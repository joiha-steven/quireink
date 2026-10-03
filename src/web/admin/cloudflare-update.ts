// A Quire Ink on Cloudflare: what Settings → Server → Cloudflare shows (G5.4) — the version, how this
// blog takes a newer one, and what it costs — and the owner check the Worker asks before it runs an
// update (`src/worker.ts` → `install/cloudflare/update.ts`).
//
// ⚠️ THE UPDATE ITSELF IS NOT HERE. Replacing the code restarts this Durable Object, so an update
// run from inside it would cut itself off; the Worker runs it, and asks this route first whether
// the request comes from the owner. That question goes through the owner gate like any other write
// (session, same-origin), which is the whole of the Worker's authority to act.
//
// Only on a Cloudflare install. A Bun install's card is the move (`cloudflare-move.ts`).
import type { Context } from 'hono'
import { readEnv } from '@/env'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { getViewTotalsSince } from '@/analytics/summary'
import { storageStats } from '@/media/storage-stats'
import { updateState } from '@/server/update-check'
import { logActivity } from '@/server/activity'
import { fail, json } from '@/web/api'
import { owner, ownerRouter, QUIET } from '@/web/guard'
import { verifyPassword } from '@/auth/password'
import { passwordHashFor } from '@/auth/users'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { APP_VERSION } from '@/version'
import { databaseBytes } from '@/runtime/impl/runtime-info'
import { listKept } from '@/runtime/impl/archive'

/** How this blog takes a newer release (`QUIREINK_UPDATES`): set by whatever deployed it. */
export type UpdatePath = 'api' | 'git' | 'cli'
const updatePath = (): UpdatePath => {
  const v = process.env.QUIREINK_UPDATES
  return v === 'api' || v === 'git' || v === 'cli' ? v : 'cli'
}

/**
 * What the month costs, from what the blog knows of itself. Workers Paid is $5 and includes 10
 * million requests, 1 million Durable Object requests, 5 GB of SQLite and 10 GB of R2 a month
 * (docs/self-host-cloudflare.md). A page view is two Worker requests (the page and its beacon) and
 * one Durable Object request; the estimate is that, and storage past what is included.
 */
export function estimateMonthly(views30: number, r2Bytes: number, dbBytes: number): { requests: number; usd: number } {
  // At least: a view is the page and its beacon, and the Worker hands EVERY request to the object,
  // so each one is a Durable Object request too. Pictures, feeds and bots come on top.
  const requests = views30 * 2
  const over = (n: number, free: number) => Math.max(0, n - free)
  const usd = 5
    + over(requests, 10e6) / 1e6 * 0.30
    + over(requests, 1e6) / 1e6 * 0.15
    + over(r2Bytes / 1e9, 10) * 0.015
    + over(dbBytes / 1e9, 5) * 0.20
  return { requests, usd: Math.round(usd * 100) / 100 }
}

export function cloudflareUpdateRoutes() {
  const router = ownerRouter()
  const here = (c: Context) => (readEnv().package !== 'cloudflare' ? fail(c, 'not_on_cloudflare', 404) : null)

  router.get('/api/cloudflare/status', async (c) => {
    const no = here(c)
    if (no) return no
    const u = updateState()
    const views30 = Object.values(await getViewTotalsSince(30)).reduce((n, v) => n + v, 0)
    const stats = await storageStats()
    // The uploads listing leaves out `private/`, where the kept backups live — each holding every
    // upload again. R2 bills them all.
    const kept = (await listKept()).reduce((n, k) => n + k.size, 0)
    const dbBytes = databaseBytes()
    return json({
      current: APP_VERSION,
      latest: u.state === 'behind' ? u.release.latest : null,
      // `unknown` is not `current` (`update-check.ts`): the check is off, has not run, or is stale.
      // The card says "newest" only for `current`, and otherwise offers to ask.
      state: u.state,
      updates: updatePath(),
      hasToken: Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID),
      siteUrl: resolveSiteUrl(await getSettings()),
      cost: { views30, r2Bytes: stats.totalBytes + kept, dbBytes, ...estimateMonthly(views30, stats.totalBytes + kept, dbBytes) },
    })
  })

  /** The Worker's question before an update: is this the owner, and what is newest? */
  router.post('/api/cloudflare/update/authorize', async (c) => {
    const no = here(c)
    if (no) return no
    if (updatePath() !== 'api') return fail(c, `updates_through_${updatePath()}`, 409)
    const u = updateState()
    void logActivity('cloudflare.update', u.state === 'behind' ? `${APP_VERSION} → ${u.release.latest}` : APP_VERSION)
    return json({ current: APP_VERSION, latest: u.state === 'behind' ? u.release.latest : null, siteUrl: resolveSiteUrl(await getSettings()) })
  }, QUIET)

  /**
   * The Worker's question before it deletes this blog from Cloudflare: the owner, their password,
   * and the blog's own address typed out. Three, because nothing is behind this — no Trash, and
   * the Durable Object's 30 days of bookmarks go with it. The archive the card offers first is the
   * only way back.
   */
  router.post('/api/cloudflare/uninstall/authorize', async (c) => {
    const no = here(c)
    if (no) return no
    const { user } = owner(c)
    if (rateLimited(`security:${clientIp(c)}`, 10, 5 * 60_000)) return fail(c, 'too_many_attempts', 429)
    const input = (await c.req.json().catch(() => ({}))) as { current?: unknown; confirm?: unknown }
    const stored = passwordHashFor(user.username)
    if (!stored || typeof input.current !== 'string' || !(await verifyPassword(stored.hash, input.current))) return fail(c, 'wrong_password', 403)
    const host = new URL(resolveSiteUrl(await getSettings())).hostname
    // The host name, however it was typed: `https://` and a trailing slash are how an address is
    // copied out of the browser, and refusing them proved only that the owner pasted it.
    const typed = typeof input.confirm === 'string' ? input.confirm.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/\/+$/, '') : ''
    if (typed !== host) return fail(c, 'confirm_mismatch', 400)
    return json({ host })
  }, QUIET)

  return router
}
