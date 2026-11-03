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

// 2026-11-03. `update_post` REPLACES, and five fields a post carries were not in its schema at all:
// zod stripped them, so an update erased them, even when the model sent back exactly what
// `get_post` had handed it. `patch_post` given one of them answered success and changed nothing.
describe('the fields a post carries beyond its words', () => {
  const EXTRA = {
    series: 'Designing a reading page', seriesOrder: 3,
    metaTitle: 'SEO title', metaDescription: 'SEO description', coverImage: '/uploads/media/cover.webp',
  }

  it('survive an update_post that does not mention them, which is every client written before', async () => {
    await savePost({ title: 'Measure', slug: 'measure', content: 'x', status: 'published', date: '2024-01-01T00:00:00.000Z', ...EXTRA })
    const out = await call('update_post', { slug: 'measure', title: 'Measure', content: 'edited', status: 'published' })
    expect(out.isError).toBe(false)
    const post = await getPost('measure')
    expect(post?.content).toBe('edited')
    expect({ series: post?.series, seriesOrder: post?.seriesOrder, metaTitle: post?.metaTitle,
      metaDescription: post?.metaDescription, coverImage: post?.coverImage?.replace(/^https?:\/\/[^/]+/, '') }).toEqual(EXTRA)
  })

  it('round-trip: what get_post returns, sent back to update_post, changes nothing', async () => {
    await savePost({ title: 'Measure', slug: 'measure', content: 'x', status: 'published', date: '2024-01-01T00:00:00.000Z', ...EXTRA })
    const before = JSON.parse((await call('get_post', { slug: 'measure' })).text) as Record<string, unknown>
    await call('update_post', before)
    const after = JSON.parse((await call('get_post', { slug: 'measure' })).text) as Record<string, unknown>
    expect({ ...after, updatedAt: undefined }).toEqual({ ...before, updatedAt: undefined })
  })

  it('can be set by update_post and patch_post, and cleared with an empty string', async () => {
    await savePost({ title: 'Plain', slug: 'plain', content: 'x', status: 'published', date: '2024-01-01T00:00:00.000Z' })
    expect((await call('patch_post', { slug: 'plain', series: 'Ink and press', seriesOrder: 2 })).isError).toBe(false)
    expect((await getPost('plain'))?.series).toBe('Ink and press')
    expect((await getPost('plain'))?.seriesOrder).toBe(2)
    await call('update_post', { slug: 'plain', title: 'Plain', content: 'x', status: 'published', coverImage: '/uploads/media/c.webp', metaTitle: 'T' })
    expect((await getPost('plain'))?.coverImage).toContain('/uploads/media/c.webp')
    expect((await getPost('plain'))?.metaTitle).toBe('T')
    await call('patch_post', { slug: 'plain', coverImage: '', series: '' })
    expect((await getPost('plain'))?.coverImage).toBeUndefined()
    expect((await getPost('plain'))?.series).toBeUndefined()
  })
})

// 2026-11-03. Scheduling is "published" plus a date ahead, and nothing said so: the schema offered
// draft or published, `date` said "defaults to now", and every read answered `published` for a
// post no reader can see yet. A model scheduling a post could not confirm it had.
describe('a scheduled post says so', () => {
  it('list_posts and get_post mark a published post dated ahead, and only that one', async () => {
    const ahead = new Date(Date.now() + 7 * 86_400_000).toISOString()
    await savePost({ title: 'Later', slug: 'later', content: 'x', status: 'published', date: ahead })
    await savePost({ title: 'Now', slug: 'now', content: 'x', status: 'published', date: '2024-01-01T00:00:00.000Z' })
    await savePost({ title: 'Draft ahead', slug: 'draft-ahead', content: 'x', status: 'draft', date: ahead })
    const rows = JSON.parse((await call('list_posts')).text) as { slug: string; scheduled?: boolean }[]
    expect(Object.fromEntries(rows.map((r) => [r.slug, r.scheduled ?? false]))).toEqual({ later: true, now: false, 'draft-ahead': false })
    expect((JSON.parse((await call('get_post', { slug: 'later' })).text) as { scheduled?: boolean }).scheduled).toBe(true)
  })

  it('and the tools that write one say how', async () => {
    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'sec-fetch-site': 'none' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    const tools = (await res.json() as { result: { tools: { name: string; description: string; inputSchema: { properties: Record<string, { description?: string }> } }[] } }).result.tools
    const create = tools.find((t) => t.name === 'create_post')!
    expect(create.inputSchema.properties.date?.description).toMatch(/schedul/i)
    expect(create.inputSchema.properties.status?.description).toMatch(/schedul/i)
    // The settings a full token is refused are named where it would look before trying them.
    expect(tools.find((t) => t.name === 'update_settings')!.description).toMatch(/backups/)
  })
})
