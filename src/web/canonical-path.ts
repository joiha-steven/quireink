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
    await next()
  }
}
