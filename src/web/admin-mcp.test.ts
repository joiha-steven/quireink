// The MCP OAuth layer.
//
// The account-takeover path is the reason this has tests at all: /api/mcp/register is
// public, so an attacker can register a client pointing at their own host and phish the
// owner into authorizing it. The allowlist passes — it really is registered for that
// client — and only the consent step plus its session-bound CSRF token stop a code being
// issued to them.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { createHash, randomBytes } from 'node:crypto'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { saveSettings } from '@/content/settings'
import { payload } from '@/test/api'

const DIR = './.tmp/test-admin-mcp'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
let cookie = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'mcp_tokens', 'mcp_clients', 'mcp_used_codes',
                   'activity_log', 'settings', 'server_secrets']) {
    db().run(`delete from ${t}`)
  }
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
  await saveSettings({ mcp: { enabled: true } })
})

const asOwner = (path: string, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: { cookie, 'sec-fetch-site': 'same-origin', ...(init.headers as Record<string, string> ?? {}) },
  })

/** A PKCE pair, the S256 way the flow requires. */
function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

const register = async (uris: string[]): Promise<string> => {
  const res = await app.request('/api/mcp/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ redirect_uris: uris }),
  })
  return (await payload<{ client_id: string }>(res)).client_id
}

describe('token management', () => {
  it('is owner-gated', async () => {
    expect((await app.request('/api/mcp/tokens')).status).toBe(401)
    const res = await app.request('/api/mcp/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify({ name: 'x' }),
    })
    expect(res.status).toBe(401)
    const del = await app.request('/api/mcp/tokens/1', {
      method: 'DELETE', headers: { 'sec-fetch-site': 'same-origin' },
    })
    expect(del.status).toBe(401)
  })

  // The origin check runs BEFORE the session check, so a cross-site write is 403 whether
  // or not it is authenticated. That is the right order: the request is rejected for
  // where it came from, and signing in would not change that.
  it('answers a cross-site write 403, not 401, even with no session', async () => {
    const res = await app.request('/api/mcp/tokens/1', {
      method: 'DELETE', headers: { 'sec-fetch-site': 'cross-site' },
    })
    expect(res.status).toBe(403)
  })

  it('returns the plaintext once and stores only a hash', async () => {
    const res = await asOwner('/api/mcp/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Claude' }),
    })
    expect(res.status).toBe(201)
    const { token } = await payload<{ token: string; info: { id: number } }>(res)
    expect(token.length).toBeGreaterThan(20)

    // The list never carries it again, and neither does the table.
    const listed = JSON.stringify(await (await asOwner('/api/mcp/tokens')).json())
    expect(listed).not.toContain(token)
    const stored = db().query<{ token_hash: string }, []>(`select token_hash from mcp_tokens`).all()
    for (const row of stored) expect(row.token_hash).not.toBe(token)
  })

  it('requires a name', async () => {
    const res = await asOwner('/api/mcp/tokens', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

describe('client registration', () => {
  it('mints a client id and demands at least one redirect_uri', async () => {
    const good = await app.request('/api/mcp/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redirect_uris: ['https://example.com/cb'] }),
    })
    expect(good.status).toBe(201)
    const body = await payload<{ client_id: string; token_endpoint_auth_method: string }>(good)
    expect(body.client_id.length).toBeGreaterThan(8)
    // No client secret: PKCE is what secures this flow.
    expect(body.token_endpoint_auth_method).toBe('none')

    const bad = await app.request('/api/mcp/register', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
    })
    expect(bad.status).toBe(400)
  })

  it('refuses registration while MCP is switched off', async () => {
    await saveSettings({ mcp: { enabled: false } })
    const res = await app.request('/api/mcp/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redirect_uris: ['https://example.com/cb'] }),
    })
    expect(res.status).toBe(503)
  })
})

