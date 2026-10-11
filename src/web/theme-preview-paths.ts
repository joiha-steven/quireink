// The names a theme preview travels by: its cookie, the way out, and where the way out may go.
// Shared by the routes (`web/theme-preview.ts`) and the bar (`web/theme-preview-bar.ts`), which
// would otherwise each spell them.

/**
 * The previewed theme's id. `__Host-` as the session's is: sent only over HTTPS (or localhost),
 * only to this host, path `/`. HttpOnly, since no script reads it. Lax, so following a link to the
 * site from elsewhere still shows the preview the owner left open.
 *
 * It grants nothing: every request checks the owner's session and the id again
 * (`web/theme-preview.ts`), so a reader who sets it by hand gets the reader's page.
 */
export const PREVIEW_COOKIE = '__Host-quire_theme_preview'

/** The entry's query parameter: it only keeps the first previewed page off a shared cache's key for `/`. */
export const PREVIEW_PARAM = 'theme-preview'

/**
 * On the Look card's address after a refused preview: the id, beside `why` (`missing` or
 * `unreadable`). Read by the island, which says it and takes both out of the address.
 */
export const REFUSED_PARAM = 'preview-refused'

/** An hour: long enough to read a few pages in it, short enough that a forgotten one ends itself. */
export const PREVIEW_MAX_AGE_S = 60 * 60

export const previewCookie = (themeId: string): string =>
  `${PREVIEW_COOKIE}=${themeId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${PREVIEW_MAX_AGE_S}`

export const clearedPreviewCookie = (): string =>
  `${PREVIEW_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`

/**
 * Leave preview. Two segments, so the one-segment `/{slug}` namespace stays whole, and public:
 * clearing a cookie is safe for anyone to ask, and an owner whose session ran out must still be
 * able to leave.
 */
export const LEAVE_PATH = '/theme-preview/leave'

/** The way out, then on to `to`. */
export const leaveHref = (to: string): string => `${LEAVE_PATH}?to=${encodeURIComponent(to)}`

/**
 * Where Leave may send the browser: a path on this site, never another site. `//host` and
 * `/\host` are other sites to a browser, so only one leading slash followed by something else is
 * kept; anything else is the home page.
 */
export function safeReturnPath(to: string | undefined): string {
  if (!to || !to.startsWith('/') || to.startsWith('//') || to.startsWith('/\\')) return '/'
  // Control characters and spaces have no business in a path this site drew; refusing them keeps a
  // header from carrying anything but the one URL.
  if (/[\x00-\x20\x7f]/.test(to)) return '/'
  // A header value is bytes up to U+00FF, and `new Response` throws on anything above: a crafted
  // `?to=` with one would be a 500. Percent-encoded, the browser reads the same path; a lone
  // surrogate cannot be encoded at all, and is the home page.
  try {
    return to.replace(/[^\x21-\x7e]/gu, (ch) => encodeURIComponent(ch))
  } catch {
    return '/'
  }
}
