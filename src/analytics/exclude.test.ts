// The exclusions are worth a test for one reason: they fail SILENTLY in both directions.
// Too loose and the owner's own reloads inflate every number on the dashboard; too tight and
// real readers quietly stop being counted, which looks like a traffic drop rather than a bug.

import { describe, expect, it, afterAll, beforeEach } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createUser } from '@/auth/users'
import { createSession } from '@/auth/sessions'
import { isInternalIp } from '@/analytics/exclude'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-exclude'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const READER_IP = '203.0.113.7'
const OWNER_IP = '198.51.100.4'
const READER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149 Safari/537.36'

/** One beacon, exactly as the island sends it. */
const track = (ip: string, extra: Record<string, string> = {}) =>
  app.request('/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': READER_UA, 'x-forwarded-for': ip, ...extra },
    body: JSON.stringify({ path: '/a-post' }),
  })

const viewCount = (): number =>
  db().query<{ n: number }, []>(`select count(*) as n from analytics.analytics_events`).get()?.n ?? 0

let owner: { id: number }
let ownerCookie = ''

beforeEach(async () => {
  db().run(`delete from analytics.analytics_events`)
  db().run(`delete from sessions`)
  db().run(`delete from users`)
  owner = await createUser({ username: 'owner', email: 'owner@example.com', password: 'kx7Qm-vault-heron-92' })
  const { token } = createSession(owner.id, { ip: OWNER_IP, userAgent: READER_UA })
  ownerCookie = `__Host-quire_session=${token}`
  // No post is created on purpose: the beacon records whatever path it is given, and a
  // fixture that has to exist would only be another thing to keep in step.
})

describe('who counts as a reader', () => {
  it('counts a reader', async () => {
    expect((await track(READER_IP)).status).toBe(204)
    const { flushAnalytics } = await import('@/analytics/buffer')
    flushAnalytics()
    expect(viewCount()).toBe(1)
  })

  it('does not count a request carrying the owner session', async () => {
    expect((await track(READER_IP, { cookie: ownerCookie })).status).toBe(204)
    const { flushAnalytics } = await import('@/analytics/buffer')
    flushAnalytics()
    expect(viewCount()).toBe(0)
  })

  it('does not count the owner from the same IP with no cookie at all', async () => {
    // The second browser / private window / phone case. There is nothing to identify but
    // the address a live session was created from.
    expect((await track(OWNER_IP)).status).toBe(204)
    const { flushAnalytics } = await import('@/analytics/buffer')
    flushAnalytics()
    expect(viewCount()).toBe(0)
  })

  it('counts that IP again once the session is gone', async () => {
    db().run(`delete from sessions`)
    expect((await track(OWNER_IP)).status).toBe(204)
    const { flushAnalytics } = await import('@/analytics/buffer')
    flushAnalytics()
    expect(viewCount()).toBe(1)
  })

  it('does not count the box talking to itself', async () => {
    for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '192.168.1.20', '10.0.0.5', '172.20.1.1']) {
      expect((await track(ip)).status).toBe(204)
    }
    const { flushAnalytics } = await import('@/analytics/buffer')
    flushAnalytics()
    expect(viewCount()).toBe(0)
  })
})

describe('isInternalIp', () => {
  it('knows the private ranges from the public ones', () => {
    for (const ip of ['127.0.0.1', '::1', '10.1.2.3', '192.168.0.1', '172.16.0.1', '172.31.255.255', 'fd00::1', '', 'unknown']) {
      expect(isInternalIp(ip)).toBe(true)
    }
    // 172.32 is OUTSIDE the private block, and so is 172.15 — the range is 16 to 31 and a
    // naive `startsWith('172.')` would swallow both.
    for (const ip of ['203.0.113.7', '8.8.8.8', '172.32.0.1', '172.15.0.1', '2001:db8::1']) {
      expect(isInternalIp(ip)).toBe(false)
    }
  })
})
