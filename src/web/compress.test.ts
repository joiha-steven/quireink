// Responses leave the origin compressed.
//
// Nothing here ever set `content-encoding`, so every page, stylesheet and bundle went out
// raw. The reader does not see that — the CDN re-compresses — but the origin-to-edge fetch
// does, on every cache miss and on every purge this release started issuing.

import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { savePost } from '@/content/posts'
import { createApp } from '@/web/app'
import { compressionCacheSize, resetCompressionCache } from '@/web/compress'

const DIR = './.tmp/test-compress'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = (path: string, headers: Record<string, string> = {}): Promise<Response> =>
  Promise.resolve(app.request(path, { headers }))

const PAST = '2020-01-01T00:00:00.000Z'
const GZIP = { 'accept-encoding': 'gzip, deflate, br' }

describe('compression', () => {
  it('gzips a page for a client that asked, and says what it varies on', async () => {
    await savePost({
      title: 'Long', status: 'published', date: PAST,
      content: 'A paragraph of prose.\n\n'.repeat(80),
    })
    const res = await get('/long', GZIP)
    expect(res.headers.get('content-encoding')).toBe('gzip')
    // Without Vary a shared cache can hand the gzipped body to a client that never asked.
    expect(res.headers.get('vary')).toContain('Accept-Encoding')
    // ...and it decodes back to the page. Inflated by hand on purpose: `app.request` hands
    // back the raw body, where a browser's fetch would have done this itself. That is also
    // the proof the body really is compressed rather than merely labelled.
    const raw = new Uint8Array(await res.arrayBuffer())
    expect(new TextDecoder().decode(Bun.gunzipSync(raw))).toContain('Long')
  })

  it('sends plain bytes to a client that did not ask', async () => {
    await savePost({
      title: 'Plain', status: 'published', date: PAST,
      content: 'A paragraph of prose.\n\n'.repeat(80),
    })
    const res = await get('/plain')
    expect(res.headers.get('content-encoding')).toBeNull()
    expect(await res.text()).toContain('Plain')
  })

  it('leaves a short body alone, where the header costs more than it saves', async () => {
    const res = await get('/robots.txt', GZIP)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-encoding')).toBeNull()
    expect((await res.text()).length).toBeLessThan(1024)
  })

  it('compresses the stylesheet, which is the biggest single asset on the site', async () => {
    const html = await get('/long').then((r) => r.text())
    const href = /<link rel="stylesheet" href="([^"]+)">/.exec(html)?.[1] ?? ''
    const res = await get(href, GZIP)
    expect(res.headers.get('content-encoding')).toBe('gzip')
    expect(res.headers.get('content-type')).toContain('text/css')
    // Still immutable: compressing a response must not disturb what may be cached.
    expect(res.headers.get('cache-control')).toContain('immutable')
  })
})

describe('the machine surfaces are never compressed', () => {
  it('leaves an /api/ response alone however big it is', async () => {
    // The MCP connector authorised, stayed connected, and never showed a tool list:
    // `initialize` is under a kilobyte so it went out raw and the handshake worked, and
    // `tools/list` is over it so it went out gzipped and the client could not read it.
    const res = await get('/api/mcp', { ...GZIP, accept: 'application/json' })
    expect(res.headers.get('content-encoding')).toBeNull()
  })
})

describe('the same bytes are only gzipped once', () => {
  /**
   * The page cache stores HTML strings and this middleware runs outside it, so a cache HIT
   * still paid a full gzip. Measured on a warm local instance: the front page fell from
   * 5,510 to 3,325 req/s with compression on, and the immutable stylesheet from 11,216 to
   * 3,652 — most of the origin's CPU spent re-deriving an answer it already had.
   */
  it('serves an identical body from one compressed copy', async () => {
    resetCompressionCache()
    await savePost({
      title: 'Repeat', status: 'published', date: PAST,
      content: 'A paragraph of prose.\n\n'.repeat(80),
    })
    const first = new Uint8Array(await (await get('/repeat', GZIP)).arrayBuffer())
    const second = new Uint8Array(await (await get('/repeat', GZIP)).arrayBuffer())
    expect(second).toEqual(first)
    // One entry, not two: the second request found the first request's bytes.
    expect(compressionCacheSize()).toBe(1)
  })

  it('does not confuse two different bodies', async () => {
    resetCompressionCache()
    const a = await get('/repeat', GZIP).then((r) => r.arrayBuffer()).then((b) => Bun.gunzipSync(new Uint8Array(b)))
    const html = await get('/repeat').then((r) => r.text())
    const href = /<link rel="stylesheet" href="([^"]+)">/.exec(html)?.[1] ?? ''
    const b = await get(href, GZIP).then((r) => r.arrayBuffer()).then((x) => Bun.gunzipSync(new Uint8Array(x)))
    expect(new TextDecoder().decode(a)).toContain('Repeat')
    expect(new TextDecoder().decode(b)).toContain('--c-bg')
    expect(compressionCacheSize()).toBe(2)
  })
})

describe('a 404 is compressed too', () => {
  /**
   * It is 19,650 bytes of rendered site shell and it is deliberately NOT page-cached, so a
   * crawler walking dead links paid for all of it, every time.
   */
  it('gzips the not-found page', async () => {
    const res = await get('/no-such-page-anywhere', GZIP)
    expect(res.status).toBe(404)
    expect(res.headers.get('content-encoding')).toBe('gzip')
  })
})
