// The import routes: the WordPress upload (and through its persist loop, every
// platform's), the 301s an import writes, and the image fetch batch. Split from
// admin-ops.test.ts when these grew past the file-size cap — the setup is the
// standard one: an app, a database of its own, an owner session.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { payload } from '@/test/api'

const DIR = './.tmp/test-admin-import'
const UPLOADS = `${DIR}-uploads`
freshDatabase(DIR)
// Its own upload store, CREATED — same reason as admin-ops.test.ts: nothing here may
// depend on a developer machine happening to have an ./uploads.
process.env.STORAGE_LOCAL_DIR = UPLOADS
mkdirSync(UPLOADS, { recursive: true })

afterAll(() => {
  dropDatabase(DIR)
  delete process.env.STORAGE_LOCAL_DIR
  try { rmSync(UPLOADS, { recursive: true, force: true }) } catch { /* ignore */ }
})

const app = createApp()
let cookie = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'posts', 'pages', 'post_terms', 'activity_log', 'settings', 'server_secrets', 'redirects', 'media']) {
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

describe('the WordPress import', () => {
  const wxr = (items: string) => `<?xml version="1.0"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/">
<channel>${items}</channel></rss>`

  const item = (title: string, type = 'post', slug = '') => `
<item>
  <title>${title}</title>
  <wp:post_name>${slug}</wp:post_name>
  <wp:post_type>${type}</wp:post_type>
  <wp:status>publish</wp:status>
  <content:encoded><![CDATA[<p>Body of <strong>${title}</strong>.</p>]]></content:encoded>
</item>`

  const send = (xml: string, name = 'export.xml') => {
    const form = new FormData()
    form.append('file', new File([xml], name, { type: 'text/xml' }), name)
    return asOwner('/api/import/wordpress', { method: 'POST', body: form })
  }

  it('imports posts and pages and converts the HTML to markdown', async () => {
    const res = await send(wxr(item('First Post') + item('About', 'page')))
    expect(res.status).toBe(200)
    const result = await payload<{ posts: number; pages: number }>(res)
    expect(result.posts).toBe(1)
    expect(result.pages).toBe(1)

    const list = await payload<Array<{ slug: string }>>(asOwner('/api/posts'))
    const full = await payload<{ content: string }>(asOwner(`/api/posts/${list[0].slug}`))
    expect(full.content).toContain('**First Post**')
    expect(full.content).not.toContain('<strong>')
  })

  /**
   * Nothing is ever overwritten: an import ADDS. Posts and pages share one namespace
   * (Invariant 2), so the suffix has to be found against both.
   */
  it('suffixes a slug that already exists rather than overwriting', async () => {
    await send(wxr(item('Same Title')))
    await send(wxr(item('Same Title')))
    const list = await payload<Array<{ slug: string }>>(asOwner('/api/posts'))
    expect(list.length).toBe(2)
    expect(new Set(list.map((p) => p.slug)).size).toBe(2)
  })

  it('rejects a file that is not a WordPress export, with a specific message', async () => {
    const res = await send('<html><body>not an export</body></html>')
    expect(res.status).toBe(400)
    // "import failed" on the wrong file is the least useful thing to say to someone.
    expect(await res.json()).toEqual({ success: false, error: 'not_a_wordpress_export' })
  })

  it('rejects a request with no file', async () => {
    const res = await asOwner('/api/import/wordpress', { method: 'POST', body: new FormData() })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ success: false, error: 'no_file' })
  })

  /**
   * The old address keeps working: a published item that lived at WordPress's dated
   * path gets a 301 to its new slug, served by the same middleware as every owner-made
   * redirect — so the day the old domain points here, old links and search results land.
   */
  it('301s the path a published item lived at to its new slug', async () => {
    const dated = `
<item>
  <title>Hello</title>
  <link>https://old.example/2020/05/hello/</link>
  <wp:post_name>hello</wp:post_name>
  <wp:post_type>post</wp:post_type>
  <wp:status>publish</wp:status>
  <content:encoded><![CDATA[<p>Body.</p>]]></content:encoded>
</item>`
    const result = await payload<{ redirects: number }>(send(wxr(dated)))
    expect(result.redirects).toBe(1)

    // Without the trailing slash: WITH it, the canonical-path middleware answers first
    // (strip the slash, 301), and THEN this table answers — two hops, both real.
    const res = await app.request('/2020/05/hello')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/hello')
  })

  it('never lets an old path shadow live content', async () => {
    // Two exports both carrying /hello/: the second import suffixes the slug to hello-2,
    // and a redirect on /hello would put the FIRST post behind a 301 to the second —
    // the middleware answers before the router. The import must decline that redirect.
    const flat = `
<item>
  <title>Hello</title>
  <link>https://old.example/hello/</link>
  <wp:post_name>hello</wp:post_name>
  <wp:post_type>post</wp:post_type>
  <wp:status>publish</wp:status>
  <content:encoded><![CDATA[<p>Body.</p>]]></content:encoded>
</item>`
    await send(wxr(flat))
    const second = await payload<{ redirects: number }>(send(wxr(flat)))
    expect(second.redirects).toBe(0)
    expect((await app.request('/hello')).status).toBe(200)
  })

  it('adds no redirect when the old path IS the new slug', async () => {
    const flat = `
<item>
  <title>Same</title>
  <link>https://old.example/same/</link>
  <wp:post_name>same</wp:post_name>
  <wp:post_type>post</wp:post_type>
  <wp:status>publish</wp:status>
  <content:encoded><![CDATA[<p>Body.</p>]]></content:encoded>
</item>`
    const result = await payload<{ redirects: number }>(send(wxr(flat)))
    expect(result.redirects).toBe(0)
  })
})

describe('the image fetch batch', () => {
  // The wiring only: the real work (scan, fetch, rewrite) is proven with an injected
  // fetcher in import/images.test.ts, because the SSRF guard rightly refuses localhost.
  it('answers an empty report when nothing remote is referenced', async () => {
    const res = await asOwner('/api/import/images', { method: 'POST' })
    expect(res.status).toBe(200)
    expect(await payload<Record<string, unknown>>(res)).toEqual({ found: 0, moved: 0, remaining: 0, failed: [] })
  })

  it('is owner-gated', async () => {
    // 403, not 401: the gate checks the origin BEFORE the session, same as every write.
    expect((await app.request('/api/import/images', { method: 'POST' })).status).toBe(403)
  })
})
