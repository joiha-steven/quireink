import { one } from '@/store/query'
// Shapes the admin reads. Unchanged from the frozen tree, including the optional fields:
// they were optional because the pre-v2 migration might not have run yet, and the admin
// hides each section until its data shows up. There is one schema in 2.0, so every field
// is now always present, but the types stay as they were rather than forcing an edit
// across the components that consume them.

export type TopPage = { path: string; views: number; visitors: number; avgDepth: number; avgDwellMs?: number }
export type DailyPoint = { day: string; views: number; visitors: number }
export type TopReferrer = { host: string; visitors: number }
export type TopCountry = { country: string; visitors: number }
export type ChannelStat = { channel: string; visitors: number }
export type NameStat = { name: string; visitors: number } // device / browser / os facet
export type DepthBucket = { bucket: number; samples: number } // 0 = 0-25% … 3 = 76-100%

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
  path, totalViews: 0, uniqueVisitors: 0, avgReadDepth: 0, avgDwellMs: 0,
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
