// When this process began, which a dashboard and the cache counter print. Taken when the module
// loads, which is right on Bun and is 0 in workerd: a clock read at an isolate's global scope reads
// the epoch, and the dashboard said "Started 20,760 days ago", analytics "since Jan 1, 1970"
// (2026-11-03). The Durable Object stamps both at its first request (`worker.ts` `boot`).
import { describe, expect, it } from 'bun:test'
import { markStarted, startedAt, setStartedForTest } from '@/server/started'
import { cacheStats } from '@/server/cache'

describe('the start of this process', () => {
  it('is the module\'s load time where the clock ran then', () => {
    expect(startedAt()).toBeGreaterThan(Date.parse('2020-01-01'))
  })

  it('is stamped at the first request where the load read the epoch, the cache counter too', () => {
    setStartedForTest(0)
    cacheStats.since = 0
    markStarted(1_800_000_000_000)
    expect(startedAt()).toBe(1_800_000_000_000)
    expect(cacheStats.since).toBe(1_800_000_000_000)
    markStarted(1_900_000_000_000)
    expect(startedAt()).toBe(1_800_000_000_000)
  })
})
