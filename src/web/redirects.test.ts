// Owner-managed redirects, at the layer a reader meets them: a real HTTP redirect from
// the router, not a row in a table.
//
// Its OWN database directory, like every other web test: `openDatabases` holds one
// connection pair per process, so two test files sharing a directory close each other's.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { saveRedirect, getRedirects } from '@/server/redirects'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-redirects'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings', 'media', 'redirects']) {
    db().run(`delete from ${t}`)
  }
})

describe('redirects are served', () => {
  it('answers a permanent redirect with 301 and a relative Location', async () => {
    await saveRedirect({ source: '/old-slug', destination: '/new-slug' })
    const res = await get('/old-slug')
    expect(res.status).toBe(301)
    // Relative on purpose. Resolving against the request would emit the scheme the ORIGIN
    // saw, which behind TLS-terminating nginx is `http://` — an extra hop for a browser and
    // a refusal from anything that will not follow https → http. Asserting the absolute form
    // here is what let that ship: `app.request` speaks plain http, so it looked right.
    expect(res.headers.get('location')).toBe('/new-slug')
  })

  it('answers a temporary redirect with 302', async () => {
    await saveRedirect({ source: '/moved', destination: '/elsewhere', permanent: false })
    expect((await get('/moved')).status).toBe(302)
  })

  it('sends an absolute destination through untouched', async () => {
    await saveRedirect({ source: '/gone', destination: 'https://example.com/there' })
    const res = await get('/gone')
    expect(res.headers.get('location')).toBe('https://example.com/there')
  })

  it('redirects a multi-segment path, which is what a WordPress import leaves behind', async () => {
    await saveRedirect({ source: '/2024/01/hello-world', destination: '/hello-world' })
    const res = await get('/2024/01/hello-world')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/hello-world')
  })

  it('never emits a scheme of its own, whatever the origin saw', async () => {
    await saveRedirect({ source: '/old-slug', destination: '/new-slug' })
    const location = (await get('/old-slug')).headers.get('location') ?? ''
    expect(location.startsWith('http://')).toBe(false)
  })

  it('matches through the trailing-slash canonicalisation rather than around it', async () => {
    await saveRedirect({ source: '/old-slug', destination: '/new-slug' })
    // `canonicalPath` strips the slash first, so this is two hops, and the second one is
    // the redirect. Both are 301s, so a crawler follows the pair without penalty.
    const first = await get('/old-slug/')
    expect(first.status).toBe(301)
    expect(first.headers.get('location')).toBe('/old-slug')
    expect((await get('/old-slug')).status).toBe(301)
  })

  it('renaming a slug leaves a redirect that actually works', async () => {
    await savePost({ title: 'First name', content: 'body text here', status: 'published', date: '2020-01-01T00:00:00.000Z' })
    await savePost(
      { slug: 'second-name', title: 'Second name', content: 'body text here', status: 'published', date: '2020-01-01T00:00:00.000Z' },
      'first-name',
    )
    expect((await getRedirects()).map((r) => r.source)).toContain('/first-name')
    const res = await get('/first-name')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/second-name')
    expect((await get('/second-name')).status).toBe(200)
  })
})

describe('the URLs that are a second spelling of another URL', () => {
  const PAST = '2020-01-01T00:00:00.000Z'

  it('sends /page/1 to the home listing, which is the same page', async () => {
    await savePost({ title: 'Anything', content: 'body text here', status: 'published', date: PAST })
    const res = await get('/page/1')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/')
    // ...and page 2 is a page of its own, so it still renders.
    expect((await get('/page/2')).status).not.toBe(301)
  })

  it('sends a term archive\'s page 1 to the archive', async () => {
    await savePost({
      title: 'Tagged', content: 'body text here', status: 'published', date: PAST,
      categories: ['Ghi chép'], tags: ['bun'],
    })
    for (const [from, to] of [['/category/ghi-chep/page/1', '/category/ghi-chep'], ['/tag/bun/page/1', '/tag/bun']]) {
      const res = await get(from!)
      expect(`${from}: ${res.status}`).toBe(`${from}: 301`)
      expect(res.headers.get('location')).toBe(to!)
    }
  })

  it('keeps the query string, and takes a trailing slash in two permanent hops', async () => {
    expect((await get('/page/1?x=1')).headers.get('location')).toBe('/?x=1')
    const first = await get('/page/1/')
    expect(first.headers.get('location')).toBe('/page/1')
    expect((await get('/page/1')).status).toBe(301)
  })

  it('leaves a path that only looks like page one alone', async () => {
    // The rule is anchored: `/series/x/page/1` is not a route, and `/page/10` is a page.
    expect((await get('/page/10')).status).not.toBe(301)
    expect((await get('/series/notes/page/1')).status).not.toBe(301)
  })

  it('sends the plural /sitemaps.xml to the one sitemap', async () => {
    const res = await get('/sitemaps.xml')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/sitemap.xml')
  })
})

describe('what redirects do NOT touch', () => {
  it('leaves the admin and the API alone', async () => {
    await saveRedirect({ source: '/admin/old', destination: '/new' })
    await saveRedirect({ source: '/api/old', destination: '/new' })
    // The admin bounces a signed-out visitor to sign-in; the API 404s. Neither is a 301,
    // which is the point: a redirect table cannot reach either surface.
    expect((await get('/admin/old')).status).not.toBe(301)
    expect((await get('/api/old')).status).not.toBe(301)
  })

  it('a URL with no row is still a 404 page, not a redirect', async () => {
    const res = await get('/never-existed')
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('live content at a path wins, because saving there clears the row', async () => {
    await saveRedirect({ source: '/taken', destination: '/somewhere' })
    await savePost({ slug: 'taken', title: 'Taken', content: 'body text here', status: 'published', date: '2020-01-01T00:00:00.000Z' })
    expect((await getRedirects()).map((r) => r.source)).not.toContain('/taken')
    expect((await get('/taken')).status).toBe(200)
  })
})
