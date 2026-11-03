// A tool that changed nothing must not say it did (2026-11-03).
//
// Nine delete and restore tools answered success for a slug, URL or id that named nothing:
// "Moved post to Trash: no-such-post" and `{ deleted: true }` for a comment that never existed.
// The thing on the other end is a model, and it reports what the tool said to the owner as
// done. `delete_file` (issue #69) and `restore_note` already checked; these are the rest.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { db } from '@/test/sqlite'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { saveSettings } from '@/content/settings'
import { savePost, deletePost } from '@/content/posts'
import { savePage, deletePage } from '@/content/pages'
import { saveNote } from '@/content/notes'
import { addComment, softDeleteComment } from '@/comments/comments'
import { payload } from '@/test/api'

const DIR = './.tmp/test-mcp-missing'
process.env.STORAGE_LOCAL_DIR = `${DIR}-uploads`
freshDatabase(DIR)
const app = createApp()
let token = ''

beforeAll(() => resetLimits())
beforeEach(async () => {
  for (const t of ['sessions', 'users', 'mcp_tokens', 'activity_log', 'settings', 'server_secrets',
                   'posts', 'pages', 'notes', 'comments', 'media', 'files']) {
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
    body: JSON.stringify({ name: 'missing test' }),
  })
  token = (await payload<{ token: string }>(res)).token
})

afterAll(() => {
  delete process.env.STORAGE_LOCAL_DIR
  dropDatabase(DIR)
})

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const res = await app.request('/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'sec-fetch-site': 'none' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  })
  const body = await res.json() as { result?: { content?: { text: string }[]; isError?: boolean } }
  return { text: body.result?.content?.[0]?.text ?? '', isError: body.result?.isError ?? false }
}

const verdict = async (name: string, args: Record<string, unknown>) => `${name}: ${(await call(name, args)).isError ? 'refused' : 'success'}`

describe('a target that is not there is an error, not a success', () => {
  it('for every delete and restore that names something', async () => {
    const asked: [string, Record<string, unknown>][] = [
      ['delete_post', { slug: 'no-such-post' }],
      ['restore_post', { slug: 'no-such-post' }],
      ['delete_page', { slug: 'no-such-page' }],
      ['restore_page', { slug: 'no-such-page' }],
      ['delete_note', { slug: 'no-such-note' }],
      ['delete_media', { url: '/uploads/media/no-such.png' }],
      ['restore_media', { url: '/uploads/media/no-such.png' }],
      ['restore_file', { url: '/uploads/files/no-such.pdf' }],
      ['delete_comment', { id: 999999 }],
    ]
    const got = await Promise.all(asked.map(([n, a]) => verdict(n, a)))
    expect(got).toEqual(asked.map(([n]) => `${n}: refused`))
  })

  it('restoring something that is live, not in the Trash, is refused too', async () => {
    await savePost({ title: 'Live', slug: 'live', content: 'x', status: 'published', date: '2024-01-01T00:00:00.000Z' })
    await savePage({ title: 'Live page', slug: 'live-page', content: 'x', status: 'published' })
    expect(await verdict('restore_post', { slug: 'live' })).toBe('restore_post: refused')
    expect(await verdict('restore_page', { slug: 'live-page' })).toBe('restore_page: refused')
  })

  it('and a comment already in the Trash is not deleted again', async () => {
    await savePost({ title: 'P', slug: 'p', content: 'x', status: 'published', date: '2024-01-01T00:00:00.000Z' })
    const c = await addComment({ postSlug: 'p', parentId: null, provider: 'manual', name: 'Reader', email: 'r@example.com', content: 'hello' })
    await softDeleteComment(c.id)
    expect(await verdict('delete_comment', { id: c.id })).toBe('delete_comment: refused')
  })
})

describe('the ordinary paths still work', () => {
  it('delete then restore a post, a page and a note; delete a live comment', async () => {
    await savePost({ title: 'P', slug: 'p', content: 'x', status: 'published', date: '2024-01-01T00:00:00.000Z' })
    await savePage({ title: 'Pg', slug: 'pg', content: 'x', status: 'published' })
    await saveNote({ title: 'N', slug: 'n', content: 'x', status: 'published', date: '2024-01-01T00:00:00.000Z' })
    const c = await addComment({ postSlug: 'p', parentId: null, provider: 'manual', name: 'Reader', email: 'r@example.com', content: 'hello' })
    expect(await verdict('delete_post', { slug: 'p' })).toBe('delete_post: success')
    expect(await verdict('restore_post', { slug: 'p' })).toBe('restore_post: success')
    expect(await verdict('delete_page', { slug: 'pg' })).toBe('delete_page: success')
    expect(await verdict('restore_page', { slug: 'pg' })).toBe('restore_page: success')
    expect(await verdict('delete_note', { slug: 'n' })).toBe('delete_note: success')
    expect(await verdict('delete_comment', { id: c.id })).toBe('delete_comment: success')
    // The deletes the test helpers do directly are the same functions; nothing here is a second path.
    await deletePost('p')
    await deletePage('pg')
  })
})
