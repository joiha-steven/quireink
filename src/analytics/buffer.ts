// Invariant 7: analytics writes go through this buffer, never straight from a handler.
//
// A pageview is the highest-frequency write in the system and the least valuable one.
// Buffering means a burst of readers costs one transaction instead of one per view, and
// it keeps the analytics file's fsync pattern away from the request path entirely.
//
// The cost, stated plainly: rows still in the buffer are lost if the process dies. That is
// the accepted trade for analytics and NOTHING else in the codebase may use this path.

import { analyticsQuery } from '@/store/query'

export type EventRow = {
  path: string
  visitor: string
  referrerHost: string | null
  country: string | null
  device: string | null
  browser: string | null
  os: string | null
  createdAt: number
}

export type ScrollRow = {
  path: string
  depth: number
  dwellMs: number | null
  /** Bytes the reader's browser reported for this visit. NULL = not measured, never 0. */
  bytes: number | null
  visitor: string
  createdAt: number
}

const FLUSH_MS = 2_000
const MAX_ROWS = 200

/**
 * How long one reader on one page stays ONE visit.
 *
 * The beacon sends a leave sample every time the tab is hidden and re-arms when it comes
 * back (`assets/js/track.ts`), so a reader who switches app twice sends three samples for
 * a single reading. Each carries the visit so far — deepest point, engaged total — and the
 * later ones supersede the earlier, so the row is updated rather than joined by a second.
 * Half an hour is the same line `DWELL_CAP_MS` draws under a dwell: past it, a sample on
 * the same page is a return, not the same sitting.
 */
export const SAME_VISIT_MS = 30 * 60_000

let events: EventRow[] = []
let scrolls: ScrollRow[] = []
let timer: ReturnType<typeof setTimeout> | null = null

function schedule(): void {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    flushAnalytics()
  }, FLUSH_MS)
  // Do not hold the process open for a pending flush; shutdown calls flushAnalytics().
  timer.unref?.()
}

function enqueue(): void {
  // A FULL BUFFER STILL DOES NOT FLUSH HERE. This runs inside `/api/track`, and calling
  // `flushAnalytics` from it put a 200-row transaction and its fsync in front of one
  // reader's beacon in every two hundred — which is precisely what Invariant 7 says the
  // buffer exists to prevent. A zero-delay timer is the next macrotask instead: the same
  // flush, off the request.
  if (events.length + scrolls.length >= MAX_ROWS) {
    // The waiting timer is the SLOW one this is overtaking, so it has to go: leaving it in
    // place meant the full-buffer case simply waited out the ordinary delay.
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; flushAnalytics() }, 0)
    timer.unref?.()
    return
  }
  schedule()
}

export function bufferEvent(row: EventRow): void {
  events.push(row)
  enqueue()
}

export function bufferScroll(row: ScrollRow): void {
  scrolls.push(row)
  enqueue()
}

/**
 * Write everything buffered, in one transaction. Called on the interval, when the buffer
 * fills, at shutdown, and by tests that need the rows to exist now.
 *
 * Never throws. The batch is taken off the buffer BEFORE the write, so a failing insert
 * costs those rows rather than retrying them forever behind every later pageview.
 */
export function flushAnalytics(): void {
  if (events.length === 0 && scrolls.length === 0) return
  const e = events
  const s = scrolls
  events = []
  scrolls = []
  try {
    analyticsQuery.tx(() => {
      for (const r of e) {
        analyticsQuery.run(
          `insert into analytics_events (path, visitor, referrer_host, country, device, browser, os, created_at)
           values ($path, $visitor, $referrerHost, $country, $device, $browser, $os, $createdAt)`,
          { ...r },
        )
      }
      for (const r of s) {
        // One statement pair: the most recent row for this reader and page inside the
        // window takes the new sample, and only when there is none is one inserted. Depth
        // keeps its maximum; dwell and bytes are totals the browser accumulated, so the
        // later value replaces the earlier — unless it is NULL, which means unmeasured
        // and must not erase a measurement.
        const merged = analyticsQuery.run(
          `update analytics_scroll
              set depth = max(depth, $depth),
                  dwell_ms = coalesce($dwellMs, dwell_ms),
                  bytes = coalesce($bytes, bytes)
            where id = (select id from analytics_scroll
                         where created_at >= $from and visitor = $visitor and path = $path
                         order by created_at desc limit 1)`,
          { depth: r.depth, dwellMs: r.dwellMs, bytes: r.bytes,
            from: r.createdAt - SAME_VISIT_MS, visitor: r.visitor, path: r.path },
        ).changes
        if (merged > 0) continue
        analyticsQuery.run(
          `insert into analytics_scroll (path, depth, dwell_ms, bytes, visitor, created_at)
           values ($path, $depth, $dwellMs, $bytes, $visitor, $createdAt)`,
          { path: r.path, depth: r.depth, dwellMs: r.dwellMs, bytes: r.bytes,
            visitor: r.visitor, createdAt: r.createdAt },
        )
      }
    })
  } catch (error) {
    console.error(`[ERROR] analytics.flush: ${(error as Error).message} (${e.length + s.length} rows dropped)`)
  }
}

/** Test/shutdown helper: forget anything pending without writing it. */
export function resetAnalyticsBuffer(): void {
  events = []
  scrolls = []
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

export const pendingAnalytics = (): number => events.length + scrolls.length
