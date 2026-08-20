// The aggregate reads shared by the whole-site summary and the per-page drill-down.
//
// Each helper holds TWO complete SQL literals rather than one with an optional predicate:
// `(?1 is null or path = ?1)` reads as clever and costs the `analytics_events_path_idx`,
// because SQLite cannot prove the term constant. Two literals keep both shapes indexed and
// keep the rule that no SQL is assembled from parts.

import { analyticsQuery } from '@/store/query'
import { canonicalHost, channelOf } from '@/analytics/channel'
import type { BucketRange } from '@/analytics/buckets'
import type {
  ChannelStat, DailyPoint, DepthBucket, NameStat, TopCountry, TopReferrer,
} from '@/analytics/types'

const { all, one } = analyticsQuery

/**
 * Dwell samples are averaged with a 30-minute ceiling. A dwell is meant to be time spent
 * reading, and above half an hour it almost never is: manhhung.me's table held six samples
 * over an hour and one at the 24-hour clamp — tabs left open on a lit monitor — and that
 * single sample alone was adding ~3 minutes to a 511-sample average. `min()` rather than
 * exclusion, so a genuinely long read still counts as a long read instead of vanishing.
 * The beacon now meters engaged time (assets/js/track.ts), so new samples rarely get here;
 * the ceiling is what makes the YEARS of already-recorded samples tell the truth too.
 */
export const DWELL_CAP_MS = 30 * 60_000

/** Bucket boundaries as ONE bound parameter: `[[lo,hi],[lo,hi],…]`. */
const boundsJson = (ranges: BucketRange[]) => JSON.stringify(ranges.map((r) => [r.lo, r.hi]))

const BOUNDS_CTE = `with bounds(i, lo, hi) as (
  select key, json_extract(value, '$[0]'), json_extract(value, '$[1]') from json_each($bounds)
)`

/**
 * Views and unique visitors per bucket — EVERY bucket, zeros included.
 *
 * The port dropped empty buckets, which is what `group by date_trunc(...)` did, and the
 * chart inherited the lie: a week with three quiet days drew as a smooth line between the
 * loud ones, because the quiet days were not points at all. The boundaries are right here,
 * so the fix is to emit them: a day with no readers is a fact about the week, not a gap in
 * the data.
 */
export function dailySeries(ranges: BucketRange[], path: string | null): DailyPoint[] {
  const rows = path === null
    ? all<{ i: number; views: number; visitors: number }>(
        `${BOUNDS_CTE}
         select b.i as i, count(*) as views, count(distinct e.visitor) as visitors
           from bounds b join analytics_events e on e.created_at >= b.lo and e.created_at < b.hi
          group by b.i order by b.i`,
        { bounds: boundsJson(ranges) },
      )
    : all<{ i: number; views: number; visitors: number }>(
        `${BOUNDS_CTE}
         select b.i as i, count(*) as views, count(distinct e.visitor) as visitors
           from bounds b join analytics_events e on e.created_at >= b.lo and e.created_at < b.hi
          where e.path = $path
          group by b.i order by b.i`,
        { bounds: boundsJson(ranges), path },
      )
  const byIndex = new Map(rows.map((r) => [r.i, r]))
  return ranges.map((range, i) => ({
    day: range.label,
    views: byIndex.get(i)?.views ?? 0,
    visitors: byIndex.get(i)?.visitors ?? 0,
  }))
}

/**
 * Referrers count DISTINCT VISITORS (one person = 1), not views.
 *
 * Hosts are folded through `canonicalHost` BEFORE counting, and the fold has to happen on
 * the (host, visitor) pairs rather than on per-host counts: a reader who arrived once via
 * `l.facebook.com` and once via `m.facebook.com` is one Facebook visitor, and summing the
 * two hosts' distinct counts would say two. Same shape `channels()` already uses, for the
 * same reason.
 */
export function topReferrers(since: number, limit: number, path: string | null): TopReferrer[] {
  const pairs = path === null
    ? all<{ host: string; visitor: string }>(
        `select referrer_host as host, visitor from analytics_events
          where created_at >= $since and referrer_host is not null and referrer_host != ''
          group by referrer_host, visitor`,
        { since },
      )
    : all<{ host: string; visitor: string }>(
        `select referrer_host as host, visitor from analytics_events
          where created_at >= $since and path = $path
            and referrer_host is not null and referrer_host != ''
          group by referrer_host, visitor`,
        { since, path },
      )
  const byHost = new Map<string, Set<string>>()
  for (const p of pairs) {
    const host = canonicalHost(p.host)
    const set = byHost.get(host) ?? new Set<string>()
    set.add(p.visitor)
    byHost.set(host, set)
  }
  return [...byHost]
    .map(([host, visitors]) => ({ host, visitors: visitors.size }))
    .sort((a, b) => b.visitors - a.visitors || a.host.localeCompare(b.host))
    .slice(0, limit)
}

