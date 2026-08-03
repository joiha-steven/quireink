// Taxonomy, series, redirects, settings, trash, activity, cache.
//
// The one with real teeth is the trash `in_use` guard: without it, permanently deleting a
// trashed image silently breaks whatever published page still points at it, and nothing
// tells anyone until a reader sees a broken image.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { pageCache } from '@/server/cache'
import { blobUrl } from '@/media/blob'
import { payload } from '@/test/api'

const DIR = './.tmp/test-admin-site'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
let cookie = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'posts', 'pages', 'post_terms', 'media', 'files',
                   'comments', 'redirects', 'activity_log', 'settings', 'server_secrets']) {
    db().run(`delete from ${t}`)
  }
  pageCache.clear()
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
})

const asOwner = (path: string, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: { cookie, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
  })

const post = (path: string, data: unknown) =>
  asOwner(path, { method: 'POST', body: JSON.stringify(data) })

const newPost = (data: unknown) => post('/api/posts', data)

describe('the gate', () => {
  it('refuses every one of these without a session', async () => {
    const routes: Array<[string, string]> = [
      ['POST', '/api/taxonomy'], ['POST', '/api/series'],
      ['GET', '/api/redirects'], ['POST', '/api/redirects'], ['DELETE', '/api/redirects/1'],
      ['PUT', '/api/settings'],
      ['GET', '/api/activity'], ['DELETE', '/api/activity'],
      ['POST', '/api/cache/clear'], ['POST', '/api/trash'],
    ]
    for (const [method, path] of routes) {
      const res = await app.request(path, {
        method,
        headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
        ...(method === 'GET' || method === 'DELETE' ? {} : { body: '{}' }),
      })
      expect(`${method} ${path} -> ${res.status}`).toBe(`${method} ${path} -> 401`)
    }
  })
})

describe('taxonomy', () => {
  it('renames a tag across every post that carries it', async () => {
    await newPost({ title: 'One', tags: ['draft-tag'], status: 'published' })
    await newPost({ title: 'Two', tags: ['draft-tag'], status: 'published' })
    const res = await post('/api/taxonomy', { kind: 'tag', name: 'draft-tag', action: 'rename', newName: 'final-tag' })
    expect(res.status).toBe(200)
    expect(await payload<{ changed: number }>(res)).toEqual({ changed: 2 })
    expect((await app.request('/tag/final-tag')).status).toBe(200)
  })

  it('removes a term', async () => {
    await newPost({ title: 'One', categories: ['gone'], status: 'published' })
    const res = await post('/api/taxonomy', { kind: 'category', name: 'gone', action: 'delete' })
    expect((await payload<{ changed: number }>(res)).changed).toBe(1)
  })

  it('rejects a missing kind, a missing name, and a rename with no new name', async () => {
    expect((await post('/api/taxonomy', { name: 'x', action: 'delete' })).status).toBe(400)
    expect((await post('/api/taxonomy', { kind: 'tag', action: 'delete' })).status).toBe(400)
    expect((await post('/api/taxonomy', { kind: 'tag', name: 'x', action: 'rename' })).status).toBe(400)
  })
})

describe('series', () => {
  it('renames, reorders and removes', async () => {
    await newPost({ title: 'Part one', series: 'A Series', seriesOrder: 1, status: 'published' })
    await newPost({ title: 'Part two', series: 'A Series', seriesOrder: 2, status: 'published' })

    const renamed = await post('/api/series', { action: 'rename', name: 'A Series', newName: 'Better Name' })
    expect((await payload<{ changed: number }>(renamed)).changed).toBe(2)

    const reordered = await post('/api/series', {
      action: 'reorder', name: 'Better Name', order: ['part-two', 'part-one'],
    })
    expect(reordered.status).toBe(200)

    const removed = await post('/api/series', { action: 'delete', name: 'Better Name' })
    expect((await payload<{ changed: number }>(removed)).changed).toBe(2)
  })

  it('rejects a missing name, an unknown action and an empty reorder', async () => {
    expect((await post('/api/series', { action: 'rename' })).status).toBe(400)
    expect((await post('/api/series', { action: 'sideways', name: 'x' })).status).toBe(400)
    expect((await post('/api/series', { action: 'reorder', name: 'x', order: [] })).status).toBe(400)
  })
})

describe('redirects', () => {
  it('creates, lists and deletes', async () => {
    expect((await post('/api/redirects', { source: '/old', destination: '/new' })).status).toBe(201)
    const list = await payload<Array<{ id: number; source: string; permanent: boolean }>>(asOwner('/api/redirects'))
    expect(list.length).toBe(1)
    expect(list[0].source).toBe('/old')
    // 301 unless explicitly told otherwise.
    expect(list[0].permanent).toBe(true)
    expect((await asOwner(`/api/redirects/${list[0].id}`, { method: 'DELETE' })).status).toBe(200)
    expect((await payload<unknown[]>(asOwner('/api/redirects'))).length).toBe(0)
  })

  it('makes a redirect temporary only on an explicit false', async () => {
    await post('/api/redirects', { source: '/a', destination: '/b', permanent: false })
    const list = await payload<Array<{ permanent: boolean }>>(asOwner('/api/redirects'))
    expect(list[0].permanent).toBe(false)
  })

  // The validation message IS for the caller, unlike the generic 500 path.
  it('passes a validation message through as a 400', async () => {
    const res = await post('/api/redirects', { source: '', destination: '/b' })
    expect(res.status).toBe(400)
    expect((await payload<{ error: string }>(res)).error).not.toBe('Internal error')
  })

  it('rejects a non-numeric id', async () => {
    expect((await asOwner('/api/redirects/abc', { method: 'DELETE' })).status).toBe(400)
  })
})

