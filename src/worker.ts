// Quire Ink on Cloudflare (ADR 0066). The Worker forwards every request to ONE Durable Object, the
// blog, which plays the part the Bun process plays in `src/runtime/bun/main.ts`: it opens the
// databases (its own SQLite), builds the same Hono app, and keeps the blog's clock with an alarm
// instead of a timer. Everything that differs from Bun lives in `src/runtime/cf/`.
//
// A Worker only forwards, so it spends well under a millisecond of CPU; the work happens in the
// object, which has 30 seconds per request. That split is what Workers Paid is priced for.
import { DurableObject } from 'cloudflare:workers'
import { bind, type CfEnv } from '@/runtime/cf/bindings'
import { rememberBookmark } from '@/runtime/cf/snapshot'
import { readEnv } from '@/env'
import { openDatabases } from '@/store/db'
import { createApp } from '@/web/app'
import { getSettings, resolveSiteUrl, siteUrlIsUnset } from '@/content/settings'
import { settleExcerptKinds, settleReadingMinutes } from '@/content/settle'
import { noUsersYet } from '@/auth/users'
import { setupBanner } from '@/web/setup-routes'
import { flushAnalytics } from '@/analytics/buffer'
import { fullTick, publishTick } from '@/server/tick'
import { APP_VERSION } from '@/version'
import { newestRelease, updateSelf } from '@/install/cloudflare/update'
import { CloudflareApi } from '@/install/cloudflare/api'
import { isNewer } from '@/server/update-check'

/** Due posts every minute and housekeeping every hour: the clock Bun's `startClock` keeps (ADR 0031). */
const MINUTE = 60_000
const HOUR = 60 * MINUTE

export class Blog extends DurableObject<CfEnv> {
  private app: ReturnType<typeof createApp> | null = null
  private booting: Promise<void> | null = null
  private lastFullTick = 0

  constructor(ctx: DurableObjectState, env: CfEnv) {
    super(ctx, env)
    bind(env, ctx)
  }

  /**
   * Once per object, before the first request is served. A bookmark first — the Cloudflare form of
   * ADR 0063's copy before a migration — then the same steps as Bun's boot. Lazy rather than in the
   * constructor, because a constructor cannot await and a failure in `blockConcurrencyWhile` resets
   * the object, which is the right answer to a boot that failed.
   */
  private boot(): Promise<void> {
    this.booting ??= this.ctx.blockConcurrencyWhile(async () => {
      rememberBookmark(await this.ctx.storage.getCurrentBookmark())
      openDatabases(readEnv().dataDir)
      this.app = createApp()
      const settings = await getSettings()
      settleExcerptKinds(settings.excerptLength)
      settleReadingMinutes()
      console.log(`quire ${APP_VERSION} on Cloudflare`)
      if (noUsersYet()) console.log(setupBanner(siteUrlIsUnset(settings) ? 'this blog\'s address' : resolveSiteUrl(settings)))
      if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + MINUTE)
    })
    return this.booting
  }

  override async fetch(request: Request): Promise<Response> {
    await this.boot()
    return this.app!.fetch(request)
  }

  override async alarm(): Promise<void> {
    await this.boot()
    try {
      if (Date.now() - this.lastFullTick >= HOUR) {
        this.lastFullTick = Date.now()
        await fullTick()
      } else {
        await publishTick()
      }
      flushAnalytics()
    } finally {
      await this.ctx.storage.setAlarm(Date.now() + MINUTE)
    }
  }
}

/**
 * The one-click update (G5.4), run HERE and not in the object: replacing the code restarts the
 * object, and an update running inside it would cut itself off halfway. This request finishes on
 * the version it started on. The object is asked first, through its owner gate, whether the request
 * is the owner's (`web/admin/cloudflare-update.ts`); that answer is the only authority this acts on.
 */
