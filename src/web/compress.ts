// Compressing text responses.
//
// `Bun.serve` sends what the handler returns, byte for byte, and nothing here ever set
// `content-encoding` — so every page, stylesheet, bundle and feed left the origin
// uncompressed. Measured: the public stylesheet is 45,269 bytes on the wire and 14,207
// gzipped, and an article page is around 25 KB of HTML that compresses to roughly a fifth.
//
// The CDN re-compresses on its way to the reader, so this is not what a reader downloads;
// it is the origin-to-edge hop, which is a transatlantic fetch on every cache miss and on
// every one of the purges this release just started issuing. It is also what a reader gets
// if the CDN is ever bypassed or removed.
//
// Only text, only when it is worth it, and only when the client asked. An image, a font or
// a WebP variant is already compressed and running gzip over it spends CPU to add bytes.
//
// BROTLI FIRST, gzip behind it. This file used to say gzip only, on two grounds that were
// re-measured on 2026-09-01 and did not survive.
//
// The first was that brotli saves 2.9% on an article page. That is true at quality 4, which
// is the worst rung on the whole ladder: q4 saves 1.4% on this build's article page, q5
// saves 7.7% and is FASTER (0.5 ms against 0.7), and q11 saves 17.6%. The three immutable
// sheets are where it stops being a rounding error, because they are SVG data-URIs by the
// hundred and brotli has a window wide enough to see the repetition: pen-marks.css goes
// 11,838 → 5,928 bytes (-50%) and pen-lines.css 8,664 → 5,368 (-38%). Over one cold visit to
// a post carrying the pen, the six text responses fall from 49,960 bytes to 36,717 (-27%).
//
// The second was that the CDN re-compresses anyway, so the reader never sees the difference.
// Half true, and the wrong half. Measured against a live install behind Cloudflare: the HTML
// came back `content-encoding: zstd`, so that hop is indeed re-done — but
// `/assets/site.<hash>.css` came back `cf-cache-status: HIT, content-encoding: gzip,
// content-length: 10907`, byte for byte the origin's own gzip, passed straight through. The
// immutable assets are exactly the ones every first-time reader downloads, and they were
// keeping the worse encoding. An install with no CDN in front of it kept the worse encoding
// for everything.
//
// The CPU objection is answered by the cache below rather than by choosing a weak quality:
// a body is compressed once per encoding and served from the map forever after, so q11 on a
// sheet that never changes is paid once in the life of the process. Only the qualities that
// would be paid per DISTINCT body are held down, which is why HTML gets q5.
//
// zstd is deliberately not offered. Measured on the same six responses it saves 18% against
// brotli's 27%, and Safari does not send it at all.

import { brotliCompress, brotliCompressSync, constants as zlib } from 'node:zlib'
import { promisify } from 'node:util'
import type { MiddlewareHandler } from 'hono'

/**
 * Below this, the gzip header and trailer cost more than the saving on typical prose.
 * Chosen to match what nginx and Cloudflare use as their own floor.
 */
const MIN_BYTES = 1024

/** Compressible by type. A binary body is left alone whatever its size. */
const TEXTUAL = /^(?:text\/|application\/(?:json|xml|javascript|manifest\+json|rss\+xml|atom\+xml)|image\/svg)/

/**
 * Statuses worth compressing.
 *
 * 404 is in here because it is 19,650 bytes of rendered site shell and it is NOT page-cached
 * (one entry per URL a crawler invents is not a cache), so a bot walking dead links paid for
 * the whole thing uncompressed, every time.
 *
 * 206 is deliberately NOT: a range response describes a byte range of the ORIGINAL, and
 * compressing the slice makes `content-range` a lie. 304 has no body to compress.
 */
const COMPRESSIBLE_STATUS = new Set([200, 404])

/**
 * The encodings offered, best first. A client that names neither gets the body raw.
 */
type Encoding = 'br' | 'gzip'
const OFFERED: readonly Encoding[] = ['br', 'gzip']