describe('settings', () => {
  it('saves and returns the merged settings', async () => {
    const res = await asOwner('/api/settings', { method: 'PUT', body: JSON.stringify({ title: 'A New Title' }) })
    expect(res.status).toBe(200)
    expect((await payload<{ title: string }>(res)).title).toBe('A New Title')
  })

  // Invariant 1. Settings are site-wide, so every cached page is now wrong.
  it('clears the page cache', async () => {
    await app.request('/')
    expect(pageCache.size).toBeGreaterThan(0)
    await asOwner('/api/settings', { method: 'PUT', body: JSON.stringify({ title: 'Changed' }) })
    expect(pageCache.size).toBe(0)
  })
})

describe('the activity log', () => {
  it('reports what the admin did, and clears', async () => {
    await newPost({ title: 'Logged' })
    const entries = await payload<Array<{ action: string }>>(asOwner('/api/activity'))
    expect(entries.some((e) => e.action === 'post.create')).toBe(true)
    expect((await asOwner('/api/activity', { method: 'DELETE' })).status).toBe(200)
    expect((await payload<unknown[]>(asOwner('/api/activity'))).length).toBe(0)
  })
})

describe('the cache purge', () => {
  it('empties the page cache', async () => {
    await app.request('/')
    expect(pageCache.size).toBeGreaterThan(0)
    expect((await post('/api/cache/clear', {})).status).toBe(200)
    expect(pageCache.size).toBe(0)
  })
})

describe('trash', () => {
  it('rejects an unknown kind or action, and an empty id list', async () => {
    expect((await post('/api/trash', { kind: 'widgets', action: 'purge', ids: ['x'] })).status).toBe(400)
    expect((await post('/api/trash', { kind: 'posts', action: 'sideways', ids: ['x'] })).status).toBe(400)
    expect((await post('/api/trash', { kind: 'posts', action: 'restore', ids: [] })).status).toBe(400)
  })

  it('restores a soft-deleted post to the public site', async () => {
    const created = await newPost({ title: 'Comes back', status: 'published' })
    const { slug } = await payload<{ slug: string }>(created)
    await asOwner(`/api/posts/${slug}`, { method: 'DELETE' })
    expect(await (await app.request('/')).text()).not.toContain('Comes back')

    const res = await post('/api/trash', { kind: 'posts', action: 'restore', ids: [slug] })
    expect(res.status).toBe(200)
    // Invariant 1 again: the restore has to be visible without a cold hit.
    expect(await (await app.request('/')).text()).toContain('Comes back')
  })

  it('purges permanently', async () => {
    const created = await newPost({ title: 'Gone for good' })
    const { slug } = await payload<{ slug: string }>(created)
    await asOwner(`/api/posts/${slug}`, { method: 'DELETE' })
    expect((await post('/api/trash', { kind: 'posts', action: 'purge', ids: [slug] })).status).toBe(200)
    const restored = await post('/api/trash', { kind: 'posts', action: 'restore', ids: [slug] })
    // Nothing left to restore; the row is really gone.
    expect(restored.status).toBe(200)
    expect((await asOwner(`/api/posts/${slug}`)).status).toBe(404)
  })

  /**
   * The guard with teeth. Purging a trashed image that a published post still references
   * silently breaks that post, and nobody finds out until a reader sees a broken image.
   * `in_use:<n>` is what lets the admin re-ask with `force`.
   */
  it('refuses to purge media a live post still references', async () => {
    // Stored store-relative (Invariant 3): the column is `path`, and the key must live
    // under `media/` because that is the prefix usedMediaKeys scans content for.
    const path = 'media/photo.jpg'
    const url = blobUrl(path)
    db().run(`insert into media (path, filename, uploaded_at) values (?, ?, ?)`,
      [path, 'photo.jpg', Date.now()])
    await newPost({ title: 'Has an image', content: `![alt](${url})`, status: 'published' })
    db().run(`update media set deleted_at = ?`, [Date.now()])

    const refused = await post('/api/trash', { kind: 'media', action: 'purge', ids: [url] })
    expect(refused.status).toBe(409)
    expect((await payload<{ error: string }>(refused)).error).toBe('in_use:1')

    // ...and goes ahead when the caller confirms.
    const forced = await post('/api/trash', { kind: 'media', action: 'purge', ids: [url], force: true })
    expect(forced.status).toBe(200)
  })

  it('lets an unreferenced image be purged without force', async () => {
    const url = blobUrl('media/orphan.jpg')
    db().run(`insert into media (path, filename, uploaded_at, deleted_at) values (?, ?, ?, ?)`,
      ['media/orphan.jpg', 'orphan.jpg', Date.now(), Date.now()])
    expect((await post('/api/trash', { kind: 'media', action: 'purge', ids: [url] })).status).toBe(200)
  })
})
