// Invariant 1, in its 2.0 form.
//
// The frozen tree spread invalidation across Next's ISR page cache, a tagged Data Cache
// and `lib/revalidate.ts`, which computed a per-write superset of affected paths and was
// pinned by a test because it was easy to under-purge. Here there is one Map and every
// write empties all of it. Re-rendering a post from SQLite costs well under a
// millisecond, so a total flush is not a performance question at this scale.
//
// Do NOT reintroduce targeted invalidation. If a measurement ever shows the flush
// matters, the answer is a rollup table or a longer edge TTL, not a dependency graph.
// See docs/02-structure.md, "Caching: the biggest simplification".

import { readEnv } from '@/env'

/**
 * How much rendered HTML this process will hold, in characters of key plus body.
 *
 * `PAGE_CACHE_MB` (`env.ts`), read once. A character of an ASCII page is one byte in
 * JavaScriptCore and a page with non-latin text is two, so the environment variable names
 * the megabytes of an English blog's HTML and is an upper bound on any other.
 *
 * ⚠️ A BUDGET, NOT A PAGE COUNT, because pages are not the same size: a 2 KB note and an
 * 85,000-character essay are one entry each and two very different amounts of memory.
 *
 * MEASURED 2026-09-21 in a container, which is the only place these numbers mean anything —
 * JavaScriptCore sizes its heap to the machine, so the same corpus reads 282 MB on a 48 GB
 * laptop and 117 MB under a 128 MB limit. A blog of 1,000 posts, `--memory=128m --cpus=0.25`:
 *
 *   unbounded, as it shipped   117.6 MB of 128, and OOM-KILLED on 2 of 3 restarts
 *   the same box, cache off     44.8 MB idle, 66.3 MB after reads
 *   8 MB budget                 90.0 MB, 315 pages warmed, no kill
 *
 * The warmer renders every public post at boot and after every write (`warm.ts`), so the
 * unbounded Map held 977 pages nobody had asked for. That is the whole difference, and on the
 * small box it was the difference between running and a restart loop.
 *
 * `--smol` was measured against this and is NOT the answer: 86.8 MB against 90.0, because
 * what the cache holds is retained rather than uncollected garbage.
 *
 * WHAT IT DOES NOT CHANGE: a blog under the budget behaves exactly as it did. 100 posts of
 * this size come to 2.4 MB — the whole archive still fits, nothing is ever evicted, and the
 * only code that runs is one addition per store.
 */
let budget: number | null = null
export const budgetChars = (): number => (budget ??= readEnv().pageCacheBytes)

/** Test seam: the budget is read once, like the port, and a test changing it has to say so. */
export function rereadBudget(): void {
  budget = null
}

/**
 * Rendered public pages, keyed by request path, under a fixed budget.
 *
 * ⚠️ THE BUDGET IS THE TYPE'S, NOT THE CALLER'S. Written first as a `remember()` helper beside
 * a plain `Map`, which is the shape `guard.ts` argues against in its own header: a cache whose
 * ceiling holds because every writer remembered to go through one function has no ceiling. The
 * two writers are `web/listing-page.ts` and `server/warm.ts`; a third one day should not have
 * to know this file exists.
 *
 * EVICTION IS LEAST-RECENTLY-READ, and that part is not decoration either. Insertion order
 * alone would let a crawler walking a 900-post archive push the front page out, which is the
 * one page that is certain to be asked for again. A `Map` keeps insertion order and a
 * delete-then-set moves a key to the end, so a read costs one extra pair of operations and
 * buys the ordering for free.
 */
class PageCache {
  #pages = new Map<string, string>()
  #chars = 0

  /** Entries held. Named `size` so this reads as the Map it replaced. */
  get size(): number {
    return this.#pages.size
  }

  /** Characters held, key and body. What the budget is spent against. */
  get chars(): number {
    return this.#chars
  }

