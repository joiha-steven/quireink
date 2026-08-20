// The aggregate reads behind the dashboard.
//
// Worth pinning because every one of them fails QUIETLY: a wrong number still renders as a
// number, and nobody can tell by looking whether "412 visitors" counted people or pageloads.
// Each test below is a distinction the SQL makes that a rewrite would plausibly lose.

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { analyticsQuery } from '@/store/query'
import {
  channels, dailySeries, depthBuckets, engagement, facet, topCountries, topReferrers,
  windowCounts,
} from '@/analytics/aggregate'
import type { BucketRange } from '@/analytics/buckets'

const DIR = './.tmp/test-aggregate'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const T0 = 1_700_000_000_000
const HOUR = 3_600_000

type Event = {
  path?: string
  visitor?: string
  host?: string | null
  country?: string | null
  device?: string | null
  at?: number
}

const view = ({
  path = '/a', visitor = 'v1', host = null, country = null, device = null, at = T0,
}: Event = {}) =>
  analyticsQuery.run(
    `insert into analytics_events (path, visitor, referrer_host, country, device, browser, os, created_at)
     values (?, ?, ?, ?, ?, 'Chrome', 'macOS', ?)`,
    path, visitor, host, country, device, at,
  )

const scroll = (depth: number, dwell: number | null, at = T0, path = '/a') =>
  analyticsQuery.run(
    `insert into analytics_scroll (path, depth, dwell_ms, visitor, created_at)
     values (?, ?, ?, 'v1', ?)`,
    path, depth, dwell, at,
  )

/** Two adjacent hour buckets, built by hand so this tests aggregation and not bucketing. */
const RANGES: BucketRange[] = [
  { lo: T0, hi: T0 + HOUR, label: 'first' },
  { lo: T0 + HOUR, hi: T0 + 2 * HOUR, label: 'second' },
]

beforeEach(() => {
  analyticsQuery.run(`delete from analytics_events`)
  analyticsQuery.run(`delete from analytics_scroll`)
})

describe('dailySeries', () => {
  it('counts views as rows and visitors as distinct people', () => {
    view({ visitor: 'a' })
    view({ visitor: 'a' })
    view({ visitor: 'b' })
    expect(dailySeries(RANGES, null)).toEqual([
      { day: 'first', views: 3, visitors: 2 },
      { day: 'second', views: 0, visitors: 0 },
    ])
  })

  it('emits an explicit zero for a bucket with nothing in it', () => {
    view({ at: T0 + HOUR })
    // The chart receives BOTH points: a quiet hour is a fact, not a gap. The port used to
    // drop it, and the line drew straight across days that had no readers at all.
    expect(dailySeries(RANGES, null)).toEqual([
      { day: 'first', views: 0, visitors: 0 },
      { day: 'second', views: 1, visitors: 1 },
    ])
  })

  it('treats a bucket as lo-inclusive and hi-exclusive', () => {
    view({ at: T0 })
    view({ at: T0 + HOUR - 1 })
    view({ at: T0 + HOUR })
    expect(dailySeries(RANGES, null)).toEqual([
      { day: 'first', views: 2, visitors: 1 },
      { day: 'second', views: 1, visitors: 1 },
    ])
  })

  it('narrows to one page when given a path', () => {
    view({ path: '/a' })
    view({ path: '/b' })
    expect(dailySeries(RANGES, '/b')).toEqual([
      { day: 'first', views: 1, visitors: 1 },
      { day: 'second', views: 0, visitors: 0 },
    ])
  })
})