async function update(request: Request, env: CfEnv, blog: DurableObjectStub): Promise<Response> {
  const input = (await request.json().catch(() => ({}))) as { target?: unknown; token?: unknown; accountId?: unknown }
  const headers = new Headers(request.headers)
  headers.set('content-type', 'application/json')
  const asked = await blog.fetch(new Request(new URL('/api/cloudflare/update/authorize', request.url), { method: 'POST', headers, body: '{}' }))
  if (!asked.ok) return asked
  const { data } = (await asked.json()) as { data: { current: string; latest: string | null; siteUrl: string } }
  const say = (error: string, status: number) => Response.json({ success: false, error }, { status })
  const wanted = typeof input.target === 'string' && /^\d+\.\d+\.\d+$/.test(input.target) ? input.target : null
  const target = wanted ?? data.latest ?? await newestRelease()
  if (!target || !isNewer(target, data.current)) return say('already_newest', 409)
  const token = env.CLOUDFLARE_API_TOKEN || (typeof input.token === 'string' ? input.token.trim() : '')
  const accountId = env.CLOUDFLARE_ACCOUNT_ID || (typeof input.accountId === 'string' ? input.accountId.trim() : '')
  if (!token || !accountId) return say('token_required', 400)
  if (!env.QUIREINK_SCRIPT || !env.QUIREINK_BUCKET) return say('not_installed_by_api', 409)
  try {
    const result = await updateSelf({
      token, accountId, scriptName: env.QUIREINK_SCRIPT, bucket: env.QUIREINK_BUCKET,
      siteUrl: data.siteUrl || new URL(request.url).origin, target,
    })
    return Response.json({ success: !result.error, data: result, ...(result.error ? { error: result.error } : {}) })
  } catch (error) {
    return say((error as Error).message, 502)
  }
}

/**
 * Delete this blog from Cloudflare (G5.4): its uploads and backups, its bucket, then the Worker and
 * with it the Durable Object and its database. Here and not in the object for the same reason as
 * the update, and only after the object has checked the owner, their password and the blog's
 * address typed out (`/api/cloudflare/uninstall/authorize`). The uploads go through the binding —
 * a thousand keys a call — rather than one API call each; the bucket and the Worker through the API.
 */
async function uninstall(request: Request, env: CfEnv, blog: DurableObjectStub): Promise<Response> {
  const raw = await request.text()
  const input = (JSON.parse(raw || '{}') ?? {}) as { token?: unknown; accountId?: unknown }
  const headers = new Headers(request.headers)
  headers.set('content-type', 'application/json')
  const asked = await blog.fetch(new Request(new URL('/api/cloudflare/uninstall/authorize', request.url), { method: 'POST', headers, body: raw || '{}' }))
  if (!asked.ok) return asked
  const say = (error: string, status: number) => Response.json({ success: false, error }, { status })
  const token = env.CLOUDFLARE_API_TOKEN || (typeof input.token === 'string' ? input.token.trim() : '')
  const accountId = env.CLOUDFLARE_ACCOUNT_ID || (typeof input.accountId === 'string' ? input.accountId.trim() : '')
  if (!token || !accountId) return say('token_required', 400)
  if (!env.QUIREINK_SCRIPT || !env.QUIREINK_BUCKET) return say('not_installed_by_api', 409)
  try {
    for (;;) {
      const page = await env.BLOBS.list({ limit: 1000 })
      if (page.objects.length === 0) break
      await env.BLOBS.delete(page.objects.map((o) => o.key))
    }
    const api = new CloudflareApi(token, accountId)
    await api.call('bucket', `/accounts/:account/r2/buckets/${env.QUIREINK_BUCKET}`, { method: 'DELETE' }).catch(() => undefined)
    await api.call('worker', `/accounts/:account/workers/scripts/${env.QUIREINK_SCRIPT}?force=true`, { method: 'DELETE' })
    return Response.json({ success: true, data: { deleted: env.QUIREINK_SCRIPT } })
  } catch (error) {
    return say((error as Error).message, 502)
  }
}

export default {
  fetch(request: Request, env: CfEnv): Promise<Response> {
    const blog = env.BLOG.get(env.BLOG.idFromName('blog'))
    const path = new URL(request.url).pathname
    if (request.method === 'POST' && path === '/api/cloudflare/update') return update(request, env, blog)
    if (request.method === 'POST' && path === '/api/cloudflare/uninstall') return uninstall(request, env, blog)
    return blog.fetch(request)
  },
} satisfies ExportedHandler<CfEnv>
