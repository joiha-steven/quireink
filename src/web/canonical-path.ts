// Spellings of a URL that are not the URL, answered at the door with a 301.
//
// Two rules live here, and they are the same rule: a page has ONE address, and anything else
// that reaches the same bytes is a second URL for it. A trailing slash is one such spelling;
// `/page/1` is the other.
//
// A trailing slash is the SAME page, and until this existed it was a 404.
//
// No route in this app ends in a slash and Hono does not match one, so `/some-post/` missed
// every route and fell through. That is fine for a URL somebody typed and fatal for a site
// that MOVED here: every WordPress permalink carries a trailing slash. Measured on a real
// WordPress export: 468 old URLs, every one of the shape `https://example.com/{slug}/` — so pointing an
// imported domain at Quire would have answered 404 to every inbound link and every search
// result the site already had, which is most of what an import is for.
//
// It lives beside `cache-headers`, `security-headers` and `compress` rather than inside
// `app.ts` because it is the same kind of thing: a rule about every request, applied at the
// door, not a route.

import type { MiddlewareHandler } from 'hono'
import { getSettings } from '@/content/settings'

/**
 * Page 1 of a listing IS the listing: `/category/x/page/1` is `/category/x`, the same for a
 * tag, and `/page/1` is wherever the post list currently lives.
 *
 * Both spellings rendered, identically, at two addresses — the plain duplicate-content
 * shape. `renderListing` has always LINKED page 1 at the bare path, so nothing this site
 * prints produced the second URL; what did is a person typing it, a crawler guessing the
 * pattern from `/page/2`, and an inbound link that has carried it since 1.x. 1.x resolved
 * this in `middleware.ts`; here it is the same regex one layer earlier than the routes, so
 * `/page/:n` and `/{kind}/:slug/page/:n` only ever see a real page number.
 *
 * The capture is the destination for a term archive. An empty group means the HOME listing,
 * which is not always `/`: once the owner gives the homepage to a page or the front (ADR
 * 0014), page 1 of the post list lives at `home.listPath` and `/` is a different document —
 * so redirecting there would send the reader somewhere else entirely. That is the same
 * `listRoot` `renderPostList` already puts in the canonical tag; this makes it an answer.
 *
 * Nothing else in the path can match: `/admin`, `/api` and `/uploads` have no `/page/1`
 * shape, and a post whose slug is literally `page` is served at `/page`, not at `/page/1`.
 */
const PAGE_ONE = /^(\/(?:category|tag)\/[^/]+)?\/page\/1$/

async function listRoot(): Promise<string> {
  const { home } = await getSettings()
  return home.mode === 'list' ? '/' : home.listPath
}

/**
 * 301 any path with a trailing slash to the same path without one.
 *
 * A redirect rather than serving both: two URLs for one page splits whatever those inbound
 * links are worth, and a canonical tag is a hint where a 301 is an answer. Permanent rather
 * than temporary, because this will never stop being true — no route here will ever end in a
 * slash.
 *
 * `/` is left alone: trimming it leaves nothing to redirect to. The query string rides
 * along, or `/tag/edc/?page=2` would silently lose its page.
 */
export function canonicalPath(): MiddlewareHandler {
  return async (c, next) => {
    const { pathname, search } = new URL(c.req.url)
    if (pathname.length > 1 && pathname.endsWith('/')) {
      return c.redirect(pathname.replace(/\/+$/, '') + search, 301)
    }
    // After the slash rule, not before: `PAGE_ONE` anchors on the end, so `/page/1/` has to
    // lose its slash first. That makes it a two-hop chain, both permanent, which a crawler
    // follows without penalty — the same pair `userRedirects` already produces.
    const pageOne = PAGE_ONE.exec(pathname)
    // The settings read happens ONLY on a path that already matched, so the hot path — every
    // page, every asset, every image byte — still costs one regex and nothing else.
    if (pageOne) return c.redirect((pageOne[1] ?? await listRoot()) + search, 301)
    await next()
  }
}
