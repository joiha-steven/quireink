// Who a rate limit counts, driven through the real router.
//
// `rate-limit.test.ts` covers `clientIp` as a function. This drives `/api/search` — a real
// public route with a real cap — because the two defects it pins were both measured against
// a running server and neither was visible from the unit above.
//
// The peer address is supplied the way `Bun.serve` supplies it: the server object is passed
// as the second argument to `fetch`, which Hono surfaces as `c.env`, and `app.request`
// takes it as its third argument. Nothing here is a stub of the code under test — only of
// the socket the process would otherwise need.

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { savePost } from '@/content/posts'
import { resetLimits } from '@/server/rate-limit'
import { forgetCloudflareInFront, saveIntegrationKeys } from '@/store/integration-keys'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-client-ip'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()

/** `Bun.serve` as far as `clientIp` is concerned: a peer address and nothing else. */
const serverAt = (address: string) => ({ requestIP: () => ({ address }) })

const search = (peer: string, headers: Record<string, string> = {}): Promise<Response> =>
  Promise.resolve(app.request('/api/search?q=probe', { headers }, serverAt(peer)))

/** The number of the first request that came back 429, or null if none did. */
async function firstRefusal(
  count: number,
  send: (i: number) => Promise<Response>,
): Promise<number | null> {
  for (let i = 1; i <= count; i++) {
    if ((await send(i)).status === 429) return i
  }
  return null
}

// The cap is 60 a minute (`web/search-api.ts`), so 70 is enough to cross it and few enough
// to stay quick.
const OVER_THE_CAP = 70

// One post, so the route has something to match and every test starts from the same
// database. The limiter is what each test resets.
await savePost({
  title: 'Probe', slug: 'probe', content: 'probe', status: 'published',
  date: '2020-01-01T00:00:00.000Z',
})

describe('who a public rate limit counts', () => {
  beforeEach(() => resetLimits())

  /**
   * `CF-Connecting-IP` was read unconditionally, so a request straight to the origin could
   * carry a made-up one and rotating it walked through the cap untouched: measured at 70
   * requests, 70 answered. Cloudflare overwrites the header, so the live instances were
   * covered by their deployment and the software was not.
   */
  it('does not let a public peer forge its way past the cap', async () => {
    const at = await firstRefusal(OVER_THE_CAP, (i) =>
      search('203.0.113.7', { 'cf-connecting-ip': `10.0.0.${i % 256}` }))
    expect(at).not.toBeNull()
    expect(at).toBeLessThanOrEqual(62)
  })

  /**
   * The same defect, one layer in, and the one a default install has: put ANY reverse proxy
   * in front and the peer becomes a trusted local hop, so the forged header was believed
   * again. Measured through a real Caddy 2 on 2026-09-01 — 45 requests against a 30-per-
   * minute cap, a different made-up `CF-Connecting-IP` on each, ZERO refused, where the same
   * 45 without the header were refused 16. Caddy replaces `X-Forwarded-For` with the peer it
   * saw, so that one is not forgeable; `CF-Connecting-IP` is an unknown header to it and goes
   * straight through. Cloudflare is the only front that overwrites it.
   */
  it('does not let a forged CF header past the cap when Cloudflare is not the front', async () => {
    const at = await firstRefusal(OVER_THE_CAP, (i) =>
      search('::ffff:127.0.0.1', { 'cf-connecting-ip': `10.0.0.${i % 256}` }))
    expect(at).not.toBeNull()
    expect(at).toBeLessThanOrEqual(62)
  })

  /** And once the owner turns the zone on in the admin, the header is the reader again. */
  it('counts the CF header once the zone is configured', async () => {
    await saveIntegrationKeys({ cloudflareApiToken: 'token', cloudflareZoneId: 'zone' })
    forgetCloudflareInFront()
    try {
      const at = await firstRefusal(OVER_THE_CAP, () =>
        search('::ffff:127.0.0.1', { 'cf-connecting-ip': '198.51.100.9' }))
      expect(at).not.toBeNull()
      // A different reader behind the same zone is unaffected by the one that was refused.
      expect((await search('::ffff:127.0.0.1', { 'cf-connecting-ip': '198.51.100.10' })).status).toBe(200)
    } finally {
      await saveIntegrationKeys({ cloudflareApiToken: '', cloudflareZoneId: '' })
      forgetCloudflareInFront()
    }
  })

  /**
   * With no proxy in front, neither header is present and every visitor used to share one
   * bucket called 'unknown' — so one person searching rate-limited the whole site. The
   * second visitor here starts with a full allowance.
   */
  it('gives each visitor their own allowance when there is no proxy at all', async () => {
    expect(await firstRefusal(OVER_THE_CAP, () => search('203.0.113.7'))).not.toBeNull()
    expect((await search('198.51.100.4')).status).toBe(200)
  })

  /** The ordinary deployment: Caddy or nginx on the same box, so the header IS the reader. */
  it('still counts the forwarded reader when the peer is the local proxy', async () => {
    const at = await firstRefusal(OVER_THE_CAP, () =>
      search('::ffff:127.0.0.1', { 'x-forwarded-for': '198.51.100.9' }))
    expect(at).not.toBeNull()
    // A different reader behind the same proxy is unaffected by the one that was refused.
    expect((await search('::ffff:127.0.0.1', { 'x-forwarded-for': '198.51.100.10' })).status).toBe(200)
  })

  /**
   * The first hop is whatever the client sent, on nginx (`$proxy_add_x_forwarded_for`) and on
   * Cloudflare, both of which append. Reading it let a client pick its own bucket without
   * needing to know the CF header existed.
   */
  it('does not let a forged first hop past the cap', async () => {
    const at = await firstRefusal(OVER_THE_CAP, (i) =>
      search('::ffff:127.0.0.1', { 'x-forwarded-for': `10.0.0.${i % 256}, 198.51.100.9` }))
    expect(at).not.toBeNull()
    expect(at).toBeLessThanOrEqual(62)
  })
})
