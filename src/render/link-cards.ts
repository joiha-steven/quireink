// A PARAGRAPH HOLDING NOTHING BUT A LINK, and the three things it can become.
//
// ADR 0058. This blog has drawn one of these since the port: a standalone video URL becomes a
// player. The rule that finds it — "a `<p>` whose whole content is one link, or one bare URL" —
// is the same rule a bookmark card and a file card need, and it lives here now rather than in
// three regular expressions that agree until one of them is edited.
//
// ⚠️ THE MARKDOWN STAYS A BARE URL. Nothing here is stored in a post; the line an author wrote
// is the line every other renderer in the world reads as a link, and an export of this blog
// carries no markup a different tool would have to learn. That is the bargain the video embed
// made and it is why a card can be switched off without touching a single piece of writing.
//
// Every function here is PURE: HTML in, HTML out, with the facts handed in. What a bookmark
// card SAYS is fetched and stored elsewhere (`content/link-cards.ts`), because a renderer that
// reached out to somebody else's server would do it once per reader.

import { escapeHtml } from '@/utils'

/** What a fetched page said about itself. `image` is a path into THIS blog's store, or ''. */
export type BookmarkFacts = {
  title: string
  description: string
  site: string
  image: string
}

/** What this blog already knows about one of its own uploads. */
export type FileFacts = {
  name: string
  /** Bytes. Printed by the caller's own formatter, because a size is a UI string. */
  size: number
  /** A short, upper-case kind for the corner of the card: PDF, ZIP, EPUB. */
  kind: string
}

export type CardFacts = {
  bookmarks: ReadonlyMap<string, BookmarkFacts>
  /** Keyed by the upload's own path, `/uploads/files/…`, which is how `FileItem.url` reads. */
  files: ReadonlyMap<string, FileFacts>
  /**
   * This blog's own address, so a link written out in full can be recognised as one of its own.
   *
   * It is a FACT the renderer is handed rather than a setting it reads, for the same reason the
   * maps are: everything that can change this HTML is an argument, and everything that is an
   * argument is in the cache key.
   */
  site: string
}

/** Nothing known and nothing on: what every caller passes while the settings are off. */
export const NO_CARDS: CardFacts = { bookmarks: new Map(), files: new Map(), site: '' }

/**
 * A URL this blog will not look up, whatever a paragraph says.
 *
 * Root-relative is one of its own pages or its own uploads — there is nothing to fetch and
 * `/uploads/files/…` is the FILE card's business. Anything that is not http(s) is a scheme this
 * has no business dialling.
 */
export const isRemote = (url: string): boolean => /^https?:\/\//i.test(url)

/**
 * The path a URL has on THIS blog, or ''.
 *
 * An owner pastes the full address of their own upload as often as the short one — it is what
 * the Library's Copy URL key gives them — so the two have to mean the same thing. Without this
 * the same file is a download card written one way and a bookmark card written the other, and
 * the bookmark card is this server fetching its own page to find out about itself.
 */
export function ownPath(url: string, siteUrl: string): string {
  if (url.startsWith('/')) return url
  if (!siteUrl) return ''
  try {
    const here = new URL(siteUrl)
    const there = new URL(url)
    return there.origin === here.origin ? there.pathname : ''
  } catch {
    return ''
  }
}

/**
 * A `<p>` whose entire content is one link, or one bare URL.
 *
 * ⚠️ ONE COPY OF THIS, read by the video pass and both card passes. Three passes over the same
 * shape with three regular expressions is three rules that agree on the day they are written:
 * a fragment handled in one and not the others is a URL that becomes a player and never a card,
 * or the reverse, with nothing failing anywhere.
 */
const RULE = /<p>\s*(?:<a\b[^>]*href="([^"]+)"[^>]*>[^<]*<\/a>|([^<\s]+))\s*<\/p>/g

/**
 * Hand every standalone link to `draw`, and keep whatever it returns.
 *
 * `frag` is the `#…` the author wrote, which the video pass reads for `#wide`. The URL arrives
 * WITHOUT it, because a fragment is a position inside a document and not part of the document's
 * identity — two posts linking `…/guide#install` and `…/guide` are linking one page.
 */
export function standalone(
  html: string,
  draw: (url: string, frag: string, whole: string) => string,
): string {
  return html.replace(RULE, (whole, hrefUrl?: string, textUrl?: string) => {
    const raw = (hrefUrl || textUrl || '').trim()
    const [url, frag = ''] = raw.split('#')
    return url ? draw(url, frag, whole) : whole
  })
}

/** Every standalone link in a body, de-duplicated, in the order they appear. */
export function standaloneUrls(html: string): string[] {
  const seen = new Set<string>()
  standalone(html, (url, _frag, whole) => {
    seen.add(url)
    return whole
  })
  return [...seen]
}

/**
 * ⚠️ NEITHER THE URL NOR THE CARD'S TEXT IS ESCAPED THE SAME WAY, and the difference is where
 * each one came from.
 *
 * The URL was read back out of rendered HTML with `[^"]*`, so it cannot contain a double quote
 * and it has ALREADY been through the engine's escaper — `&` is `&amp;` in it. Escaping it
 * again would publish `&amp;amp;` in every URL carrying a query string, which is `figures.ts`'s
 * note at length.
 *
 * The card's TEXT came from somebody else's web page by way of a database column. It has been
 * through no escaper at all and is the one string on this surface an attacker chooses, so it
 * gets the full treatment, every time, with no branch that skips it.
 */
const text = (value: string): string => escapeHtml(value)

/**
 * The bookmark card: a whole clickable block, not a heading with a link in it.
 *
 * ONE `<a>` AROUND EVERYTHING. A card built as a box containing a title link and a picture link
 * is two stops for a keyboard and two targets for a thumb, pointing at the same place; the
 * screen reader then reads the destination twice. The picture is `alt=""` for the same reason —
 * it is decoration inside a link that already has its name.
 *
 * `rel="nofollow ugc"` is NOT set: this is the author's own citation on their own blog, which is
 * what a link in running text already is. The card changes how it is drawn, not what it means.
 */
export function bookmarkCard(url: string, f: BookmarkFacts): string {
  const picture = f.image
    ? `<img class="link-card-pic" src="${f.image}" alt="" loading="lazy" decoding="async">`
    : ''
  const description = f.description
    ? `<span class="link-card-desc">${text(f.description)}</span>`
    : ''
  const site = f.site ? `<span class="link-card-site">${text(f.site)}</span>` : ''
  return `<a class="link-card" href="${url}" rel="noopener">`
    + `<span class="link-card-text">`
    + `<span class="link-card-title">${text(f.title)}</span>`
    + `${description}${site}</span>${picture}</a>`
}

/**
 * The file card: what this is, what kind, and how big, before the reader spends the click.
 *
 * ⚠️ NO `download` ATTRIBUTE. Whether a file opens or saves is `web/uploads.ts`'s answer, in the
 * `content-disposition` it already sends, and it is the right place for it — a PDF an owner
 * wants read in the tab and one they want kept are the same card. Putting `download` here would
 * overrule that from the other end of the system, for one of the two ways to reach the file.
 */
export function fileCard(url: string, f: FileFacts, size: string): string {
  return `<a class="file-card" href="${url}">`
    + `<span class="file-card-kind">${text(f.kind)}</span>`
    + `<span class="file-card-text">`
    + `<span class="file-card-name">${text(f.name)}</span>`
    + `<span class="file-card-meta">${text(size)}</span></span></a>`
}
