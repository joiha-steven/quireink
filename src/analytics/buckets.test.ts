// Bucket boundaries are the one part of the analytics port with no Postgres left to lean
// on, and the failure mode is silent: a chart that looks plausible and is an hour out for
// half the year. So the DST cases are the point of this file, not decoration.
import { describe, it, expect } from 'bun:test'
import { bucketRanges, safeTimeZone, windowStart } from '@/analytics/buckets'

const iso = (ms: number) => new Date(ms).toISOString()
const at = (s: string) => Date.parse(s)

describe('labels match the frozen tree to_char formats', () => {
  it('hour is YYYY-MM-DD HH:00', () => {
    const r = bucketRanges(at('2026-07-27T10:30:00Z'), at('2026-07-27T12:10:00Z'), 'hour', 'UTC')
    expect(r.map((b) => b.label)).toEqual(['2026-07-27 10:00', '2026-07-27 11:00', '2026-07-27 12:00'])
  })

  it('day and week are YYYY-MM-DD, month is YYYY-MM', () => {
    expect(bucketRanges(at('2026-07-27T10:00:00Z'), at('2026-07-28T01:00:00Z'), 'day', 'UTC')
      .map((b) => b.label)).toEqual(['2026-07-27', '2026-07-28'])
    expect(bucketRanges(at('2026-07-27T10:00:00Z'), at('2026-08-02T00:00:00Z'), 'week', 'UTC')
      .map((b) => b.label)).toEqual(['2026-07-27'])
    expect(bucketRanges(at('2026-07-27T10:00:00Z'), at('2026-09-02T00:00:00Z'), 'month', 'UTC')
      .map((b) => b.label)).toEqual(['2026-07', '2026-08', '2026-09'])
  })
})

describe('truncation', () => {
  it('starts a week on MONDAY, as date_trunc does', () => {
    // 2026-07-27 is a Monday; 2026-07-30 is the Thursday after it.
    const r = bucketRanges(at('2026-07-30T12:00:00Z'), at('2026-07-30T13:00:00Z'), 'week', 'UTC')
    expect(r[0]!.label).toBe('2026-07-27')
  })

  it('a Sunday belongs to the week that started the PREVIOUS Monday', () => {
    const r = bucketRanges(at('2026-08-02T12:00:00Z'), at('2026-08-02T13:00:00Z'), 'week', 'UTC')
    expect(r[0]!.label).toBe('2026-07-27')
  })

  it('clamps the first range to `since`, but keeps the true bucket label', () => {
    const since = at('2026-07-27T10:30:00Z')
    const [first] = bucketRanges(since, at('2026-07-27T11:00:00Z'), 'day', 'UTC')
    expect(first!.label).toBe('2026-07-27') // the bucket really starts at midnight
    expect(first!.lo).toBe(since) // but nothing before `since` is counted
  })

  it('ranges are contiguous and half-open, so no event is counted twice or missed', () => {
    const r = bucketRanges(at('2026-07-01T00:00:00Z'), at('2026-07-05T00:00:00Z'), 'day', 'UTC')
    for (let i = 1; i < r.length; i++) expect(r[i]!.lo).toBe(r[i - 1]!.hi)
  })
})

describe('a fixed-offset zone (Asia/Ho_Chi_Minh, UTC+7, no DST)', () => {
  it('starts a day at local midnight, not UTC midnight', () => {
    const r = bucketRanges(at('2026-07-27T10:00:00Z'), at('2026-07-27T11:00:00Z'), 'day', 'Asia/Ho_Chi_Minh')
    expect(r[0]!.label).toBe('2026-07-27')
    // Local midnight on 27 July is 17:00 UTC on 26 July.
    expect(iso(r[0]!.hi)).toBe('2026-07-27T17:00:00.000Z')
  })

  it('puts a late-evening UTC instant into the NEXT local day', () => {
    // 22:00 UTC is 05:00 the following morning in Ho Chi Minh City.
    const r = bucketRanges(at('2026-07-27T22:00:00Z'), at('2026-07-27T23:00:00Z'), 'day', 'Asia/Ho_Chi_Minh')
    expect(r[0]!.label).toBe('2026-07-28')
  })
})

