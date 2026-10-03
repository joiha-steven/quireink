// One page's drill-down, ported from the `analytics_page` plpgsql function.
//
// Same helpers as the summary, with a path filter, so the two can never disagree about
// what "unique visitors" or "average dwell" mean. The frozen tree had the definitions
// written out twice inside one SQL file, which is exactly how they drift.
//
// Each read runs on its own turn of the event loop (`pause`, chunked.ts), for the reason that
// file gives: the driver is synchronous, and a screen that runs eight statements back to back
// holds every reader of the blog for all eight. The chart is cut by buckets like the site's; the
// rest read a single path through its own index and are not cut further — the slowest measured
// 0.09 s for 365 days of the busiest page on a 1,000,000-event blog (2026-10-03).

import { analyticsQuery } from '@/store/query'
import { bucketRanges, windowStart, type Bucket } from '@/analytics/buckets'
import { depthBuckets, engagement, topCountries, topReferrers, windowCounts } from '@/analytics/aggregate'
import { pause, seriesIn } from '@/analytics/chunked'
import { EMPTY_PAGE, reportTz, type PageSummary } from '@/analytics/types'

const { one } = analyticsQuery

// The original hard-coded 10 for both lists in the per-page function, where the summary
// took a parameter. Kept as-is.
const PAGE_TOP_N = 10

/** Every read of one page's screen. Throws; `getPageAnalytics` is the version that cannot. */
export async function readPage(path: string, days: number, bucket: Bucket): Promise<PageSummary> {
  const now = Date.now()
  // Same alignment and the same equal-elapsed previous window as `getAnalytics`; a page's
  // chart and the site's chart must not disagree about where a day begins.
  const since = windowStart(now, days, bucket, reportTz())
  const prevSince = since - (now - since)
  const step = async <T>(read: () => T): Promise<T> => { await pause(); return read() }

  const current = await step(() => windowCounts(since, null, path))
  const previous = await step(() => windowCounts(prevSince, since, path))
  const { avgReadDepth, avgDwellMs } = await step(() => engagement(since, path))

  return {
    path,
    totalViews: current.views,
    uniqueVisitors: current.visitors,
    avgReadDepth,
    avgDwellMs,
    prevViews: previous.views,
    prevVisitors: previous.visitors,
    daily: await seriesIn(bucketRanges(since, now, bucket, reportTz()), path),
    topReferrers: await step(() => topReferrers(since, PAGE_TOP_N, path)),
    topCountries: await step(() => topCountries(since, PAGE_TOP_N, path)),
    depthBuckets: await step(() => depthBuckets(since, path)),
    leftQuickly: await step(() => leftQuickly(since, path)),
  }
}

export async function getPageAnalytics(path: string, days: number, bucket: Bucket = 'day'): Promise<PageSummary> {
  try {
    return await readPage(path, days, bucket)
  } catch (error) {
    console.error(`[ERROR] analytics.getPageAnalytics: ${(error as Error).message}`)
    return EMPTY_PAGE(path)
  }
}

/**
 * Where "a glance" stops and "a read" starts.
 *
 * Ten seconds is the usual line and it is not arbitrary: it is about how long it takes to
 * realise a page is not the one you wanted. A quarter of the page is deliberately the SAME
 * boundary as the first bar of the read-depth split the admin already draws, so the two
 * never contradict each other on the same screen.
 */
export const QUICK_MS = 10_000
export const QUICK_DEPTH = 25

/**
 * The share of measured leaves that were a glance, and how many leaves were measured. Here
 * rather than beside the other aggregates since 2026-10-03: this screen is its only reader.
 *
 * ⚠️ `measured` travels with the share, for the reason `transferred()` in aggregate.ts gives
 * and one more of its own. A leave sample exists only when the browser delivered the beacon —
 * and until 2026-08-30 only when the reader had scrolled at all, which meant the visits this
 * measures were the exact ones missing from the table (see `assets/js/track.ts`). A share
 * shown without its denominator would read a long history as a site nobody bounces off.
 */
export function leftQuickly(since: number, path: string | null): { share: number; measured: number } {
  const row = path === null
    ? one<{ measured: number; quick: number | null }>(
        `select count(*) as measured,
                sum(case when depth < $depth or (dwell_ms is not null and dwell_ms < $quick)
                         then 1 else 0 end) as quick
           from analytics_scroll where created_at >= $since`,
        { since, depth: QUICK_DEPTH, quick: QUICK_MS },
      )
    : one<{ measured: number; quick: number | null }>(
        `select count(*) as measured,
                sum(case when depth < $depth or (dwell_ms is not null and dwell_ms < $quick)
                         then 1 else 0 end) as quick
           from analytics_scroll where created_at >= $since and path = $path`,
        { since, path, depth: QUICK_DEPTH, quick: QUICK_MS },
      )
  const measured = row?.measured ?? 0
  return {
    measured,
    share: measured === 0 ? 0 : Math.round(((row?.quick ?? 0) / measured) * 100),
  }
}
