// The admin dashboard's whole-site figures, ported from the `analytics_summary` plpgsql
// function.
//
// The original was ONE Postgres call building a jsonb object out of a dozen scalar
// subqueries. Here it is a dozen small statements against `analytics.db`, each of which
// uses an index. 01-schema.md said a daily rollup table would be the answer past ~2 million
// rows; measured on 1,000,000 events (2026-10-03) the cost is `count(distinct visitor)`, which
// no rollup of days can answer, so the long windows are cut into pieces instead (`chunked.ts`)
// and the screens keep what they read for a minute (`memo.ts`).

import { analyticsQuery } from '@/store/query'
import { nowMs } from '@/store/db'
import { cacheStats } from '@/server/cache'
import { bucketRanges, windowStart, type Bucket } from '@/analytics/buckets'
import {
  DWELL_CAP_MS, depthBuckets, engagement, topCountries, topReferrers, transferred,
} from '@/analytics/aggregate'
import { countsIn, partsFor, pause, returningIn, seriesIn } from '@/analytics/chunked'
import { piecesIn, rankPieces, windowIn, type WindowFacts } from '@/analytics/window'
import {
  EMPTY_RIGHT_NOW, EMPTY_SUMMARY, reportTz,
  type AnalyticsSummary, type PieceStat, type RightNow, type TopPage, type YearStat,
} from '@/analytics/types'

export type { Bucket }

const { all } = analyticsQuery

/** Where a window's facts come from: read here, or the screens' minute-old copy (`memo.ts`). */
export type WindowOf = (since: number) => Promise<WindowFacts>

/**
 * Busiest pages, with their read depth and dwell.
 *
 * The original ran two correlated subqueries per returned path. Here the top N come first
 * and their engagement is fetched in one grouped read keyed by that list, which is the
 * same numbers with one round of work instead of 2N.
 *
 * Ranked from EVERY piece in the window rather than by a `limit` of its own since 2026-10-03:
 * the screen asks for all of them anyway (`getPieces`), and on 365 days of a 1,000,000-event blog
 * that one grouped read is 0.9 s, which the two used to spend twice.
 */
async function topPages(pieces: PieceStat[], since: number, limit: number): Promise<TopPage[]> {
  const pages = rankPieces(pieces, limit)
  if (pages.length === 0) return []
  await pause()
  const depth = new Map(
    all<{ path: string; depth: number | null; dwell: number | null }>(
      // The same 30-minute dwell ceiling `engagement()` applies, so a page's row in this
      // table can never disagree with the drill-down it links to.
      //
      // Both averages come back NULL for a page with no samples, and `avg(dwell_ms)` comes
      // back NULL on its own for a page whose samples all predate the dwell meter. Those
      // NULLs are carried through rather than floored to 0: see `TopPage`.
      `select path, avg(depth) as depth, avg(min(dwell_ms, $cap)) as dwell from analytics_scroll
        where created_at >= $since and path in (select value from json_each($paths))
        group by path`,
      { since, cap: DWELL_CAP_MS, paths: JSON.stringify(pages.map((p) => p.path)) },
    ).map((r) => [r.path, r]),
  )
  const round = (v: number | null | undefined) => (v == null ? null : Math.round(v))
  return pages.map((p) => ({
    path: p.path,
    views: p.views,
    visitors: p.visitors,
    avgDepth: round(depth.get(p.path)?.depth),
    avgDwellMs: round(depth.get(p.path)?.dwell),
  }))
}

