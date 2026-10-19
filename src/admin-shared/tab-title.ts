// WHAT THE BROWSER TAB SAYS: the screen first, then the site.
//
// With fifteen tabs open the front of the title is all that stays visible, and "quireINK" there
// named the product, which every tab of the admin shares. The screen goes first and the site's
// own title second, so two blogs open side by side still tell apart. A site with no title falls
// back to the product name rather than to an empty tail.
//
// Shared because two sides write the title: the server on a page load, and the island when the
// address changes under an open page (a settings tab swap, a new piece's first save).

export const PRODUCT_NAME = 'quireINK'

/** The plain-text title, for `document.title` and for tests. */
export function tabTitleText(parts: string[], siteTitle: string): string {
  const site = siteTitle.trim() || PRODUCT_NAME
  const named = parts.map((p) => p.trim()).filter(Boolean)
  return [...named, site].join(' · ')
}
