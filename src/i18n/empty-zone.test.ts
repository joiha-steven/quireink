// An empty `settings.timezone` means `ANALYTICS_TZ`, then UTC (`types.ts`). The public site used
// to read it as the server PROCESS's zone, so the date under a post differed from the admin's on
// the same instance whenever the process zone was not UTC.

import { describe, it, expect, afterAll } from 'bun:test'
import { formatDate, formatMonth, zonedDay, siteZone } from '@/i18n/format'

// Captured by NAME: `delete process.env.TZ` would freeze the zone for later files in the run.
const WAS_TZ = process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone
const WAS_ANALYTICS = process.env.ANALYTICS_TZ
process.env.TZ = 'America/Los_Angeles'

afterAll(() => {
  process.env.TZ = WAS_TZ
  if (WAS_ANALYTICS === undefined) delete process.env.ANALYTICS_TZ
  else process.env.ANALYTICS_TZ = WAS_ANALYTICS
})

// 18:00 UTC: 11:00 on the 22nd in Los Angeles, 01:00 on the 23rd in Hanoi.
const EVENING = '2026-08-22T18:00:00Z'

describe('an empty site timezone on the public site', () => {
  it('follows ANALYTICS_TZ, not the process zone', () => {
    process.env.ANALYTICS_TZ = 'Asia/Ho_Chi_Minh'
    expect(formatDate(EVENING, 'en', '')).toBe('August 23, 2026')
    expect(formatDate(EVENING, 'vi', '')).toBe('23 tháng 8, 2026')
    expect(zonedDay(EVENING, '')).toBe('2026-08-23')
    expect(formatMonth('2026-08-31T18:00:00Z', 'vi', '')).toBe('Tháng 9')
    expect(siteZone('')).toBe('Asia/Ho_Chi_Minh')
  })

  it('is UTC with neither set', () => {
    delete process.env.ANALYTICS_TZ
    expect(formatDate(EVENING, 'en', '')).toBe('August 22, 2026')
    expect(formatDate('2026-08-23T03:00:00Z', 'en', '')).toBe('August 23, 2026')
    expect(zonedDay('2026-08-23T03:00:00Z', '')).toBe('2026-08-23')
    expect(siteZone('')).toBe('UTC')
  })

  it('treats an unknown ANALYTICS_TZ as UTC, in the dates and in data-tz', () => {
    process.env.ANALYTICS_TZ = 'Asia/Hanoi'
    expect(siteZone('')).toBe('UTC')
    expect(formatDate(EVENING, 'en', '')).toBe('August 22, 2026')
  })

  it('lets a saved zone win over ANALYTICS_TZ', () => {
    process.env.ANALYTICS_TZ = 'Asia/Ho_Chi_Minh'
    expect(formatDate(EVENING, 'en', 'America/Los_Angeles')).toBe('August 22, 2026')
  })
})
