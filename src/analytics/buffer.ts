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
  visitor: string
  createdAt: number
}

const FLUSH_MS = 2_000
const MAX_ROWS = 200

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
  if (events.length + scrolls.length >= MAX_ROWS) flushAnalytics()
  else schedule()
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
        analyticsQuery.run(
          `insert into analytics_scroll (path, depth, dwell_ms, visitor, created_at)
           values ($path, $depth, $dwellMs, $visitor, $createdAt)`,
          { path: r.path, depth: r.depth, dwellMs: r.dwellMs, visitor: r.visitor, createdAt: r.createdAt },
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
