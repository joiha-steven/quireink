// IndieAuth on the MCP OAuth server (ADR 0046): a client that is a URL, a scope that rides
// inside the code, a `me` in the answer, and the sign-in-only exchange.
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
import { isIndieAuthClient } from '@/web/admin/mcp'
import { payload } from '@/test/api'
import { clearCache } from '@/server/cache'

const DIR = './.tmp/test-indieauth'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
let cookie = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'mcp_tokens', 'mcp_clients', 'mcp_used_codes', 'activity_log', 'settings', 'server_secrets']) {
    db().run(`delete from ${t}`)
  }
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
  await saveSettings({ mcp: { enabled: true } })
})

const asOwner = (path: string, init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { cookie, 'sec-fetch-site': 'same-origin', ...(init.headers as Record<string, string> ?? {}) } })

function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

const CLIENT = 'https://notebook.example/'
const REDIRECT = 'https://notebook.example/auth/callback'

/** The whole front half: consent page for an unregistered client, then Approve. */
async function approve(scope: string): Promise<{ code: string; verifier: string }> {
  const { verifier, challenge } = pkce()
  const page = await asOwner(
    `/api/mcp/authorize?response_type=code&client_id=${encodeURIComponent(CLIENT)}`
    + `&redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=${challenge}&code_challenge_method=S256`
    + `&state=xyz${scope ? `&scope=${encodeURIComponent(scope)}` : ''}`,
  )
  expect(page.status).toBe(200)
  const html = await page.text()
  expect(html).toContain(CLIENT)
  if (scope) expect(html).toContain(`value="${scope}"`)
  const csrf = html.match(/name="csrf" value="([^"]*)"/)![1]!
  const res = await asOwner('/api/mcp/authorize', {
    method: 'POST',
    body: new URLSearchParams({ client_id: CLIENT, redirect_uri: REDIRECT, code_challenge: challenge, state: 'xyz', scope, csrf }),
  })
  expect(res.status).toBe(302)
  const dest = new URL(res.headers.get('location')!)
  expect(dest.origin + dest.pathname).toBe(REDIRECT)
  expect(dest.searchParams.get('state')).toBe('xyz')
  return { code: dest.searchParams.get('code')!, verifier }
}

describe('a client that is a URL', () => {
  it('is trusted when its redirect shares its origin, and only then', () => {
    expect(isIndieAuthClient(CLIENT, REDIRECT)).toBe(true)
    expect(isIndieAuthClient('https://notebook.example/app', 'https://notebook.example:8443/cb')).toBe(false)
    expect(isIndieAuthClient('http://notebook.example/', 'http://notebook.example/cb')).toBe(false)
    expect(isIndieAuthClient('https://notebook.example/', 'https://evil.example/cb')).toBe(false)
    expect(isIndieAuthClient('not a url', REDIRECT)).toBe(false)
  })

  it('still cannot send the owner to a redirect on some other host', async () => {
    const { challenge } = pkce()
    const res = await asOwner(
      `/api/mcp/authorize?response_type=code&client_id=${encodeURIComponent(CLIENT)}`
      + `&redirect_uri=${encodeURIComponent('https://evil.example/cb')}&code_challenge=${challenge}&code_challenge_method=S256`,
    )
    expect(res.status).toBe(400)
  })
})

describe('the token', () => {
  const exchange = (fields: Record<string, string>) =>
    app.request('/api/mcp/token', { method: 'POST', body: new URLSearchParams(fields) })

  it('carries the scope the owner approved and the profile URL, and a writing scope mints full', async () => {
    const { code, verifier } = await approve('create update')
    const res = await exchange({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier })
    expect(res.status).toBe(200)
    const body = await payload<{ access_token: string; scope: string; me: string }>(res)
    expect(body.scope).toBe('create update')
    expect(body.me).toBe('http://localhost/')
    const row = db().query<{ scope: string }, []>(`select scope from mcp_tokens`).get()
    expect(row?.scope).toBe('full')
  })

  it('mints a read token for a scope that does not write, and nobody can widen it at exchange', async () => {
    const { code, verifier } = await approve('profile')
    const res = await exchange({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier, scope: 'create' })
    expect(res.status).toBe(200)
    expect((await payload<{ scope: string }>(res)).scope).toBe('profile')
    expect(db().query<{ scope: string }, []>(`select scope from mcp_tokens`).get()?.scope).toBe('read')
  })

  it('still mints full for a code with no scope, as every MCP connector expects', async () => {
    const { code, verifier } = await approve('')
    const res = await exchange({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier })
    expect((await payload<{ scope: string }>(res)).scope).toBe('full')
  })
})

describe('the sign-in-only exchange', () => {
  it('answers with the profile URL and mints nothing, and the code is spent', async () => {
    const { code, verifier } = await approve('')
    const fields = { grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier }
    const res = await app.request('/api/mcp/authorize', { method: 'POST', body: new URLSearchParams(fields) })
    expect(res.status).toBe(200)
    expect(await payload<{ me: string }>(res)).toEqual({ me: 'http://localhost/' })
    expect(db().query<{ n: number }, []>(`select count(*) as n from mcp_tokens`).get()?.n).toBe(0)
    const again = await app.request('/api/mcp/token', { method: 'POST', body: new URLSearchParams(fields) })
    expect(again.status).toBe(400)
  })
})

describe('what the head advertises', () => {
  it('names the endpoints while the switch is on, and only the webmention one when it is off', async () => {
    const on = await (await app.request('/')).text()
    expect(on).toContain('rel="webmention" href="/webmention"')
    expect(on).toContain('rel="indieauth-metadata"')
    expect(on).toContain('rel="micropub" href="/micropub"')
    await saveSettings({ mcp: { enabled: false } })
    clearCache()
    const off = await (await app.request('/')).text()
    expect(off).toContain('rel="webmention"')
    expect(off).not.toContain('rel="micropub"')
  })
})
