// Re-filling the page cache after it is emptied.
//
// `clearCache()` throws away every rendered page on ANY write (Invariant 1), and the next
// reader pays the re-render. That was fine when a render was assumed to cost a fraction of
// a millisecond. Measured on the live box it is not: an 85,000-character post takes 360ms,
// almost all of it inside `marked.parse`. The body cache in `render-cache.ts` is the real
// fix and takes that to a lookup; this is what stops even the cheap re-render landing on a
// reader rather than on an idle process.
//
// It is also what the owner asked for in as many words: edit or change a setting, and the
// site should clear AND re-fill, not clear and wait to be asked.
//
// Deliberately NOT registered by default. `enableBackgroundCache()` is called once by the
// server entry point, so importing anything here from a test or a script does nothing: a
// suite that calls `clearCache()` a few hundred times must not render the whole archive a
// few hundred times, and a CLI must not leave a timer holding the process open.

import { getPublicPosts } from '@/content/posts'
import { getPublicPages } from '@/content/pages'
import { getSettings } from '@/content/settings'
import { isPublicallyVisible } from '@/utils'
import { pageCache, onFlush } from '@/server/cache'
import { renderArticle } from '@/web/article'
import { renderHome } from '@/web/home-mode'
import { purgeEdge } from '@/server/edge-cache'

/** Wait this long after the LAST write before warming: a bulk import is one burst. */
const DEBOUNCE_MS = 3_000

/**
 * The shortest gap between two purges fired by the LEADING edge of a burst.
 *
 * Cloudflare rate-limits purge-everything, and a bulk import is a thousand writes. The
 * trailing purge below is deliberately NOT held by this: the last write of a burst must reach
 * the edge whatever the clock says, which is the whole point of the re-entrant tail.
 */
const PURGE_GAP_MS = 3_000
let lastPurgeAt = 0

let pending: ReturnType<typeof setTimeout> | null = null
let running = false
/**
 * A write landed while a warm was already in flight, so the whole thing has to run again.
 *
 * WITHOUT THIS THE SAVE IS SIMPLY LOST. The guard used to be `if (running) return`, which
 * reads like a harmless de-duplication and is not one: a warm walks every public post and
 * measured 8.4s on a 77-post site, and the editor saves far more often than that. Any save
 * landing inside that window never reached `purgeEdge`, so the CDN went on serving the
 * previous version of the page — measured at `Age: 824` against an `s-maxage` of 60, because
 * a shared cache that is never told to drop something keeps it well past the window the
 * headers ask for. The owner's report was "saving a post does not clear the cache", and this
 * was it: it cleared the in-process cache every time and skipped the edge some of the time.
 */
let again = false

/**
 * Render every public article back into the page cache, plus `/`.
 *
 * Articles and the homepage. A taxonomy listing re-renders in about 6ms because it never
 * touches a body, and warming 200 of them to save 6ms each would cost more than it saves.
 *
 * `/` is the exception, and it was CLAIMED here long before it was true: this comment said
 * the home page was included and the loop below only ever walked posts and pages, so the
 * first reader after every single write paid for it. It also matters more than 6ms now that
 * `/` may be a page with a body to render (ADR 0014).
 */
export async function warmCache(): Promise<{ warmed: number; ms: number }> {
  const t0 = performance.now()
  // Nothing to fill when the owner has switched the cache off, and filling it anyway would
  // leave a full set of pages waiting to be served the moment it comes back on.
  if (!(await getSettings()).cache.enabled) return { warmed: 0, ms: 0 }
  const posts = (await getPublicPosts()).filter((p) => isPublicallyVisible(p.status, p.date))
  const pages = (await getPublicPages()).filter((p) => p.status === 'published')
  let warmed = 0
  const homeHtml = await renderHome()
  if (homeHtml !== null) {
    pageCache.set('/', homeHtml)
    warmed += 1
  }
  for (const { slug } of [...posts, ...pages]) {
    // One at a time, on purpose. The point is to use the idle time BETWEEN requests, and a
    // Promise.all over seventy 360ms renders would block the loop for the whole burst.
    const html = await renderArticle(slug)
    if (html !== null) {
      pageCache.set(`/${slug}`, html)
      warmed += 1
    }
  }
  return { warmed, ms: Math.round(performance.now() - t0) }
}

