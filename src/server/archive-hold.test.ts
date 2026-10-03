// The archive reads every table twice and fails when one changed in between (ADR 0067). On
// Cloudflare a Durable Object has one connection, so two things keep that rare: the pageview buffer
// does not flush while the rows are read, and an archive a table changed under is taken again.
import { afterAll, describe, expect, it } from 'bun:test'
import { dropDatabase, freshDatabase } from '@/test/db'
import { analyticsDb } from '@/test/sqlite'
import { bufferEvent, flushAnalytics, holdFlushes, pendingAnalytics } from '@/analytics/buffer'
import { withArchiveRetry } from '@/server/archive'

const DIR = './.tmp/test-archive-hold'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const row = (path: string) => ({ path, visitor: 'v', referrerHost: '', country: '', device: 'desktop', browser: 'x', os: 'y', createdAt: Date.now() })
const stored = () => analyticsDb().query<{ n: number }, []>('select count(*) as n from analytics_events').get()!.n

describe('the pageview buffer, held', () => {
  it('keeps every beacon while held and writes them all once let go', async () => {
    const before = stored()
    const release = holdFlushes()
    bufferEvent(row('/a'))
    bufferEvent(row('/b'))
    flushAnalytics()
    expect(stored()).toBe(before)
    expect(pendingAnalytics()).toBeGreaterThanOrEqual(2)
    release()
    release() // twice is harmless
    flushAnalytics()
    expect(stored()).toBe(before + 2)
  })
})

describe('an archive a table changed under', () => {
  it('is taken again, and gives up after three goes', async () => {
    let calls = 0
    const changed = () => { calls++; throw new Error('archive: posts changed while it was being written; take the backup again') }
    await expect(withArchiveRetry(async () => changed())).rejects.toThrow('changed while')
    expect(calls).toBe(3)
    calls = 0
    expect(await withArchiveRetry(async () => { calls++; if (calls < 2) changed(); return 'ok' })).toBe('ok')
  })

  it('is not taken again for any other failure', async () => {
    let calls = 0
    await expect(withArchiveRetry(async () => { calls++; throw new Error('disk full') })).rejects.toThrow('disk full')
    expect(calls).toBe(1)
  })
})
