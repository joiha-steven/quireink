// The screens must say the same numbers after the 2026-10-03 rework as before it.
//
// Three things changed under the analytics screens that day: a long window is cut by visitor and
// its parts added up (`chunked.ts`), a cut window's eight "who read" questions come from one pass
// folded in memory (`window.ts`), and three statements were rewritten so the planner reads the
// window rather than the history. None of it may move a number. So this keeps the screens as they
// were — the old composition, word for word, over the unchanged helpers of `aggregate.ts` and the
// old literals of the three rewritten statements — builds a year and a bit of traffic, and holds
// every new screen to the old one twice: with windows too small to cut, and cut into dozens.
import { describe, expect, it, beforeAll, afterAll, setSystemTime } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { analyticsQuery } from '@/store/query'
import { analyticsDb } from '@/test/sqlite'
import { binary, chunkSizes, partsFor } from '@/analytics/chunked'
import { getAnalytics, getDashboardTraffic, getPieces, yearTotals } from '@/analytics/summary'
import { getPageAnalytics, leftQuickly } from '@/analytics/page'
import { bucketRanges, windowStart, type Bucket } from '@/analytics/buckets'
import {
  DWELL_CAP_MS, allPieces, channels, dailySeries, depthBuckets, engagement, facet, topCountries,
  topReferrers, transferred, windowCounts,
} from '@/analytics/aggregate'
import { reportTz } from '@/analytics/types'
import { cacheStats } from '@/server/cache'

const DIR = './.tmp/test-analytics-chunked'
const NOW = Date.parse('2026-06-15T09:30:00Z')
const DAY = 86_400_000
const { all, one } = analyticsQuery

let seed = 7
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * rnd() * xs.length)]!
const hex = () => Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('')

// Paths that tie, and paths whose order differs between UTF-16 and UTF-8: U+1D51E sorts AFTER
// U+FB00 by code point and BEFORE it by UTF-16 unit, which is the case `binary` exists for.
const PATHS = ['/', '/a', '/b', '/c', '/ﬀ', '/𝔞', '/tag/x', '/page/2', '/long-read', '/notes']
const HOSTS = [null, null, null, '', 'www.google.com', 'google.com', 'l.facebook.com', 'm.facebook.com', 't.co', 'news.ycombinator.com', 'example.org']
// Visitors that are not hex at all — a 1.x import, a fixture — must still land in exactly one part.
const ODD = ['v1', 'Visitor-Z', 'zzz', '~legacy', '']

beforeAll(() => {
  setSystemTime(new Date(NOW))
  freshDatabase(DIR)
  const sqlite = analyticsDb()
  const event = sqlite.prepare(`insert into analytics_events (path, visitor, referrer_host, country, device, browser, os, created_at)
    values (?, ?, ?, ?, ?, ?, ?, ?)`)
  const leave = sqlite.prepare(`insert into analytics_scroll (path, depth, dwell_ms, bytes, visitor, created_at)
    values (?, ?, ?, ?, ?, ?)`)
  const visitors = Array.from({ length: 700 }, hex)
  // In time order, as the server writes them: the part count is estimated from rowids.
  const rows = Array.from({ length: 4000 }, (_, i) => ({
    visitor: i < 40 ? ODD[i % ODD.length]! : pick(visitors),
    at: NOW - Math.floor(rnd() * 420 * DAY),
  })).sort((a, b) => a.at - b.at)
  sqlite.transaction(() => {
    for (const { visitor, at } of rows) {
      const path = pick(PATHS)
      const blank = rnd() < 0.05 // a row from before the facet columns existed
      event.run(path, visitor, pick(HOSTS), blank ? null : pick(['VN', 'US', 'DE', '', 'JP']),
        blank ? null : pick(['desktop', 'mobile', 'tablet']), blank ? null : pick(['Chrome', 'Safari', 'Firefox']),
        blank ? null : pick(['macOS', 'iOS', 'Windows', 'Android']), at)
      if (rnd() < 0.3) leave.run(path, Math.floor(rnd() * 101), rnd() < 0.1 ? null : Math.floor(rnd() * 3_000_000), null, visitor, at + 5_000)
    }
    // A view a moment in the future, as an import can leave: the window has no upper bound.
    event.run('/a', 'v1', null, 'VN', 'desktop', 'Chrome', 'macOS', NOW + 60_000)
  })()
})