describe('a DST zone (Europe/Berlin)', () => {
  // Every case starts the window a couple of days early: the FIRST range is clamped to
  // `since` by design, so measuring its length would measure the clamp, not the zone.

  // Spring forward: 2026-03-29, 02:00 local becomes 03:00. That day is 23 hours long.
  it('makes the spring-forward day 23 hours, not 24', () => {
    const r = bucketRanges(at('2026-03-27T00:00:00Z'), at('2026-03-30T12:00:00Z'), 'day', 'Europe/Berlin')
    const day = r.find((b) => b.label === '2026-03-29')!
    expect((day.hi - day.lo) / 3_600_000).toBe(23)
  })

  // Fall back: 2026-10-25, 03:00 local becomes 02:00. That day is 25 hours long.
  it('makes the fall-back day 25 hours, not 24', () => {
    const r = bucketRanges(at('2026-10-23T00:00:00Z'), at('2026-10-26T12:00:00Z'), 'day', 'Europe/Berlin')
    const day = r.find((b) => b.label === '2026-10-25')!
    expect((day.hi - day.lo) / 3_600_000).toBe(25)
  })

  it('keeps every later day aligned to local midnight ACROSS a transition', () => {
    // The bug a fixed 86,400,000 ms step produces: every bucket after the change is an
    // hour out, and the chart quietly attributes evening views to the next day.
    const r = bucketRanges(at('2026-03-27T00:00:00Z'), at('2026-04-02T00:00:00Z'), 'day', 'Europe/Berlin')
    for (const b of r.slice(1)) {
      const localMidnight = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(b.lo)
      expect(localMidnight).toBe('00:00')
    }
  })

  it('labels each day exactly once across a transition, with no gap', () => {
    const r = bucketRanges(at('2026-10-23T00:00:00Z'), at('2026-10-27T00:00:00Z'), 'day', 'Europe/Berlin')
    expect(r.map((b) => b.label)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'])
    for (let i = 1; i < r.length; i++) expect(r[i]!.lo).toBe(r[i - 1]!.hi)
  })

  it('hour buckets stay one hour apart through a transition', () => {
    const r = bucketRanges(at('2026-10-25T00:00:00Z'), at('2026-10-25T04:00:00Z'), 'hour', 'Europe/Berlin')
    for (const b of r) expect(b.hi - b.lo).toBe(3_600_000)
  })
})

describe('edges', () => {
  it('crosses a year boundary for months', () => {
    expect(bucketRanges(at('2026-11-15T00:00:00Z'), at('2027-01-15T00:00:00Z'), 'month', 'UTC')
      .map((b) => b.label)).toEqual(['2026-11', '2026-12', '2027-01'])
  })

  it('returns exactly one bucket when since and now are in the same one', () => {
    expect(bucketRanges(at('2026-07-27T10:10:00Z'), at('2026-07-27T10:50:00Z'), 'hour', 'UTC')).toHaveLength(1)
  })

  it('falls back to UTC for a zone Intl does not know, instead of throwing', () => {
    expect(safeTimeZone('Not/AZone')).toBe('UTC')
    expect(bucketRanges(at('2026-07-27T10:00:00Z'), at('2026-07-27T11:00:00Z'), 'day', 'Not/AZone')[0]!.label)
      .toBe('2026-07-27')
  })
})

// The bug this file could not have caught before: `bucketRanges` was right and its CALLER
// handed it a `since` in the middle of a day, so the chart grew a partial first column that
// only a rendered chart or a width measurement would reveal. These pin the caller's half.
describe('windowStart gives the chart a whole first column', () => {
  const tz = 'Asia/Ho_Chi_Minh'
  const noon = at('2026-08-29T05:00:00Z') // 12:00 in Hanoi, mid-day on purpose

  it('a 30-day window is thirty whole days, not thirty-one with a sliver', () => {
    const since = windowStart(noon, 30, 'day', tz)
    const r = bucketRanges(since, noon, 'day', tz)
    expect(r).toHaveLength(30)
    expect(r[0]!.label).toBe('2026-07-31')
    // Whole: the clamp inside bucketRanges has nothing left to clamp.
    expect(r[0]!.hi - r[0]!.lo).toBe(86_400_000)
    // And it really is local midnight, not UTC midnight.
    expect(iso(since)).toBe('2026-07-30T17:00:00.000Z')
  })

  it('the LAST column stays partial, because today is not over', () => {
    const since = windowStart(noon, 7, 'day', tz)
    const r = bucketRanges(since, noon, 'day', tz)
    expect(r).toHaveLength(7)
    expect(r[r.length - 1]!.label).toBe('2026-08-29')
    expect(noon - r[r.length - 1]!.lo).toBeLessThan(86_400_000)
  })

  it('one day of hours is twenty-four whole hours', () => {
    const since = windowStart(noon, 1, 'hour', tz)
    const r = bucketRanges(since, noon, 'hour', tz)
    expect(r).toHaveLength(24)
    expect(r[0]!.hi - r[0]!.lo).toBe(3_600_000)
  })

  it('the same instant in two zones starts on two different days', () => {
    expect(iso(windowStart(noon, 30, 'day', 'UTC'))).toBe('2026-07-31T00:00:00.000Z')
    expect(iso(windowStart(noon, 30, 'day', tz))).toBe('2026-07-30T17:00:00.000Z')
  })

  it('an unknown zone falls back to UTC rather than throwing', () => {
    expect(iso(windowStart(noon, 7, 'day', 'Not/AZone'))).toBe('2026-08-23T00:00:00.000Z')
  })
})
