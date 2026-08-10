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
 * Not a nicety. Quire Ink AUTO-EXTRACTS an excerpt from the first paragraph whenever the author
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

/** What ends a sentence, across the scripts this product ships a UI for. */
const SENTENCE_ENDS = '.!?…。！？'
/** Punctuation that may follow the stop and still leave the sentence finished. */
const AFTER_STOP = '"\'”’»)]'

/**
 * Cut at a SENTENCE if one is near enough, and at a word boundary otherwise.
 *
 * Word-boundary alone is where this started, and it ended a front-page teaser on "…a long
 * one gives it a field of…" — a budget running out on a preposition, which reads as a
 * broken string rather than as a sentence trailing off. Stopping at a full stop costs a few
 * characters and buys a complete thought, so the ellipsis is not needed at all.
 *
 * No stop-word list, deliberately: dropping a trailing "of" or "the" would mean an English
 * word list applied to Vietnamese, German, Japanese, Chinese and Korean posts, and this
 * product ships a UI for all six. A full stop is punctuation, not vocabulary.
 *
 * The lookahead reads the FULL text rather than the cut, so a decimal point cannot pass as
 * a sentence: in "3.14" the character after the stop is a digit whichever way the budget
 * happens to fall.
 */
function clamp(text: string, max: number): string {
  if (max <= 0 || !text) return ''
  if (text.length <= max) return text
  const cut = text.slice(0, max)

  let sentence = -1
  for (let i = 0; i < cut.length; i++) {
    if (!SENTENCE_ENDS.includes(cut[i]!)) continue
    let end = i + 1
    while (AFTER_STOP.includes(text[end] ?? '')) end++
    const next = text[end]
    if (next === undefined || /\s/.test(next)) sentence = end
  }
  // Only when it lands in the last 40% of the budget. Nearer the start it would throw away
  // most of a teaser that had room for more, which is a worse answer than an ellipsis.
  if (sentence > max * 0.6) return text.slice(0, sentence).trimEnd()

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
 *
 * `priority` for the ONE image that is in the first screen — the lead's, and only when the
 * front page is the image kind. Every picture here was `loading="lazy"`, the lead's included,
 * and the lead's is the LCP element: measured at y=411 in a 1000px viewport and y=606 in an
 * 812px one, so it is above the fold on a laptop and on a phone. Lazy takes it out of the
 * preload scanner's reach, which costs a round trip on the one image the page is judged by.
 * The rule is `post-content.ts`'s (`seen === 0 ? fetchpriority : lazy`) and `chrome.ts`'s for
 * the logo; this was the one place that had not read it.
 */
export function postImage(
  post: Post,
  ready: ReadyImages,
  sizes: string,
  priority = false,
): string | null {
  const src = post.featuredImage || post.coverImage
  if (!src) return null
  const alt = escapeAttr(post.title)
  const loading = priority ? ' fetchpriority="high"' : ' loading="lazy"'
  const img = `<img src="${escapeAttr(src)}" alt="${alt}"${loading} decoding="async">`
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
  // The one image on the page that is above the fold on every width, so the one that gets
  // `fetchpriority` rather than `loading=lazy`. See `postImage`.
  const picture = front.kind === 'image'
    ? postImage(post, ready, '(max-width: 900px) 100vw, 60vw', true)
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
 *
 * THE LEVEL IS THE CALLER'S, and it is a required argument rather than a default because
 * the two callers genuinely differ. Every other row on this page opens with an h2 label
 * ("Featured", a category name, "Most read"), so its stories are h3 and sit under it. The
 * lead row has NO label — it is the top of the page — so its headlines have nothing between
 * them and the h1. Fixed at h3 they produced h1 → h3 → h3 → h3 → h2, which skips a level
 * and then files the page's most important stories BELOW the section headings that follow
 * them. Size is set by `.fc-line .fc-title`, never by the tag, so this is outline only:
 * nothing on the page moves.
 */
export function lineItem(post: Post, ctx: Ctx, tag: 'h2' | 'h3'): string {
  return `<article class="fc fc-line">${title(post, tag)}${meta(post, ctx.settings, ctx.front)}</article>`
}
