// Calendar years, and the window that finally reaches them.
//
// Nothing in this product has ever deleted an analytics row: there is no retention setting,
// no pruning job, and no `delete from analytics_events` anywhere outside a test. What was
// missing was a way to ASK — every window was "the last N days" and the widest N offered was
// 365, so an install in its third year was holding two years it could not look at. Reported
// as issue #64, by an owner who reasonably concluded the data was gone.
//
// What is pinned here is the arithmetic, because a year table that disagrees with the
// headline above it is worse than no year table: the totals must ADD UP to the all-time
// figure, and the boundaries must be the site's midnight rather than UTC's.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { analyticsDb, db } from '@/store/db'
import { firstEventAt, getAnalytics, yearTotals } from '@/analytics/summary'

const DIR = './.tmp/test-analytics-years'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

/** One view at an exact instant, written straight in — `recordView` buffers and rate-limits. */
const view = (whenIso: string, visitor: string) =>
  analyticsDb().run(
    `insert into analytics_events (path, visitor, country, device, browser, os, created_at)
     values ('/a', ?, 'VN', 'desktop', 'Chrome', 'macOS', ?)`,
    [visitor, Date.parse(whenIso)],
  )

beforeEach(() => {
  analyticsDb().run('delete from analytics_events')
  db().run('delete from settings')
})

describe('yearTotals', () => {
  it('is empty on an install nobody has visited', () => {
    expect(firstEventAt()).toBeNull()
    expect(yearTotals()).toEqual([])
  })

  it('groups by calendar year, oldest first, and counts visitors distinctly', () => {
    view('2024-03-01T10:00:00Z', 'v1')
    view('2024-06-01T10:00:00Z', 'v1') // same person, two views
    view('2024-09-01T10:00:00Z', 'v2')
    view('2025-02-01T10:00:00Z', 'v3')

    const years = yearTotals()
    const by = new Map(years.map((y) => [y.year, y]))
    expect(by.get('2024')).toEqual({ year: '2024', views: 3, visitors: 2 })
    expect(by.get('2025')).toEqual({ year: '2025', views: 1, visitors: 1 })
    // Oldest first, and the first year is the year of the first event — never earlier.
    expect(years[0]!.year).toBe('2024')
    expect([...by.keys()]).toEqual([...by.keys()].slice().sort())
  })

  // The property that makes the table trustworthy: it is the same population as the
  // headline, cut a different way. A year boundary that dropped or double-counted a row
  // would show up here and nowhere else on the screen.
  it('adds up to the all-time total', async () => {
    for (let i = 0; i < 12; i++) view(`202${4 + (i % 2)}-0${(i % 9) + 1}-15T08:00:00Z`, `v${i % 5}`)
    const years = yearTotals()
    const all = await getAnalytics(9_999, 'month')
    expect(years.reduce((n, y) => n + y.views, 0)).toBe(all.totalViews)
  })

  // A CONTINUOUS axis, quiet years included. Dropping a year with no views would close the
  // gap and make a blog that went quiet for a year look like one that never did — and the
  // comparison this table exists for is exactly "is this year like last year". It also runs
  // to the CURRENT year whether or not it has anything yet, so the row for a January with
  // no visits reads as "nothing yet" rather than as a missing table.
  it('draws every year from the first event to the present, quiet ones included', () => {
    view('2023-05-01T10:00:00Z', 'v1')
    view('2026-05-01T10:00:00Z', 'v2')

    const years = yearTotals()
    const thisYear = String(new Date().getFullYear())
    expect(years[0]!.year).toBe('2023')
    expect(years[years.length - 1]!.year).toBe(thisYear)
    expect(years.find((y) => y.year === '2024')).toEqual({ year: '2024', views: 0, visitors: 0 })
    expect(years.find((y) => y.year === '2023')!.views).toBe(1)
  })
})
