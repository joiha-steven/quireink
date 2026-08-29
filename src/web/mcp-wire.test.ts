// The MCP endpoint itself: does it speak JSON-RPC over Streamable HTTP.
//
// Split from `admin-mcp.test.ts`, which covers the OAuth layer around it. This one is
// about the WIRE — the one piece of M3 that is a rewrite rather than a port, because
// `mcp-handler` wraps the SDK for Next and could not come along.

import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { db } from '@/store/db'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { getSettings, saveSettings } from '@/content/settings'
import { savePost } from '@/content/posts'
import { payload } from '@/test/api'

// Its own directory: `openDatabases` holds one pair of connections per process and closes
// the previous pair, so two test files sharing a directory would fight over them.
const DIR = './.tmp/test-mcp-wire'

// Created ONCE and then emptied per test: on Windows the directory cannot be removed
// while the connections are open, so re-creating it per test fails with EBUSY.
freshDatabase(DIR)
const app = createApp()
let cookie = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'mcp_tokens', 'activity_log', 'settings',
                   'server_secrets', 'posts']) {
    db().run(`delete from ${t}`)
  }
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
  await saveSettings({ mcp: { enabled: true } })
})

afterAll(() => dropDatabase(DIR))

const asOwner = (path: string, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: { cookie, 'sec-fetch-site': 'same-origin', ...(init.headers as Record<string, string> ?? {}) },
  })

describe('the MCP endpoint', () => {
  // The one piece of M3 that is a rewrite rather than a port: `mcp-handler` wraps the SDK
  // for Next and could not come along. These tests are therefore about the WIRE, not the
  // tools -- that the endpoint really speaks JSON-RPC over Streamable HTTP, and that the
  // handshake a connector needs is present.
  const mintToken = async (): Promise<string> => {
    const res = await asOwner('/api/mcp/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'test client' }),
    })
    return (await payload<{ token: string }>(res)).token
  }

  const rpc = (token: string, body: unknown) =>
    app.request('/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'sec-fetch-site': 'none' },
      body: JSON.stringify(body),
    })

  it('refuses an unauthenticated call and points it at the metadata', async () => {
    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'none' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    expect(res.status).toBe(401)
    // Without this header a connector has no way to discover how to authenticate, so the
    // 401 is a dead end rather than the start of the OAuth flow.
    expect(res.headers.get('www-authenticate')).toContain('/.well-known/oauth-protected-resource')
  })

  it('completes the initialize handshake', async () => {
    const token = await mintToken()
    const res = await rpc(token, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { result?: { serverInfo?: { name: string } } }
    expect(body.result?.serverInfo?.name).toBe('quire')
  })

  it('answers the notification that follows the handshake, rather than hanging on it', async () => {
    // A connector's first move after `initialize` is the `notifications/initialized`
    // notification, and a notification has no `id` and gets no reply. The transport used to
    // await one anyway, which deadlocked: that POST never came back, so the client never
    // reached `tools/list` and sat on a spinner until it declared the server unavailable.
    // Raced against a timer on purpose -- a regression here HANGS, and a hanging test that
    // eventually times out tells you far less than one that names what went wrong.
    const token = await mintToken()
    const answered = await Promise.race([
      Promise.resolve(rpc(token, { jsonrpc: '2.0', method: 'notifications/initialized' }))
        .then((r) => r.status),
      new Promise<string>((r) => setTimeout(() => r('hung'), 3_000)),
    ])
    // 202 Accepted with no body: taken, nothing to say back.
    expect(answered).toBe(202)
  }, 10_000)

  it('lists the tools it registered', async () => {
    const token = await mintToken()
    const res = await rpc(token, { jsonrpc: '2.0', id: 2, method: 'tools/list' })
    const body = await res.json() as { result?: { tools?: { name: string }[] } }
    const names = (body.result?.tools ?? []).map((t) => t.name)
    // A representative few from each family, so a tool file that silently stops
    // registering is caught here rather than by a connector months later.
    expect(names).toContain('list_posts')
    expect(names).toContain('create_post')
    expect(names).toContain('list_pages')
    expect(names).toContain('list_media')
  })

  it('actually runs a tool against the real data layer', async () => {
    const token = await mintToken()
    await savePost({ title: 'Through MCP', content: 'Body.', status: 'published', date: '2020-01-01T00:00:00.000Z' })
    const res = await rpc(token, {
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'list_posts', arguments: {} },
    })
    const body = await res.json() as { result?: { content?: { text: string }[] } }
    expect(body.result?.content?.[0]?.text).toContain('Through MCP')
  })

  // The read-only door. A 'read' token does not get write tools REFUSED — they are not
  // registered on its server at all, so they are absent from tools/list and unknown to
  // tools/call. Same shape as Invariant 4: the rule lives where things are mounted.
  it('withholds every write tool from a read-scope token', async () => {
    const res = await asOwner('/api/mcp/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'reader', scope: 'read' }),
    })
    const { token, info } = await payload<{ token: string; info: { scope: string } }>(res)
    expect(info.scope).toBe('read')

    const list = await rpc(token, { jsonrpc: '2.0', id: 7, method: 'tools/list' })
    const body = await list.json() as { result?: { tools?: { name: string }[] } }
    const names = (body.result?.tools ?? []).map((t) => t.name)
    expect(names).toContain('list_posts')
    expect(names).toContain('get_settings')
    expect(names).not.toContain('create_post')
    expect(names).not.toContain('update_settings')
    expect(names).not.toContain('delete_media')

    // And calling one anyway is an error, not an execution.
    const call = await rpc(token, {
      jsonrpc: '2.0', id: 8, method: 'tools/call',
      params: { name: 'create_post', arguments: { title: 'should not exist' } },
    })
    const outcome = await call.json() as { error?: unknown; result?: { isError?: boolean } }
    expect(outcome.error !== undefined || outcome.result?.isError === true).toBe(true)
    expect(db().query<{ n: number }, []>(`select count(*) as n from posts`).get()!.n).toBe(0)
  })

  it('mints a full token by default, so existing clients keep their writes', async () => {
    const token = await mintToken()
    const res = await rpc(token, { jsonrpc: '2.0', id: 9, method: 'tools/list' })
    const body = await res.json() as { result?: { tools?: { name: string }[] } }
    expect((body.result?.tools ?? []).map((t) => t.name)).toContain('create_post')
  })

  it('is not there at all when the owner turns MCP off', async () => {
    const token = await mintToken()
    const { mcp } = await getSettings()
    await saveSettings({ mcp: { ...mcp, enabled: false } })
    // 404, not 401: a disabled feature should not leave a probe-able surface behind.
    expect((await rpc(token, { jsonrpc: '2.0', id: 4, method: 'tools/list' })).status).toBe(404)
    await saveSettings({ mcp: { ...mcp, enabled: true } })
  })
})