/**
 * Brotli quality, decided per response rather than once for the process.
 *
 * `immutable` is the signal, and it is available here because the asset routes set their own
 * `cache-control` inside the handler, while `cacheHeaders` fills in everything else AFTER
 * this middleware has run. So a response that says immutable really is one of the hashed
 * artefacts: compressed on its first request and served from the map for the life of the
 * process, which makes the 41–94 ms of q11 a one-off rather than a per-request bill.
 *
 * Everything else is a page, and a page is one distinct body per URL per write, so its
 * compression is paid again every time the archive turns over. q5 is the rung that pays for
 * itself there: 7.7% better than gzip on an article page and measured FASTER than q4.
 */
const QUALITY_IMMUTABLE = 11
const QUALITY_PAGE = 5

/**
 * ...but only up to here, and this ceiling was found by the tour rather than by reasoning.
 *
 * `immutable` was the whole test at first, which was right about the public sheets and wrong
 * about what else wears the label: the admin's own chunks are hashed and immutable too, and
 * they are twenty times the size. `main-<hash>.js` is 644 KB and takes **642 ms** at q11
 * against 11 ms at q5; `admin.css` is 375 KB and takes 279 ms. Compression was synchronous
 * at that point, so the first load of the admin stalled the whole process for over a second
 * and the tour's settings flow timed out with no search box on the screen — a reader asking
 * for a page in that window would have waited exactly as long.
 *
 * Two things came out of it. Compression moved off the event loop (below), which removes the
 * stall. And q11 stopped applying to bodies this large, which is a judgement about who pays:
 * q11 buys 12.5% over q5 on that bundle and 14.2% on the admin sheet, and it costs most of a
 * CPU second on a machine that may only have one — for an artefact one person downloads once,
 * on the surface this codebase has already ruled is never on the reader's critical path.
 *
 * 192 KB sits above every public asset (the largest is a pen sheet at 138,375 bytes raw) and
 * below every admin chunk that matters. It is a gap, not a knife-edge.
 */
const QUALITY_CEILING = 192 * 1024

/**
 * Compressed bodies, keyed by the bytes they were made from AND the encoding they were made
 * into. Content-addressed rather than keyed by path: same bytes in, same bytes out, and
 * there is nothing to invalidate when a write empties the page cache. That property is the
 * reason it is safe to have at all.
 *
 * WHY IT EXISTS: a page cache hit still went through a full compression, because the cache
 * stores HTML strings and this runs outside it. Measured against a warm local instance — the
 * front page fell from 5,510 to 3,325 req/s with compression on, and
 * `/assets/site.<hash>.css`, which is immutable and never changes for the life of a build,
 * from 11,216 to 3,652. The origin was spending most of its CPU re-deriving an answer it
 * already had. It is also what makes brotli q11 affordable at all.
 *
 * `Bun.hash` is wyhash and costs 0.006 ms on a 31 KB page against 0.090 ms to gzip it, and
 * 0.009 ms against 0.297 ms on the 68 KB admin sheet — 16× and 33×. The byte LENGTH is part
 * of the key as well as the hash, so two different bodies have to collide in both to be
 * confused, and neither is reachable from a request.
 */
const compressed = new Map<string, Promise<Uint8Array>>()

/**
 * Blunt, like the page cache and for the same reason: a site serves a bounded number of
 * distinct bodies, this only ever holds compressed copies, and throwing all of it away costs
 * one compression per page. Getting an eviction policy exactly right is not worth being
 * wrong about.
 *
 * Doubled when brotli arrived, because one body now occupies one slot PER ENCODING and a
 * site whose readers are split between browsers would otherwise have held half as many
 * distinct pages as before.
 */
const MAX_ENTRIES = 1024

/**
 * Which brotli quality a response gets. Exported because it is the whole policy in one line
 * and the alternative is a test that reaches for a 644 KB fixture to observe it indirectly.
 */
export const qualityFor = (cacheControl: string | null, byteLength: number): number =>
  (cacheControl ?? '').includes('immutable') && byteLength <= QUALITY_CEILING
    ? QUALITY_IMMUTABLE
    : QUALITY_PAGE

/**
 * The key a body is stored under. Encoding and quality are both in it because both change
 * the bytes.
 *
 * The hash is passed IN rather than taken here, because the validator below needs the same
 * number and hashing a 31 KB page twice per request is measurable: doing it once took the
 * article path from 5,318 back to 6,410 req/s.
 */
