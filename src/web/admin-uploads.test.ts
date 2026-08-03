// The media library and the file/icon/font uploads.
//
// These write real bytes, so each test file gets its own storage directory and the whole
// thing is torn down after. The behaviours worth pinning are the type gates (a 415 the
// upload client shows as its own message) and the batch-rejection rule.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { rmSync } from 'node:fs'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { payload } from '@/test/api'

const DIR = './.tmp/test-admin-uploads'
const STORE = './.tmp/test-admin-uploads-store'
process.env.STORAGE_LOCAL_DIR = STORE
// Cleared on load as well as after, so a run that crashed last time does not leave files
// behind that change the names this one gets.
try { rmSync(STORE, { recursive: true, force: true }) } catch { /* first run */ }
freshDatabase(DIR)
afterAll(() => {
  dropDatabase(DIR)
  try { rmSync(STORE, { recursive: true, force: true }) } catch { /* test hygiene only */ }
})

const app = createApp()
let cookie = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'posts', 'pages', 'media', 'files', 'activity_log', 'settings', 'server_secrets']) {
    db().run(`delete from ${t}`)
  }
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
})

const asOwner = (path: string, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: { cookie, 'sec-fetch-site': 'same-origin', ...(init.headers as Record<string, string> ?? {}) },
  })

const postJson = (path: string, data: unknown) =>
  asOwner(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })

/**
 * A one-pixel PNG. Real bytes, because the upload path decodes them for dimensions and a
 * fabricated buffer would fail somewhere unrelated to what is being tested.
 */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

function upload(path: string, files: Array<[name: string, type: string]>, extra: Record<string, string> = {}) {
  const form = new FormData()
  for (const [name, type] of files) form.append('file', new File([PNG], name, { type }), name)
  for (const [k, v] of Object.entries(extra)) form.append(k, v)
  return asOwner(path, { method: 'POST', body: form })
}

