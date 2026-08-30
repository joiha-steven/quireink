import type { Context } from 'hono'
import { describe, it, expect, vi, beforeEach, afterEach } from '@/test/vitest'
import { rateLimited, overLimit, recordHit, clientIp, resetLimits } from '@/server/rate-limit'

describe('rateLimited', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('blocks only after exceeding max within the window', () => {
    const k = `t-${Math.random()}`
    expect(rateLimited(k, 2, 1000)).toBe(false) // 1
    expect(rateLimited(k, 2, 1000)).toBe(false) // 2
    expect(rateLimited(k, 2, 1000)).toBe(true) // 3 > max
  })

  it('forgets old hits once the window passes (and evicts the key)', () => {
    const k = `t-${Math.random()}`
    rateLimited(k, 1, 1000)
    expect(rateLimited(k, 1, 1000)).toBe(true)
    vi.advanceTimersByTime(90_000) // window elapsed, and past the sweep cadence
    // A hit on a DIFFERENT key triggers the sweep that drops the now-stale key…
    rateLimited(`other-${Math.random()}`, 1, 1000)
    // …and the original key starts fresh (not still-blocked).
    expect(rateLimited(k, 1, 1000)).toBe(false)
  })

  /**
   * The regression. Sign-in charges a fifteen-minute window and every public endpoint
   * charges one minute, into the same map — and the sweep used to apply the CALLER's window
   * to every key in it, so one ordinary search request ninety seconds later deleted a
   * lockout that had fourteen minutes left to run.
   */
  it('a short window does not sweep away a long one', () => {
    resetLimits()
    const locked = `login:ip:${Math.random()}`
    const FIFTEEN_MIN = 15 * 60_000
    for (let i = 0; i < 5; i++) recordHit(locked, FIFTEEN_MIN)
    expect(overLimit(locked, 5, FIFTEEN_MIN)).toBe(true)

    vi.advanceTimersByTime(90_000) // long past the 60s window, nowhere near fifteen minutes
    rateLimited(`search:${Math.random()}`, 60) // an ordinary public request, default window

    expect(overLimit(locked, 5, FIFTEEN_MIN)).toBe(true)
  })

  it('still evicts a long-window key once its OWN window has passed', () => {
    resetLimits()
    const k = `login:ip:${Math.random()}`
    recordHit(k, 15 * 60_000)
    vi.advanceTimersByTime(16 * 60_000)
    rateLimited(`search:${Math.random()}`, 60) // triggers the sweep
    expect(overLimit(k, 1, 15 * 60_000)).toBe(false)
  })
})

describe('clientIp', () => {
  /**
   * A context with a peer address, the way `Bun.serve` supplies one — it passes itself as
   * the second argument to `fetch`, which Hono surfaces as `c.env`. `peer: null` is the
   * unit-test shape: an app driven through `app.request()` has no server behind it.
   */
  const ctx = (headers: Record<string, string>, peer: string | null): Context => {
    const raw = new Request('https://x/', { headers })
    return {
      req: { raw, header: (n: string) => raw.headers.get(n) ?? undefined },
      env: peer === null ? {} : { requestIP: () => ({ address: peer }) },
    } as unknown as Context
  }

  it('believes a proxy header when the peer is the local reverse proxy', () => {
    const c = ctx({ 'cf-connecting-ip': '9.9.9.9', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, '::ffff:127.0.0.1')
    expect(clientIp(c)).toBe('9.9.9.9')
  })

  it('prefers CF-Connecting-IP over X-Forwarded-For, whose first hop the client may have sent', () => {
    expect(clientIp(ctx({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, '10.0.0.3'))).toBe('1.2.3.4')
  })

  /**
   * The other regression, and the one that measured: a request straight to the origin used
   * to have its made-up `CF-Connecting-IP` believed, so rotating the value walked through
   * a 60-per-minute cap 70 times without a single refusal.
   */
  it('ignores a forged proxy header from a public peer', () => {
    const c = ctx({ 'cf-connecting-ip': '9.9.9.9', 'x-forwarded-for': '1.2.3.4' }, '203.0.113.7')
    expect(clientIp(c)).toBe('203.0.113.7')
  })

  it('TRUST_PROXY=1 believes the header even from a public peer', () => {
    const before = process.env.TRUST_PROXY
    process.env.TRUST_PROXY = '1'
    try {
      expect(clientIp(ctx({ 'cf-connecting-ip': '9.9.9.9' }, '203.0.113.7'))).toBe('9.9.9.9')
    } finally {
      if (before === undefined) delete process.env.TRUST_PROXY
      else process.env.TRUST_PROXY = before
    }
  })

  /**
   * With no proxy at all every visitor used to share one bucket called 'unknown', so one
   * person searching rate-limited the whole site. The peer is what separates them now.
   */
  it('separates visitors by peer when there is no proxy header', () => {
    expect(clientIp(ctx({}, '203.0.113.7'))).toBe('203.0.113.7')
    expect(clientIp(ctx({}, '198.51.100.4'))).toBe('198.51.100.4')
  })

  it('falls back to unknown only when there is no server and no header', () => {
    expect(clientIp(ctx({}, null))).toBe('unknown')
  })

  /**
   * EVERY range the local-hop test claims, one row each.
   *
   * It was pinned by two addresses — `::ffff:127.0.0.1` and `10.0.0.3` — and the other five
   * branches were reachable by nothing. Measured on 2026-08-30: making the unique-local test
   * (`fc00::/7`) answer the opposite left all 2377 tests green, and the symptom would have
   * been the regression this file already records, on the container networks where it is the
   * normal setup — a proxy on `fd00::` stops being believed, every visitor collapses into the
   * proxy's own bucket, and one person searching rate-limits the site.
   */
  const LOCAL = [
    ['IPv6 loopback', '::1'],
    ['IPv4 loopback, as Bun maps it', '::ffff:127.0.0.1'],
    ['IPv4 loopback', '127.0.0.53'],
    ['unique-local fc00::/7, the container-network default', 'fd00::1'],
    ['the other half of fc00::/7', 'fc00::1'],
    ['IPv6 link-local', 'fe80::1'],
    ['private 10/8', '10.0.0.3'],
    ['private 172.16/12, at the bottom', '172.16.0.1'],
    ['private 172.16/12, at the top', '172.31.255.254'],
    ['private 192.168/16', '192.168.1.1'],
    ['IPv4 link-local', '169.254.0.1'],
  ] as const

  for (const [what, peer] of LOCAL) {
    it(`believes a proxy header from ${what}`, () => {
      expect(clientIp(ctx({ 'cf-connecting-ip': '9.9.9.9' }, peer))).toBe('9.9.9.9')
    })
  }

  // The near misses, so the ranges above are ranges and not "anything starting with 17".
  const PUBLIC = [
    ['just below 172.16/12', '172.15.0.1'],
    ['just above 172.16/12', '172.32.0.1'],
    ['a public address that starts like a private one', '192.169.1.1'],
    ['global unicast IPv6', '2001:db8::1'],
  ] as const

  for (const [what, peer] of PUBLIC) {
    it(`ignores a forged header from ${what}`, () => {
      expect(clientIp(ctx({ 'cf-connecting-ip': '9.9.9.9' }, peer))).toBe(peer)
    })
  }
})