describe('authorize', () => {
  const authorizeUrl = (clientId: string, redirectUri: string, challenge: string) =>
    `/api/mcp/authorize?response_type=code&client_id=${clientId}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&code_challenge=${challenge}&code_challenge_method=S256&state=xyz`

  it('rejects a malformed request before looking at anything else', async () => {
    const { challenge } = pkce()
    const id = await register(['https://example.com/cb'])
    // No PKCE method.
    const res = await asOwner(
      `/api/mcp/authorize?response_type=code&client_id=${id}`
      + `&redirect_uri=${encodeURIComponent('https://example.com/cb')}&code_challenge=${challenge}`,
    )
    expect(res.status).toBe(400)
  })

  it('rejects a redirect_uri not registered for that client', async () => {
    const { challenge } = pkce()
    const id = await register(['https://example.com/cb'])
    const res = await asOwner(authorizeUrl(id, 'https://evil.example/cb', challenge))
    expect(res.status).toBe(400)
    // Never a redirect to the unvalidated URI — that would make this an open redirect.
    expect(res.headers.get('location')).toBeNull()
  })

  it('sends someone who is not signed in to the sign-in page', async () => {
    const { challenge } = pkce()
    const id = await register(['https://example.com/cb'])
    const res = await app.request(authorizeUrl(id, 'https://example.com/cb', challenge))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/login?next=')
  })

  // Loopback used to auto-approve ("the owner's own machine, little risk") — but the
  // authorize route is a GET, and any web page can make the signed-in owner's browser
  // issue a GET. With auto-approve, that GET handed a code to whatever listened on the
  // port, with no click and no CSRF anywhere in the path. Since 2026-08-29 loopback walks
  // through the same consent page as everyone else.
  it('shows consent for a loopback redirect too — a bare GET issues NO code', async () => {
    const { challenge } = pkce()
    const id = await register(['http://127.0.0.1:8123/cb'])
    const res = await asOwner(authorizeUrl(id, 'http://127.0.0.1:8123/cb', challenge))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    expect(await res.text()).toContain('127.0.0.1')
  })

  /**
   * THE attack. A non-loopback redirect must NOT auto-issue: the owner has to see the
   * exact client and host first. A code in this response is account takeover.
   */
  it('shows consent for a non-loopback redirect and issues NO code', async () => {
    const { challenge } = pkce()
    const id = await register(['https://evil.example/cb'])
    const res = await asOwner(authorizeUrl(id, 'https://evil.example/cb', challenge))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    const html = await res.text()
    // The owner must be able to read what they are trusting.
    expect(html).toContain('evil.example')
    expect(html).toContain(id)
  })

  it('refuses an approve POST with no CSRF token', async () => {
    const { challenge } = pkce()
    const id = await register(['https://evil.example/cb'])
    const res = await asOwner('/api/mcp/authorize', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: id, redirect_uri: 'https://evil.example/cb', code_challenge: challenge, state: '', csrf: '',
      }),
    })
    expect(res.status).toBe(403)
  })

  it('refuses an approve POST carrying another session\'s CSRF token', async () => {
    const { challenge } = pkce()
    const id = await register(['https://evil.example/cb'])
    // A token minted for this session...
    const page = await (await asOwner(authorizeUrl(id, 'https://evil.example/cb', challenge))).text()
    const csrf = page.match(/name="csrf" value="([^"]*)"/)![1]
    expect(csrf.length).toBeGreaterThan(10)

    // ...is worthless from a different session.
    // `additional`: see `auth/users.ts`. One owner is the design; this second account exists
    // only to prove a CSRF token does not travel between accounts.
    const other = await createUser({ username: 'other', email: 'o@example.com', password: 'another long passphrase', additional: true })
    const otherCookie = `${COOKIE_NAME}=${createSession(other.id).token}`
    const res = await app.request('/api/mcp/authorize', {
      method: 'POST',
      headers: { cookie: otherCookie, 'sec-fetch-site': 'same-origin' },
      body: new URLSearchParams({
        client_id: id, redirect_uri: 'https://evil.example/cb', code_challenge: challenge, state: '', csrf,
      }),
    })
    expect(res.status).toBe(403)
  })

  it('issues a code once the owner really approves', async () => {
    const { challenge } = pkce()
    const id = await register(['https://example.com/cb'])
    const page = await (await asOwner(authorizeUrl(id, 'https://example.com/cb', challenge))).text()
    const csrf = page.match(/name="csrf" value="([^"]*)"/)![1]
    const res = await asOwner('/api/mcp/authorize', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: id, redirect_uri: 'https://example.com/cb', code_challenge: challenge, state: 'xyz', csrf,
      }),
    })
    expect(res.status).toBe(302)
    expect(new URL(res.headers.get('location')!).searchParams.get('code')).toBeTruthy()
  })
})

