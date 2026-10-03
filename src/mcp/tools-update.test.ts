// The three update tools keep the slug they were given (2026-09-30).
//
// They stripped it from the arguments, so the saver derived one from the title: updating a
// post called "Who I am" at `about-me` renamed it to `who-i-am` and left a 301, without anybody
// asking. Every piece whose slug was not its title's, and every untitled post whose opening
// changed, was renamed by an ordinary update.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { db } from '@/test/sqlite'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { saveSettings } from '@/content/settings'
import { getPost, savePost } from '@/content/posts'
import { getPage, savePage } from '@/content/pages'
import { getNote, saveNote } from '@/content/notes'
import { findRedirect } from '@/server/redirects'
import { payload } from '@/test/api'

const DIR = './.tmp/test-mcp-update'
process.env.STORAGE_LOCAL_DIR = `${DIR}-uploads`
freshDatabase(DIR)
const app = createApp()
let token = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'mcp_tokens', 'activity_log', 'settings',
                   'server_secrets', 'posts', 'pages', 'notes', 'redirects', 'comments']) {
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
    body: JSON.stringify({ name: 'update test' }),
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
  const body = await res.json() as { result?: { content?: { text: string }[]; isError?: boolean }; error?: { message?: string } }
  return { text: body.result?.content?.[0]?.text ?? '', isError: body.result?.isError ?? false, rpcError: body.error?.message ?? '' }
}

describe('an update keeps the slug', () => {
  it('update_post leaves a post whose slug is not its title where it is', async () => {
    await savePost({ title: 'Who I am', slug: 'about-me', content: 'old', status: 'published', date: '2024-01-01T00:00:00.000Z' })
    const out = await call('update_post', { slug: 'about-me', title: 'Who I am', content: 'new words', status: 'published' })
    expect(out.isError).toBe(false)
    expect((await getPost('about-me'))?.content).toBe('new words')
    expect(await getPost('who-i-am')).toBeNull()
    expect(findRedirect('/about-me')).toBeNull()
  })

  it('renames only when newSlug says so', async () => {
    await savePost({ title: 'Old name', slug: 'old-name', content: 'x', status: 'published', date: '2024-01-01T00:00:00.000Z' })
    await call('update_post', { slug: 'old-name', newSlug: 'new-name', title: 'Old name', content: 'x', status: 'published' })
    expect(await getPost('new-name')).not.toBeNull()
    expect(findRedirect('/old-name')?.destination).toBe('/new-name')
  })

  it('update_page and update_note too', async () => {
    await savePage({ title: 'Colophon', slug: 'how-this-is-made', content: 'x', status: 'published' })
    await call('update_page', { slug: 'how-this-is-made', title: 'Colophon', content: 'y', status: 'published' })
    expect((await getPage('how-this-is-made'))?.content).toBe('y')
    await saveNote({ title: 'Reading list', slug: 'books', content: 'x', status: 'published', date: '2024-01-01T00:00:00.000Z' })
    await call('update_note', { slug: 'books', title: 'Reading list', content: 'z', status: 'published' })
    expect((await getNote('books'))?.content).toBe('z')
  })
})
