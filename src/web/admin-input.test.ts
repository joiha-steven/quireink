// What the piece routes refuse, and why (2026-09-30): a save from an older copy (two tabs), a
// derived slug that is taken (renamed, not refused), and a body of the wrong shape.
// The rule is in `web/admin/stale.ts`; the editor half is a tour flow ("two tabs: …").
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { payload } from '@/test/api'

const DIR = './.tmp/test-admin-input'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
let cookie = ''

beforeEach(async () => {
  for (const table of ['sessions', 'users', 'posts', 'pages', 'post_terms', 'activity_log', 'server_secrets']) {
    db().run(`delete from ${table}`)
  }
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
})

/** A signed-in request. Same-origin headers, because writes require them. */
const asOwner = (path: string, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: {
      cookie,
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
      ...(init.headers as Record<string, string> ?? {}),
    },
  })

const post = (path: string, data: unknown) =>
  asOwner(path, { method: 'POST', body: JSON.stringify(data) })

describe('a save from an older copy', () => {
  it('refuses a save from a copy older than the row, and keeps the newer words', async () => {
    const meta = await payload<{ slug: string; updatedAt: string }>(await post('/api/posts', { title: 'Twice', content: 'v1' }))
    const opened = Date.parse(meta.updatedAt)
    await new Promise((r) => setTimeout(r, 5))
    const put = (content: string, baseSavedAt?: number) => asOwner(`/api/posts/${meta.slug}`, {
      method: 'PUT', body: JSON.stringify({ title: 'Twice', content, ...(baseSavedAt ? { baseSavedAt } : {}) }),
    })
    // Tab A saves, from the copy it opened.
    const a = await put('from tab A', opened)
    expect(a.status).toBe(200)
    // Tab B still holds that same old copy.
    const b = await put('from tab B', opened)
    expect(b.status).toBe(409)
    expect(await b.json()).toEqual({ success: false, error: 'stale' })
    const now = await payload<{ content: string }>(asOwner(`/api/posts/${meta.slug}`))
    expect(now.content).toBe('from tab A')
    // Tab A carries on from what it saved.
    expect((await put('A again', Date.parse((await payload<{ updatedAt: string }>(a)).updatedAt))).status).toBe(200)
  })


  it('is not asked of a caller that sends no copy stamp (MCP, the API, imports)', async () => {
    const meta = await payload<{ slug: string }>(await post('/api/posts', { title: 'Plain', content: 'v1' }))
    const res = await asOwner(`/api/posts/${meta.slug}`, { method: 'PUT', body: JSON.stringify({ title: 'Plain', content: 'v2' }) })
    expect(res.status).toBe(200)
  })
})

// A new post whose title matches an existing post's failed every save with "That slug is
// already taken", though the writer never typed a slug — and on an untitled post, cannot see it.
describe('a new piece whose derived slug is taken', () => {
  it('is saved under the next free one', async () => {
    await post('/api/posts', { title: 'Three weeks', content: 'first' })
    const again = await post('/api/posts', { title: 'Three weeks', slug: 'three-weeks', slugDerived: true, content: 'second' })
    expect(again.status).toBe(201)
    expect((await payload<{ slug: string }>(again)).slug).toBe('three-weeks-2')
  })

  it('still refuses a slug the writer typed', async () => {
    await post('/api/posts', { title: 'Typed', slug: 'typed' })
    expect((await post('/api/posts', { title: 'Other', slug: 'typed' })).status).toBe(409)
  })
})

// A body of the wrong shape is the caller's mistake and says so; it was a 500.
describe('a piece body of the wrong shape', () => {
  it('is refused with a 400 that names the field', async () => {
    for (const [bad, field] of [
      [{ title: 123 }, 'title'], [{ slug: { a: 1 } }, 'slug'], [{ title: 'x', tags: 'notarray' }, 'tags'],
      [{ title: 'x', date: 'not-a-date' }, 'date'],
    ] as const) {
      const res = await post('/api/posts', bad)
      expect(`${field}: ${res.status}`).toBe(`${field}: 400`)
      expect((await res.json() as { error: string }).error).toContain(field)
    }
    expect((await asOwner('/api/posts', { method: 'POST', body: 'null' })).status).toBe(400)
    expect((await asOwner('/api/pages', { method: 'POST', body: '{"title":[1]}' })).status).toBe(400)
    expect((await asOwner('/api/notes', { method: 'POST', body: '{"content":7}' })).status).toBe(400)
  })

  it('and a settings save that is not JSON is a 400, not a silent no-op', async () => {
    expect((await asOwner('/api/settings', { method: 'PUT', body: '{bad' })).status).toBe(400)
  })
})
