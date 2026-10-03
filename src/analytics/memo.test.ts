// The screens' minute: kept, shared, forgotten on time, forgotten at once when the tables are
// replaced, and never more than a bounded number of entries — and a long read gives the event
// loop its turns, which is the whole reason for cutting it (`chunked.ts`).
import { describe, expect, it, beforeEach, afterAll, setSystemTime } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { analyticsDb } from '@/test/sqlite'
import { chunkSizes } from '@/analytics/chunked'
import { getAnalytics } from '@/analytics/summary'
import {
  getAnalyticsCached, getPageAnalyticsCached, getPiecesCached, keptReads, resetAnalyticsCaches, yearTotalsCached,
} from '@/analytics/memo'

const DIR = './.tmp/test-analytics-memo'
const NOW = Date.parse('2026-06-15T09:30:00Z')
freshDatabase(DIR)

const view = (visitor: string, at = NOW - 3_600_000, path = '/a') =>
  analyticsDb().run(
    `insert into analytics_events (path, visitor, country, device, browser, os, created_at)
     values (?, ?, 'VN', 'desktop', 'Chrome', 'macOS', ?)`,
    [path, visitor, at],
  )

beforeEach(() => {
  setSystemTime(new Date(NOW))
  analyticsDb().run('delete from analytics_events')
  resetAnalyticsCaches()
  chunkSizes()
})

afterAll(() => {
  chunkSizes()
  setSystemTime()
  dropDatabase(DIR)
})

describe('the analytics screens keep what they read for a minute', () => {
  it('a second load inside the minute is the first one\'s numbers; after it, fresh ones', async () => {
    view('a')
    expect((await getAnalyticsCached(7)).totalViews).toBe(1)
    view('b')
    expect((await getAnalyticsCached(7)).totalViews).toBe(1)
    expect((await yearTotalsCached())[0]?.views).toBe(2)
    // The exact read is untouched by any of it.
    expect((await getAnalytics(7)).totalViews).toBe(2)
    setSystemTime(new Date(NOW + 61_000))
    expect((await getAnalyticsCached(7)).totalViews).toBe(2)
  })

  it('forgets everything the moment the tables are replaced', async () => {
    view('a')
    expect((await getPiecesCached(7))).toEqual([{ path: '/a', views: 1, visitors: 1 }])
    analyticsDb().run('delete from analytics_events')
    resetAnalyticsCaches()
    expect(await getPiecesCached(7)).toEqual([])
    expect((await getAnalyticsCached(7)).totalViews).toBe(0)
  })

  it('two loads at once share one read', async () => {
    view('a')
    const [one, two] = await Promise.all([getPiecesCached(30), getPiecesCached(30)])
    expect(two).toBe(one)
  })

  it('the summary ranks its busiest pages from the same list the screen is handed', async () => {
    view('a', NOW - 3_600_000, '/x')
    const pieces = await getPiecesCached(30)
    view('b', NOW - 3_600_000, '/y')
    // Read after a second row landed, and still the first list's pages: it is the same read.
    expect((await getAnalyticsCached(30)).topPages.map((p) => p.path)).toEqual(pieces.map((p) => p.path))
  })

  it('holds a bounded number of reads however many are asked for', async () => {
    view('a')
    for (let i = 0; i < 80; i++) await getPageAnalyticsCached(`/p${i}`, 7)
    expect(keptReads()).toBeLessThanOrEqual(32)
  })
})

describe('a long read gives the event loop its turns', () => {
  it('a timer set before a cut read fires before the read is done', async () => {
    for (let i = 0; i < 400; i++) view(`${(i * 7919 % 4096).toString(16).padStart(3, '0')}visitor`, NOW - i * 3_600_000)
    chunkSizes(20, 100)
    let fired = false
    setTimeout(() => { fired = true }, 0)
    let firedBeforeDone = false
    await getAnalytics(30).then(() => { firedBeforeDone = fired })
    expect(firedBeforeDone).toBe(true)
  })
})