afterAll(() => {
  chunkSizes()
  setSystemTime()
  dropDatabase(DIR)
})

// ----- the screens as they were, before 2026-10-03 -------------------------------------------

const oldSingle = (since: number) => all<{ n: number }>(`select count(*) as n from (
       select visitor from analytics_events where created_at >= $since
        group by visitor having count(distinct path) = 1)`, { since })[0]?.n ?? 0

const oldReturning = (since: number) => all<{ n: number }>(`select count(distinct e.visitor) as n from analytics_events e
      where e.created_at >= $since
        and exists (select 1 from analytics_events p
                     where p.visitor = e.visitor and p.created_at < $since)`, { since })[0]?.n ?? 0

function oldTopPages(since: number, limit: number) {
  const pages = all<{ path: string; views: number; visitors: number }>(
    `select path, count(*) as views, count(distinct visitor) as visitors from analytics_events
      where created_at >= $since group by +path order by views desc, path limit $limit`, { since, limit })
  if (pages.length === 0) return []
  const depth = new Map(all<{ path: string; depth: number | null; dwell: number | null }>(
    `select path, avg(depth) as depth, avg(min(dwell_ms, $cap)) as dwell from analytics_scroll
      where created_at >= $since and path in (select value from json_each($paths)) group by path`,
    { since, cap: DWELL_CAP_MS, paths: JSON.stringify(pages.map((p) => p.path)) }).map((r) => [r.path, r]))
  const round = (v: number | null | undefined) => (v == null ? null : Math.round(v))
  return pages.map((p) => ({ ...p, avgDepth: round(depth.get(p.path)?.depth), avgDwellMs: round(depth.get(p.path)?.dwell) }))
}

function oldSummary(days: number, bucket: Bucket, topN = 10) {
  const now = Date.now()
  const since = windowStart(now, days, bucket, reportTz())
  const prevSince = since - (now - since)
  const current = windowCounts(since, null, null)
  const previous = windowCounts(prevSince, since, null)
  return {
    totalViews: current.views, uniqueVisitors: current.visitors, ...engagement(since, null),
    singlePageVisitors: oldSingle(since), topPages: oldTopPages(since, topN),
    daily: dailySeries(bucketRanges(since, now, bucket, reportTz()), null),
    prevViews: previous.views, prevVisitors: previous.visitors, returningVisitors: oldReturning(since),
    topReferrers: topReferrers(since, topN, null), topCountries: topCountries(since, topN, null),
    channels: channels(since), devices: facet(since, 'device', topN), browsers: facet(since, 'browser', topN),
    systems: facet(since, 'os', topN), depthBuckets: depthBuckets(since, null), transfer: transferred(since, null),
    cache: { ...cacheStats },
  }
}

/** One page's chart through the literal `e.path = $path`, the shape that walked the history. */
function oldPageSeries(since: number, now: number, bucket: Bucket, path: string) {
  const ranges = bucketRanges(since, now, bucket, reportTz())
  const rows = all<{ i: number; views: number; visitors: number }>(`with bounds(i, lo, hi) as (
      select key, json_extract(value, '$[0]'), json_extract(value, '$[1]') from json_each($bounds))
    select b.i as i, count(*) as views, count(distinct e.visitor) as visitors
      from bounds b join analytics_events e on e.created_at >= b.lo and e.created_at < b.hi
     where e.path = $path group by b.i order by b.i`, { bounds: JSON.stringify(ranges.map((r) => [r.lo, r.hi])), path })
  const byIndex = new Map(rows.map((r) => [r.i, r]))
  return ranges.map((r, i) => ({ day: r.label, views: byIndex.get(i)?.views ?? 0, visitors: byIndex.get(i)?.visitors ?? 0 }))
}

function oldPage(path: string, days: number, bucket: Bucket = 'day') {
  const now = Date.now()
  const since = windowStart(now, days, bucket, reportTz())
  const current = windowCounts(since, null, path)
  const previous = windowCounts(since - (now - since), since, path)
  return {
    path, totalViews: current.views, uniqueVisitors: current.visitors, ...engagement(since, path),
    prevViews: previous.views, prevVisitors: previous.visitors, daily: oldPageSeries(since, now, bucket, path),
    topReferrers: topReferrers(since, 10, path), topCountries: topCountries(since, 10, path),
    depthBuckets: depthBuckets(since, path), leftQuickly: leftQuickly(since, path),
  }
}

