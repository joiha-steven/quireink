// The service worker: what a reader has already read, kept for when the network is gone.
//
// ADR 0039. It is off unless the owner turned it on, and everything in here follows from
// one rule: **nothing is fetched that the reader did not ask for.** A page is in the cache
// because it was read. There is no prefetch, no crawl, no warm-up.
//
// The two strategies are chosen by what CAN go stale:
//
//   * HTML is NETWORK-FIRST. Online, the reader always gets what the server just rendered.
//     The cached copy answers only when the network does not. This is the failure this
//     feature could most easily cause — a reader shown yesterday's post with no way to
//     know — and it is designed out rather than mitigated.
//   * `/assets/<hash>.js|css` and `/fonts/*` are CACHE-FIRST, because those URLs are
//     immutable by construction: a deploy changes the bytes, which changes the hash, which
//     changes the URL. A stale answer is not reachable through them.
//
// Neither may be swapped for the other without going back to the ADR.
//
// Untouched, always: `/admin`, `/api`, `/preview`, anything that is not a GET, and anything
// on another origin. Nothing the owner does passes through here, so nothing private is left
// behind on a shared machine.
//
// **The speculation-rules prefetch does not land here**, and that was measured rather than
// assumed: this site prefetches every safe link at `eager` (see `web/speculation.ts`), so if
// those requests reached this handler a single listing would fill the page cache with links
// nobody opened. Measured 2026-08-30 on a top-level page with 133 links and the worker in
// control: six seconds after load, zero entries. That is Chromium's behaviour today and not
// a promise in a spec — if a listing is ever seen filling the cache by itself, the fix is a
// `sec-purpose: prefetch` guard in the handler below.

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope

/**
 * The cache name carries the build, which the registering page puts in the query string.
 *
 * Two caches, not one, because they are emptied on different occasions: pages turn over as
 * the reader reads, assets turn over on a deploy. `activate` deletes every cache whose name
 * does not start with the current build, which is what makes a deploy a clean sweep rather
 * than an accumulation.
 */
const BUILD = new URL(self.location.href).searchParams.get('v') ?? 'dev'
const PAGES = `quire-pages-${BUILD}`
const ASSETS = `quire-assets-${BUILD}`

/**
 * How many read pages to keep.
 *
 * A count, not a byte budget: `Cache.put` gives no size back without reading the body, and
 * a worker that measures every response to enforce a megabyte figure spends more than the
 * figure saves. Forty articles is a long commute's worth and a few megabytes of text.
 */
const KEEP_PAGES = 40

/** Paths this worker must never see, whatever the request is for. */
const OFF_LIMITS = /^\/(admin|api|preview|og|setup|login)(\/|$)/

/** Immutable by construction: the URL changes when the bytes do. */
const IMMUTABLE = /^\/(assets\/[^/]+\.(js|css)|fonts\/[^/]+)$/

const isHtml = (request: Request) =>
  request.mode === 'navigate'
  || (request.headers.get('accept') ?? '').includes('text/html')

/**
 * Drop the oldest entries once a cache is over its count.
 *
 * `cache.keys()` returns insertion order, so the front of the list is the least recently
 * ADDED — not the least recently used. Tracking real recency would need a second store
 * written on every read, and the difference between the two only shows up for a reader who
 * has read more than forty articles and returns to one of the earliest. That reader is
 * online often enough to have the network.
 */
async function trim(name: string, keep: number): Promise<void> {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  for (const request of keys.slice(0, Math.max(0, keys.length - keep))) {
    await cache.delete(request)
  }
}

/**
 * A page: the network, and the cache as the fallback.
 *
 * Only a 200 from our own origin is stored. A 404 or a 500 kept here would be served back
 * offline as though it were the page, and a redirect (`response.redirected`) cannot be put
 * in a cache at all — `Cache.put` rejects it, and an unhandled rejection in a `fetch`
 * handler is a failed navigation.
 */
async function page(request: Request): Promise<Response> {
  try {
    const fresh = await fetch(request)
    if (fresh.ok && fresh.status === 200 && !fresh.redirected) {
      const copy = fresh.clone()
      const cache = await caches.open(PAGES)
      await cache.put(request, copy)
      await trim(PAGES, KEEP_PAGES)
    }
    return fresh
  } catch (error) {
    const hit = await caches.match(request, { cacheName: PAGES })
    if (hit) return hit
    throw error
  }
}

/** An immutable asset: the cache, and the network the first time only. */
async function asset(request: Request): Promise<Response> {
  const hit = await caches.match(request, { cacheName: ASSETS })
  if (hit) return hit
  const fresh = await fetch(request)
  if (fresh.ok && fresh.status === 200) {
    const cache = await caches.open(ASSETS)
    await cache.put(request, fresh.clone())
  }
  return fresh
}

self.addEventListener('install', () => {
  // Nothing is precached, so there is nothing to wait for. Taking over immediately is safe
  // BECAUSE of the two strategies above: HTML is network-first, and asset URLs are
  // immutable, so a page rendered by the old build cannot be handed the new build's files.
  void self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('quire-') && name !== PAGES && name !== ASSETS) await caches.delete(name)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (OFF_LIMITS.test(url.pathname)) return
  // A query string on a page means a search, a filter, or a campaign tag: one URL per
  // query, and none of them worth a slot in a forty-page cache.
  if (isHtml(request) && !url.search) { event.respondWith(page(request)); return }
  if (IMMUTABLE.test(url.pathname)) event.respondWith(asset(request))
})
