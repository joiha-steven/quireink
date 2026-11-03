// The MCP doors are rate limited (2026-11-04).
//
// `/register` was the only one with a limit. Measured against a running instance: 500 wrong
// bearers on `/api/mcp` all answered 401 in 75 ms, 300 tool calls with one token all answered,
// and 50 made-up codes on `/api/mcp/token` all answered `invalid_grant`. A 192-bit token is not
// guessed by any of that; what it does is let a looping agent or a script hammer the door with
// nothing to stop it. Three limits, each keyed the way its abuse is:
//  - wrong bearers by client address, counting failures only; a right token from that address
//    still gets in, because one stale client looping must not lock the owner's working one out;
//  - calls by token, so one runaway agent is stopped without touching another;
//  - code exchanges by client address, on `/token` and on IndieAuth's exchange at `/authorize`.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { db } from '@/test/sqlite'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { saveSettings } from '@/content/settings'
import { payload } from '@/test/api'
import { MCP_AUTH_FAILURES, MCP_CALLS_PER_MINUTE } from '@/web/admin/mcp-transport'
import { MCP_EXCHANGES_PER_MINUTE } from '@/web/admin/mcp'

const DIR = './.tmp/test-mcp-rate-limit'
freshDatabase(DIR)
const app = createApp()
const tokens: Record<'read' | 'full', string> = { read: '', full: '' }

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'mcp_tokens', 'settings', 'server_secrets']) db().run(`delete from ${t}`)
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  const cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
  await saveSettings({ mcp: { enabled: true } })
  for (const scope of ['read', 'full'] as const) {
    const res = await app.request('/api/mcp/tokens', {
      method: 'POST',
      headers: { cookie, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
      body: JSON.stringify({ name: `limit ${scope}`, scope }),
    })
    tokens[scope] = (await payload<{ token: string }>(res)).token
  }
  // Minting went through the owner's door; the limits under test start from nothing.
  resetLimits()
})

afterAll(() => dropDatabase(DIR))

const ping = (bearer: string) => app.request('/api/mcp', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}`, 'sec-fetch-site': 'none' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
})

const exchange = (path: string) => app.request(path, {
  method: 'POST',
  body: new URLSearchParams({ grant_type: 'authorization_code', code: 'made.up', redirect_uri: 'http://127.0.0.1/cb', code_verifier: 'v' }),
})

describe('wrong bearers on /api/mcp', () => {
  it(`are answered 401 up to ${MCP_AUTH_FAILURES}, then 429, while a right token from the same address still works`, async () => {
    const statuses: number[] = []
    for (let i = 0; i < MCP_AUTH_FAILURES; i++) statuses.push((await ping(`vbmcp_guess${i}`)).status)
    expect(new Set(statuses)).toEqual(new Set([401]))
    const refused = await ping('vbmcp_one-more')
    expect(refused.status).toBe(429)
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0)
    // A stale client looping on a revoked token must not lock the owner's working one out.
    expect((await ping(tokens.full)).status).toBe(200)
    expect((await ping('vbmcp_still-wrong')).status).toBe(429)
  })

  it('a token that works is not counted as a failure', async () => {
    for (let i = 0; i < MCP_AUTH_FAILURES + 5; i++) expect((await ping(tokens.read)).status).toBe(200)
    expect((await ping('vbmcp_wrong')).status).toBe(401)
  })
})

describe('calls with one token', () => {
  it(`are answered up to ${MCP_CALLS_PER_MINUTE} a minute, then refused with a JSON-RPC error, and another token is untouched`, async () => {
    for (let i = 0; i < MCP_CALLS_PER_MINUTE; i++) {
      const res = await ping(tokens.full)
      if (res.status !== 200) throw new Error(`call ${i + 1} answered ${res.status}`)
    }
    const refused = await ping(tokens.full)
    expect(refused.status).toBe(429)
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0)
    const reply = await refused.json() as { error?: { code: number; message: string } }
    expect(reply.error?.code).toBe(-32000)
    expect(reply.error?.message).toContain(String(MCP_CALLS_PER_MINUTE))
    expect((await ping(tokens.read)).status).toBe(200)
  })
})

describe('code exchanges', () => {
  for (const path of ['/api/mcp/token', '/api/mcp/authorize']) {
    it(`${path}: ${MCP_EXCHANGES_PER_MINUTE} a minute from one address, then 429`, async () => {
      for (let i = 0; i < MCP_EXCHANGES_PER_MINUTE; i++) expect((await exchange(path)).status).toBe(400)
      const refused = await exchange(path)
      expect(refused.status).toBe(429)
      expect(refused.headers.get('retry-after')).toBe('60')
      // A connector in a browser may read it only when the answer says so.
      expect(refused.headers.get('access-control-expose-headers') ?? '').toMatch(/retry-after/i)
      expect(refused.headers.get('access-control-allow-origin')).toBe('*')
      expect(await refused.json()).toEqual({ error: 'too_many_requests' })
    })
  }

  it('the two doors share one allowance, so alternating between them buys nothing', async () => {
    for (let i = 0; i < MCP_EXCHANGES_PER_MINUTE; i++) await exchange(i % 2 ? '/api/mcp/token' : '/api/mcp/authorize')
    expect((await exchange('/api/mcp/token')).status).toBe(429)
    expect((await exchange('/api/mcp/authorize')).status).toBe(429)
  })
})