/**
 * Drop the reader's copy NOW, without waiting for the warm.
 *
 * THE BUG THIS EXISTS FOR, measured on the live site 2026-08-21 from the owner's own publish:
 *
 *     14:44:00  PUT /api/posts/…              the post is published
 *     14:44:03  (debounce elapses)            the warm starts
 *     14:44:09  cache: warmed 79 pages        6.5 seconds of rendering
 *     14:44:09  edge-cache: purged            <- only now do readers stop seeing the old page
 *
 * Nine seconds, and the number grows with the archive: the purge was queued behind a warm of
 * every public page. The owner refreshed the home page inside that window, did not see his
 * post, and pressed "Clear cache" — which purges in 183ms, because that route calls
 * `purgeEdge()` directly. The manual button was fast and the automatic path was not, which is
 * exactly what "the cache is broken" feels like from the outside.
 *
 * The two jobs were never the same job. The warm is for ORIGIN LATENCY: it stops the next
 * reader paying for a re-render, and it can take as long as it likes. The purge is for
 * CORRECTNESS: until it runs, every reader behind the CDN is served a page that is wrong.
 * Making the second wait for the first traded the thing that matters for the thing that does
 * not.
 *
 * So the purge now fires on the LEADING edge of a burst, ~50ms after the write, and the
 * trailing one after the warm stays exactly as it was. A publish reaches readers immediately;
 * an import still purges at most twice.
 */
/**
 * @param now Injected so the gap can be tested without a three-second sleep, and without a
 * reset function that exists only for tests. Callers pass nothing.
 */
export async function purgeAfterWrite(now: number = Date.now()): Promise<'purged' | 'held'> {
  if (now - lastPurgeAt < PURGE_GAP_MS) return 'held'
  lastPurgeAt = now
  await purgeEdge()
  return 'purged'
}

/**
 * Warm, then purge the edge — in that order, so the CDN refetches into a warm origin.
 *
 * Re-entrant by TAIL, not by overlap: a second pass is remembered and run after this one
 * finishes, rather than started beside it. Two warms at once would race each other into the
 * same Map and double the render load for one useful result; dropping the second, which is
 * what this used to do, loses the write. Looping once at the end is the only version that
 * both serialises the work and guarantees the last write reaches the CDN.
 */
export async function warmThenPurge(reason: string): Promise<void> {
  if (running) {
    again = true
    return
  }
  running = true
  try {
    do {
      // Cleared BEFORE the work, so a write arriving mid-pass sets it again and earns
      // another lap. Clearing it after would swallow exactly that write.
      again = false
      const { warmed, ms } = await warmCache()
      console.log(`cache: warmed ${warmed} page(s) in ${ms}ms (${reason})`)
      // Unconditional. `purgeAfterWrite`'s gap does not apply here: this is the purge that
      // carries the LAST write of a burst, and skipping it is the 2026-08-19 data-staleness
      // bug the `again` flag above exists to prevent.
      lastPurgeAt = Date.now()
      await purgeEdge()
    } while (again)
  } catch (error) {
    console.error(`[ERROR] warm.warmThenPurge: ${(error as Error).message}`)
  } finally {
    running = false
    again = false
  }
}

/**
 * Start listening for flushes. Called once, from the server entry point.
 *
 * The debounce is what makes this safe to hang off a hook that fires on every write: an
 * import that saves 200 posts calls `clearCache()` 200 times and gets one warm.
 */
export function enableBackgroundCache(): void {
  onFlush(() => {
    // First, and not awaited: the reader's copy is wrong from this instant and the warm has
    // nothing to do with that. See `purgeAfterWrite`.
    void purgeAfterWrite()
    if (pending) clearTimeout(pending)
    pending = setTimeout(() => {
      pending = null
      void warmThenPurge('after a write')
    }, DEBOUNCE_MS)
    // The timer must not be the reason the process stays alive at shutdown.
    pending.unref?.()
  })
  // A deploy is a restart, and a restart is an empty page cache and markup that may have
  // changed under the edge's copy. Both are answered here rather than by remembering to do
  // something after `systemctl restart`.
  setTimeout(() => void warmThenPurge('on boot'), 1_000).unref?.()
}
