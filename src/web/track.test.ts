// POST /api/track, driven over real HTTP.
//
// The assertions that matter are the ones about what does NOT get recorded: a bot, an
// admin path, a flood. Analytics that quietly counts crawlers is worse than no analytics,
// because it looks like readers.

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { analyticsDb } from '@/store/db'
import { flushAnalytics, pendingAnalytics, resetAnalyticsBuffer } from '@/analytics/buffer'
import { createApp } from '@/web/app'

// Its own directory: `openDatabases` holds one connection pair per process, so two test
// files sharing a directory would close each other's.
const DIR = './.tmp/test-track'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()

const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  + ' (KHTML, like Gecko) Chrome/140.0 Safari/537.36'

/** One beacon. A fresh IP per test keeps the rate limiter out of the way. */
const beacon = (body: unknown, ip = '203.0.113.1', ua = BROWSER): Promise<Response> =>
  Promise.resolve(app.request('/api/track', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'user-agent': ua, 'x-forwarded-for': ip },
  }))

beforeEach(() => {
  resetAnalyticsBuffer()
  analyticsDb().run(`delete from analytics_events`)
  analyticsDb().run(`delete from analytics_scroll`)
})

describe('POST /api/track', () => {
  it('records a page view, and answers 204 without a body', async () => {
    const res = await beacon({ path: '/hello', referrer: 'news.ycombinator.com' })
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(pendingAnalytics()).toBe(1)

    flushAnalytics()
    const row = analyticsDb().query<{ path: string; referrer_host: string | null; device: string }, []>(
      `select path, referrer_host, device from analytics_events`,
    ).get()
    expect(row?.path).toBe('/hello')
    expect(row?.referrer_host).toBe('news.ycombinator.com')
    expect(row?.device).toBe('desktop')
  })

  it('records a depth sample as a scroll, not as a second view', async () => {
    await beacon({ path: '/hello', depth: 72, dwell: 41_000 })
    flushAnalytics()
    expect(analyticsDb().query<{ n: number }, []>(`select count(*) as n from analytics_events`).get()?.n).toBe(0)
    const row = analyticsDb().query<{ depth: number; dwell_ms: number | null }, []>(
      `select depth, dwell_ms from analytics_scroll`,
    ).get()
    expect(row?.depth).toBe(72)
    expect(row?.dwell_ms).toBe(41_000)
  })

  it('stores no IP and no user-agent, only a hash', async () => {
    await beacon({ path: '/hello' }, '198.51.100.7')
    flushAnalytics()
    const dump = JSON.stringify(analyticsDb().query<Record<string, unknown>, []>(`select * from analytics_events`).all())
    expect(dump).not.toContain('198.51.100.7')
    expect(dump).not.toContain('Chrome/140.0')
  })

  it('drops a bot', async () => {
    const res = await beacon({ path: '/hello' }, '203.0.113.2', 'Googlebot/2.1 (+http://www.google.com/bot.html)')
    expect(res.status).toBe(204) // never tells the caller it was dropped
    expect(pendingAnalytics()).toBe(0)
  })

  it('drops admin and api paths', async () => {
    await beacon({ path: '/admin/posts' }, '203.0.113.3')
    await beacon({ path: '/api/search' }, '203.0.113.4')
    expect(pendingAnalytics()).toBe(0)
  })

  it('drops an empty or missing path, and malformed JSON', async () => {
    await beacon({ path: '' })
    await beacon({})
    const bad = await app.request('/api/track', {
      method: 'POST',
      body: 'not json at all',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.5' },
    })
    expect(bad.status).toBe(204)
    expect(pendingAnalytics()).toBe(0)
  })

  it('caps one IP so a script cannot flood the table', async () => {
    for (let i = 0; i < 260; i++) await beacon({ path: `/p${i}` }, '203.0.113.9')
    // Counted in the TABLE, not in the buffer: the buffer flushes itself at MAX_ROWS, so
    // by this point most of these are already on disk. 240 a minute, and every call over
    // it is a silent 204 — telling a flooder they have been limited tells them what to
    // change.
    flushAnalytics()
    expect(analyticsDb().query<{ n: number }, []>(`select count(*) as n from analytics_events`).get()?.n).toBe(240)
  })

  it('leaves the referrer null when the beacon sends none', async () => {
    await beacon({ path: '/hello' })
    flushAnalytics()
    const row = analyticsDb().query<{ referrer_host: string | null }, []>(
      `select referrer_host from analytics_events`,
    ).get()
    expect(row?.referrer_host).toBeNull()
  })
})