describe('the token exchange', () => {
  /** Run the flow to a code the way every client now runs it: consent page, then Approve. */
  async function getCode(): Promise<{ code: string; verifier: string; redirectUri: string }> {
    const { verifier, challenge } = pkce()
    const redirectUri = 'http://127.0.0.1:8123/cb'
    const id = await register([redirectUri])
    const page = await (await asOwner(
      `/api/mcp/authorize?response_type=code&client_id=${id}`
      + `&redirect_uri=${encodeURIComponent(redirectUri)}`
      + `&code_challenge=${challenge}&code_challenge_method=S256`,
    )).text()
    const csrf = page.match(/name="csrf" value="([^"]*)"/)![1]!
    const res = await asOwner('/api/mcp/authorize', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: id, redirect_uri: redirectUri, code_challenge: challenge, state: '', csrf,
      }),
    })
    return {
      code: new URL(res.headers.get('location')!).searchParams.get('code')!,
      verifier,
      redirectUri,
    }
  }

  const exchange = (fields: Record<string, string>) =>
    app.request('/api/mcp/token', { method: 'POST', body: new URLSearchParams(fields) })

  it('exchanges a code and PKCE verifier for a bearer token', async () => {
    const { code, verifier, redirectUri } = await getCode()
    const res = await exchange({
      grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier,
    })
    expect(res.status).toBe(200)
    const body = await payload<{ access_token: string; token_type: string }>(res)
    expect(body.token_type).toBe('Bearer')
    expect(body.access_token.length).toBeGreaterThan(20)
  })

  // Single use. The jti is consumed on first exchange; without that, a stateless HMAC
  // code is replayable for its whole lifetime.
  it('refuses the same code twice', async () => {
    const { code, verifier, redirectUri } = await getCode()
    const fields = { grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier }
    expect((await exchange(fields)).status).toBe(200)
    const replay = await exchange(fields)
    expect(replay.status).toBe(400)
    expect(await replay.json()).toEqual({ error: 'invalid_grant' })
  })

  it('refuses a wrong PKCE verifier', async () => {
    const { code, redirectUri } = await getCode()
    const res = await exchange({
      grant_type: 'authorization_code', code, redirect_uri: redirectUri,
      code_verifier: randomBytes(32).toString('base64url'),
    })
    expect(res.status).toBe(400)
  })

  it('refuses a redirect_uri that does not match the one the code was bound to', async () => {
    const { code, verifier } = await getCode()
    const res = await exchange({
      grant_type: 'authorization_code', code,
      redirect_uri: 'http://127.0.0.1:9999/cb', code_verifier: verifier,
    })
    expect(res.status).toBe(400)
  })

  // One error for every failure. Which check failed is not the client's business, and
  // saying would turn this into an oracle.
  it('gives the same error for a tampered code, a bad verifier and a replay', async () => {
    const { code, verifier, redirectUri } = await getCode()
    const tampered = await exchange({
      grant_type: 'authorization_code', code: `${code}x`, redirect_uri: redirectUri, code_verifier: verifier,
    })
    expect(await tampered.json()).toEqual({ error: 'invalid_grant' })
  })

  it('rejects a grant type it does not support', async () => {
    const res = await exchange({ grant_type: 'password', code: 'x', redirect_uri: 'y', code_verifier: 'z' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'unsupported_grant_type' })
  })
})

describe('discovery metadata', () => {
  it('publishes both documents with CORS, so a connector can read them', async () => {
    for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-authorization-server']) {
      const res = await app.request(path)
      expect(`${path} -> ${res.status}`).toBe(`${path} -> 200`)
      expect(res.headers.get('access-control-allow-origin')).toBe('*')
    }
  })

  it('points at the endpoints this server actually serves', async () => {
    const meta = await (await app.request('/.well-known/oauth-authorization-server')).json() as {
      authorization_endpoint: string
      token_endpoint: string
      registration_endpoint: string
      code_challenge_methods_supported: string[]
    }
    expect(meta.authorization_endpoint).toContain('/api/mcp/authorize')
    expect(meta.token_endpoint).toContain('/api/mcp/token')
    expect(meta.registration_endpoint).toContain('/api/mcp/register')
    // S256 only. `plain` is in the spec and is not PKCE in any useful sense.
    expect(meta.code_challenge_methods_supported).toEqual(['S256'])
  })
})
