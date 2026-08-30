// POST /api/track: one page view, or one scroll-depth sample, from the reader's browser.
//
// Always answers 204, whatever happens. Analytics is best-effort by definition, and a
// beacon that can fail visibly is a beacon that can break a page load. Errors are logged
// on this side and never surfaced.
//
// No PII is stored: `recordView` keeps a salted hash of IP and user-agent, never either
// one. See `analytics/record.ts`.
//
// The owner and the machine are not readers and are not counted — session, IP, or private
// address. The rule and the reasoning are in `analytics/exclude.ts`.

import type { Context } from 'hono'
import { isCountableVisit } from '@/analytics/exclude'
import { recordScroll, recordView } from '@/analytics/record'
import { clientIp, rateLimited } from '@/server/rate-limit'

/**
 * Generous enough that a real reader never trips it (one view plus one depth sample per
 * page, plus whatever they read in a minute), tight enough that a script cannot flood
 * `analytics_events`. Over the limit is a silent drop, not an error: telling a flooder
 * they have been limited is telling them what to change.
 */
const PER_MINUTE = 240

type Payload = {
  path?: unknown; depth?: unknown; referrer?: unknown; dwell?: unknown; bytes?: unknown
  touch?: unknown
}

export async function handleTrack(c: Context): Promise<Response> {
  try {
    const body = (await c.req.json().catch(() => ({}))) as Payload
    const path = typeof body.path === 'string' ? body.path : ''
    if (!path) return c.body(null, 204)

    const ip = clientIp(c)
    if (rateLimited(`track:${ip}`, PER_MINUTE)) return c.body(null, 204)
    // Before the rate limiter's own budget is spent on it, and before anything is parsed
    // further: the owner and the box are not readers.
    if (!isCountableVisit(c, ip)) return c.body(null, 204)

    const ua = c.req.header('user-agent') ?? ''
    // Buffered in memory (Invariant 7), so neither of these touches the disk on the
    // request path and there is nothing to defer past the response.
    if (typeof body.depth === 'number') {
      const dwell = typeof body.dwell === 'number' ? body.dwell : undefined
      // What the reader's own browser says it downloaded. Clamped and sanity-checked in
      // `recordScroll`, because this route is an open POST and the number ends up in a
      // total the owner reads.
      const bytes = typeof body.bytes === 'number' ? body.bytes : undefined
      await recordScroll(path, body.depth, ip, ua, dwell, bytes)
    } else {
      // Source attribution: the referrer HOST only, sent by the beacon on session entry
      // and only when it is external, plus the country the CDN saw. Both privacy-light.
      const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 255) : ''
      const country = (c.req.header('cf-ipcountry') ?? '').trim()
      // Multi-touch, which the user agent cannot say and an iPad needs (`analytics/ua.ts`).
      // Read as a strict boolean: this is an open POST, and the flag decides a bucket.
      await recordView(path, ip, ua, referrer, country, body.touch === true)
    }
  } catch (error) {
    console.error(`[ERROR] track: ${(error as Error).message}`)
  }
  return c.body(null, 204)
}
