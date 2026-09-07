// What a SHARED cache may do with a page. One rule, at the door.
//
// Nothing was sent at all, and the CDN in front of this decides for itself what that means:
// a staging article came back from the edge two deploys stale, and an hour went into
// chasing a bug that had already been fixed. On the live domain the same thing is a
// published post nobody can see.
//
// This is about the SHARED cache only. The in-process page cache is a different thing with
// a different rule — Invariant 1, cleared completely after every write — and it is exact
// where this is a window.

import type { MiddlewareHandler } from 'hono'
import { getSettings } from '@/content/settings'
import { SPECULATION_HEADER } from '@/web/speculation'

/**
 * 60 seconds, and the edge may keep answering while it refreshes.
 *
 * Short enough that a publish is visible almost at once, long enough that a burst of
 * readers costs one render. `stale-while-revalidate` is what keeps the refresh off the
 * reader's critical path: the first request after expiry is answered from the stale copy
 * and the edge fetches a new one behind it.
 */
const PUBLIC = 'public, s-maxage=60, stale-while-revalidate=600'

/**
 * The owner's own surfaces, and anything that is not a 200.
 *
 * An admin shell or a sign-in page held by a shared cache is a page served to somebody it
 * was not rendered for. A cached 404 is worse than useless: it outlives the reason for it.
 */
const PRIVATE = 'private, no-store'

const OWNER_PATH = /^\/(admin|login|api)(\/|$)/

export function cacheHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next()
    // A handler that has already said what it wants is left alone: the asset routes are
    // immutable-for-a-year, and the machine surfaces set their own.
    if (c.res.headers.has('cache-control')) return
    // Anything that is not a 200 or its 304 is refused a shared cache whatever its type: a
    // public miss is now a rendered page in the site shell, and a cached 404 outlives the
    // reason for it.
    //
    // ⚠ THE 304 IS THE SAME RESOURCE as the 200 it revalidates, and it has to carry the
    // same instructions. This middleware is registered before `compression`, so its own
    // code runs after that one has already turned a matching `If-None-Match` into a 304 —
    // and the old status check then stamped `no-store` on it. A browser merging those
    // headers into the entry it just revalidated dooms the entry, so the next visit was a
    // full 200 again and the validator paid off every other request at best.
    const revalidated = c.res.status === 304
    if ((c.res.status !== 200 && !revalidated) || OWNER_PATH.test(c.req.path)) {
      c.res.headers.set('cache-control', PRIVATE)
      return
    }
    if ((c.res.headers.get('content-type') ?? '').includes('text/html')) {
      // Read only for public HTML, which is the only response this decides anything about.
      // Putting it above the branches would add a query to every asset and every API call.
      //
      // `no-store`, not `no-cache`: Cloudflare treats `no-cache` as "may keep it, must
      // revalidate" and will still answer from the edge, so the switch would appear to do
      // nothing from outside. `no-store` is the one that means what it says.
      c.res.headers.set('cache-control', (await getSettings()).cache.enabled ? PUBLIC : 'public, no-store')
      // Prerender-on-hover, offered on the same responses a shared cache may hold: a public
      // page, 200, HTML. The owner's surfaces are already gone by the branch above, which
      // is the point of setting it here rather than in each renderer.
      c.res.headers.set('speculation-rules', SPECULATION_HEADER)
    }
  }
}
