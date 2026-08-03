// What an unhandled throw becomes, which depends on who asked.
//
// It was one answer for everybody — `{"error":"Internal error"}` — and everybody includes a
// reader on an article, who got a line of JSON in the browser window with no styling, no
// viewport meta and no way back. The three strings for a proper error page had been sitting
// in all six locales since the port, printed by nothing, which is how this was found.
import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { t } from '@/i18n/i18n'

const DIR = './.tmp/test-errors'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

// Routes that throw, added to the real app so the real `onError`, the real middleware and
// the real cache headers all answer them.
//
// THREE segments, not one: the public router ends in a `/:slug` catch-all that claims every
// single-segment path and answers a miss with the 404 page, so a route added here as `/boom`
// is never reached and the test passes against the wrong response. Nothing in the router
// matches three segments, so this one is genuinely unclaimed.
const app = createApp()
const HTML_PATH = '/test/throwing/page'
const API_PATH = '/api/test-throwing'
app.get(HTML_PATH, () => {
  throw new Error('a secret path: /home/someone/.env and a token abc123')
})
app.get(API_PATH, () => {
  throw new Error('the same secret')
})

describe('an unhandled throw', () => {
  it('gives a reader a real HTML page in the site shell', async () => {
    const res = await app.request(HTML_PATH)
    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    // The site shell, not a bare string: this is what stops a phone laying the page out at
    // the default 980px desktop width.
    expect(html).toContain('<meta name="viewport"')
    expect(html).toContain(t('en').errorTitle)
    // And a way back, which is the whole difference between a page and a dead end.
    expect(html).toContain('href="/"')
  })

  it('still gives an API client the typed envelope it parses', async () => {
    const res = await app.request(API_PATH)
    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({ error: 'Internal error' })
  })

  // The message can carry a file path, a SQL fragment or a token. Asserted on BOTH shapes,
  // because the HTML one is new and is the one that renders into a page a search engine may
  // index.
  it('leaks nothing from the exception, in either shape', async () => {
    for (const path of [HTML_PATH, API_PATH]) {
      const body = await (await app.request(path)).text()
      expect(body).not.toContain('.env')
      expect(body).not.toContain('abc123')
      expect(body).not.toContain('secret')
    }
  })

  // A shared cache holding a 500 would serve the failure to everyone until it expired.
  it('is never stored by a shared cache', async () => {
    const cc = (await app.request(HTML_PATH)).headers.get('cache-control') ?? ''
    expect(cc).toMatch(/no-store|private|max-age=0/)
  })
})

// A URL no route claims at all. `/{slug}` answers a ONE-segment miss with the 404 page, so
// that case always looked right and was the only case anyone checked; two segments or more
// matched nothing and fell through to Hono's built-in `404 Not Found` in text/plain.
describe('a URL no route claims', () => {
  it('gives a reader the 404 page however deep the path is', async () => {
    for (const path of ['/no-such-post', '/2024/01/an-old-wordpress-permalink', '/a/b/c/d/e']) {
      const res = await app.request(path)
      expect(res.status).toBe(404)
      expect(res.headers.get('content-type')).toContain('text/html')
      const html = await res.text()
      expect(html).toContain('<meta name="viewport"')
      expect(html).toContain(t('en').notFoundTitle)
    }
  })

  it('gives an API client JSON, at any depth', async () => {
    for (const path of ['/api/nope', '/api/deeply/nested/nope']) {
      const res = await app.request(path)
      expect(res.status).toBe(404)
      expect(res.headers.get('content-type')).toContain('application/json')
    }
  })
})

// A trailing slash is the same page, and it used to be a 404.
//
// Hono does not match a trailing slash and no route here has one, so `/some-post/` missed
// everything. Every WordPress permalink carries one: measured on the edcmeo export, 468 old
// URLs of the shape `https://edcmeo.com/{slug}/`. An imported site pointing its domain at
// Quire would have answered 404 to every inbound link and every search result it already had.
describe('a trailing slash', () => {
  it('301s to the same path without it', async () => {
    const res = await app.request('/some-post/')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/some-post')
  })

  it('keeps the query string and collapses repeats', async () => {
    expect((await app.request('/tag/edc/?page=2')).headers.get('location')).toBe('/tag/edc?page=2')
    expect((await app.request('/deep/path///')).headers.get('location')).toBe('/deep/path')
  })

  // Trimming `/` leaves nothing to redirect to, so the homepage is left alone.
  it('leaves the homepage alone', async () => {
    expect((await app.request('/')).status).toBe(200)
  })

  it('normalises an API path too, rather than 404ing it', async () => {
    expect((await app.request('/api/search/')).status).toBe(301)
  })
})