  /**
   * Store this page only if it fits, and say whether it did. What the WARMER uses.
   *
   * ⚠️ A WARM MUST NEVER EVICT, and that rule is the whole difference between this and `set`.
   * Two wrong versions came before it, both of which read perfectly:
   *
   *   `#chars >= budgetChars()` as a "full" test — `set` always evicts back to at or under the
   *   budget, so the count is essentially never over it, the warm never stops, and all 977
   *   pages render exactly as before. Every measurement in this file would still be true of it.
   *
   *   `set` for the whole warm, stopping once something had been evicted — the warm renders in
   *   PRIORITY order, `/` first, so the first thing an over-budget archive threw away was the
   *   home page. The one page certain to be asked for again, evicted by the warm meant to have
   *   it ready. Caught by the test asserting `/` is still there, not by reading this.
   *
   * Both are why the offer exists: rendered pages go in in priority order and nothing already
   * paid for is thrown away to make room for something further down the list. A reader's own
   * request still uses `set`, where evicting IS the right answer — that page was asked for.
   *
   * A single body larger than the whole budget is refused rather than stored, and ends the
   * warm there. It is 8 million characters; the largest post this project has measured is
   * 85,000. A reader who asks for it still gets it cached, through `set`.
   */
  offer(key: string, html: string): boolean {
    const previous = this.#pages.get(key)
    const cost = key.length + html.length - (previous === undefined ? 0 : key.length + previous.length)
    if (this.#chars + cost > budgetChars()) return false
    this.set(key, html)
    return true
  }

  has(key: string): boolean {
    return this.#pages.has(key)
  }

  get(key: string): string | undefined {
    const html = this.#pages.get(key)
    // Untouched on a miss: `delete` on an absent key is a no-op, but re-inserting `undefined`
    // would put a key in the Map that has no page behind it.
    if (html !== undefined) {
      this.#pages.delete(key)
      this.#pages.set(key, html)
    }
    return html
  }

  set(key: string, html: string): void {
    // `PAGE_CACHE_MB=0` is NO CACHE, which is the plain reading of a cache size and not the
    // reading its two neighbours in `env.ts` have (`0` there is "no limit"). A cache with no
    // room is not a cache with an infinite one, and an operator on a box with nothing to spare
    // has to be able to say so. Refused here rather than at the two call sites, so it holds
    // for whatever the third one turns out to be.
    if (budgetChars() === 0) return
    // An overwrite refunds what the old body cost. Without this the count would only ever
    // rise, and a site that re-warms the same 100 paths would evict itself down to nothing.
    const previous = this.#pages.get(key)
    if (previous !== undefined) this.#chars -= key.length + previous.length
    this.#pages.set(key, html)
    this.#chars += key.length + html.length
    // Oldest read first, and never the page just stored: a body bigger than the whole budget
    // would otherwise evict itself and leave the cache empty at every attempt.
    for (const oldest of this.#pages.keys()) {
      if (this.#chars <= budgetChars() || oldest === key) break
      this.#chars -= oldest.length + this.#pages.get(oldest)!.length
      this.#pages.delete(oldest)
    }
  }

  clear(): void {
    this.#pages.clear()
    this.#chars = 0
  }
}

export const pageCache = new PageCache()

/**
 * What runs after a flush: re-filling the cache and purging the CDN.
 *
 * A list rather than a direct call, because `cache.ts` is imported by everything that
 * writes — including every test — and the warmer imports the whole renderer. Registering
 * the hook from the server entry point is what keeps a test suite from rendering the
 * archive on each of its several hundred flushes.
 */
type FlushHook = () => void
const hooks: FlushHook[] = []
export function onFlush(hook: FlushHook): void {
  hooks.push(hook)
}

/**
 * Hit and miss, since this process started.
 *
 * In memory and not in a table, deliberately. Persisting them would mean a WRITE on the
 * read path, on the one path this whole file exists to keep cheap, for a number nobody
 * reads more than once a week. They reset on restart and the admin says since when, which
 * is the honest shape for a counter that costs nothing.
 *
 * ⚠️ What this measures is the IN-PROCESS cache, and only for requests that reached this
 * process at all. With a CDN in front, most readers are answered at the edge and never
 * appear here: a blog can show a low hit rate and still be serving almost everything from
 * cache. The edge's own rate is not visible from inside the origin, and the admin label
 * has to keep saying so.
 */
export const cacheStats = { hits: 0, misses: 0, since: Date.now() }

export function countCacheHit(): void {
  cacheStats.hits += 1
}

export function countCacheMiss(): void {
  cacheStats.misses += 1
}

/** Test seam: the counters are process-global, like the Map above. */
export function resetCacheStats(): void {
  cacheStats.hits = 0
  cacheStats.misses = 0
  cacheStats.since = Date.now()
}

/** Called after EVERY write, unconditionally. No arguments, so it cannot be narrowed. */
export function clearCache(): void {
  pageCache.clear()
  // A hook that throws must not turn a successful save into a 500. It is a cache.
  for (const hook of hooks) {
    try {
      hook()
    } catch (error) {
      console.error(`[ERROR] cache.clearCache hook: ${(error as Error).message}`)
    }
  }
}
