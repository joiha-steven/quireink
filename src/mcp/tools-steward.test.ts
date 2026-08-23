// The steward tools over the real wire, against the real data layer. Same harness shape
// as `tools-insight.test.ts`, its own directory for the reason `mcp-wire.test.ts` names.

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
import { addComment, getCommentTree } from '@/comments/comments'
import { payload } from '@/test/api'

const DIR = './.tmp/test-mcp-steward'
freshDatabase(DIR)
const app = createApp()
let token = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'mcp_tokens', 'activity_log', 'settings',
                   'server_secrets', 'posts', 'comments']) {
    db().run(`delete from ${t}`)
  }
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'owner@example.com', password: 'wandering violet cassette' })
  const cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
  await saveSettings({ mcp: { enabled: true } })
  const res = await app.request('/api/mcp/tokens', {
    method: 'POST',
    headers: { cookie, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'steward test' }),
  })
  token = (await payload<{ token: string }>(res)).token
})

afterAll(() => dropDatabase(DIR))

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const res = await app.request('/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'sec-fetch-site': 'none' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  })
  const body = await res.json() as { result?: { content?: { text: string }[]; isError?: boolean }; error?: { message?: string } }
  return { text: body.result?.content?.[0]?.text ?? '', isError: body.result?.isError ?? false, rpcError: body.error?.message ?? '' }
}

describe('the steward tools', () => {
  it('update_appearance switches the palette and keeps the switcher offering it', async () => {
    const { text } = await call('update_appearance', { palette: 'sepia', readingFont: 'literata' })
    expect(JSON.parse(text)).toMatchObject({ palette: 'sepia', readingFont: 'literata' })
    const s = await getSettings()
    expect(s.themePreset).toBe('sepia')
    expect(s.enabledPalettes).toContain('sepia')
  })

  it('refuses a color that is not on the menu — the schema IS the guard', async () => {
    const out = await call('update_appearance', { palette: '#ff0000' })
    expect(out.isError || out.rpcError !== '').toBe(true)
    expect((await getSettings()).themePreset).not.toBe('#ff0000')
  })

  it('compose_homepage pins a lead, replaces strips, and flags an empty category', async () => {
    await savePost({ title: 'Pinned', content: 'Body.', status: 'published', slug: 'pinned', date: '2020-01-01T00:00:00.000Z', categories: ['Letters'] })
    const { text } = await call('compose_homepage', {
      mode: 'front',
      lead: { source: 'pinned', slug: 'pinned' },
      strips: [{ category: 'Letters' }, { category: 'Ghost Town' }],
    })
    const data = JSON.parse(text) as { home: { mode: string; front: { lead: { slug: string }; strips: { category: string }[] } }; warning?: string }
    expect(data.home.mode).toBe('front')
    expect(data.home.front.lead.slug).toBe('pinned')
    expect(data.home.front.strips.map((s) => s.category)).toEqual(['Letters', 'Ghost Town'])
    expect(data.warning).toContain('Ghost Town')
  })

  it('get_post_traffic answers the per-page shape for a quiet post', async () => {
    const { text } = await call('get_post_traffic', { slug: 'quiet-post' })
    const data = JSON.parse(text) as { path: string; totalViews: number }
    expect(data.path).toBe('/quiet-post')
    expect(data.totalViews).toBe(0)
  })

  it('reply_comment nests under the parent, on the parent\'s post', async () => {
    await savePost({ title: 'Discussed', content: 'Body.', status: 'published', slug: 'discussed', date: '2020-01-01T00:00:00.000Z' })
    const parent = await addComment({ postSlug: 'discussed', parentId: null, provider: 'manual', name: 'A reader', email: 'reader@example.com', content: 'A question?' })
    const { text } = await call('reply_comment', { id: parent.id, content: 'An answer.' })
    expect(JSON.parse(text)).toMatchObject({ parentId: parent.id })
    const tree = await getCommentTree('discussed')
    expect(tree[0]?.replies[0]?.contentHtml).toContain('An answer.')
  })

  it('send_test_newsletter fails HONESTLY without SMTP, and never takes a recipient', async () => {
    await savePost({ title: 'Issue one', content: 'Body.', status: 'published', slug: 'issue-one', date: '2020-01-01T00:00:00.000Z' })
    const out = await call('send_test_newsletter', {})
    expect(out.isError).toBe(true)
    expect(out.text).toContain('smtp_not_configured')
    // A `to` argument is not part of the schema; passing one must not smuggle a recipient.
    const forced = await call('send_test_newsletter', { to: 'attacker@example.com' })
    expect(forced.text).not.toContain('attacker@example.com')
  })

  it('create_snapshot writes a real archive into the retained set', async () => {
    const { text, isError } = await call('create_snapshot', {})
    expect(isError).toBe(false)
    const data = JSON.parse(text) as { name: string; size: number }
    expect(data.name).toMatch(/^quire-.*\.tar\.gz$/)
    expect(data.size).toBeGreaterThan(0)
  })
})