function oldYears() {
  const first = one<{ at: number }>('select min(created_at) as at from analytics_events')!.at
  const spans = new Map<string, { lo: number; hi: number }>()
  for (const m of bucketRanges(first, Date.now(), 'month', reportTz())) {
    const seen = spans.get(m.label.slice(0, 4))
    if (seen) seen.hi = m.hi
    else spans.set(m.label.slice(0, 4), { lo: m.lo, hi: m.hi })
  }
  return [...spans].map(([year, s]) => ({ year, ...windowCounts(s.lo, s.hi, null) }))
}

const WINDOWS: [number, Bucket][] = [[1, 'hour'], [7, 'day'], [30, 'day'], [90, 'day'], [365, 'day'], [420, 'month']]

const oldScreens = () => ({
  summaries: WINDOWS.map(([d, b]) => oldSummary(d, b)),
  pieces: [7, 30, 365].map((d) => allPieces(windowStart(Date.now(), d, 'day', reportTz()))),
  years: oldYears(),
  dashboard: (({ totalViews, uniqueVisitors, avgReadDepth, avgDwellMs, daily, topReferrers, topCountries }) =>
    ({ totalViews, uniqueVisitors, avgReadDepth, avgDwellMs, daily, topReferrers, topCountries }))(oldSummary(30, 'day')),
  pages: ['/', '/𝔞', '/nobody'].map((p) => oldPage(p, 365)),
})

const newScreens = async () => ({
  summaries: await Promise.all(WINDOWS.map(([d, b]) => getAnalytics(d, b))),
  pieces: await Promise.all([7, 30, 365].map((d) => getPieces(d))),
  years: await yearTotals(),
  dashboard: await getDashboardTraffic(30),
  pages: await Promise.all(['/', '/𝔞', '/nobody'].map((p) => getPageAnalytics(p, 365))),
})

describe('the analytics screens say what they said before the rework', () => {
  it('with no window big enough to cut', async () => {
    chunkSizes(1e9, 1e9)
    expect(partsFor(NOW - 420 * DAY, null)).toEqual([])
    const before = oldScreens()
    expect(await newScreens()).toEqual(before)
    // Not a comparison of two empty screens.
    expect(before.summaries[4]!.totalViews).toBeGreaterThan(3000)
    expect(before.summaries[4]!.topPages.length).toBe(10)
    expect(before.summaries[4]!.devices.length).toBe(3)
    expect(before.summaries[4]!.topReferrers.length).toBeGreaterThan(4)
  })

  it('with every window cut into dozens of parts', async () => {
    chunkSizes(60, 300)
    // Proof the reads really were cut, and finely, down to the shortest windows.
    expect(partsFor(NOW - 365 * DAY, null).length).toBeGreaterThan(30)
    expect(partsFor(NOW - 7 * DAY, null).length).toBeGreaterThan(5)
    const before = oldScreens()
    expect(await newScreens()).toEqual(before)
  })

  it('the parts cover every visitor once: hex, not hex, and empty', () => {
    chunkSizes(60, 300)
    const parts = partsFor(NOW - 420 * DAY, null)
    const sqlite = analyticsDb()
    const everyone = (sqlite.query('select distinct visitor from analytics_events').all() as { visitor: string }[]).map((r) => r.visitor)
    let counted = 0
    for (const p of parts) {
      counted += (sqlite.query('select count(distinct visitor) as n from analytics_events where visitor >= ? and visitor < ?')
        .get(p.lo, p.hi) as { n: number }).n
    }
    expect(counted).toBe(everyone.length)
    expect(everyone).toEqual(expect.arrayContaining(ODD))
  })
})

describe('binary', () => {
  it('sorts as SQLite\'s BINARY collation does, by code point', () => {
    const words = ['/𝔞', '/ﬀ', '/a', '/', '/A', '/é', '/e', '/ab', '/a b', '']
    const want = all<{ value: string }>('select value from json_each(?) order by value', JSON.stringify(words)).map((r) => r.value)
    expect([...words].sort(binary)).toEqual(want)
    // And the case it exists for: JavaScript's own order disagrees.
    expect([...words].sort()).not.toEqual(want)
  })
})
