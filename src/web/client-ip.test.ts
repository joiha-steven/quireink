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
   * With no proxy in front, neither header is present and every visitor used to share one
   * bucket called 'unknown' — so one person searching rate-limited the whole site. The
   * second visitor here starts with a full allowance.
   */
  it('gives each visitor their own allowance when there is no proxy at all', async () => {
    expect(await firstRefusal(OVER_THE_CAP, () => search('203.0.113.7'))).not.toBeNull()
    expect((await search('198.51.100.4')).status).toBe(200)
  })

  /** The ordinary deployment: nginx on the same box, so the header IS the reader. */
  it('still counts the forwarded reader when the peer is the local proxy', async () => {
    const at = await firstRefusal(OVER_THE_CAP, () =>
      search('::ffff:127.0.0.1', { 'cf-connecting-ip': '198.51.100.9' }))
    expect(at).not.toBeNull()
    // A different reader behind the same proxy is unaffected by the one that was refused.
    expect((await search('::ffff:127.0.0.1', { 'cf-connecting-ip': '198.51.100.10' })).status).toBe(200)
  })
})
