// THE CONTENT API, ASKED THE WAY A STRANGER ASKS IT.
//
// `api-v1-shape.test.ts` holds the field-by-field guarantee and runs in milliseconds against no
// database. This file asks the RUNNING APP, because three of the four things holding this door
// shut are not properties of a projection: the switch, who may see a piece, and whether the
// answer changes when the person asking is the owner.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { dropDatabase, freshDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { clearCache } from '@/server/cache'
import { saveSettings } from '@/content/settings'
import { deletePost, savePost } from '@/content/posts'
import { savePage } from '@/content/pages'
import { saveNote } from '@/content/notes'
import { PER_MAX } from '@/web/api-v1-shape'

const DIR = './.tmp/test-api-v1'
freshDatabase(DIR)
const app = createApp()
const SITE = 'https://example.test'
let cookie = ''

const ago = (ms: number): string => new Date(Date.now() - ms).toISOString()
const ahead = (ms: number): string => new Date(Date.now() + ms).toISOString()

const get = async (path: string, headers: Record<string, string> = {}): Promise<Response> =>
  await app.request(path, { headers })

const body = async (path: string): Promise<Record<string, unknown>> =>
  (await get(path)).json() as Promise<Record<string, unknown>>

/** The `items` of a listing, as the rows a caller reads them back as. */
const items = async <T>(path: string): Promise<T[]> => (await body(path)).items as T[]

/** Flip the one switch this whole file is about. */
const openDoor = (on: boolean): Promise<unknown> => saveSettings({ api: { enabled: on } })

beforeAll(async () => {
  resetSecretCache()
  resetLimits()
  // The page cache is per process and the test files share one (see `routes-open.test.ts`).
  clearCache()
  const user = await createUser({
    username: 'owner', email: 'owner@example.com', password: 'wandering violet cassette',
  })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
  await saveSettings({ title: 'A Blog', description: 'Đôi dòng', siteUrl: SITE })

  const post = (over: Partial<Parameters<typeof savePost>[0]>) =>
    savePost({ status: 'published', date: ago(3_600_000), categories: [], tags: [], ...over } as Parameters<typeof savePost>[0])

  await post({ title: 'Bài công khai', slug: 'bai-cong-khai', content: 'Thân bài.', categories: ['Ghi chép'], tags: ['bút'] })
  await post({ title: 'Bài thứ hai', slug: 'bai-thu-hai', content: 'Thân bài hai.', categories: ['Ghi chép'] })
  await post({ title: 'Bản nháp', slug: 'ban-nhap', content: 'Chưa xong.', status: 'draft', categories: ['Riêng tư'] })
  await post({ title: 'Đăng sau', slug: 'dang-sau', content: 'Tuần tới.', date: ahead(86_400_000), categories: ['Hẹn giờ'] })
  await post({ title: 'Đã bỏ', slug: 'da-bo', content: 'Bỏ rồi.', categories: ['Thùng rác'] })
  await deletePost('da-bo')

  await savePage({ title: 'Giới thiệu', slug: 'gioi-thieu', content: 'Về trang này.', status: 'published' })
  await savePage({ title: 'Nháp trang', slug: 'nhap-trang', content: 'Chưa xong.', status: 'draft' })
  await saveNote({ title: 'Trích', slug: 'trich', content: 'Ghi lại.', status: 'published', date: ago(3_600_000) })
})
afterAll(() => dropDatabase(DIR))

const PATHS = [
  '/api/v1', '/api/v1/posts', '/api/v1/posts/bai-cong-khai', '/api/v1/pages',
  '/api/v1/pages/gioi-thieu', '/api/v1/notes', '/api/v1/notes/trich', '/api/v1/taxonomy',
]