/** Every read of the summary, in order, each on its own turn (`chunked.ts`). Throws. */
export async function readSummary(days: number, bucket: Bucket, topN: number, windowOf: WindowOf): Promise<AnalyticsSummary> {
  const now = Date.now()
  // Aligned to the bucket, so the chart's first column is a whole day rather than the
  // sliver of one `now - days * 86_400_000` used to leave there (see `windowStart`).
  const since = windowStart(now, days, bucket, reportTz())
  // The window just before `since`, of the SAME ELAPSED length. Not `days` again: the
  // current window ends now, part-way through today, so a full previous day-count would
  // be the longer of the two and every comparison would open showing a fall.
  const prevSince = since - (now - since)

  const current = await countsIn(since, null)
  const previous = await countsIn(prevSince, since)
  await pause()
  const { avgReadDepth, avgDwellMs } = engagement(since, null)
  const facts = await windowOf(since)

  return {
    totalViews: current.views,
    uniqueVisitors: current.visitors,
    avgReadDepth,
    avgDwellMs,
    singlePageVisitors: facts.singlePage,
    topPages: await topPages(facts.pieces, since, topN),
    daily: await seriesIn(bucketRanges(since, now, bucket, reportTz())),
    prevViews: previous.views,
    prevVisitors: previous.visitors,
    returningVisitors: await returningIn(since),
    topReferrers: facts.referrers.slice(0, topN),
    topCountries: facts.countries.slice(0, topN),
    channels: facts.channels,
    devices: facts.devices.slice(0, topN),
    browsers: facts.browsers.slice(0, topN),
    systems: facts.systems.slice(0, topN),
    depthBuckets: await pause().then(() => depthBuckets(since, null)),
    transfer: await pause().then(() => transferred(since, null)),
    // Not windowed like everything above it: the counters live in this process and start
    // at boot, so they answer "is the cache working" and not "how did last month go".
    cache: { ...cacheStats },
  }
}

/**
 * Aggregated stats for the last `days` days. `bucket` controls the chart grain (hour for
 * 24h, day for a week/month, month for a year). Empty on failure: the dashboard degrades
 * to zeroes rather than erroring, as it did before.
 *
 * Read fresh on every call. The screens go through `memo.ts`, which keeps a minute.
 */
export async function getAnalytics(days: number, bucket: Bucket = 'day', topN = 10): Promise<AnalyticsSummary> {
  try {
    return await readSummary(days, bucket, topN, windowIn)
  } catch (error) {
    console.error(`[ERROR] analytics.getAnalytics: ${(error as Error).message}`)
    return EMPTY_SUMMARY
  }
}

/** The first instant of a window, as `getAnalytics` and `getPieces` both draw it. */
export const sinceOf = (days: number, bucket: Bucket): number =>
  windowStart(Date.now(), days, bucket, reportTz())

/**
 * Every path read in the window, on the SAME window boundary the rest of the screen uses.
 *
 * A separate call rather than a field on `AnalyticsSummary`: the dashboard and the front
 * page both read that shape and neither wants a row per path. It is one grouped scan of the
 * index the summary already walks.
 *
 * The alignment is the whole reason this lives here instead of in the view. `windowStart`
 * is what makes a chart column a whole day; a list built from `now - days * 86_400_000`
 * would silently disagree with the table above it about which day the window opens on, and
 * two tables on one screen giving different numbers for the same piece is worse than not
 * having the second one.
 */
export async function getPieces(days: number, bucket: Bucket = 'day'): Promise<PieceStat[]> {
  try {
    return await piecesIn(sinceOf(days, bucket))
  } catch (error) {
    console.error(`[ERROR] analytics.getPieces: ${(error as Error).message}`)
    return []
  }
}

export type DashboardTraffic = {
  totalViews: number
  uniqueVisitors: number
  avgReadDepth: number
  avgDwellMs: number
  daily: Awaited<ReturnType<typeof seriesIn>>
  topReferrers: WindowFacts['referrers']
  topCountries: WindowFacts['countries']
}

/** Every read of the dashboard's traffic card. Throws; `getDashboardTraffic` cannot. */
export async function readDashboardTraffic(days: number, topN: number, windowOf: WindowOf): Promise<DashboardTraffic> {
  const now = Date.now()
  const since = windowStart(now, days, 'day', reportTz())
  const current = await countsIn(since, null)
  await pause()
  const { avgReadDepth, avgDwellMs } = engagement(since, null)
  // Two questions of a window, so a small one asks them as the two statements they are. A window
  // big enough to be cut is read once for all eight (`window.ts`) — cheaper than two passes of
  // the cut, and on the screens the same read the analytics page's 30 days makes (`memo.ts`).
  const cut = partsFor(since, null).length > 0
  const facts = cut ? await windowOf(since) : null
  return {
    totalViews: current.views,
    uniqueVisitors: current.visitors,
    avgReadDepth,
    avgDwellMs,
    daily: await seriesIn(bucketRanges(since, now, 'day', reportTz())),
    topReferrers: facts ? facts.referrers.slice(0, topN) : await pause().then(() => topReferrers(since, topN, null)),
    topCountries: facts ? facts.countries.slice(0, topN) : await pause().then(() => topCountries(since, topN, null)),
  }
}

