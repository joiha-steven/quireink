// Every setting, over the real MCP wire.
//
// `update_settings` wrote three fields and its own description said the rest "cannot be
// changed over MCP". That was written when every token was all-powerful and when nothing had
// proved that a partial save leaves the rest of the tree alone. Both moved: tokens carry a
// scope, and `content/settings-path.test.ts` now asserts the deep merge for all 150 paths one
// at a time. What is left to prove HERE is the wire: that a path is validated, that a wrong
// kind of value is refused rather than coerced, and that a read token cannot reach any of it.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { db } from '@/store/db'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { getSettings, saveSettings } from '@/content/settings'
import { payload } from '@/test/api'

const DIR = './.tmp/test-mcp-settings'
freshDatabase(DIR)
const app = createApp()
let token = ''
let readToken = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'mcp_tokens', 'activity_log', 'settings', 'server_secrets']) {
    db().run(`delete from ${t}`)
  }
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'owner@example.com', password: 'wandering violet cassette' })
  const cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
  await saveSettings({ mcp: { enabled: true } })
  const mint = async (scope?: 'read') => {
    const res = await app.request('/api/mcp/tokens', {
      method: 'POST',
      headers: { cookie, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
      body: JSON.stringify({ name: `settings test ${scope ?? 'full'}`, ...(scope ? { scope } : {}) }),
    })
    return (await payload<{ token: string }>(res)).token
  }
  token = await mint()
  readToken = await mint('read')
})

afterAll(() => dropDatabase(DIR))

const call = async (name: string, args: Record<string, unknown> = {}, bearer = () => token) => {
  const res = await app.request('/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer()}`, 'sec-fetch-site': 'none' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  })
  const body = await res.json() as { result?: { content?: { text: string }[]; isError?: boolean }; error?: { message?: string } }
  return { text: body.result?.content?.[0]?.text ?? '', isError: body.result?.isError ?? false, rpcError: body.error?.message ?? '' }
}

describe('finding a setting', () => {
  it('lists every path with its kind and what it is set to', async () => {
    const { text } = await call('list_settings')
    const out = JSON.parse(text) as { count: number; settings: { path: string; type: string }[] }
    expect(out.count).toBeGreaterThan(100)
    expect(out.settings.find((s) => s.path === 'features.search')?.type).toBe('boolean')
    expect(out.settings.find((s) => s.path === 'typography.roles.body.size')?.type).toBe('number')
  })

  it('narrows to a word, because 155 rows is not an answer to "which one is the font"', async () => {
    const { text } = await call('list_settings', { contains: 'font' })
    const out = JSON.parse(text) as { count: number; settings: { path: string }[] }
    expect(out.count).toBeGreaterThan(0)
    expect(out.settings.every((s) => s.path.toLowerCase().includes('font'))).toBe(true)
  })

  it('offers nothing the server derives — a lever attached to nothing is worse than none', async () => {
    const { text } = await call('list_settings')
    const paths = (JSON.parse(text) as { settings: { path: string }[] }).settings.map((s) => s.path)
    expect(paths).not.toContain('logoRenderUrl')
    expect(paths).not.toContain('firstRunDone')
  })
})

describe('changing one by path', () => {
  // A rem multiplier, not pixels — 19 is clamped to 6, which is how this test first failed
  // and is exactly the reason the tool reports `now` from the SAVED settings.
  it('sets a nested number and reports what it was', async () => {
    const { text } = await call('update_settings', { path: 'typography.roles.body.size', value: 1.25 })
    expect(JSON.parse(text)).toMatchObject({ path: 'typography.roles.body.size', now: 1.25 })
    expect((await getSettings()).typography.roles.body.size).toBe(1.25)
  })

  it('leaves every neighbour alone, which is the whole reason this is allowed', async () => {
    const before = await getSettings()
    await call('update_settings', { path: 'features.search', value: false })
    const after = await getSettings()
    expect(after.features.search).toBe(false)
    expect(after.features.toc).toBe(before.features.toc)
    expect(after.typography.roles.body.size).toBe(before.typography.roles.body.size)
    expect(after.title).toBe(before.title)
  })

  it('refuses a path that is not one, rather than reporting a success nothing moved for', async () => {
    const out = await call('update_settings', { path: 'features.nonesuch', value: true })
    expect(out.isError).toBe(true)
    expect(out.text).toContain('list_settings')
  })

  it('refuses the wrong KIND of value rather than coercing it', async () => {
    const out = await call('update_settings', { path: 'features.search', value: 'yes' })
    expect(out.isError).toBe(true)
    expect((await getSettings()).features.search).toBe(true)
  })

  it('refuses a path with no value', async () => {
    expect((await call('update_settings', { path: 'title' })).isError).toBe(true)
  })

  it('still answers the older three-argument shorthand', async () => {
    await call('update_settings', { title: 'Renamed by a connector' })
    expect((await getSettings()).title).toBe('Renamed by a connector')
  })

  it('reports what the SANITISER did, not what was asked for', async () => {
    // Clamped hard. A tool that echoed the request would report a size the site is not set
    // to, which is the one lie an agent has no way to catch.
    const { text } = await call('update_settings', { path: 'typography.roles.body.size', value: 99_999 })
    const out = JSON.parse(text) as { now: number }
    expect(out.now).toBeLessThan(99_999)
    expect((await getSettings()).typography.roles.body.size).toBe(out.now)
  })
})

describe('a read token', () => {
  it('can look, and cannot touch', async () => {
    const listed = await call('list_settings', {}, () => readToken)
    expect(listed.isError).toBe(false)
    const wrote = await call('update_settings', { path: 'features.search', value: false }, () => readToken)
    expect(wrote.isError || wrote.rpcError !== '').toBe(true)
    expect((await getSettings()).features.search).toBe(true)
  })
})
