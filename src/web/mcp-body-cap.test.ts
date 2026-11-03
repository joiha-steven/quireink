// The MCP body is capped before it is parsed (2026-11-03).
//
// `/api/mcp` takes a bearer token, and `web/body-cap.ts` leaves a bearer door's body to the
// owner, so nothing capped it: any token, a read one included, could post a JSON body of any size
// and the process held all of it, then parsed it. The cap is sized for the largest honest call
// there is, a theme at its package limit sent as base64, and is checked while the bytes arrive.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { randomBytes } from 'node:crypto'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { db } from '@/test/sqlite'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { saveSettings } from '@/content/settings'
import { payload } from '@/test/api'
import { THEME_LIMITS } from '@/theme/types'

const DIR = './.tmp/test-mcp-body-cap'
freshDatabase(DIR)
const app = createApp()
const tokens: Record<'read' | 'full', string> = { read: '', full: '' }

/** The number the transport must hold to, worked out here independently: base64 of the package limit, plus 2 MiB. */
const CAP = Math.ceil(THEME_LIMITS.totalBytes / 3) * 4 + 2 * 1024 * 1024

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'mcp_tokens', 'settings', 'server_secrets', 'posts']) db().run(`delete from ${t}`)
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  const cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
  await saveSettings({ mcp: { enabled: true } })
  for (const scope of ['read', 'full'] as const) {
    const res = await app.request('/api/mcp/tokens', {
      method: 'POST',
      headers: { cookie, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
      body: JSON.stringify({ name: `cap ${scope}`, scope }),
    })
    tokens[scope] = (await payload<{ token: string }>(res)).token
  }
})

afterAll(() => dropDatabase(DIR))

const headers = (scope: 'read' | 'full') => ({
  'content-type': 'application/json', authorization: `Bearer ${tokens[scope]}`, 'sec-fetch-site': 'none',
})

/** A well-formed tools/call whose JSON is exactly `size` bytes, padded inside the arguments. */
function callOfSize(size: number, name: string, args: Record<string, unknown>): string {
  const shell = (pad: string) => JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: { ...args, content: pad } } })
  return shell('x'.repeat(size - shell('').length))
}

const posts = (): number => (db().query('select count(*) as n from posts').get() as { n: number }).n

describe('the MCP body cap', () => {
  it('refuses a body past the cap from its declared length, before anything is read or run', async () => {
    const body = callOfSize(CAP + 1, 'create_post', { title: 'Too big' })
    for (const scope of ['read', 'full'] as const) {
      const res = await app.request('/api/mcp', { method: 'POST', headers: headers(scope), body })
      expect(`${scope}: ${res.status}`).toBe(`${scope}: 413`)
      const reply = await res.json() as { error?: { code: number; message: string } }
      expect(reply.error?.code).toBe(-32600)
      expect(reply.error?.message).toContain(String(CAP))
    }
    expect(posts()).toBe(0)
  })

  it('refuses one that does not declare its length once the bytes pass the cap', async () => {
    const bytes = new TextEncoder().encode(callOfSize(CAP + 1, 'create_post', { title: 'Too big, streamed' }))
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let at = 0; at < bytes.length; at += 1 << 20) controller.enqueue(bytes.subarray(at, at + (1 << 20)))
        controller.close()
      },
    })
    const req = new Request('http://localhost/api/mcp', { method: 'POST', headers: headers('full'), body: stream, duplex: 'half' } as RequestInit)
    expect(req.headers.get('content-length')).toBeNull()
    const res = await app.request(req)
    expect(res.status).toBe(413)
    expect(posts()).toBe(0)
  })

  it('lets through the largest honest call: a theme at its package limit, sent as base64', async () => {
    // Nine megabyte-sized files plus the two text ones: just under the 10 MB a package may expand
    // to, which is the most `install_theme` would accept. Random, so it is refused by the checker,
    // but by the checker, as a tool answer, not by the cap.
    const files = [
      { path: 'theme.json', text: '{}' }, { path: 'theme.css', text: '.prose{}' },
      ...Array.from({ length: 9 }, (_, i) => ({ path: `images/a${i}.png`, base64: randomBytes(THEME_LIMITS.imageBytes - 4096).toString('base64') })),
    ]
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'check_theme', arguments: { files } } })
    expect(body.length).toBeGreaterThan(12_000_000)
    expect(body.length).toBeLessThan(CAP)
    const res = await app.request('/api/mcp', { method: 'POST', headers: headers('read'), body })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { result?: unknown }).result).toBeDefined()
  })
})