const keyOf = (hash: bigint, byteLength: number, enc: Encoding, quality: number): string =>
  `${enc}${quality}:${byteLength}:${hash}`

/**
 * Off the event loop, always.
 *
 * `brotliCompressSync` on the 644 KB admin bundle blocks for 642 ms, and this process serves
 * every reader from one thread: measured with a 10 ms interval running alongside, the sync
 * call let 1 tick through and the async call let 59 through over the same 643 ms. The work
 * costs the same either way; only one of them costs it to everybody else as well.
 */
const brotli = promisify(brotliCompress)

/**
 * The PROMISE is what goes in the map, not the bytes.
 *
 * With a synchronous compressor there was no window for two requests to want the same
 * uncompressed body at once. There is now, and it is widest exactly where it hurts: the first
 * two hits on a large asset would each have started their own 600 ms compression. Storing the
 * promise makes the second one wait for the first instead of repeating it.
 */
// `Uint8Array<ArrayBuffer>` rather than a bare `Uint8Array`: the bare form widens to
// `ArrayBufferLike`, which includes `SharedArrayBuffer`, and `Bun.hash` will not take one.
function compress(
  body: Uint8Array<ArrayBuffer>,
  hash: bigint,
  enc: Encoding,
  quality: number,
): Promise<Uint8Array> {
  const key = keyOf(hash, body.byteLength, enc, quality)
  const hit = compressed.get(key)
  if (hit) return hit
  // SIZE_HINT is free and lets brotli pick its window instead of guessing from the first
  // block; without it a 133 KB sheet is compressed as though it might be arbitrarily long.
  const params = {
    [zlib.BROTLI_PARAM_QUALITY]: quality,
    [zlib.BROTLI_PARAM_SIZE_HINT]: body.byteLength,
  }
  // Only the expensive rung goes to the threadpool, and that is a memory decision as much as
  // a latency one: a worker that has run a brotli job keeps its allocator arena afterwards.
  // Measured on one warm instance, same request sequence, physical footprint after 2,000
  // requests — gzip only 119 MB, every brotli through the pool 179 MB, only q11 through it
  // **151 MB**. q5 costs 0.5 ms on an article page, which is not worth a thread and not worth
  // 28 MB. What the pool is still needed for is the case that started this: q11 on a body at
  // the ceiling blocks for ~94 ms, and nothing else can be served while it does.
  const made = enc !== 'br'
    ? Promise.resolve(Bun.gzipSync(body))
    : quality >= QUALITY_IMMUTABLE
      ? brotli(body, { params }).then((out) => new Uint8Array(out))
      : Promise.resolve(new Uint8Array(brotliCompressSync(body, { params })))
  // A failed compression must not be remembered as the answer for that body forever.
  made.catch(() => compressed.delete(key))
  if (compressed.size >= MAX_ENTRIES) compressed.clear()
  compressed.set(key, made)
  return made
}

/** Test seam: the map is process-global, so a size assertion needs a known starting point. */
export function resetCompressionCache(): void {
  compressed.clear()
}

/** Test seam: how many distinct bodies have been compressed since the last reset. */
export function compressionCacheSize(): number {
  return compressed.size
}

/**
 * The best offered encoding this client will actually accept.
 *
 * Parsed rather than substring-matched, because `br;q=0` is how a client says it would
 * rather not, and `includes('br')` reads that as yes. It also matches inside `deflate` and
 * inside a future token nobody has thought of yet.
 */
function negotiate(header: string): Encoding | null {
  const asked = new Map<string, number>()
  for (const part of header.split(',')) {
    const [name, ...params] = part.trim().split(';')
    const q = params.map((x) => x.trim()).find((x) => x.startsWith('q='))
    asked.set(name!.trim().toLowerCase(), q ? Number(q.slice(2)) : 1)
  }
  const star = asked.get('*')
  for (const enc of OFFERED) {
    const q = asked.get(enc) ?? star
    if (q !== undefined && q > 0) return enc
  }
  return null
}

