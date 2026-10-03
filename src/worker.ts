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

export default {
  fetch(request: Request, env: CfEnv): Promise<Response> {
    return env.BLOG.get(env.BLOG.idFromName('blog')).fetch(request)
  },
} satisfies ExportedHandler<CfEnv>
