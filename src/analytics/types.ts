import { one } from '@/store/query'
// Shapes the admin reads. Unchanged from the frozen tree, including the optional fields:
// they were optional because the pre-v2 migration might not have run yet, and the admin
// hides each section until its data shows up. There is one schema in 2.0, so every field
// is now always present, but the types stay as they were rather than forcing an edit
// across the components that consume them.

/**
 * A row of the busiest-pages table.
 *
 * `avgDepth` and `avgDwellMs` are NULL when nothing was measured, and that is not the same
 * as zero. A leave sample only exists when the browser delivered the beacon, so a page can
 * be read plenty and measured never — and it used to print `0s` and `0%` in the table beside
 * pages printing `2m 10s`, which reads as "nobody stayed" rather than "nobody was measured".
 * Zero is now a real answer on its own: after the 2026-08-30 beacon fix, a reader who leaves
 * an unscrolled page records depth 0. The two cases have to be told apart.
 */
export type TopPage = {
  path: string
  views: number
  visitors: number
  avgDepth: number | null
  avgDwellMs?: number | null
}
export type DailyPoint = { day: string; views: number; visitors: number }
export type TopReferrer = { host: string; visitors: number }
export type TopCountry = { country: string; visitors: number }
export type ChannelStat = { channel: string; visitors: number }
export type NameStat = { name: string; visitors: number } // device / browser / os facet
export type DepthBucket = { bucket: number; samples: number } // 0 = 0-25% … 3 = 76-100%
/** One path's numbers in the window, for the complete list rather than the top N. */
export type PieceStat = { path: string; views: number; visitors: number }
/**
 * The glance share, and how many leaves were measured to get it.
 *
 * Never shown without `measured`: see `leftQuickly` in `aggregate.ts` for why a bare
 * percentage here would flatter every install with history.
 */
export type QuickExit = { share: number; measured: number }

export type AnalyticsSummary = {
  totalViews: number
  uniqueVisitors: number
  avgReadDepth: number
  topPages: TopPage[]
  daily: DailyPoint[]
  prevViews?: number
  prevVisitors?: number
  returningVisitors?: number
  topReferrers?: TopReferrer[]
  topCountries?: TopCountry[]
  avgDwellMs?: number
  singlePageVisitors?: number
  channels?: ChannelStat[]
  devices?: NameStat[]
  browsers?: NameStat[]
  systems?: NameStat[]
  depthBuckets?: DepthBucket[]
  /**
   * What readers downloaded, and over how many measured visits.
   *
   * `measured` travels with the total on purpose: `bytes` is NULL on every sample older
   * than the column, on browsers with no Navigation Timing, and on visits whose leave
   * beacon never landed. A total shown without its denominator reads a partly-measured
   * month as a cheap one.
   */
  transfer?: { totalBytes: number; avgBytes: number; measured: number }
  /** In-process page cache since boot. Not the CDN's, which the origin cannot see. */
  cache?: { hits: number; misses: number; since: number }
}

// One page's drill-down. Empty on failure.
export type PageSummary = {
  path: string
  totalViews: number
  uniqueVisitors: number
  avgReadDepth: number
  avgDwellMs: number
  prevViews?: number
  prevVisitors?: number
  daily: DailyPoint[]
  topReferrers: TopReferrer[]
  topCountries: TopCountry[]
  depthBuckets: DepthBucket[]
  leftQuickly?: QuickExit
}

// The last five minutes, for the live strip on the Analytics page. `pages` is by distinct
// visitors, so "2 readers on /a" means two people, not one person's reloads.
export type RightNow = {
  visitors: number
  pages: { path: string; visitors: number }[]
}

export const EMPTY_RIGHT_NOW: RightNow = { visitors: 0, pages: [] }

export const EMPTY_SUMMARY: AnalyticsSummary = {
  totalViews: 0, uniqueVisitors: 0, avgReadDepth: 0, topPages: [], daily: [],
}

export const EMPTY_PAGE = (path: string): PageSummary => ({
  path, totalViews: 0, uniqueVisitors: 0, avgReadDepth: 0, avgDwellMs: 0, leftQuickly: { share: 0, measured: 0 },
  daily: [], topReferrers: [], topCountries: [], depthBuckets: [],
})

/**
 * IANA zone the admin time buckets are truncated in, so a "day" matches local midnight
 * rather than UTC.
 *
 * THREE sources, in order: the owner's setting, then `ANALYTICS_TZ`, then UTC. It became a
 * setting on 2026-08-22 — an environment variable is the operator's answer and the owner
 * is the one reading the chart, and the same zone now also decides the date printed under
 * every post (`i18n/i18n.ts`), which was reading the SERVER's zone until that day.
 *
 * Read from the row directly rather than through `getSettings()`, which is async and would
 * make six pure bucket functions async to reach it. This runs once per analytics request,
 * nowhere near a reader's path, against a one-row table.
 *
 * The shape check is kept from the frozen tree, where it stopped a bad value reaching
 * Postgres as SQL; here nothing is interpolated, and `safeTimeZone` in `buckets.ts` catches
 * a well-shaped but unknown zone before `Intl` can throw on it.
 */
export function reportTz(): string {
  let stored = ''
  try {
    const row = one<{ data: string }>(`select data from settings where id = 1`)
    if (row) stored = String((JSON.parse(row.data) as { timezone?: unknown }).timezone ?? '')
  } catch {
    /* an unreadable settings row is not a reason to fail a chart */
  }
  const tz = (stored || process.env.ANALYTICS_TZ || '').trim()
  return /^[A-Za-z0-9_+/-]{1,40}$/.test(tz) ? tz : 'UTC'
}
