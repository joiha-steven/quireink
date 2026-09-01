// Responses leave the origin compressed, and a returning reader can be answered with nothing.
//
// Nothing here ever set `content-encoding`, so every page, stylesheet and bundle went out
// raw. Then it set gzip and nothing else, on the reasoning that a CDN re-compresses anyway —
// which a live install disproved for exactly the responses it matters most on, the hashed
// immutable ones (`cf-cache-status: HIT` with the origin's own gzip passed through).
//
// And nothing carried a validator, so a warm browser cache re-fetched every page in full:
// measured at 8,179 bytes of HTML per view with every other resource already at zero.

import { describe, expect, it, afterAll } from 'bun:test'
import { brotliDecompressSync } from 'node:zlib'
import { freshDatabase, dropDatabase } from '@/test/db'
import { savePost } from '@/content/posts'
import { createApp } from '@/web/app'
import { compressionCacheSize, qualityFor, resetCompressionCache } from '@/web/compress'

const DIR = './.tmp/test-compress'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = (path: string, headers: Record<string, string> = {}): Promise<Response> =>
  Promise.resolve(app.request(path, { headers }))

const PAST = '2020-01-01T00:00:00.000Z'
/** What every current browser sends. Brotli is in it, so brotli is what comes back. */
const MODERN = { 'accept-encoding': 'gzip, deflate, br' }
/** A client that knows gzip and nothing newer. */
const OLD = { 'accept-encoding': 'gzip, deflate' }

// `Uint8Array<ArrayBuffer>`, not the bare form: the bare one widens to `ArrayBufferLike`,
// which includes `SharedArrayBuffer`, and neither `Bun.gunzipSync` nor `Bun.hash` will take
// one. Same trap the middleware itself documents.
const bytes = async (res: Response): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(await res.arrayBuffer())
const longPage = 'A paragraph of prose.\n\n'.repeat(80)
const sheetHref = async (): Promise<string> => {
  const html = await get('/long').then((r) => r.text())
  return /<link rel="stylesheet" href="([^"]+)">/.exec(html)?.[1] ?? ''
}

describe('compression', () => {
  it('sends brotli to a client that accepts it, and says what it varies on', async () => {
    await savePost({ title: 'Long', status: 'published', date: PAST, content: longPage })
    const res = await get('/long', MODERN)
    expect(res.headers.get('content-encoding')).toBe('br')
    // Without Vary a shared cache can hand the brotli body to a client that never asked.
    expect(res.headers.get('vary')).toContain('Accept-Encoding')
    // ...and it decodes back to the page. Decompressed by hand on purpose: `app.request`
    // hands back the raw body, where a browser's fetch would have done this itself. That is
    // also the proof the body really is compressed rather than merely labelled.
    expect(new TextDecoder().decode(brotliDecompressSync(await bytes(res)))).toContain('Long')
  })

  it('falls back to gzip for a client that does not know brotli', async () => {
    const res = await get('/long', OLD)
    expect(res.headers.get('content-encoding')).toBe('gzip')
    expect(new TextDecoder().decode(Bun.gunzipSync(await bytes(res)))).toContain('Long')
  })

  it('reads a q-value rather than looking for the letters', async () => {
    // `br;q=0` is how a client says it would rather not, and a substring match reads it as
    // yes. Same trap: `br` matches inside `brotli-not-a-thing` and inside `deflate`.
    const res = await get('/long', { 'accept-encoding': 'br;q=0, gzip' })
    expect(res.headers.get('content-encoding')).toBe('gzip')
  })

  it('sends plain bytes to a client that did not ask', async () => {
    await savePost({ title: 'Plain', status: 'published', date: PAST, content: longPage })
    const res = await get('/plain')
    expect(res.headers.get('content-encoding')).toBeNull()
    expect(await res.text()).toContain('Plain')
  })

  it('leaves a short body alone, where the header costs more than it saves', async () => {
    const res = await get('/robots.txt', MODERN)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-encoding')).toBeNull()
    expect((await res.text()).length).toBeLessThan(1024)
  })

  it('compresses the stylesheet, which is the biggest single asset on the site', async () => {
    const res = await get(await sheetHref(), MODERN)
    expect(res.headers.get('content-encoding')).toBe('br')
    expect(res.headers.get('content-type')).toContain('text/css')
    // Still immutable: compressing a response must not disturb what may be cached.
    expect(res.headers.get('cache-control')).toContain('immutable')
  })

  it('holds the expensive quality back from a body the size of the admin bundle', () => {
    // The ceiling exists because the tour found the absence of it. The admin's chunks are
    // hashed and immutable like the public sheets and twenty times the size, so `immutable`
    // alone put a 644 KB bundle through 642 ms of q11 on its first load, synchronously, and
    // the settings flow timed out with no search box on the screen.
    const IMMUTABLE = 'public, max-age=31536000, immutable'
    // The public sheets, which is who q11 is for: the largest is a pen sheet at 138,375 raw.
    expect(qualityFor(IMMUTABLE, 138_375)).toBe(11)
    // `main-<hash>.js`, which is not.
    expect(qualityFor(IMMUTABLE, 659_456)).toBe(5)
    // A page is a new body on every write, so it never gets q11 whatever its size.
    expect(qualityFor('public, s-maxage=60, stale-while-revalidate=600', 8_000)).toBe(5)
    expect(qualityFor(null, 8_000)).toBe(5)
  })

  it('spends the expensive quality only where the answer is kept forever', async () => {
    // The sheet is immutable, so it is compressed once for the life of the process and q11
    // is a one-off; a page is a new body on every write, so it gets q5. The observable
    // difference is the ratio: measured on this build, q11 takes the public sheet 11.2%
    // below its gzip and q5 takes an article page 7.7% below its own.
    const [sheetBr, sheetGz] = await Promise.all([
      get(await sheetHref(), MODERN).then(bytes),
      get(await sheetHref(), OLD).then(bytes),
    ])
    const [pageBr, pageGz] = await Promise.all([
      get('/long', MODERN).then(bytes),
      get('/long', OLD).then(bytes),
    ])
    const gain = (br: Uint8Array, gz: Uint8Array): number => 1 - br.byteLength / gz.byteLength
    expect(gain(sheetBr, sheetGz)).toBeGreaterThan(gain(pageBr, pageGz))
  })
})

