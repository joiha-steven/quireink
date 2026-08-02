// The admin API, and the gate in front of it.
//
// The gate tests matter more than the CRUD tests. CRUD failing is visible the moment
// anyone opens the admin; the gate failing is invisible until it is someone else's blog.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { payload } from '@/test/api'
import { saveSettings } from '@/content/settings'

const DIR = './.tmp-test-admin'
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

describe('the gate', () => {
  // Invariant 4. Every one of these is protected because of the router it was registered
  // on, not because of a check written inside it.
  it('refuses every admin route without a session', async () => {
    const routes: Array<[string, string]> = [
      ['GET', '/api/posts'],
      ['POST', '/api/posts'],
      ['GET', '/api/posts/anything'],
      ['PUT', '/api/posts/anything'],
      ['DELETE', '/api/posts/anything'],
      ['GET', '/api/posts/anything/revisions'],
      ['GET', '/api/pages'],
      ['POST', '/api/pages'],
      ['GET', '/api/pages/anything'],
      ['PUT', '/api/pages/anything'],
      ['DELETE', '/api/pages/anything'],
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

  /**
   * The gate must not leak onto public routes.
   *
   * It did. `ownerRouter()` first applied `requireOwner()` as `use('*')` on a sub-app, and
   * `app.route('/', sub)` copies that into the parent as `/*` — so every public page on the
   * site started returning 401. Fifty-one tests failed and none of them said why.
   */
  it('does not gate the public site', async () => {
    for (const path of ['/', '/feed.xml', '/robots.txt', '/login', '/search']) {
      expect(`${path} -> ${(await app.request(path)).status}`).toBe(`${path} -> 200`)
    }
  })

  it('refuses a session token that is not in the database', async () => {
    const res = await app.request('/api/posts', { headers: { cookie: `${COOKIE_NAME}=invented` } })
    expect(res.status).toBe(401)
  })

  // CSRF. `SameSite=Lax` already blocks this in the browser; the header check is the
  // second layer, for the cases Lax does not cover.
  it('refuses a cross-site write even with a valid session', async () => {
    const res = await app.request('/api/posts', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
      body: JSON.stringify({ title: 'From somewhere else' }),
    })
    // 403, not 401: signing in would not help, and a 401 invites the client to retry with
    // credentials it already sent.
    expect(res.status).toBe(403)
  })

  it('refuses a write whose Origin is another host', async () => {
    const res = await app.request('/api/posts', {
      method: 'POST',
      headers: {
        cookie, 'content-type': 'application/json',
        origin: 'https://evil.example', host: 'localhost',
      },
      body: JSON.stringify({ title: 'Forged' }),
    })
    expect(res.status).toBe(403)
  })

  // A READ is not state-changing, so it is not subject to the origin check. Applying it
  // there would break a legitimate cross-origin fetch and defend nothing.
  it('allows a cross-site read with a valid session', async () => {
    const res = await app.request('/api/posts', {
      headers: { cookie, 'sec-fetch-site': 'cross-site' },
    })
    expect(res.status).toBe(200)
  })
})

describe('posts', () => {
  it('creates, reads, updates and deletes', async () => {
    const created = await post('/api/posts', { title: 'Hello', content: 'Body' })
    expect(created.status).toBe(201)
    const meta = await payload<{ slug: string; title: string }>(created)
    expect(meta.title).toBe('Hello')

    const read = await asOwner(`/api/posts/${meta.slug}`)
    expect(read.status).toBe(200)
    expect((await payload<{ content: string }>(read)).content).toBe('Body')

    const updated = await asOwner(`/api/posts/${meta.slug}`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'Hello again', content: 'More' }),
    })
    expect(updated.status).toBe(200)

    const removed = await asOwner(`/api/posts/${meta.slug}`, { method: 'DELETE' })
    expect(removed.status).toBe(200)
    expect((await asOwner(`/api/posts/${meta.slug}`)).status).toBe(404)
  })

  it('requires a title or a slug', async () => {
    const res = await post('/api/posts', { content: 'Body with no title' })
    expect(res.status).toBe(400)
  })

  // `slug_taken` verbatim, and 409. The admin client matches on the string, not the status,
  // so changing either breaks the editor's rename flow silently.
  it('reports a slug conflict as 409 slug_taken', async () => {
    await post('/api/posts', { title: 'First', slug: 'taken' })
    const clash = await post('/api/posts', { title: 'Second', slug: 'taken' })
    expect(clash.status).toBe(409)
    expect(await clash.json()).toEqual({ success: false, error: 'slug_taken' })
  })

  // Invariant 2: posts and pages share one /{slug} namespace.
  it('reports a conflict with a PAGE slug too', async () => {
    await post('/api/pages', { title: 'About', slug: 'about' })
    const clash = await post('/api/posts', { title: 'About', slug: 'about' })
    expect(clash.status).toBe(409)
  })

  it('returns 404 for a post that does not exist', async () => {
    expect((await asOwner('/api/posts/nothing-here')).status).toBe(404)
  })

  it('lists drafts, which is the reason this route is owner-only', async () => {
    await post('/api/posts', { title: 'A draft', status: 'draft' })
    const list = await payload<Array<{ title: string }>>(asOwner('/api/posts'))
    expect(list.map((p) => p.title)).toContain('A draft')
  })
})

