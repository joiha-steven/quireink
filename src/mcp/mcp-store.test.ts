// The three MCP tables. Two of these guard real attacks, so the cases are the frozen
// tree's, run against real rows instead of a mocked query builder: the redirect-uri
// allowlist (open redirect leading to owner-account takeover) and the single-use code
// (authorization-code replay). Token hashing is the third.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { createHash } from 'node:crypto'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db, nowMs } from '@/store/db'
import { one } from '@/store/query'
import {
  listTokens, createToken, mintOAuthToken, deleteToken, verifyTokenHash, OAUTH_TOKEN_NAME,
} from '@/mcp/tokens'
import { registerClient, isRedirectAllowed, isLoopbackRedirect } from '@/mcp/clients'
import { consumeCodeJti } from '@/mcp/used-codes'

const DIR = './.tmp/test-mcp'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => {
  for (const t of ['mcp_tokens', 'mcp_clients', 'mcp_used_codes']) db().run(`delete from ${t}`)
})

describe('tokens', () => {
  it('returns the plaintext once and stores only its SHA-256 hash', async () => {
    const { token } = await createToken('Laptop')
    expect(token).toStartWith('vbmcp_')
    const stored = one<{ token_hash: string }>(`select token_hash from mcp_tokens`)!
    expect(stored.token_hash).toBe(createHash('sha256').update(token).digest('hex'))
    const dump = JSON.stringify(db().query(`select * from mcp_tokens`).all())
    expect(dump).not.toContain(token.slice(12)) // the secret tail is nowhere in the row
  })

  it('shows a non-secret prefix hint and never the token in the admin view', async () => {
    const { token, info } = await createToken('Laptop')
    expect(info.prefix).toBe(token.slice(0, 12))
    expect(JSON.stringify(await listTokens())).not.toContain(token)
  })

  it('caps MANUAL tokens at five', async () => {
    for (let i = 0; i < 5; i++) await createToken(`t${i}`)
    await expect(createToken('one-too-many')).rejects.toThrow('token_limit')
  })

  it('exempts OAuth tokens from the cap, so authorizing never fails with "limit reached"', async () => {
    for (let i = 0; i < 5; i++) await createToken(`t${i}`)
    await mintOAuthToken()
    await mintOAuthToken()
    expect(await listTokens()).toHaveLength(7)
    expect((await listTokens()).filter((t) => t.oauth)).toHaveLength(2)
  })

  it('falls back to a default name for a blank one, and caps the length', async () => {
    expect((await createToken('   ')).info.name).toBe('Token')
    expect((await createToken('x'.repeat(200))).info.name).toHaveLength(80)
  })

  it('verifies a live bearer and stamps last_used_at', async () => {
    const { token, info } = await createToken('Laptop')
    expect((await listTokens())[0]!.lastUsedAt).toBeNull()
    expect(await verifyTokenHash(token)).toEqual({ id: info.id, name: 'Laptop' })
    expect((await listTokens())[0]!.lastUsedAt).not.toBeNull()
  })

  it('rejects an unknown bearer and an EXPIRED one', async () => {
    expect(await verifyTokenHash('vbmcp_nonsense')).toBeNull()
    const { token, info } = await createToken('Old')
    db().run(`update mcp_tokens set expires_at = ? where id = ?`, [nowMs() - 1000, info.id])
    expect(await verifyTokenHash(token)).toBeNull()
    expect((await listTokens())[0]!.expired).toBe(true)
  })

  it('expires 180 days out', async () => {
    const { info } = await createToken('Laptop')
    const days = (Date.parse(info.expiresAt) - Date.parse(info.createdAt)) / 86_400_000
    expect(Math.round(days)).toBe(180)
  })

  it('deletes one token without touching the others', async () => {
    const a = await createToken('a')
    await createToken('b')
    await deleteToken(a.info.id)
    expect((await listTokens()).map((t) => t.name)).toEqual(['b'])
    expect(await verifyTokenHash(a.token)).toBeNull()
  })

  it('names the OAuth token consistently, since the cap keys off it', async () => {
    const { info } = await mintOAuthToken()
    expect(info.name).toBe(OAUTH_TOKEN_NAME)
    expect(info.oauth).toBe(true)
  })
})

describe('redirect_uri allowlist (open-redirect guard)', () => {
  const REGISTERED = 'https://app.example.com/oauth/callback'
  let clientId = ''
  beforeEach(async () => {
    clientId = await registerClient([REGISTERED])
  })

  it('allows a redirect_uri exactly registered for the client', async () => {
    expect(await isRedirectAllowed(clientId, REGISTERED)).toBe(true)
  })

  it('rejects an arbitrary attacker host not registered for the client', async () => {
    expect(await isRedirectAllowed(clientId, 'https://evil.attacker.test/steal')).toBe(false)
  })

  it('rejects a uri for an unknown client_id', async () => {
    expect(await isRedirectAllowed('no-such-client', REGISTERED)).toBe(false)
  })

  it('rejects a near-miss (subdomain) of a registered uri', async () => {
    expect(await isRedirectAllowed(clientId, 'https://app.example.com.evil.test/oauth/callback')).toBe(false)
  })

  it('allows loopback (127.0.0.1 / localhost / [::1]) on any port without registration', async () => {
    expect(await isRedirectAllowed('', 'http://127.0.0.1:49152/callback')).toBe(true)
    expect(await isRedirectAllowed('', 'http://localhost:8080/cb')).toBe(true)
    expect(await isRedirectAllowed('', 'http://[::1]:3000/cb')).toBe(true)
  })

  it('does NOT treat a non-loopback http origin as loopback', async () => {
    expect(await isRedirectAllowed('', 'http://attacker.test/cb')).toBe(false)
    // a host merely containing "localhost" is not loopback
    expect(await isRedirectAllowed('', 'http://localhost.evil.test/cb')).toBe(false)
    expect(isLoopbackRedirect('https://127.0.0.1/cb')).toBe(false) // https is not the exception
    expect(isLoopbackRedirect('not a url')).toBe(false)
  })

  it('fails CLOSED if the stored uri list is unreadable', async () => {
    db().run(`update mcp_clients set redirect_uris = 'not json'`)
    expect(await isRedirectAllowed(clientId, REGISTERED)).toBe(false)
  })

  it('keeps each client to its own list', async () => {
    const other = await registerClient(['https://other.example.com/cb'])
    expect(await isRedirectAllowed(other, REGISTERED)).toBe(false)
  })
})

describe('single-use authorization codes (replay guard)', () => {
  it('accepts the first exchange and rejects the second', async () => {
    const exp = nowMs() + 60_000
    expect(await consumeCodeJti('jti-1', exp)).toBe(true)
    expect(await consumeCodeJti('jti-1', exp)).toBe(false)
  })

  it('keeps distinct codes independent', async () => {
    const exp = nowMs() + 60_000
    expect(await consumeCodeJti('jti-a', exp)).toBe(true)
    expect(await consumeCodeJti('jti-b', exp)).toBe(true)
    expect(await consumeCodeJti('jti-a', exp)).toBe(false)
  })

  it('refuses the exchange rather than throwing when the store is unusable', async () => {
    db().run(`drop table mcp_used_codes`)
    expect(await consumeCodeJti('jti-x', nowMs() + 60_000)).toBe(false)
    db().run(`create table mcp_used_codes (jti text primary key, expires_at integer not null)`)
  })
})
