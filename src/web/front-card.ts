// The items a front page is built from. ADR 0014.
//
// Three shapes, and the difference between them is a hierarchy rather than three designs:
// a LEAD (the biggest headline, a standfirst, usually a picture), a CARD (a headline, a
// standfirst, sometimes a thumbnail) and a LINE (a headline and its meta, nothing else).
// Measured on the NYT front page, that is the whole vocabulary: size, then standfirst, then
// image, then rules. Most stories there carry no image at all, which is why an image is a
// dial here and never a requirement.

import type { FrontSettings, Post, SiteSettings } from '@/types'
import { formatDate, t } from '@/i18n/i18n'
import { termSlug } from '@/content/taxonomy'
import { escapeAttr, escapeHtml } from '@/utils'
import { collapseBlob } from '@/media/blob'

/** Which originals have responsive variants. Built once per render, never per image. */
export type ReadyImages = Set<string>

/**
 * How much standfirst a shape gets, in characters.
 *
 * This is the owner's rule made literal: with a picture you need fewer words to make
 * somebody look, without one the words are all there is. The text kind therefore prints
 * roughly twice as much, and the lead prints more than a card in either kind.
 */
const DECK_CHARS: Record<'image' | 'text', { lead: number; card: number }> = {
  image: { lead: 150, card: 90 },
  text: { lead: 260, card: 190 },
}

/**
 * How much of the body the lead prints, in characters.
 *
 * The text kind gets more for the same reason it gets a longer standfirst: with no picture
 * in the row, the words are the only thing filling it.
 */
const LEAD_INTRO_CHARS: Record<'image' | 'text', number> = { image: 240, text: 420 }

/**
 * The body with its opening skipped when the standfirst already said it.
 *
 * Not a nicety. Quire AUTO-EXTRACTS an excerpt from the first paragraph whenever the author
 * leaves the field empty, so on a normal blog the standfirst and the first line of the piece
 * are the same sentence — and printing both puts it on the front page twice, one under the
 * other. Photographed exactly that way the first time this shipped.
 *
 * Compared on collapsed whitespace so a line break in the source does not defeat it.
 */
function afterExcerpt(bodyText: string, excerpt: string): string {
  const body = bodyText.replace(/\s+/g, ' ').trim()
  const head = excerpt.replace(/\s+/g, ' ').trim()
  if (!head || !body.toLowerCase().startsWith(head.toLowerCase())) return body
  return body.slice(head.length).trim()
}

