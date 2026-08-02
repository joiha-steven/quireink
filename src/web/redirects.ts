// Owner-managed redirects, answered before anything renders.
//
// The rows have been stored since the port and nothing served them: a redirect created in
// Settings → SEO appeared in the list and did nothing, and — the expensive half — every
// slug rename auto-added a 301 that never fired, so renaming a post silently threw away
// its old URL and whatever ranked at it.
//
// The frozen tree resolved these in Next's `middleware.ts` because a page-level
// `redirect()` under a route with a `loading.tsx` was downgraded to a 200 meta-refresh.
// Hono has no such rule, but "a moved URL answers with a real 301 before anything renders"
// is the behaviour rather than the workaround, so it is still resolved ahead of the router:
// a redirect whose source is also a live listing (`/category/old`) has to win, and it only
// wins from here. Live CONTENT cannot be shadowed either way — `clearRedirectForPath`
// deletes any row whose source is a slug that content is saved at.

import type { MiddlewareHandler } from 'hono'
import { findRedirect } from '@/server/redirects'

/**
 * Paths that can never be a redirect source: the owner's own surfaces, and the two heavy
 * asset trees. The frozen tree's matcher excluded `_next/` and `uploads/` for the same
 * reason — a table lookup per image byte buys nothing.
 */
function isExcluded(path: string): boolean {
  return path.startsWith('/admin') || path.startsWith('/api')
    || path.startsWith('/uploads/') || path.startsWith('/assets/')
}

export function userRedirects(): MiddlewareHandler {
  return async (c, next) => {
    if (!isExcluded(c.req.path)) {
      const hit = findRedirect(c.req.path)
      if (hit) {
        // Absolute, resolved against the request, exactly as the frozen tree sent it. A
        // stored destination may be a path or another site's URL, and `new URL` handles
        // both — which also means the query string is NOT carried over, because the
        // destination is the whole of what the owner said the new URL is.
        return c.redirect(new URL(hit.destination, c.req.url).toString(), hit.permanent ? 301 : 302)
      }
    }
    await next()
  }
}
