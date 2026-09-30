// Which link a menu may carry (2026-09-30).
//
// The header menu took any string as its link, and the public header printed it: a menu item
// saved as `javascript:alert(1)` ran in every reader's browser that clicked it, and `data:` did
// the same through a page of its own. Only the owner can write the menu, so it was self-inflicted
// — but a pasted snippet is exactly how an owner inflicts it. Redirects already refused both.
//
// A path, an anchor, a query, or http(s), mailto and tel. Anything else that names a scheme is
// refused, checked with the whitespace and control characters a browser ignores taken out first,
// because `java\tscript:` is `javascript:` to a URL parser.
const ALLOWED = new Set(['http', 'https', 'mailto', 'tel'])

export function isSafeHref(href: string): boolean {
  const bare = href.replace(/[\u0000- \u007f]/g, '')
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(bare)
  return !scheme || ALLOWED.has(scheme[1]!.toLowerCase())
}