export function topCountries(since: number, limit: number, path: string | null): TopCountry[] {
  return path === null
    ? all<TopCountry>(
        `select country, count(distinct visitor) as visitors from analytics_events
          where created_at >= $since and country is not null and country != ''
          group by country order by visitors desc limit $limit`,
        { since, limit },
      )
    : all<TopCountry>(
        `select country, count(distinct visitor) as visitors from analytics_events
          where created_at >= $since and path = $path and country is not null and country != ''
          group by country order by visitors desc limit $limit`,
        { since, limit, path },
      )
}

/** Quartile distribution of scroll samples. Integer division, as in the original. */
export function depthBuckets(since: number, path: string | null): DepthBucket[] {
  return path === null
    ? all<DepthBucket>(
        `select min(3, depth / 25) as bucket, count(*) as samples from analytics_scroll
          where created_at >= $since group by bucket order by bucket`,
        { since },
      )
    : all<DepthBucket>(
        `select min(3, depth / 25) as bucket, count(*) as samples from analytics_scroll
          where created_at >= $since and path = $path group by bucket order by bucket`,
        { since, path },
      )
}

/** Average scroll depth, and average dwell over the samples that measured one. */
export function engagement(since: number, path: string | null): { avgReadDepth: number; avgDwellMs: number } {
  // SQLite's avg() already skips NULLs (min(NULL, cap) is NULL, so the ceiling does not
  // resurrect them), which is what the original's explicit `where dwell_ms is not null`
  // amounted to. The ceiling itself is DWELL_CAP_MS at the top of this file.
  const row = path === null
    ? one<{ depth: number | null; dwell: number | null }>(
        `select avg(depth) as depth, avg(min(dwell_ms, $cap)) as dwell from analytics_scroll where created_at >= $since`,
        { since, cap: DWELL_CAP_MS },
      )
    : one<{ depth: number | null; dwell: number | null }>(
        `select avg(depth) as depth, avg(min(dwell_ms, $cap)) as dwell from analytics_scroll
          where created_at >= $since and path = $path`,
        { since, path, cap: DWELL_CAP_MS },
      )
  return {
    avgReadDepth: Math.round(row?.depth ?? 0),
    avgDwellMs: Math.round(row?.dwell ?? 0),
  }
}

/** Views + unique visitors over a window, optionally for one page. */
export function windowCounts(from: number, to: number | null, path: string | null): { views: number; visitors: number } {
  const upper = to ?? Number.MAX_SAFE_INTEGER
  const row = path === null
    ? one<{ views: number; visitors: number }>(
        `select count(*) as views, count(distinct visitor) as visitors from analytics_events
          where created_at >= $from and created_at < $upper`,
        { from, upper },
      )
    : one<{ views: number; visitors: number }>(
        `select count(*) as views, count(distinct visitor) as visitors from analytics_events
          where created_at >= $from and created_at < $upper and path = $path`,
        { from, upper, path },
      )
  return { views: row?.views ?? 0, visitors: row?.visitors ?? 0 }
}

// The three audience facets. One complete literal each, chosen by key: the column name is
// never interpolated, so the "one place allowed to assemble SQL" that 01-schema.md
// reserved for this turned out not to be needed.
const FACET_SQL = {
  device: `select coalesce(nullif(device, ''), 'Unknown') as name, count(distinct visitor) as visitors
             from analytics_events where created_at >= $since group by name order by visitors desc limit $limit`,
  browser: `select coalesce(nullif(browser, ''), 'Unknown') as name, count(distinct visitor) as visitors
              from analytics_events where created_at >= $since group by name order by visitors desc limit $limit`,
  os: `select coalesce(nullif(os, ''), 'Unknown') as name, count(distinct visitor) as visitors
         from analytics_events where created_at >= $since group by name order by visitors desc limit $limit`,
} as const

export function facet(since: number, column: keyof typeof FACET_SQL, limit: number): NameStat[] {
  return all<NameStat>(FACET_SQL[column], { since, limit })
}

/**
 * Traffic channels, by distinct visitors.
 *
 * The classification is a regex and SQLite has none, so the fold happens here over the
 * distinct (host, visitor) pairs. Summing per-host visitor counts would DOUBLE-COUNT
 * anyone who arrived from two hosts in the same channel, which is the bug this shape
 * avoids; the plpgsql version got it right by grouping on the function's result.
 *
 * Cost is one row per distinct pair. Measure before optimising: if this ever matters, the
 * answer is a channel column written at insert, not a cleverer query.
 */
export function channels(since: number): ChannelStat[] {
  const byChannel = new Map<string, Set<string>>()
  for (const r of all<{ referrer_host: string | null; visitor: string }>(
    `select referrer_host, visitor from analytics_events
      where created_at >= $since group by referrer_host, visitor`,
    { since },
  )) {
    const key = channelOf(r.referrer_host)
    const set = byChannel.get(key) ?? new Set<string>()
    set.add(r.visitor)
    byChannel.set(key, set)
  }
  return [...byChannel]
    .map(([channel, visitors]) => ({ channel, visitors: visitors.size }))
    .sort((a, b) => b.visitors - a.visitors)
}