describe('topReferrers and topCountries', () => {
  // The distinction that matters: one person reloading five times is ONE referral.
  it('count distinct visitors, not views', () => {
    for (let i = 0; i < 5; i++) view({ visitor: 'a', host: 'news.example' })
    view({ visitor: 'b', host: 'news.example' })
    expect(topReferrers(T0, 10, null)).toEqual([{ host: 'news.example', visitors: 2 }])
  })

  it('ignore a direct visit, which has no host', () => {
    view({ visitor: 'a', host: null })
    view({ visitor: 'b', host: '' })
    view({ visitor: 'c', host: 'news.example' })
    expect(topReferrers(T0, 10, null)).toEqual([{ host: 'news.example', visitors: 1 }])
  })

  it('order by visitors and honour the limit', () => {
    view({ visitor: 'a', host: 'small.example' })
    view({ visitor: 'b', host: 'big.example' })
    view({ visitor: 'c', host: 'big.example' })
    expect(topReferrers(T0, 1, null)).toEqual([{ host: 'big.example', visitors: 2 }])
  })

  it('count countries the same way, and skip the unknown ones', () => {
    view({ visitor: 'a', country: 'VN' })
    view({ visitor: 'a', country: 'VN' })
    view({ visitor: 'b', country: null })
    expect(topCountries(T0, 10, null)).toEqual([{ country: 'VN', visitors: 1 }])
  })
})

describe('depthBuckets', () => {
  // Integer division by 25, capped at 3, so 100% lands in the last bucket and not a fifth one.
  it('puts each depth in its quartile, with 100 capped into the last', () => {
    for (const depth of [0, 24, 25, 49, 50, 74, 75, 99, 100]) scroll(depth, null)
    expect(depthBuckets(T0, null)).toEqual([
      { bucket: 0, samples: 2 },
      { bucket: 1, samples: 2 },
      { bucket: 2, samples: 2 },
      { bucket: 3, samples: 3 },
    ])
  })
})

describe('engagement', () => {
  it('averages depth over every sample', () => {
    scroll(20, null)
    scroll(80, null)
    expect(engagement(T0, null).avgReadDepth).toBe(50)
  })

  // The subtle one: a sample that never measured dwell must not be counted as a zero, which
  // would drag the average down every time a reader closed the tab before it was taken.
  it('averages dwell over only the samples that measured one', () => {
    scroll(50, 4000)
    scroll(50, 8000)
    scroll(50, null)
    expect(engagement(T0, null).avgDwellMs).toBe(6000)
  })

  it('reports zero rather than null when nothing was recorded', () => {
    expect(engagement(T0, null)).toEqual({ avgReadDepth: 0, avgDwellMs: 0 })
  })
})

describe('windowCounts', () => {
  it('is from-inclusive and to-exclusive', () => {
    view({ at: T0 - 1 })
    view({ at: T0 })
    view({ at: T0 + HOUR - 1 })
    view({ at: T0 + HOUR })
    expect(windowCounts(T0, T0 + HOUR, null).views).toBe(2)
  })

  it('runs to the end of time when given no upper bound', () => {
    view({ at: T0 })
    view({ at: T0 + 400 * 24 * HOUR })
    expect(windowCounts(T0, null, null).views).toBe(2)
  })
})

describe('facet', () => {
  it('folds a missing device into Unknown rather than dropping the visitor', () => {
    view({ visitor: 'a', device: 'mobile' })
    view({ visitor: 'b', device: '' })
    view({ visitor: 'c', device: null })
    expect(facet(T0, 'device', 10)).toEqual([
      { name: 'Unknown', visitors: 2 },
      { name: 'mobile', visitors: 1 },
    ])
  })
})

describe('channels', () => {
  // The reason this folds in TypeScript instead of SQL: summing per-host visitor counts
  // double-counts anyone who arrived from two hosts in the same channel. One person, two
  // search engines, is one referral.
  it('does not count one visitor twice for two hosts in the same channel', () => {
    view({ visitor: 'a', host: 'www.google.com' })
    view({ visitor: 'a', host: 'duckduckgo.com' })
    expect(channels(T0).find((c) => c.channel === 'search')).toEqual({
      channel: 'search', visitors: 1,
    })
  })

  it('sorts channels by visitors, most first', () => {
    view({ visitor: 'a', host: 'www.google.com' })
    view({ visitor: 'b', host: null })
    view({ visitor: 'c', host: null })
    expect(channels(T0)[0]!.visitors).toBe(2)
  })
})