/** Cut on a word boundary, and only when there is something worth cutting. */
function clamp(text: string, max: number): string {
  if (max <= 0 || !text) return ''
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/**
 * The picture for a post, or null.
 *
 * `featuredImage` first and `coverImage` behind it: the featured one is already the site's
 * representative image (it is what `og.ts` renders the share card from), and the cover is
 * the banner inside the article. When a site has only ever filled one of them, this finds it.
 *
 * A `<picture>` has NO fallback when a source 404s, so the AVIF/WebP pair is only offered
 * for an original whose variants are confirmed. Everything else renders as a plain `<img>`,
 * which always loads. That rule is `post-content.ts`'s and it is not restated by accident:
 * getting it wrong here would blank the image on exactly the posts that are still processing.
 */
export function postImage(post: Post, ready: ReadyImages, sizes: string): string | null {
  const src = post.featuredImage || post.coverImage
  if (!src) return null
  const alt = escapeAttr(post.title)
  const img = `<img src="${escapeAttr(src)}" alt="${alt}" loading="lazy" decoding="async">`
  const m = src.match(/^(.*\/media\/.+)\.(?:jpe?g|png)$/i)
  if (!m || !ready.has(collapseBlob(src))) return `<picture>${img}</picture>`
  const set = (fmt: string) => `${m[1]}-1024.${fmt} 1024w, ${m[1]}-1600.${fmt} 1600w`
  return '<picture>'
    + `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
    + `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
    + `${img}</picture>`
}

/** Date, reading time, or neither. Both are settings because a front page is not a feed. */
function meta(post: Post, settings: SiteSettings, front: FrontSettings): string {
  const tx = t(settings.language)
  const parts: string[] = []
  if (front.showDate) {
    parts.push(`<time datetime="${escapeAttr(post.date)}">${escapeHtml(formatDate(post.date, settings.language))}</time>`)
  }
  if (front.showReadingTime && post.readingMinutes) {
    parts.push(`<span class="num">${post.readingMinutes}</span> ${escapeHtml(tx.readingSuffix)}`)
  }
  return parts.length ? `<p class="fc-meta t-small text-meta">${parts.join(' · ')}</p>` : ''
}

function title(post: Post, tag: 'h1' | 'h2' | 'h3'): string {
  return `<${tag} class="fc-title reading-font"><a class="link-accent" href="/${escapeAttr(post.slug)}">${
    escapeHtml(post.title)}</a></${tag}>`
}

function deck(post: Post, max: number): string {
  const text = clamp(post.excerpt ?? '', max)
  return text ? `<p class="fc-deck reading-font">${escapeHtml(text)}</p>` : ''
}

/** The category above a headline, which is how a front page says where it is. */
function category(post: Post): string {
  const name = post.categories[0]
  if (!name) return ''
  return `<p class="fc-cat t-small"><a class="link-accent" href="/category/${
    escapeAttr(termSlug(name))}">${escapeHtml(name)}</a></p>`
}

type Ctx = { settings: SiteSettings; front: FrontSettings; ready: ReadyImages }

/**
 * The lead. One per front page, and the only h1 on it.
 *
 * The image sits in its own element AFTER the text in source order, which is what puts the
 * headline above the picture on a phone with no work: the desktop grid reorders it into the
 * right-hand column and the phone simply reads it as written. NYT does the same thing, and
 * doing it the other way round means a reader on a phone scrolls past a photograph to find
 * out what it is of.
 */
export function leadItem(post: Post, ctx: Ctx, opening = ''): string {
  const { settings, front, ready } = ctx
  const picture = front.kind === 'image'
    ? postImage(post, ready, '(max-width: 900px) 100vw, 60vw')
    : null
  // The opening lines of the piece itself, under the standfirst. Without them the lead
  // column ran out of words a third of the way down its own row and the rule underneath sat
  // in a field of white — visible in every screenshot of it. A standfirst says what a piece
  // is about; these are the piece, which is what actually makes somebody start reading.
  const body = afterExcerpt(opening, post.excerpt ?? '')
  const intro = body
    ? `<p class="fc-intro reading-font">${escapeHtml(clamp(body, LEAD_INTRO_CHARS[front.kind]))}</p>`
    : ''
  return `<article class="fc fc-lead${picture ? ' has-media' : ''}">
<div class="fc-text">${category(post)}${title(post, 'h1')}${deck(post, DECK_CHARS[front.kind].lead)}${intro}${meta(post, settings, front)}</div>
${picture ? `<div class="fc-media">${picture}</div>` : ''}
</article>`
}

/**
 * A card in a grid row. The thumbnail is the image kind's; the standfirst is the text kind's.
 *
 * `category: false` for a card inside a category strip, where the row heading already says
 * the name and repeating it on every card under it is noise. NYT does not print the section
 * name on each story below the section heading either.
 */
export function cardItem(post: Post, ctx: Ctx, opts: { category?: boolean } = {}): string {
  const { settings, front, ready } = ctx
  const picture = front.kind === 'image'
    ? postImage(post, ready, '(max-width: 640px) 100vw, 33vw')
    : null
  const cat = opts.category === false ? '' : category(post)
  return `<article class="fc${picture ? ' has-media' : ''}">
${picture ? `<div class="fc-media">${picture}</div>` : ''}
<div class="fc-text">${cat}${title(post, 'h3')}${deck(post, DECK_CHARS[front.kind].card)}${meta(post, settings, front)}</div>
</article>`
}

/**
 * A headline and its meta, nothing else. Used where a row is a list rather than a grid:
 * under the lead, and in the most-viewed row.
 */
export function lineItem(post: Post, ctx: Ctx): string {
  return `<article class="fc fc-line">${title(post, 'h3')}${meta(post, ctx.settings, ctx.front)}</article>`
}
