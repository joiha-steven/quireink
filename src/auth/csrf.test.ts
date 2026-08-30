// The header check that stands in for a CSRF token, and the half of it nothing was watching.
//
// Every test that reached `checkOrigin` before this file sent `Sec-Fetch-Site`, which returns
// on the first branch and never touches the `Origin` fallback underneath. Measured on
// 2026-08-30 by inverting that fallback's two guards one at a time: both inversions left all
// 2377 tests green. The only thing ever asserted about the fallback was that it REFUSES a
// foreign origin (`web/admin.test.ts`); that it ACCEPTS a legitimate same-origin write was
// asserted nowhere. So the branch could have been broken in either direction and the symptom
// would have been every client that does not send Sec-Fetch-Site — an older browser, a
// desktop app, curl with the right cookie — locked out of every write, with a green check,
// no exception, and nothing in any log to look at.
//
// Hence the shape below: a full truth table, and the ACCEPT rows are the point.

import { describe, expect, it } from 'bun:test'
import type { Context } from 'hono'
import { checkOrigin, isStateChanging } from '@/auth/csrf'

/** A context carrying nothing but headers, which is all this function reads. */
const ctx = (headers: Record<string, string>): Context => {
  const raw = new Request('https://blog.test/api/thing', { method: 'POST', headers })
  return {
    req: { raw, header: (n: string) => raw.headers.get(n) ?? undefined },
  } as unknown as Context
}

describe('Sec-Fetch-Site decides on its own when the browser sends it', () => {
  it('accepts same-origin, and a direct navigation, which cannot be a cross-site POST', () => {
    expect(checkOrigin(ctx({ 'sec-fetch-site': 'same-origin' }))).toEqual({ ok: true })
    expect(checkOrigin(ctx({ 'sec-fetch-site': 'none' }))).toEqual({ ok: true })
  })

  it('refuses cross-site, and same-SITE too: a sibling subdomain is not us', () => {
    expect(checkOrigin(ctx({ 'sec-fetch-site': 'cross-site' })))
      .toEqual({ ok: false, reason: 'cross-site' })
    expect(checkOrigin(ctx({ 'sec-fetch-site': 'same-site' })))
      .toEqual({ ok: false, reason: 'cross-site' })
  })

  it('outranks Origin, which script can set and the browser cannot be made to lie about', () => {
    const c = ctx({ 'sec-fetch-site': 'same-origin', origin: 'https://evil.example', host: 'blog.test' })
    expect(checkOrigin(c)).toEqual({ ok: true })
  })
})

describe('the Origin fallback, for a client that sends no Sec-Fetch-Site', () => {
  // ⚠️ THE ROW THE SUITE DID NOT HAVE. Everything else here was reachable through a refusal;
  // this is the one that says the door still opens.
  it('ACCEPTS a write whose Origin is the host it arrived on', () => {
    expect(checkOrigin(ctx({ origin: 'https://blog.test', host: 'blog.test' })))
      .toEqual({ ok: true })
  })

  it('accepts it on a non-default port, because the port is part of the host', () => {
    expect(checkOrigin(ctx({ origin: 'http://blog.test:3399', host: 'blog.test:3399' })))
      .toEqual({ ok: true })
  })

  it('accepts regardless of scheme, since the proxy in front may terminate TLS', () => {
    expect(checkOrigin(ctx({ origin: 'http://blog.test', host: 'blog.test' })))
      .toEqual({ ok: true })
  })

  it('refuses an Origin belonging to somebody else', () => {
    expect(checkOrigin(ctx({ origin: 'https://evil.example', host: 'blog.test' })))
      .toEqual({ ok: false, reason: 'cross-site' })
  })

  it('refuses a subdomain of the host, which is a different origin', () => {
    expect(checkOrigin(ctx({ origin: 'https://cdn.blog.test', host: 'blog.test' })))
      .toEqual({ ok: false, reason: 'cross-site' })
  })

  it('refuses an Origin that is not a URL at all', () => {
    expect(checkOrigin(ctx({ origin: 'null', host: 'blog.test' })))
      .toEqual({ ok: false, reason: 'cross-site' })
  })

  it('refuses when neither header is there: that is not a browser', () => {
    expect(checkOrigin(ctx({}))).toEqual({ ok: false, reason: 'no-origin' })
  })

  it('refuses an Origin with no Host to compare it against', () => {
    expect(checkOrigin(ctx({ origin: 'https://blog.test' })))
      .toEqual({ ok: false, reason: 'no-origin' })
  })
})

describe('isStateChanging', () => {
  it('names the three methods that only read', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) expect(isStateChanging(method)).toBe(false)
  })

  it('treats everything else as a write, including one it has never heard of', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'PURGE']) {
      expect(isStateChanging(method)).toBe(true)
    }
  })
})