/**
 * The validator for a body, and the whole reason a returning reader can be answered with
 * nothing at all.
 *
 * Measured on a warm browser cache: every stylesheet, script and font came back from disk at
 * zero bytes and the HTML was fetched again in full, 8,179 bytes of it, because no response
 * carried anything to revalidate against. `cache-control` on a page is
 * `s-maxage=60, stale-while-revalidate=600` — instructions for a shared cache, with no
 * freshness for the browser — so the browser asks every time, and without a validator every
 * ask is a whole page.
 *
 * Derived from the UNCOMPRESSED bytes and then labelled with the encoding, because a strong
 * ETag names one representation: the gzip and the brotli of the same page are different
 * byte streams and must not be able to answer each other's conditional request.
 *
 * That the pages are byte-stable is what makes this work at all, and it is not obvious: the
 * comment form carries a signed spam challenge with a salt and a timestamp in it. It is
 * minted when the page is RENDERED, not when it is served, so two fetches of one URL from
 * one process are identical — verified on the four public shapes (front page, post, a post
 * with galleries, the feed). A write re-renders and mints a new salt, which changes the tag,
 * which is correct: the body did change.
 */
const etagOf = (hash: bigint, byteLength: number, enc: Encoding | 'identity'): string =>
  `"${byteLength.toString(36)}-${hash.toString(36)}-${enc}"`

/** `If-None-Match` is a list, and `*` matches anything the server has. */
const matches = (header: string | undefined, tag: string): boolean =>
  header !== undefined
  && header.split(',').some((x) => { const v = x.trim(); return v === '*' || v === tag })

export function compression(): MiddlewareHandler {
  return async (c, next) => {
    await next()
    const res = c.res
    if (!COMPRESSIBLE_STATUS.has(res.status) || res.headers.has('content-encoding')) return
    // NEVER an API response. This is for documents a browser fetches, and `/api/` is where
    // the machine surfaces live — the MCP JSON-RPC transport above all, whose client reads
    // the body itself rather than letting a browser stack decode it. Symptom when this rule
    // was missing: the connector authorised fine and stayed connected, because `initialize`
    // is under a kilobyte and went out uncompressed, and then the tool list never arrived,
    // because `tools/list` is over it and did not. They are small payloads read by one
    // caller; there is nothing here worth the risk.
    if (c.req.path.startsWith('/api/')) return
    if (!TEXTUAL.test(res.headers.get('content-type') ?? '')) return

    const body = new Uint8Array(await res.arrayBuffer())
    // Under the floor the header and trailer cost more than the saving, so the body goes out
    // as it came — but it still earns a validator, since a small page is re-fetched exactly
    // as often as a large one.
    const enc = body.byteLength < MIN_BYTES ? null : negotiate(c.req.header('accept-encoding') ?? '')
    const headers = new Headers(res.headers)
    // Once, for both the validator and the cache key. wyhash is 0.006 ms on a 31 KB page,
    // which is cheap and was still worth 1,100 req/s when it was being paid twice.
    const hash = Bun.hash(body) as bigint

    // A validator only on 200. The other compressible status is 404, which `cacheHeaders`
    // is about to mark `private, no-store`: nothing will keep it, so nothing will ever
    // revalidate it, and the header would be weight with no reader.
    if (res.status === 200 && !headers.has('etag')) {
      const tag = etagOf(hash, body.byteLength, enc ?? 'identity')
      headers.set('etag', tag)
      if (matches(c.req.header('if-none-match'), tag)) {
        // No body, and `content-length` would describe the one that is not being sent.
        headers.delete('content-length')
        c.res = new Response(null, { status: 304, headers })
        return
      }
    }

    if (enc === null) {
      // The body has been consumed, so it has to be handed back whatever the decision.
      c.res = new Response(body, { status: res.status, headers })
      return
    }

    headers.set('content-encoding', enc)
    headers.delete('content-length') // it is now wrong, and Bun sets the right one
    // Without this a shared cache can hand the brotli body to a client that never asked
    // for it. `accept-encoding` is the header the answer varies on, so it is the one named.
    const vary = headers.get('vary')
    if (!vary) headers.set('vary', 'Accept-Encoding')
    else if (!/accept-encoding/i.test(vary)) headers.set('vary', `${vary}, Accept-Encoding`)

    c.res = new Response(
      await compress(body, hash, enc, qualityFor(headers.get('cache-control'), body.byteLength)),
      { status: res.status, headers },
    )
  }
}