describe('the machine surfaces are never compressed', () => {
  it('leaves an /api/ response alone however big it is', async () => {
    // The MCP connector authorised, stayed connected, and never showed a tool list:
    // `initialize` is under a kilobyte so it went out raw and the handshake worked, and
    // `tools/list` is over it so it went out gzipped and the client could not read it.
    const res = await get('/api/mcp', { ...MODERN, accept: 'application/json' })
    expect(res.headers.get('content-encoding')).toBeNull()
    // And nothing to revalidate against either: a JSON-RPC caller is not a browser cache.
    expect(res.headers.get('etag')).toBeNull()
  })
})

describe('a returning reader is answered with nothing', () => {
  it('carries a validator on a page, and honours it', async () => {
    const first = await get('/long', MODERN)
    const tag = first.headers.get('etag')
    expect(tag).toBeTruthy()
    const second = await get('/long', { ...MODERN, 'if-none-match': tag! })
    expect(second.status).toBe(304)
    expect(second.headers.get('etag')).toBe(tag)
    expect((await second.arrayBuffer()).byteLength).toBe(0)
  })

  it('gives the two encodings of one page different tags', async () => {
    // A strong ETag names ONE representation. If the brotli and the gzip of a page shared a
    // tag, a client holding one could be told the other was unchanged, and would decode a
    // brotli stream with a gzip header on it.
    const br = (await get('/long', MODERN)).headers.get('etag')
    const gz = (await get('/long', OLD)).headers.get('etag')
    expect(br).toBeTruthy()
    expect(br).not.toBe(gz)
  })

  it('sends the page when the tag is stale', async () => {
    const res = await get('/long', { ...MODERN, 'if-none-match': '"not-this-one"' })
    expect(res.status).toBe(200)
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0)
  })

  it('is stable across two fetches of one URL, which is what makes any of this work', async () => {
    // The comment form carries a signed spam challenge with a salt and a timestamp in it.
    // It is minted when the page is RENDERED, not when it is served — if that ever stops
    // being true the tag changes on every request and the 304 above never fires again.
    const a = await get('/long', MODERN)
    const b = await get('/long', MODERN)
    expect(a.headers.get('etag')).toBe(b.headers.get('etag'))
  })
})

describe('the same bytes are only compressed once', () => {
  /**
   * The page cache stores HTML strings and this middleware runs outside it, so a cache HIT
   * still paid a full compression. Measured on a warm local instance: the front page fell
   * from 5,510 to 3,325 req/s with compression on, and the immutable stylesheet from 11,216
   * to 3,652 — most of the origin's CPU spent re-deriving an answer it already had. It is
   * also the whole reason brotli q11 is affordable on the sheets.
   */
  it('serves an identical body from one compressed copy', async () => {
    resetCompressionCache()
    await savePost({ title: 'Repeat', status: 'published', date: PAST, content: longPage })
    const first = await get('/repeat', MODERN).then(bytes)
    const second = await get('/repeat', MODERN).then(bytes)
    expect(second).toEqual(first)
    // One entry, not two: the second request found the first request's bytes.
    expect(compressionCacheSize()).toBe(1)
  })

  it('keeps one entry per encoding, because they are different bytes', async () => {
    resetCompressionCache()
    await get('/repeat', MODERN)
    await get('/repeat', OLD)
    expect(compressionCacheSize()).toBe(2)
  })

  it('does not confuse two different bodies', async () => {
    resetCompressionCache()
    const a = brotliDecompressSync(await get('/repeat', MODERN).then(bytes))
    const b = brotliDecompressSync(await get(await sheetHref(), MODERN).then(bytes))
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
  it('compresses the not-found page', async () => {
    const res = await get('/no-such-page-anywhere', MODERN)
    expect(res.status).toBe(404)
    expect(res.headers.get('content-encoding')).toBe('br')
  })

  it('does not put a validator on it, because nothing will keep it to revalidate', async () => {
    const res = await get('/no-such-page-anywhere', MODERN)
    expect(res.headers.get('etag')).toBeNull()
  })
})
