// Looking at a theme before choosing it (ADR 0072, T2c). The owner presses Preview on a tile of
// the Look card; a new tab opens the site wearing that theme, for the owner alone, until they
// leave. Nothing is saved, and nothing is logged in the activity log: a look changes nothing.
//
// THE MECHANISM. Preview is `GET /api/themes/<id>/preview`, on the owner's gated router: it sets a
// cookie naming the theme (`theme-preview-paths.ts`) and sends the browser to the home page. Then,
// on every public request carrying that cookie, the middleware below checks again that the request
// comes from the signed-in owner and that the id is still a theme the site can draw, and only then
// renders the request inside a preview scope (`server/theme-preview-scope.ts`), where
// `resolveTheme` answers the previewed theme. Anything else is the reader's page, unchanged.
//
// A COOKIE AND NOT A QUERY PARAMETER, because the owner browses: a parameter would fall off at the
// first link, and every link on every page would have to carry it. The cookie grants nothing by
// itself, so a forged one is a reader's page.
//
// WHY IT CANNOT POISON A CACHE.
//   - The page cache: a request in a preview scope neither reads nor writes it (`PageCache`), and the
//     warm renders outside any scope (`warm.ts`), so a timer started by a previewed request cannot
//     fill it with previewed pages either.
//   - A shared cache (a CDN): every answer drawn in a preview goes out `private, no-store` with
//     `Vary: Cookie`, set here before `cacheHeaders` runs, which leaves a response that has said what
//     it wants alone. The entry lands on `/?theme-preview=<id>`, a URL no reader's page is cached under.
//   - The purge and the warm fetch nothing over HTTP: the purge is one call to the CDN's API and
//     the warm renders in process, outside any preview.
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { isLiveInstalledTheme, isPreviewableTheme } from '@/content/chosen-theme'
import { isThemeId } from '@/content/themes-builtin'
import { withThemePreview } from '@/server/theme-preview-scope'
import { OWNER_PATH } from '@/web/cache-headers'
import { currentOwner } from '@/web/guard'
import {
  clearedPreviewCookie, LEAVE_PATH, PREVIEW_COOKIE, PREVIEW_PARAM, previewCookie, REFUSED_PARAM, safeReturnPath,
} from '@/web/theme-preview-paths'

/** What a previewed answer tells every cache between the blog and the owner. */
const PRIVATE = 'private, no-store'

/**
 * Draw this request as the owner's preview when it is one, and leave it alone otherwise. Only a
 * page read (GET or HEAD) outside the owner's own surfaces: a write, the admin, sign-in and the
 * API are never drawn in a theme, so they are never in a preview.
 */
export function themePreview(): MiddlewareHandler {
  return async (c, next) => {
    const themeId = getCookie(c, PREVIEW_COOKIE)
    if (!themeId) return next()
    if ((c.req.method !== 'GET' && c.req.method !== 'HEAD') || OWNER_PATH.test(c.req.path) || c.req.path === LEAVE_PATH) return next()
    // The cookie is only a request: the session decides, and the id is checked on every page,
    // because a theme removed since the preview began is no longer a theme the site can draw.
    if (currentOwner(c) === null || !isPreviewableTheme(themeId)) return next()
    const url = new URL(c.req.url)
    // Leave goes back here without the cookie, so it must not go back to the entry's own URL: the
    // reader's page it would get there is cacheable, under the very URL the next preview lands on.
    url.searchParams.delete(PREVIEW_PARAM)
    await withThemePreview({ themeId, path: url.pathname + url.search }, next)
    const headers = c.res.headers
    // A file named by the hash of its bytes cannot be drawn differently in a preview, and keeping
    // the owner's browser from caching the stylesheet would only slow the pages they are judging.
    if ((headers.get('cache-control') ?? '').includes('immutable')) return
    headers.set('cache-control', PRIVATE)
    headers.append('vary', 'Cookie')
    headers.set('x-robots-tag', 'noindex, nofollow')
    // Prerendering a link is a reader's page fetched ahead; a preview is not one.
    headers.delete('speculation-rules')
  }
}

/**
 * Preview, from the Look card's tile. The gate has already said this is the owner. An id the site
 * cannot draw (removed in another tab or by an MCP client, never installed, unreadable) opens no
 * preview and ends any that was open: the new tab goes back to the Look card, which says why
 * (`settings-themes.ts`, `previewRefused`), rather than to a home page that looks like a preview
 * of nothing.
 */
export function handlePreviewEnter(themeId: string): Response {
  if (!isPreviewableTheme(themeId)) {
    const why = isLiveInstalledTheme(themeId) ? 'unreadable' : 'missing'
    console.log(`theme preview refused: ${isThemeId(themeId) ? themeId : '(not an id)'} is ${why}`)
    const back = new URLSearchParams({ tab: 'appearance', [REFUSED_PARAM]: themeId, why })
    return redirect(`/admin/settings?${back}`, clearedPreviewCookie())
  }
  return redirect(`/?${PREVIEW_PARAM}=${encodeURIComponent(themeId)}`, previewCookie(themeId))
}

/** Leave preview, then go on to `?to=` (a path on this site). Public: see `LEAVE_PATH`. */
export function handlePreviewLeave(c: Context): Response {
  return redirect(safeReturnPath(c.req.query('to')), clearedPreviewCookie())
}

/** A 303 that sets one cookie. `cacheHeaders` makes it `private, no-store`, as it does every non-200. */
const redirect = (to: string, cookie: string): Response =>
  new Response(null, { status: 303, headers: { location: to, 'set-cookie': cookie } })