/**
 * The figures the DASHBOARD shows, and only those.
 *
 * The dashboard used to call `getAnalytics(30)` and throw ten of its fifteen fields away.
 * Measured against 40,000 events that cost 70ms of the dashboard's 85ms, for a card with a
 * sparkline, two totals and two short lists on it. The Analytics PAGE still calls
 * `getAnalytics`, because it renders all fifteen.
 *
 * ⚠️ Engagement joined the list on 2026-08-17 (ADR 0024 step 6) — two more numbers, one more
 * query, and it is the query the home screen exists to ask now that the rail no longer offers
 * an Analytics door. `engagement` is one aggregate over `analytics_scroll` in the same window
 * the rest of this function already scans; it is not a second `getAnalytics` creeping back.
 */
export async function getDashboardTraffic(days: number, topN = 10): Promise<DashboardTraffic> {
  try {
    return await readDashboardTraffic(days, topN, windowIn)
  } catch (error) {
    console.error(`[ERROR] analytics.getDashboardTraffic: ${(error as Error).message}`)
    return EMPTY_TRAFFIC
  }
}

export const EMPTY_TRAFFIC: DashboardTraffic = {
  totalViews: 0, uniqueVisitors: 0, avgReadDepth: 0, avgDwellMs: 0, daily: [], topReferrers: [], topCountries: [],
}

/**
 * Who is reading RIGHT NOW: distinct visitors over the trailing five minutes, and the
 * pages they are on. This is the one read whose freshness matters more than its window —
 * the flush buffer holds writes for at most two seconds, so the number is honest to within
 * a breath of real time, with no live socket and no second pipeline: the same table, asked
 * a smaller question. The admin polls it; the poll is one indexed range scan over five
 * minutes of rows, which is why polling it every few seconds costs nothing worth naming.
 */
export async function getRightNow(topN = 5): Promise<RightNow> {
  try {
    // Bounded on BOTH sides. The server stamps every real row itself, so a future row can
    // only be seeded or imported — and the first fixture that made one put 23 phantom
    // readers on the live strip. "Right now" must never count a timestamp that has not
    // happened yet.
    const now = nowMs()
    const since = now - 5 * 60_000
    const visitors = all<{ n: number }>(
      `select count(distinct visitor) as n from analytics_events
        where created_at >= $since and created_at <= $now`,
      { since, now },
    )[0]?.n ?? 0
    if (visitors === 0) return EMPTY_RIGHT_NOW
    const pages = all<{ path: string; visitors: number }>(
      `select path, count(distinct visitor) as visitors from analytics_events
        where created_at >= $since and created_at <= $now
        group by path order by visitors desc, path limit $topN`,
      { since, now, topN },
    )
    return { visitors, pages }
  } catch (error) {
    console.error(`[ERROR] analytics.getRightNow: ${(error as Error).message}`)
    return EMPTY_RIGHT_NOW
  }
}

/** All-time total views per path (`{ "/slug": 12, … }`) for the content tables. */
/** When the first event was recorded, or null on an install that has never been visited. */
export function firstEventAt(): number | null {
  try {
    return all<{ at: number | null }>(
      'select min(created_at) as at from analytics_events',
    )[0]?.at ?? null
  } catch (error) {
    console.error(`[ERROR] analytics.firstEventAt: ${(error as Error).message}`)
    return null
  }
}

/**
 * Every calendar year that has data, oldest first, in the site's timezone.
 *
 * Built by FOLDING the month buckets rather than by a new `group by`, and that is the
 * point: `bucketRanges` already knows how to turn an instant into a wall-clock month in an
 * IANA zone, and `windowCounts` is the same counter the headline figures use. A hand-rolled
 * `strftime('%Y', created_at)` would have been shorter and would have grouped in UTC, which
 * on a UTC+7 blog files the first seven hours of every January into the year before.
 *
 * The first month range is clamped to the first event, so the earliest year counts from the
 * day the blog started rather than from a January that has nothing in it.
 *
 * Each year is its own window (`countsIn`), cut by visitor when it is big: a busy year is the
 * whole 365-day question again, 0.4 s in one statement on 1,000,000 events.
 */
