// The two numbers a single piece needs, and the list that makes a piece reachable at all.
//
// Both exist because the screen had exactly one door into a piece's own figures — a row in
// the top-ten table — so the fortieth piece could not be looked at, and nothing on the
// per-piece screen said whether people stayed or glanced.
//
// `leftQuickly` is the one worth reading the SQL for. It answers "did they bounce" from the
// leave samples, and a leave sample only exists when the browser delivered the beacon —
// which is why `measured` is returned beside the share and asserted here as its own fact.

import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { analyticsDb } from '@/store/db'
import { QUICK_DEPTH, QUICK_MS, leftQuickly } from '@/analytics/aggregate'
import { getPieces } from '@/analytics/summary'
import { getPageAnalytics } from '@/analytics/page'

const DIR = './.tmp/test-per-piece'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const HOUR = 3_600_000
const ago = (h: number) => Date.now() - h * HOUR

beforeEach(() => {
  analyticsDb().run(`delete from analytics_events`)
  analyticsDb().run(`delete from analytics_scroll`)
})

const view = (path: string, visitor = 'v1', at = ago(1)) =>
  analyticsDb().run(
    `insert into analytics_events (path, visitor, created_at) values (?, ?, ?)`,
    [path, visitor, at],
  )

const leave = (path: string, depth: number, dwell: number | null, at = ago(1)) =>
  analyticsDb().run(
    `insert into analytics_scroll (path, depth, dwell_ms, visitor, created_at) values (?, ?, ?, 'v1', ?)`,
    [path, depth, dwell, at],
  )

describe('getPieces: every piece, not the busiest ten', () => {
  it('returns a row per path read, however many there are', async () => {
    for (let i = 0; i < 25; i++) view(`/piece-${i}`)
    const pieces = await getPieces(7)
    // The number that matters: more than any top-N would have returned. A limit creeping
    // back in would put the same wall one row further down, which is the bug this replaced.
    expect(pieces).toHaveLength(25)
    expect(pieces.map((p) => p.path)).toContain('/piece-24')
  })

  it('counts views and DISTINCT visitors, which are different numbers', async () => {
    view('/a', 'v1')
    view('/a', 'v1')
    view('/a', 'v2')
    const a = (await getPieces(7)).find((p) => p.path === '/a')
    expect(a).toEqual({ path: '/a', views: 3, visitors: 2 })
  })

  it('honours the window, so the list agrees with the table above it', async () => {
    view('/recent', 'v1', ago(1))
    view('/ancient', 'v1', ago(24 * 40))
    const paths = (await getPieces(7)).map((p) => p.path)
    expect(paths).toContain('/recent')
    expect(paths).not.toContain('/ancient')
  })

  it('is empty rather than throwing when nothing has been read', async () => {
    expect(await getPieces(7)).toEqual([])
  })
})

describe('leftQuickly: a glance, not a read', () => {
  it('counts a leave under ten seconds, however far down the page it got', () => {
    leave('/a', 100, QUICK_MS - 1)
    expect(leftQuickly(ago(24), '/a')).toEqual({ share: 100, measured: 1 })
  })

  it('counts a leave under a quarter read, however long it lasted', () => {
    leave('/a', QUICK_DEPTH - 1, 10 * 60_000)
    expect(leftQuickly(ago(24), '/a')).toEqual({ share: 100, measured: 1 })
  })

  /**
   * THE COHORT THE BEACON USED TO DROP.
   *
   * A reader who lands on a long article and leaves without scrolling measures depth 0. The
   * beacon refused to send that sample until 2026-08-30 (`assets/js/track.ts`), so the one
   * visit this metric exists to count was the one visit never recorded.
   */
  it('counts the sample a bounce actually produces: depth 0, a few seconds', () => {
    leave('/a', 0, 4_000)
    expect(leftQuickly(ago(24), '/a')).toEqual({ share: 100, measured: 1 })
  })

  it('does not count a long, deep read', () => {
    leave('/a', 90, 5 * 60_000)
    expect(leftQuickly(ago(24), '/a')).toEqual({ share: 0, measured: 1 })
  })

  // A sample whose dwell was never measured still counts as MEASURED — it is a leave that
  // happened — and is judged on depth alone rather than being read as a fast exit.
  it('judges a sample with no dwell on its depth alone', () => {
    leave('/a', 90, null)
    expect(leftQuickly(ago(24), '/a')).toEqual({ share: 0, measured: 1 })
    leave('/b', 10, null)
    expect(leftQuickly(ago(24), '/b')).toEqual({ share: 100, measured: 1 })
  })

  it('rounds the share over the samples it has', () => {
    leave('/a', 0, 1_000)
    leave('/a', 0, 1_000)
    leave('/a', 90, 60_000)
    leave('/a', 90, 60_000)
    expect(leftQuickly(ago(24), '/a')).toEqual({ share: 50, measured: 4 })
  })

  // Zero of zero is zero, not NaN and not 100. The tile shows `measured` beside it, which
  // is how a reader of the screen tells "nobody glanced" from "nothing was measured".
  it('is zero over zero samples rather than a division', () => {
    expect(leftQuickly(ago(24), '/nothing')).toEqual({ share: 0, measured: 0 })
  })

  it('scopes to the path, and the site-wide form takes them all', () => {
    leave('/a', 0, 1_000)
    leave('/b', 90, 60_000)
    expect(leftQuickly(ago(24), '/a')).toEqual({ share: 100, measured: 1 })
    expect(leftQuickly(ago(24), '/b')).toEqual({ share: 0, measured: 1 })
    expect(leftQuickly(ago(24), null)).toEqual({ share: 50, measured: 2 })
  })

  it('reaches the per-page screen', async () => {
    view('/a')
    leave('/a', 0, 2_000)
    expect((await getPageAnalytics('/a', 7)).leftQuickly).toEqual({ share: 100, measured: 1 })
  })
})