describe('the switch', () => {
  it('answers 404 on every path while it is off, which is the install default', async () => {
    await openDoor(false)
    for (const path of PATHS) {
      const res = await get(path)
      expect(res.status).toBe(404)
      // 404 and not 403: a 403 would confirm the feature exists on this install, and there is
      // nothing to be had by telling a stranger which build they are pointed at.
      expect(await res.json()).toEqual({ error: 'Not found' })
    }
  })

  it('answers every one of them once it is on', async () => {
    // ⚠️ THE COUNTER-TEST, and it is the load-bearing half. A sweep that finds 404 everywhere
    // proves nothing if the routes were never registered — one typo in the mount and the test
    // above is a clean bill of health for a feature that does not exist.
    await openDoor(true)
    for (const path of PATHS) expect((await get(path)).status).toBe(200)
  })

  it('lets a cross-origin client READ the 404, rather than hiding it behind CORS', async () => {
    // ⚠️ THE CLOSED DOOR CARRIES THE CORS HEADERS TOO. Without them a browser tells the client
    // that CORS refused the request, which is a different and much less useful sentence than
    // "that endpoint answered 404" — and this 404 says nothing a request to any unclaimed path
    // does not. It must not be held, either: a cached 404 outlives the reason for it.
    await openDoor(false)
    const res = await get('/api/v1/posts', { origin: 'https://somewhere.else' })
    expect(res.status).toBe(404)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  it('says what it is when asked at the base', async () => {
    await openDoor(true)
    const index = await body('/api/v1')
    expect(index).toMatchObject({ api: 'quireink', version: 1 })
    expect(index.site).toMatchObject({ title: 'A Blog', url: SITE, language: expect.any(String) })
    expect(index.endpoints).toMatchObject({ posts: `${SITE}/api/v1/posts` })
  })
})

describe('what a stranger may see', () => {
  beforeAll(() => openDoor(true) as Promise<void>)

  it('lists the public posts and nothing else', async () => {
    const list = await body('/api/v1/posts')
    const slugs = (list.items as { slug: string }[]).map((p) => p.slug)
    expect(slugs).toContain('bai-cong-khai')
    expect(slugs).toContain('bai-thu-hai')
    // A draft, a post dated next week, and one in the trash.
    expect(slugs).not.toContain('ban-nhap')
    expect(slugs).not.toContain('dang-sau')
    expect(slugs).not.toContain('da-bo')
    expect(list.total).toBe(2)
  })

  it('refuses each of those three by name as well', async () => {
    // The list and the single piece are different readers, so absence from one is not absence
    // from the other. A draft's slug is guessable — it is usually the title.
    for (const slug of ['ban-nhap', 'dang-sau', 'da-bo']) {
      expect((await get(`/api/v1/posts/${slug}`)).status).toBe(404)
    }
    expect((await get('/api/v1/pages/nhap-trang')).status).toBe(404)
    // The counter-test: the published ones answer, with their bodies.
    const one = await body('/api/v1/posts/bai-cong-khai')
    expect(one.content).toBe('Thân bài.')
    expect((await body('/api/v1/pages/gioi-thieu')).content).toBe('Về trang này.')
  })

  it('keeps the notebook out of the posts and the posts out of the notebook', async () => {
    // ADR 0044: a note is not a post, and it has never been in the post feed.
    const posts = await items<{ slug: string }>('/api/v1/posts')
    expect(posts.map((p) => p.slug)).not.toContain('trich')
    const notes = await items<{ slug: string; url: string }>('/api/v1/notes')
    expect(notes.map((n) => n.slug)).toEqual(['trich'])
    expect(notes[0].url).toBe(`${SITE}/notes/trich`)
  })

  it('counts a term over public posts only', async () => {
    const tax = await body('/api/v1/taxonomy')
    const names = tax.categories as { name: string; count: number }[]
    expect(names.find((x) => x.name === 'Ghi chép')?.count).toBe(2)
    // Each of these exists on exactly one piece, and that piece is a draft, a future post or a
    // trashed one. A category nobody can reach is a category this API must not name.
    for (const hidden of ['Riêng tư', 'Hẹn giờ', 'Thùng rác']) {
      expect(names.find((x) => x.name === hidden)).toBeUndefined()
    }
  })

  it('filters by the archive’s own rule, so the two cannot disagree', async () => {
    const byName = await body('/api/v1/posts?category=Ghi%20ch%C3%A9p')
    expect(byName.total).toBe(2)
    // The SLUG spelling is what `/category/{slug}` matches, and `resolveTerm` accepts both.
    const bySlug = await body('/api/v1/posts?category=ghi-chep')
    expect(bySlug.total).toBe(2)
    expect(await body('/api/v1/posts?tag=but')).toMatchObject({ total: 1 })
    expect(await body('/api/v1/posts?category=nothing-by-that-name')).toMatchObject({ total: 0 })
  })

  it('hands out term URLs that resolve, in the spelling the site itself links', async () => {
    // ⚠️ THE LOOP CLOSED. `resolveTerm` also accepts a term written out and percent-encoded, so
    // a URL built that way would have worked here and been a SECOND address for the archive that
    // only this API hands out — and `web/term-routes.ts` 301s anything but the canonical spelling.
    // So the slug this returns is fed straight back and has to find the same posts.
    const tax = await body('/api/v1/taxonomy')
    const one = (tax.categories as { name: string; count: number; url: string }[])
      .find((x) => x.name === 'Ghi chép')!
    expect(one.url).toBe(`${SITE}/category/ghi-chep`)
    const slug = one.url.split('/').pop()!
    expect(await body(`/api/v1/posts?category=${slug}`)).toMatchObject({ total: one.count })
    // And the site's own route agrees it is that term, rather than redirecting to another.
    const page = await get(`/category/${slug}`)
    expect(page.status).toBe(200)
  })

  it('clamps the page size a caller asks for', async () => {
    const page = await body('/api/v1/posts?per=99999')
    expect(page.per).toBe(PER_MAX)
  })
})

describe('the answer does not depend on who asked', () => {
  it('gives the owner’s own session exactly what it gives a stranger', async () => {
    // ⚠️ THIS IS WHAT MAKES `access-control-allow-origin: *` SAFE HERE. Open-to-any-origin plus
    // varies-by-reader is the pair in every write-up of a CORS leak; this endpoint refuses the
    // second half by never reading the cookie at all. If a `lang` switch or a preview ever
    // starts reading the session on this surface, this goes red before it ships.
    await openDoor(true)
    for (const path of ['/api/v1/posts', '/api/v1/posts/bai-cong-khai', '/api/v1']) {
      const asStranger = await (await get(path)).text()
      const asOwner = await (await get(path, { cookie })).text()
      expect(asOwner).toBe(asStranger)
    }
  })

  it('opens to any origin and offers no credentials', async () => {
    await openDoor(true)
    const res = await get('/api/v1/posts', { origin: 'https://somewhere.else' })
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    // ⚠️ THE ABSENT HEADER IS THE POINT. `*` with `allow-credentials: true` is rejected by
    // browsers outright, and a reflected origin with it is how a read API becomes a way to read
    // somebody's session. Neither exists here, and this says so out loud.
    expect(res.headers.get('access-control-allow-credentials')).toBeNull()
  })

  it('answers a preflight without consulting the switch', async () => {
    // A plain `fetch` of these URLs is a simple request and sends no preflight; a client that
    // adds a header of its own does. It is answered whether the door is open or shut because
    // OPTIONS describes the METHOD, and the GET behind it says 404 either way — so this reveals
    // nothing the next request would not, and costs no settings read.
    await openDoor(false)
    const res = await app.request('/api/v1/posts', { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS')
  })
})
