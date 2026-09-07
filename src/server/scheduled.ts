// Scheduled publishing sweep.
//
// A post saved with status 'published' and a FUTURE date is already hidden by the read
// layer (`isPublicallyVisible`) — no separate 'scheduled' status exists. What still needs
// a nudge is the caches in front of it: the in-process page cache, and any 404 the edge
// (Cloudflare) cached for the not-yet-live URL. This sweep, run by the cron, detects posts
// that crossed their scheduled time within a bounded lookback window and flushes both.
//
// The window is derived from the cron cadence (no watermark stored): the 5-min publish
// tick sweeps the last ~6 min, the hourly maintenance tick sweeps the last ~65 min as a
// backstop. Overlap is harmless — a flush is an idempotent superset (Invariant 1). A tick
// that is down during a crossing is covered by the hourly backstop.
//
// The frozen tree also RE-WARMED the origin here, because Next's ISR cache was on disk and
// a cold render cost a visitor real time. There is nothing to warm now: the cache is an
// in-process Map and a miss is a sub-millisecond SQLite read plus a render.

import { clearCache } from '@/server/cache'
import { purgeEdge } from '@/server/edge-cache'
import { all } from '@/store/query'
import { liveOnly } from '@/store/db'

// The FLOOR on each window, not the window itself: `sweepScheduled` starts where the last
// sweep ended and only falls back to these on the first run after a boot. Wider than each
// cadence so a restart between two ticks cannot drop a crossing.
export const PUBLISH_TICK_LOOKBACK_MS = 6 * 60 * 1000 // the minute tick, with room for a restart
export const HOURLY_LOOKBACK_MS = 65 * 60 * 1000 // hourly backstop + 5 min slack

type Crossable = { slug: string; date: string; status: string }

// Pure: which published posts crossed from future into live within (since, now].
// The single source of "did it go live" truth — DB-windowed reads only optimize this.
export function newlyLive(posts: Crossable[], since: number, now: number): string[] {
  return posts
    .filter((p) => p.status === 'published')
    .filter((p) => {
      const t = new Date(p.date).getTime()
      return !Number.isNaN(t) && t > since && t <= now
    })
    .map((p) => p.slug)
}

/**
 * Where the last sweep stopped looking. Module state, so it resets on a restart and the
 * lookback below is what covers the gap.
 */
let lastSweepAt = 0

/** Only for tests: forget where the last sweep stopped. */
export function resetSweepWindow(): void {
  lastSweepAt = 0
}

/**
 * Find posts that just became live and, if any, flush the caches. Returns how many crossed
 * (0 = nothing to do, no flush). The caller (cron) isolates it so a sweep failure can't
 * skip other maintenance.
 *
 * THE WINDOW STARTS WHERE THE LAST ONE ENDED, and the fixed lookback is only the floor.
 * A fixed window is wrong once the tick is faster than the window: the minute tick runs
 * with a six-minute lookback, so an ordinary publish (whose date is now) sat inside it for
 * six consecutive ticks and answered "newly live" every time. Each of those calls flushed
 * the page cache and asked the CDN to purge, so one post cost six stop-the-world warms and
 * a burst of purges the edge rate-limits. Crossing is a one-time event and now reports as
 * one.
 */
export async function sweepScheduled(lookbackMs: number): Promise<number> {
  const now = Date.now()
  const since = Math.max(now - lookbackMs, lastSweepAt)
  lastSweepAt = now
  const rows = all<{ slug: string; date: number; status: string }>(
    `select slug, date, status from posts
      where ${liveOnly('posts')} and status = 'published' and date > ? and date <= ?`,
    since, now,
  )
  // `newlyLive` still takes ISO strings: it is the pure, tested definition of "went live",
  // and the window query is an optimisation on top of it rather than a replacement.
  const crossed = newlyLive(
    rows.map((r) => ({ slug: r.slug, date: new Date(r.date).toISOString(), status: r.status })),
    since, now,
  )
  if (crossed.length > 0) {
    clearCache()
    await purgeEdge()
  }
  return crossed.length
}
