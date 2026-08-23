// The reading half over the real wire: mint a token, call the tool, check the answer
// against data planted through the same data layer the admin uses. Same shape as
// `web/mcp-wire.test.ts`, in its own directory for the same reason that file names.

import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { db } from '@/store/db'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { saveSettings } from '@/content/settings'
import { savePost } from '@/content/posts'
import { addComment } from '@/comments/comments'
import { payload } from '@/test/api'

const DIR = './.tmp/test-mcp-insight'
freshDatabase(DIR)
const app = createApp()
let token = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'mcp_tokens', 'activity_log', 'settings',
                   'server_secrets', 'posts', 'comments', 'subscribers']) {
    db().run(`delete from ${t}`)
  }
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  const cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
  await saveSettings({ mcp: { enabled: true } })
  const res = await app.request('/api/mcp/tokens', {
    method: 'POST',
    headers: { cookie, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'insight test' }),
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
  const body = await res.json() as { result?: { content?: { text: string }[]; isError?: boolean } }
  return { text: body.result?.content?.[0]?.text ?? '', isError: body.result?.isError ?? false }
}

describe('the reading half of the tool surface', () => {
  it('answers get_traffic with the dashboard shape, empty blog included', async () => {
    const { text } = await call('get_traffic', { days: 7 })
    const data = JSON.parse(text) as { totalViews: number; topPages: unknown[]; daily: unknown[] }
    expect(data.totalViews).toBe(0)
    expect(Array.isArray(data.topPages)).toBe(true)
    expect(data.daily.length).toBeGreaterThan(0)
  })

  it('answers get_audience with counts and never with an address', async () => {
    db().run(
      `insert into subscribers (email, token, status, created_at) values
       ('reader@example.com', 'tok1', 'confirmed', 1), ('waiting@example.com', 'tok2', 'pending', 2)`,
    )
    const { text } = await call('get_audience')
    expect(JSON.parse(text)).toEqual({
      subscribers: { confirmed: 1, pending: 1, unsubscribed: 0 },
      comments: 0,
    })
    // The line this file exists to hold: the mailing list never crosses MCP.
    expect(text).not.toContain('example.com')
  })

  it('lists comments without the email and ip the admin shape carries', async () => {
    await savePost({ title: 'Talked about', content: 'Body.', status: 'published', slug: 'talked-about', date: '2020-01-01T00:00:00.000Z' })
    await addComment({ postSlug: 'talked-about', parentId: null, provider: 'manual', name: 'A reader', email: 'reader@example.com', content: 'Lovely.', ip: '203.0.113.9' })
    const { text } = await call('list_comments')
    const data = JSON.parse(text) as { total: number; comments: Record<string, unknown>[] }
    expect(data.total).toBe(1)
    expect(data.comments[0]?.name).toBe('A reader')
    expect(text).not.toContain('reader@example.com')
    expect(text).not.toContain('203.0.113.9')
  })

  it('delete_comment sends it to the Trash, like the admin route', async () => {
    await savePost({ title: 'Moderated', content: 'Body.', status: 'published', slug: 'moderated', date: '2020-01-01T00:00:00.000Z' })
    const c = await addComment({ postSlug: 'moderated', parentId: null, provider: 'manual', name: 'Spammer', email: '', content: 'Buy things.' })
    await call('delete_comment', { id: c.id })
    const after = await call('list_comments')
    expect((JSON.parse(after.text) as { total: number }).total).toBe(0)
  })

  it('search_posts finds a draft by its body, the way the owner search does', async () => {
    await savePost({ title: 'Hidden draft', content: 'The xylophone paragraph.', status: 'draft', slug: 'hidden-draft' })
    const { text } = await call('search_posts', { query: 'xylophone' })
    expect(text).toContain('hidden-draft')
  })

  it('get_update_status names the running version even before any check has run', async () => {
    const { text } = await call('get_update_status')
    const data = JSON.parse(text) as { running: string; update: { state: string } }
    expect(data.running).toMatch(/^\d+\.\d+\.\d+$/)
    expect(data.update.state).toBe('unknown')
  })
})
