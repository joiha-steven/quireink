// The admin dashboard's whole-site figures, ported from the `analytics_summary` plpgsql
// function.
//
// The original was ONE Postgres call building a jsonb object out of a dozen scalar
// subqueries. Here it is a dozen small statements against `analytics.db`, each of which
// uses an index. That is fine at the present volume and is the shape 01-schema.md chose;
// if `analytics_events` ever passes ~2 million rows and this takes more than 300 ms, the
// answer is a daily rollup table maintained by the flush, not a cleverer query.

import { analyticsQuery } from '@/store/query'
import { nowMs } from '@/store/db'
import { cacheStats } from '@/server/cache'
import { bucketRanges, windowStart, type Bucket } from '@/analytics/buckets'
import {
  DWELL_CAP_MS, channels, dailySeries, depthBuckets, engagement, facet, topCountries,
  topReferrers, windowCounts, transferred,
} from '@/analytics/aggregate'
import {
  EMPTY_RIGHT_NOW, EMPTY_SUMMARY, reportTz,
  type AnalyticsSummary, type RightNow, type TopPage,
} from '@/analytics/types'

export type { Bucket }

const { all } = analyticsQuery

/** Visitors who viewed exactly one page in the window (a bounce-ish signal). */
function singlePageVisitors(since: number): number {
  return all<{ n: number }>(
    `select count(*) as n from (
       select visitor from analytics_events where created_at >= $since
        group by visitor having count(*) = 1)`,
    { since },
  )[0]?.n ?? 0
}

/** Visitors in the window who had also been seen before it. */
function returningVisitors(since: number): number {
  return all<{ n: number }>(
    `select count(distinct e.visitor) as n from analytics_events e
      where e.created_at >= $since
        and exists (select 1 from analytics_events p
                     where p.visitor = e.visitor and p.created_at < $since)`,
    { since },
  )[0]?.n ?? 0
}

/**
 * Busiest pages, with their read depth and dwell.
 *
 * The original ran two correlated subqueries per returned path. Here the top N come first
 * and their engagement is fetched in one grouped read keyed by that list, which is the
 * same numbers with one round of work instead of 2N.
 */
function topPages(since: number, limit: number): TopPage[] {
  const pages = all<{ path: string; views: number; visitors: number }>(
    `select path, count(*) as views, count(distinct visitor) as visitors from analytics_events
      where created_at >= $since group by path order by views desc limit $limit`,
    { since, limit },
  )
  if (pages.length === 0) return []
  const depth = new Map(
    all<{ path: string; depth: number | null; dwell: number | null }>(
      // The same 30-minute dwell ceiling `engagement()` applies, so a page's row in this
      // table can never disagree with the drill-down it links to.
      `select path, avg(depth) as depth, avg(min(dwell_ms, $cap)) as dwell from analytics_scroll
        where created_at >= $since and path in (select value from json_each($paths))
        group by path`,
      { since, cap: DWELL_CAP_MS, paths: JSON.stringify(pages.map((p) => p.path)) },
    ).map((r) => [r.path, r]),
  )
  return pages.map((p) => ({
    path: p.path,
    views: p.views,
    visitors: p.visitors,
    avgDepth: Math.round(depth.get(p.path)?.depth ?? 0),
    avgDwellMs: Math.round(depth.get(p.path)?.dwell ?? 0),
  }))
}

/**
 * Aggregated stats for the last `days` days. `bucket` controls the chart grain (hour for
 * 24h, day for a week/month, month for a year). Empty on failure: the dashboard degrades
 * to zeroes rather than erroring, as it did before.
 */
export async function getAnalytics(days: number, bucket: Bucket = 'day', topN = 10): Promise<AnalyticsSummary> {
  try {
    const now = Date.now()
    // Aligned to the bucket, so the chart's first column is a whole day rather than the
    // sliver of one `now - days * 86_400_000` used to leave there (see `windowStart`).
    const since = windowStart(now, days, bucket, reportTz())
    // The window just before `since`, of the SAME ELAPSED length. Not `days` again: the
    // current window ends now, part-way through today, so a full previous day-count would
    // be the longer of the two and every comparison would open showing a fall.
    const prevSince = since - (now - since)

    const current = windowCounts(since, null, null)
    const previous = windowCounts(prevSince, since, null)
    const { avgReadDepth, avgDwellMs } = engagement(since, null)

    return {
      totalViews: current.views,
      uniqueVisitors: current.visitors,
      avgReadDepth,
      avgDwellMs,
      singlePageVisitors: singlePageVisitors(since),
      topPages: topPages(since, topN),
      daily: dailySeries(bucketRanges(since, now, bucket, reportTz()), null),
      prevViews: previous.views,
      prevVisitors: previous.visitors,
      returningVisitors: returningVisitors(since),
      topReferrers: topReferrers(since, topN, null),
      topCountries: topCountries(since, topN, null),
      channels: channels(since),
      devices: facet(since, 'device', topN),
      browsers: facet(since, 'browser', topN),
      systems: facet(since, 'os', topN),
      depthBuckets: depthBuckets(since, null),
      transfer: transferred(since, null),
      // Not windowed like everything above it: the counters live in this process and start
      // at boot, so they answer "is the cache working" and not "how did last month go".
      cache: { ...cacheStats },
    }
  } catch (error) {
    console.error(`[ERROR] analytics.getAnalytics: ${(error as Error).message}`)
    return EMPTY_SUMMARY
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
export async function getDashboardTraffic(days: number, topN = 10): Promise<{
  totalViews: number
  uniqueVisitors: number
  avgReadDepth: number
  avgDwellMs: number
  daily: ReturnType<typeof dailySeries>
  topReferrers: ReturnType<typeof topReferrers>
  topCountries: ReturnType<typeof topCountries>
}> {
  try {
    const now = Date.now()
    const since = windowStart(now, days, 'day', reportTz())
    const current = windowCounts(since, null, null)
    const { avgReadDepth, avgDwellMs } = engagement(since, null)
    return {
      totalViews: current.views,
      uniqueVisitors: current.visitors,
      avgReadDepth,
      avgDwellMs,
      daily: dailySeries(bucketRanges(since, now, 'day', reportTz()), null),
      topReferrers: topReferrers(since, topN, null),
      topCountries: topCountries(since, topN, null),
    }
  } catch (error) {
    console.error(`[ERROR] analytics.getDashboardTraffic: ${(error as Error).message}`)
    return { totalViews: 0, uniqueVisitors: 0, avgReadDepth: 0, avgDwellMs: 0, daily: [], topReferrers: [], topCountries: [] }
  }
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
      `select path, count(*) as c from analytics_events where created_at >= ? group by path`,
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