export async function readYears(): Promise<YearStat[]> {
  const first = firstEventAt()
  if (first === null) return []
  const spans = new Map<string, { lo: number; hi: number }>()
  for (const m of bucketRanges(first, Date.now(), 'month', reportTz())) {
    const year = m.label.slice(0, 4)
    const seen = spans.get(year)
    if (seen) seen.hi = m.hi
    else spans.set(year, { lo: m.lo, hi: m.hi })
  }
  const out: YearStat[] = []
  for (const [year, span] of spans) out.push({ year, ...await countsIn(span.lo, span.hi) })
  return out
}

export async function yearTotals(): Promise<YearStat[]> {
  try {
    return await readYears()
  } catch (error) {
    console.error(`[ERROR] analytics.yearTotals: ${(error as Error).message}`)
    return []
  }
}

/**
 * The same totals, for the surface that asks for them on almost every request.
 *
 * `getViewTotals` is a GROUP BY over a table nothing ever deletes from, and the public
 * sidebar asks for it on every uncached listing render, every `/search` (never cached by
 * design) and every 404 (never cached either, so a bot walking dead URLs pays for a full
 * scan per miss). A year of traffic makes that tens of milliseconds of single-threaded CPU
 * that nothing is waiting on.
 *
 * A minute of staleness, because the block it feeds is "most viewed of all time" and the
 * ranking of an all-time list does not move inside a minute. The content tables' Views column
 * stays exact; the dashboard's top posts read this since 2026-10-03, beside a traffic card that
 * is a minute old too (`memo.ts`).
 */
const VIEW_TOTALS_TTL_MS = 60_000
let viewTotalsAt = 0
let viewTotalsValue: Record<string, number> = {}

export async function getViewTotalsCached(): Promise<Record<string, number>> {
  const now = Date.now()
  if (now - viewTotalsAt < VIEW_TOTALS_TTL_MS) return viewTotalsValue
  viewTotalsValue = await getViewTotals()
  viewTotalsAt = now
  return viewTotalsValue
}

/** Through `resetAnalyticsCaches` (memo.ts), which empties everything kept over these tables. */
export function resetViewTotalsCache(): void {
  viewTotalsAt = 0
  viewTotalsValue = {}
}

export async function getViewTotals(): Promise<Record<string, number>> {
  try {
    const out: Record<string, number> = {}
    for (const r of all<{ path: string; c: number }>(
      `select path, count(*) as c from analytics_events group by path`,
    )) {
      out[r.path] = r.c
    }
    return out
  } catch (error) {
    console.error(`[ERROR] analytics.getViewTotals: ${(error as Error).message}`)
    return {}
  }
}

/**
 * The same totals over a trailing window.
 *
 * All-time is the wrong measure for a front page: on a blog that has been running a while,
 * the top of an all-time list is whatever went viral once and it never moves again, which
 * is the opposite of what a "popular now" row is for. A window lets the row change without
 * the owner writing anything (ADR 0014).
 *
 * `days <= 0` means all time and skips the filter entirely rather than computing a bound.
 */
export async function getViewTotalsSince(days: number): Promise<Record<string, number>> {
  if (days <= 0) return getViewTotals()
  try {
    const out: Record<string, number> = {}
    const since = nowMs() - days * 24 * 60 * 60 * 1000
    for (const r of all<{ path: string; c: number }>(
      // `+path`: see `topPages` — the range index, not a walk of every event ever recorded.
      `select path, count(*) as c from analytics_events where created_at >= ? group by +path`,
      since,
    )) {
      out[r.path] = r.c
    }
    return out
  } catch (error) {
    // A front page that loses one row is a front page; a 500 is not. Same contract as the
    // all-time version above, which the sidebar has relied on since it shipped.
    console.error(`[ERROR] analytics.getViewTotalsSince: ${(error as Error).message}`)
    return {}
  }
}
