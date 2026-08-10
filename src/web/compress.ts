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
// GZIP ONLY, and that is a measurement rather than an omission. Brotli at quality 4 costs
// about the same CPU and saves 2.9% on an article page (7.0 KB → 6.8 KB) and 1.4% on the
// admin stylesheet; the qualities that actually compress better cost several times the CPU,
// for bytes the CDN re-compresses anyway. Not worth a second code path.

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
 * Gzipped bodies, keyed by the bytes they were made from.
 *
 * The middleware sees anonymous bodies, so this is content-addressed rather than keyed by
 * path: same bytes in, same bytes out, and there is nothing to invalidate when a write
 * empties the page cache. That property is the reason it is safe to have at all.
 *
 * WHY IT EXISTS: a page cache hit still went through a full gzip, because the cache stores
 * HTML strings and this runs outside it. Measured against a warm local instance — the front
 * page fell from 5,510 to 3,325 req/s with compression on, and `/assets/site.<hash>.css`,
 * which is immutable and never changes for the life of a build, from 11,216 to 3,652. The
 * origin was spending most of its CPU re-deriving an answer it already had.
 *
 * `Bun.hash` is wyhash and costs 0.006 ms on a 31 KB page against 0.090 ms to gzip it, and
 * 0.009 ms against 0.297 ms on the 68 KB admin sheet — 16× and 33×. The byte LENGTH is part
 * of the key as well as the hash, so two different bodies have to collide in both to be
 * confused, and neither is reachable from a request.
 */
const gzipped = new Map<string, Uint8Array>()

/**
 * Blunt, like the page cache and for the same reason: a site serves a bounded number of
 * distinct bodies, this only ever holds compressed copies, and throwing all of it away costs
 * one gzip per page. Getting an eviction policy exactly right is not worth being wrong about.
 */
const MAX_ENTRIES = 512

function compress(body: Uint8Array): Uint8Array {
  const key = `${body.byteLength}:${Bun.hash(body)}`
  const hit = gzipped.get(key)
  if (hit) return hit
  const gz = Bun.gzipSync(body)
  if (gzipped.size >= MAX_ENTRIES) gzipped.clear()
  gzipped.set(key, gz)
  return gz
}

/** Test seam: the map is process-global, so a size assertion needs a known starting point. */
export function resetCompressionCache(): void {
  gzipped.clear()
}

/** Test seam: how many distinct bodies have been compressed since the last reset. */
export function compressionCacheSize(): number {
  return gzipped.size
}

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
    if (!(c.req.header('accept-encoding') ?? '').includes('gzip')) return

    const body = new Uint8Array(await res.arrayBuffer())
    if (body.byteLength < MIN_BYTES) {
      // The body has been consumed, so it has to be handed back whatever the decision.
      c.res = new Response(body, { status: res.status, headers: res.headers })
      return
    }
    const headers = new Headers(res.headers)
    headers.set('content-encoding', 'gzip')
    headers.delete('content-length') // it is now wrong, and Bun sets the right one
    // Without this a shared cache can hand the gzipped body to a client that never asked
    // for it. `accept-encoding` is the header the answer varies on, so it is the one named.
    const vary = headers.get('vary')
    if (!vary) headers.set('vary', 'Accept-Encoding')
    else if (!/accept-encoding/i.test(vary)) headers.set('vary', `${vary}, Accept-Encoding`)
    c.res = new Response(compress(body), { status: res.status, headers })
  }
}
