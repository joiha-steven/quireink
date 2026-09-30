// The scheduled sweep against a real table (2026-09-30): notes cross too, and the hourly
// backstop keeps its own window instead of inheriting the minute tick's.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { onFlush } from '@/server/cache'
import { HOURLY_LOOKBACK_MS, PUBLISH_TICK_LOOKBACK_MS, resetSweepWindow, sweepScheduled } from '@/server/scheduled'

const DIR = './.tmp/test-sweep'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

let flushes = 0
onFlush(() => { flushes++ })

beforeEach(() => {
  for (const t of ['posts', 'notes']) db().run(`delete from ${t}`)
  resetSweepWindow()
  flushes = 0
})

const note = (slug: string, date: number) =>
  db().run(`insert into notes (slug, date, status, content, created_at, updated_at) values (?, ?, 'published', 'x', ?, ?)`,
    [slug, date, date, date])

describe('the scheduled sweep', () => {
  it('flushes when a scheduled note reaches its time, as it does for a post', async () => {
    note('later', Date.now() - 30_000)
    expect(await sweepScheduled(PUBLISH_TICK_LOOKBACK_MS)).toBe(1)
    expect(flushes).toBe(1)
    // Crossing is once: the next minute tick starts where this one ended.
    expect(await sweepScheduled(PUBLISH_TICK_LOOKBACK_MS)).toBe(0)
  })

  it('lets the hourly backstop see a crossing the minute tick already swept', async () => {
    // Twenty minutes ago: the minute tick missed it (say the process was down), and the
    // hourly tick is the one that exists to catch it.
    note('missed', Date.now() - 20 * 60_000)
    expect(await sweepScheduled(PUBLISH_TICK_LOOKBACK_MS)).toBe(0)
    expect(await sweepScheduled(HOURLY_LOOKBACK_MS)).toBe(1)
  })
})
