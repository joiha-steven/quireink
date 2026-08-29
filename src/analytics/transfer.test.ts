// Page weight and the page cache: the two numbers Analytics → Delivery draws.
//
// Both are easy to report as something bigger than they are, and both have a NULL that has
// to keep meaning "not measured" rather than "zero". That is most of what is asserted here:
// the denominator exists, the switch actually stops the write, the clamp holds against a
// forged beacon, and the cache counter moves on the one line that decides hit from miss.

import { describe, expect, it, afterAll, beforeEach } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { flushAnalytics, resetAnalyticsBuffer } from '@/analytics/buffer'
import { recordScroll } from '@/analytics/record'
import { transferred } from '@/analytics/aggregate'
import { cacheStats, countCacheHit, countCacheMiss, resetCacheStats } from '@/server/cache'
import { analyticsQuery } from '@/store/query'
import { saveSettings, getSettings } from '@/content/settings'

const DIR = './.tmp/test-transfer'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => {
  resetAnalyticsBuffer()
  analyticsQuery.run(`delete from analytics_scroll`)
  resetCacheStats()
})

/** A leave sample from a browser that reported `bytes`, on a path the site can serve. */
async function visit(bytes?: number): Promise<void> {
  await recordScroll('/', 80, '198.51.100.7', 'Mozilla/5.0 (Macintosh) Safari/17', 42_000, bytes)
  flushAnalytics()
}

describe('the column', () => {
  it('is on analytics_scroll, beside dwell, and not on the view row', () => {
    // Both are only knowable when the reader leaves; the view row is written while the
    // page's fonts and pictures are still arriving. If this ever moves, the beacon has to
    // move with it or the count is short by most of the page.
    const cols = analyticsQuery.all<{ name: string }>(`pragma table_info(analytics_scroll)`)
      .map((c) => c.name)
    expect(cols).toContain('bytes')
    expect(cols).toContain('dwell_ms')
    const events = analyticsQuery.all<{ name: string }>(`pragma table_info(analytics_events)`)
      .map((c) => c.name)
    expect(events).not.toContain('bytes')
  })

  it('records the migration in analytics.db, which had no ledger before this', () => {
    const applied = analyticsQuery.all<{ name: string }>(`select name from schema_migrations`)
      .map((r) => r.name)
    expect(applied).toContain('a001-visit-bytes')
  })
})

describe('what gets stored', () => {
  it('keeps what a browser reported', async () => {
    await visit(102_400)
    expect(transferred(0, null)).toEqual({ totalBytes: 102_400, avgBytes: 102_400, measured: 1 })
  })

  it('keeps a zero, because that is what a fully cached page really costs', async () => {
    await visit(0)
    const out = transferred(0, null)
    expect(out.totalBytes).toBe(0)
    // The distinction the whole panel rests on: measured once at zero is NOT unmeasured.
    expect(out.measured).toBe(1)
  })

  it('counts a visit that reported nothing as unmeasured, not as zero', async () => {
    await visit(undefined)
    expect(transferred(0, null).measured).toBe(0)
  })

  it('does not let one visit stand in for a month', async () => {
    await visit(100_000)
    await visit(undefined)
    await visit(300_000)
    const out = transferred(0, null)
    expect(out.totalBytes).toBe(400_000)
    // Averaged over the TWO that measured, not the three that happened. `count(bytes)`
    // skipping NULLs is the whole reason the denominator is reported beside the total.
    expect(out.avgBytes).toBe(200_000)
    expect(out.measured).toBe(2)
  })

  it('refuses a forged number', async () => {
    await visit(9_999_999_999)
    expect(transferred(0, null).totalBytes).toBe(67_108_864)
    resetAnalyticsBuffer()
    analyticsQuery.run(`delete from analytics_scroll`)
    await visit(-5)
    expect(transferred(0, null).measured).toBe(0)
    resetAnalyticsBuffer()
    analyticsQuery.run(`delete from analytics_scroll`)
    await visit(Number.POSITIVE_INFINITY)
    expect(transferred(0, null).measured).toBe(0)
  })
})

describe('the switch', () => {
  it('stops the write without touching anything else about the sample', async () => {
    await saveSettings({ features: { ...(await getSettings()).features, transferStats: false } })
    await visit(102_400)
    expect(transferred(0, null).measured).toBe(0)
    // The rest of the leave sample still lands: turning off page weight must not cost the
    // owner their read depth and dwell.
    const row = analyticsQuery.all<{ depth: number; dwell_ms: number | null }>(
      `select depth, dwell_ms from analytics_scroll`,
    )
    expect(row.length).toBe(1)
    expect(row[0]?.depth).toBe(80)
    expect(row[0]?.dwell_ms).toBe(42_000)
    await saveSettings({ features: { ...(await getSettings()).features, transferStats: true } })
  })
})

describe('the page cache counter', () => {
  it('starts empty and reports no rate rather than 0%', () => {
    expect(cacheStats.hits).toBe(0)
    expect(cacheStats.misses).toBe(0)
  })

  it('counts each side separately', () => {
    countCacheHit()
    countCacheHit()
    countCacheMiss()
    expect(cacheStats.hits).toBe(2)
    expect(cacheStats.misses).toBe(1)
  })

  it('stamps when it started, because it is since boot and not since a date range', () => {
    const before = cacheStats.since
    expect(before).toBeGreaterThan(0)
    resetCacheStats()
    expect(cacheStats.since).toBeGreaterThanOrEqual(before)
  })
})
