// What the owner's analytics screens read, kept for a minute.
//
// The screens are the only callers that ask the expensive questions, and they ask the SAME ones
// again and again: switching between two tabs of the range strip, going back from a drill-down,
// the dashboard after every save that lands on it. On a 1,000,000-event blog (2026-10-03) the
// 365-day screen was about 10 s of statements and the dashboard 0.2 s, each paid in full every
// time. A minute is what the numbers can afford to be late: the shortest window any of them
// covers is a day, the busiest-pages table and its chart do not move in a minute, and the one
// number on the screen that is about NOW — who is reading this minute — is not kept here at all
// (`getRightNow`, read fresh on every poll).
//
// The exact reads stay exact: `getAnalytics` and its siblings in summary.ts read the database on
// every call, which is what the tests and the MCP's own `days` argument are owed. This file is
// the screens' door to them.
//
// Bounded twice: entries live `TTL_MS` and there are at most `MAX_ENTRIES` of them, the oldest
// used going first. The largest value is the every-piece list, one row per path read in the
// window — a few hundred kilobytes on a blog with thousands of posts — so the ceiling is a few
// megabytes however many ranges and drill-downs one owner opens.
//
// A read in flight is shared: two tabs asking for 365 days at once start ONE pass over the
// table, not two. A read that throws is forgotten at once rather than kept as a minute of
// zeroes, and `resetAnalyticsCaches` empties everything whenever the tables under it are
// replaced (a backup loaded into the blog, a test's fresh database).

import { cacheStats } from '@/server/cache'
import type { Bucket } from '@/analytics/buckets'
import { windowIn, type WindowFacts } from '@/analytics/window'
import { readPage } from '@/analytics/page'
import {
  EMPTY_TRAFFIC, readDashboardTraffic, readSummary, readYears, resetViewTotalsCache, sinceOf,
  type DashboardTraffic,
} from '@/analytics/summary'
import {
  EMPTY_PAGE, EMPTY_SUMMARY, reportTz,
  type AnalyticsSummary, type PageSummary, type PieceStat, type YearStat,
} from '@/analytics/types'

const TTL_MS = 60_000
const MAX_ENTRIES = 32

type Entry = { at: number; value: Promise<unknown> }
const entries = new Map<string, Entry>()

/** The value under `key` if it is under a minute old, else `read()`'s, kept. */
function remembered<T>(key: readonly (string | number)[], read: () => Promise<T>): Promise<T> {
  const k = JSON.stringify(key)
  const now = Date.now()
  const hit = entries.get(k)
  if (hit && now - hit.at < TTL_MS) {
    // Re-inserted, so a Map's insertion order is its use order and the first key is the coldest.
    entries.delete(k)
    entries.set(k, hit)
    return hit.value as Promise<T>
  }
  const entry: Entry = { at: now, value: read() }
  entries.set(k, entry)
  entry.value.catch(() => { if (entries.get(k) === entry) entries.delete(k) })
  for (const [key, e] of entries) if (now - e.at >= TTL_MS) entries.delete(key)
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!)
  return entry.value as Promise<T>
}

/**
 * Everything kept here, and the sidebar's view totals with it. Called whenever the analytics
 * tables are emptied or replaced under a running blog: `load-backup.ts` after a backup is loaded
 * or a failed load is undone, and every test's `freshDatabase`.
 */
export function resetAnalyticsCaches(): void {
  entries.clear()
  resetViewTotalsCache()
}

/** How many reads are kept. For the test that holds the bound. */
export const keptReads = (): number => entries.size

const logged = <T>(what: string, empty: T) => (error: unknown): T => {
  console.error(`[ERROR] analytics.${what}: ${(error as Error).message}`)
  return empty
}

/**
 * Who read in a window (`window.ts`), keyed by the instant it starts. The summary, the list of
 * every piece and the dashboard's 30 days all read the same window of the same rows, so one load
 * of the screen reads it once — the busiest pages are ranked from the list the screen is handed.
 */
const windowSince = (since: number): Promise<WindowFacts> => remembered(['window', since], () => windowIn(since))

export async function getAnalyticsCached(days: number, bucket: Bucket = 'day', topN = 10): Promise<AnalyticsSummary> {
  const kept = await remembered(['summary', days, bucket, topN, reportTz()], () => readSummary(days, bucket, topN, windowSince))
    .catch(logged('getAnalytics', EMPTY_SUMMARY))
  // The page cache's counters are the process's own and not a window's: always today's.
  return { ...kept, cache: { ...cacheStats } }
}

export function getPiecesCached(days: number, bucket: Bucket = 'day'): Promise<PieceStat[]> {
  return windowSince(sinceOf(days, bucket)).then((w) => w.pieces).catch(logged('getPieces', [] as PieceStat[]))
}

export function yearTotalsCached(): Promise<YearStat[]> {
  return remembered(['years', reportTz()], readYears).catch(logged('yearTotals', [] as YearStat[]))
}

export function getPageAnalyticsCached(path: string, days: number, bucket: Bucket = 'day'): Promise<PageSummary> {
  return remembered(['page', path, days, bucket, reportTz()], () => readPage(path, days, bucket))
    .catch(logged('getPageAnalytics', EMPTY_PAGE(path)))
}

export function getDashboardTrafficCached(days: number, topN = 10): Promise<DashboardTraffic> {
  return remembered(['dashboard', days, topN, reportTz()], () => readDashboardTraffic(days, topN, windowSince))
    .catch(logged('getDashboardTraffic', EMPTY_TRAFFIC))
}