describe('pages', () => {
  it('creates, reads, updates and deletes', async () => {
    const created = await post('/api/pages', { title: 'About', content: 'Who I am' })
    expect(created.status).toBe(201)
    const meta = await payload<{ slug: string }>(created)

    expect((await asOwner(`/api/pages/${meta.slug}`)).status).toBe(200)
    const updated = await asOwner(`/api/pages/${meta.slug}`, {
      method: 'PUT', body: JSON.stringify({ title: 'About me', content: 'Who I am' }),
    })
    expect(updated.status).toBe(200)
    expect((await asOwner(`/api/pages/${meta.slug}`, { method: 'DELETE' })).status).toBe(200)
    expect((await asOwner(`/api/pages/${meta.slug}`)).status).toBe(404)
  })

  it('requires a title or a slug', async () => {
    expect((await post('/api/pages', { content: 'No title' })).status).toBe(400)
  })
})

describe('Invariant 1: a write clears the whole page cache', () => {
  it('serves the new post on the home page immediately after the write', async () => {
    // Warm the cache, so a stale entry would be there to serve.
    await app.request('/')
    await post('/api/posts', { title: 'Fresh off the press', status: 'published' })
    const home = await (await app.request('/')).text()
    expect(home).toContain('Fresh off the press')
  })

  it('drops a deleted post from the home page', async () => {
    const created = await post('/api/posts', { title: 'Briefly here', status: 'published' })
    const { slug } = await payload<{ slug: string }>(created)
    expect(await (await app.request('/')).text()).toContain('Briefly here')
    await asOwner(`/api/posts/${slug}`, { method: 'DELETE' })
    expect(await (await app.request('/')).text()).not.toContain('Briefly here')
  })
})

// The error handler moved to `errors.test.ts`. It was asserting JSON for a NON-api path,
// which is the behaviour that turned out to be the bug: a reader on an article got
// `{"error":"Internal error"}` in the browser window. The new file covers both shapes, the
// leak, and the cache headers, through the real router rather than a bare probe.

describe('the admin shell carries the owner settings', () => {
  // The frozen tree's admin sat inside the root layout and inherited the language, the
  // fonts and the palette from it. There is no root layout here, and for a while the shell
  // was a static document that hard-coded English and Inter — so a site set to JetBrains
  // Mono had an admin in Inter, which is what the owner reported.
  it('renders in the site language, not English', async () => {
    await saveSettings({ language: 'vi' })
    const html = await (await app.request('/admin', { headers: { cookie } })).text()
    expect(html).toContain('<html lang="vi"')
  })

  it('points --font-sans at the chosen chrome font and declares its face', async () => {
    await saveSettings({ chromeFont: 'jetbrains-mono' })
    const html = await (await app.request('/admin', { headers: { cookie } })).text()
    expect(html).toContain('data-chrome-font="jetbrains-mono"')
    expect(html).toContain("font-family:'JetBrains Mono'")
    expect(html).toContain("--font-sans:'JetBrains Mono'")
    // The tracking correction that goes with a mono chrome, missing from 2.0 until now.
    expect(html).toContain('html[data-chrome-font="jetbrains-mono"] body')
  })

  // The writing surface is a `.prose` surface, and what you type has to be set in the face
  // it will be published in. The rule lived in the PUBLIC sheet, which the admin does not
  // load, so a post drafted in the chrome font was published in the reading font.
  it('sets the writing surface in the reading face', async () => {
    const css = await (await app.request('/admin/assets/admin.css')).text()
    expect(css).toContain('.prose{font-family:var(--font-reading)')
  })

  it('publishes the motion switch the owner set', async () => {
    await saveSettings({ motion: { enabled: false, typewriter: false } })
    const html = await (await app.request('/admin', { headers: { cookie } })).text()
    expect(html).toContain('data-motion="off"')
  })
})
