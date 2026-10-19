// The chart's two end labels print in the admin's one date shape (`admin-shared/when.ts`). An
// hourly bucket arrives as a wall clock with no offset and must keep its own digits.
import { describe, expect, it } from 'bun:test'
import { trendChart } from './analytics-kit'
import { formatDateShort, formatDateTimeShort } from '@/admin-shared/when'

const chart = (days: string[], lang: 'en' | 'vi' = 'en'): string => trendChart({
  points: days.map((day) => ({ day, views: 3, visitors: 2 })),
  peakLabel: 'Peak', viewsLabel: 'Views', visitorsLabel: 'Visitors', partialLabel: 'Still counting', lang,
})

describe('the chart axis', () => {
  it('names the month on a daily range', () => {
    const html = chart(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
    expect(html).toContain(formatDateShort('2026-10-01', 'en'))
    expect(html).toContain('Oct 1, 2026')
  })

  it('keeps the hour on an hourly range, in the same shape as every other date and time', () => {
    const html = chart(['2026-10-19 13:00', '2026-10-19 14:00', '2026-10-19 15:00', '2026-10-19 16:00'], 'vi')
    expect(html).toContain(formatDateTimeShort('2026-10-19T13:00', 'vi'))
    expect(html).toContain('19 thg 10, 2026, 13:00')
  })
})