describe('the gate', () => {
  it('refuses every media and file route without a session', async () => {
    const routes: Array<[string, string]> = [
      ['GET', '/api/media'], ['POST', '/api/media/upload'], ['POST', '/api/media/register'],
      ['POST', '/api/media/delete'], ['DELETE', '/api/media/x'], ['GET', '/api/media/unused'],
      ['GET', '/api/media/debug'],
      ['GET', '/api/files'], ['GET', '/api/files/icons'], ['POST', '/api/files/attach'],
      ['POST', '/api/files/register'], ['POST', '/api/files/delete'], ['DELETE', '/api/files/by'],
      ['POST', '/api/files/upload'], ['POST', '/api/files/font'],
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

describe('media upload', () => {
  it('accepts an image and lists it', async () => {
    const res = await upload('/api/media/upload', [['one.png', 'image/png']])
    expect(res.status).toBe(201)
    const uploaded = await payload<Array<{ url: string; filename: string }>>(res)
    expect(uploaded.length).toBe(1)
    // A dedup suffix is allowed. `STORAGE_LOCAL_DIR` is a process-global env var and the
    // test files share a process, so an upload here can land beside one from another file
    // and correctly become `one-3.png`. Asserting the exact name tests the scheduler.
    expect(uploaded[0].filename).toMatch(/^one(-\d+)?\.png$/)
    // Stored store-relative under `media/` (Invariant 3), served from /uploads.
    expect(uploaded[0].url.startsWith('/uploads/media/')).toBe(true)

    const list = await payload<unknown[]>(asOwner('/api/media'))
    expect(list.length).toBe(1)
  })

  it('refuses an unsupported type with 415 and the string the client shows', async () => {
    const res = await upload('/api/media/upload', [['notes.txt', 'text/plain']])
    expect(res.status).toBe(415)
    expect(await res.json()).toEqual({ success: false, error: 'unsupported_type' })
  })

  /**
   * The whole batch is refused when one file is wrong, matching the frozen tree. A partial
   * upload leaves the owner working out which of twenty images actually landed.
   */
  it('refuses the whole batch when one file is the wrong type', async () => {
    const res = await upload('/api/media/upload', [['ok.png', 'image/png'], ['bad.txt', 'text/plain']])
    expect(res.status).toBe(415)
    expect((await payload<unknown[]>(asOwner('/api/media'))).length).toBe(0)
  })

  it('rejects an empty upload', async () => {
    const res = await asOwner('/api/media/upload', { method: 'POST', body: new FormData() })
    expect(res.status).toBe(400)
  })
})

describe('media delete', () => {
  it('deletes in a batch and returns the list that is left', async () => {
    const a = await payload<Array<{ url: string }>>(upload('/api/media/upload', [['a.png', 'image/png']]))
    await upload('/api/media/upload', [['b.png', 'image/png']])

    const res = await postJson('/api/media/delete', { urls: [a[0].url] })
    expect(res.status).toBe(200)
    // The AUTHORITATIVE post-delete list, not an acknowledgement: the admin grid is on
    // screen while this happens and must not drift from what the server holds.
    const left = await payload<Array<{ filename: string }>>(res)
    expect(left.length).toBe(1)
    expect(left[0].filename).toMatch(/^b(-\d+)?\.png$/)
  })

  it('deletes one by query parameter', async () => {
    const a = await payload<Array<{ url: string }>>(upload('/api/media/upload', [['solo.png', 'image/png']]))
    const res = await asOwner(`/api/media/solo.png?url=${encodeURIComponent(a[0].url)}`, { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect((await payload<unknown[]>(res)).length).toBe(0)
  })

  it('rejects a delete with no urls', async () => {
    expect((await postJson('/api/media/delete', { urls: [] })).status).toBe(400)
    expect((await asOwner('/api/media/x.png', { method: 'DELETE' })).status).toBe(400)
  })
})

describe('the unused audit', () => {
  // Non-destructive by design: it returns what nothing references so the owner can review.
  it('reports an unreferenced image and never deletes it', async () => {
    const a = await payload<Array<{ url: string }>>(upload('/api/media/upload', [['lonely.png', 'image/png']]))
    const unused = await payload<string[]>(asOwner('/api/media/unused'))
    expect(unused.length).toBe(1)
    // Still there.
    expect((await payload<unknown[]>(asOwner('/api/media'))).length).toBe(1)
    expect(a[0].url).toContain('lonely')
  })

  it('does not report an image a post references', async () => {
    const a = await payload<Array<{ url: string }>>(upload('/api/media/upload', [['used.png', 'image/png']]))
    await postJson('/api/posts', { title: 'Uses it', content: `![x](${a[0].url})` })
    expect((await payload<string[]>(asOwner('/api/media/unused'))).length).toBe(0)
  })
})

describe('files', () => {
  it('attaches a file of any type, which the media library would refuse', async () => {
    const form = new FormData()
    form.append('file', new File(['hello'], 'notes.txt', { type: 'text/plain' }), 'notes.txt')
    const res = await asOwner('/api/files/attach', { method: 'POST', body: form })
    expect(res.status).toBe(201)
    expect((await payload<unknown[]>(asOwner('/api/files'))).length).toBe(1)
  })

  it('deletes by batch and by url', async () => {
    const form = new FormData()
    form.append('file', new File(['a'], 'a.txt', { type: 'text/plain' }), 'a.txt')
    const added = await payload<Array<{ url: string }>>(asOwner('/api/files/attach', { method: 'POST', body: form }))
    const res = await asOwner(`/api/files/by?url=${encodeURIComponent(added[0].url)}`, { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect((await payload<unknown[]>(res)).length).toBe(0)
  })

  it('rejects an empty attach and a delete with no urls', async () => {
    expect((await asOwner('/api/files/attach', { method: 'POST', body: new FormData() })).status).toBe(400)
    expect((await postJson('/api/files/delete', { urls: [] })).status).toBe(400)
  })

  it('rejects a register with no valid items', async () => {
    expect((await postJson('/api/files/register', { items: [{ url: 'x' }] })).status).toBe(400)
    expect((await postJson('/api/media/register', { items: [] })).status).toBe(400)
  })
})

describe('icons and fonts', () => {
  it('uploads an icon', async () => {
    const res = await upload('/api/files/upload', [['favicon.png', 'image/png']], { kind: 'favicon' })
    expect(res.status).toBe(201)
    expect((await payload<{ url: string }>(res)).url).toContain('favicon')
  })

  // The fallback that matters: browsers routinely send no type at all for .ico, and this
  // route exists mostly to accept favicons.
  it('accepts a .ico whose type the browser did not send', async () => {
    const form = new FormData()
    form.append('file', new File([PNG], 'site.ico', { type: '' }), 'site.ico')
    form.append('kind', 'favicon')
    const res = await asOwner('/api/files/upload', { method: 'POST', body: form })
    expect(res.status).toBe(201)
  })

  it('refuses an icon type it does not know', async () => {
    const res = await upload('/api/files/upload', [['icon.txt', 'text/plain']])
    expect(res.status).toBe(415)
  })

  it('refuses a font that is not one', async () => {
    const res = await upload('/api/files/font', [['not-a-font.png', 'image/png']])
    expect(res.status).toBe(415)
  })
})