describe('OAuth discovery advertises the origin a CLIENT reaches, not the one it arrived on', () => {
  // The CDN terminates TLS and forwards to the origin over plain HTTP, so `c.req.url` is
  // `http://…` and both documents came out advertising `http://example.com/...`. A connector
  // fetches them over https, reads an issuer on http, and rejects the pair — RFC 8414 and
  // RFC 9728 both require the issuer to match the origin the document was served from.
  // That was the whole of why connecting failed.
  const json = async (path: string, headers: Record<string, string> = {}) => {
    const res = await app.request(path, { headers })
    return await res.json() as Record<string, unknown>
  }
  const PROXY = { 'x-forwarded-proto': 'https' }

  it('honours x-forwarded-proto in the protected-resource document', async () => {
    const body = await json('http://example.com/.well-known/oauth-protected-resource', PROXY)
    expect(body.resource).toBe('https://example.com/api/mcp')
    expect(body.authorization_servers).toEqual(['https://example.com'])
  })

  it('honours it in the authorization-server document, on every endpoint', async () => {
    const body = await json('http://example.com/.well-known/oauth-authorization-server', PROXY)
    expect(body.issuer).toBe('https://example.com')
    for (const key of ['authorization_endpoint', 'token_endpoint', 'registration_endpoint']) {
      expect(String(body[key])).toStartWith('https://example.com/')
    }
  })

  it('falls back to the request scheme with no proxy in front', async () => {
    // A direct install with no CDN sends no such header, and http is then the truth.
    const body = await json('http://localhost:3000/.well-known/oauth-authorization-server')
    expect(body.issuer).toBe('http://localhost:3000')
  })
})
