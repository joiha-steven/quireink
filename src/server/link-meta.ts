// WHAT A PAGE SAYS ABOUT ITSELF, read once, so a bookmark card has something to show.
//
// ADR 0058. The first thing in this codebase to read metadata out of somebody else's HTML —
// `webmention.ts` scans fetched pages for a `rel` and a quote, and neither wants a title — so
// this is written against the same three tools it uses: `safeFetch` (the SSRF guard, manual
// redirects, each hop re-checked), `readTextCapped` (a size limit on the stream, not on what
// the caller then looks at) and `parseHtml` (the importer's forgiving tokenizer, which already
// decodes entities in text and in attributes).
//
// ⚠️ EVERY STRING THAT COMES OUT OF HERE IS A STRANGER'S. The URL was chosen by the owner; the
// TITLE was chosen by whoever runs that server, and it lands in a column, then in a page on
// this blog. Nothing is escaped here — escaping at the point of storage is how a value gets
// escaped twice or not at all, depending on which reader — so the rule is that `render/
// link-cards.ts` escapes on the way out, unconditionally, with no branch that skips it.

import { parseHtml, textOf, type HtmlNode } from '@/import/html-parse'
import { readTextCapped, safeFetch } from '@/server/safe-fetch'

export type PageMeta = {
  title: string
  description: string
  site: string
  /** Absolute, and on the REMOTE host. Fetching it home is the caller's job. */
  image: string
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

/**
 * 256 KB of the document, which is a lot of `<head>`.
 *
 * Half what `/webmention` reads, because that one is looking for a link anywhere in a page and
 * this is looking at the top of one. A site that has not said its title in the first quarter of
 * a megabyte was not going to.
 */
const MAX_BYTES = 256_000

/** Long enough for a real headline, short enough that a card cannot become an essay. */
const CAPS = { title: 200, description: 300, site: 60 } as const

const tidy = (value: string, cap: number): string =>
  value.replace(/\s+/g, ' ').trim().slice(0, cap)

/**
 * Every `<meta>` in the document, keyed by `property` or `name`, lower-cased.
 *
 * Both attributes, because Open Graph specifies `property` and Twitter's cards and the plain
 * description use `name` — and plenty of real pages spell either one the other way. Taking both
 * costs one comparison and stops a card being blank because a site used the wrong attribute.
 *
 * FIRST WINS. A page that names `og:title` twice meant the first one; the later ones are
 * template leftovers, and taking the last is how a card ends up titled after the site's footer.
 */
function metaOf(nodes: readonly HtmlNode[]): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (list: readonly HtmlNode[], inSvg: boolean): void => {
    for (const node of list) {
      if (node.type !== 'element') continue
      const svg = inSvg || node.tag === 'svg'
      if (node.tag === 'meta') {
        const key = (node.attrs.property ?? node.attrs.name ?? '').trim().toLowerCase()
        const value = node.attrs.content ?? ''
        if (key && value && !out.has(key)) out.set(key, value)
      }
      // ⚠️ NOT A `<title>` INSIDE AN `<svg>`, which is that shape's accessible name and is
      // usually one word — "Logo", "Menu". A page whose document title is missing and whose
      // header carries an inline icon would otherwise be bookmarked as "Logo".
      if (node.tag === 'title' && !svg && !out.has('#title')) {
        out.set('#title', textOf(node.children))
      }
      walk(node.children, svg)
    }
  }
  walk(nodes, false)
  return out
}

/** The hostname without `www.`, which is what a card's footer line wants. */
const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

/** Read the four facts out of a document. Exported for its own test; it touches no network. */
export function metaFromHtml(html: string, url: string): PageMeta {
  const meta = metaOf(parseHtml(html))
  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const value = meta.get(key)
      if (value?.trim()) return value
    }
    return ''
  }
  const image = pick('og:image', 'og:image:url', 'twitter:image', 'twitter:image:src')
  return {
    title: tidy(pick('og:title', 'twitter:title') || (meta.get('#title') ?? ''), CAPS.title),
    description: tidy(pick('og:description', 'twitter:description', 'description'), CAPS.description),
    // The host is the FALLBACK, not the preference: a site that names itself says something a
    // domain cannot ("The Guardian", not "theguardian.com").
    site: tidy(pick('og:site_name', 'application-name') || hostOf(url), CAPS.site),
    // Relative against the page, because half the web writes `/og.png` and the other half
    // writes it out in full. An unparseable one is no image rather than a broken one.
    image: image ? absolute(image, url) : '',
  }
}

const absolute = (image: string, base: string): string => {
  try {
    const resolved = new URL(image.trim(), base)
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.toString() : ''
  } catch {
    return ''
  }
}

/**
 * Fetch a page and read what it says about itself, or `null`.
 *
 * `null` for every kind of no — blocked by the guard, refused, timed out, not HTML, or a
 * document with no title in it. The caller writes the same row for all of them, because the
 * answer a reader sees is the same in every case: the link stays a link.
 *
 * ⚠️ IT ASKS FOR HTML AND CHECKS WHAT CAME BACK. A URL the owner linked may be a PDF, a zip or
 * a photo; handing forty megabytes of those to a tokenizer looking for `<title>` is a way to
 * spend a minute of this process on a link somebody pasted.
 */
export async function readPageMeta(url: string, fetcher: Fetcher = safeFetch): Promise<PageMeta | null> {
  try {
    const res = await fetcher(url, { headers: { accept: 'text/html,application/xhtml+xml' } })
    if (!res.ok) return null
    const type = (res.headers.get('content-type') ?? '').toLowerCase()
    if (!type.includes('text/html') && !type.includes('application/xhtml')) return null
    const meta = metaFromHtml(await readTextCapped(res, MAX_BYTES), res.url || url)
    // A card with no title is a box with a URL in it, which is worse than the link it replaced.
    return meta.title ? meta : null
  } catch {
    return null
  }
}
