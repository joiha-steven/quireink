// The composed front page. ADR 0014, part 2.
//
// A stack of rows whose ORDER is fixed here and is not a setting: this is a prepared layout
// with options, not a block composer. What the owner chooses is which rows appear, how big
// they are, and where their posts come from.
//
// Not `renderListing`. A row is not a card: the lead is one post at h1 with a picture beside
// it, a strip is a labelled group with its own topic links, and a line is a headline with no
// body at all. Trying to serve both from one renderer is how a listing gains a field that a
// front page silently lacks, which is the failure the listing renderer's own header warns
// about.

import type { FrontSettings, Post, SiteSettings } from '@/types'
import { getPost, getPublicPosts } from '@/content/posts'
import { getSettings } from '@/content/settings'
import { termSlug } from '@/content/taxonomy'
import { getViewTotalsSince } from '@/analytics/summary'
import { getMediaRefs } from '@/media/media-refs'
import { collapseBlob } from '@/media/blob'
import { t } from '@/i18n/i18n'
import { escapeAttr, escapeHtml, isPublicallyVisible, toPlainText } from '@/utils'
import { cardItem, leadItem, lineItem, type ReadyImages } from '@/web/front-card'
import { listingPage } from '@/web/listing-page'

/**
 * The prose a piece OPENS with, stopping at its first heading.
 *
 * `toPlainText` over the whole body flattens the document into one stream, so a section
 * heading arrives mid-sentence: "...somebody else's business model. What owning it actually
 * means It is worth being precise..." — photographed exactly like that. Cutting at the first
 * heading gives the opening paragraphs and nothing else, which is what a front page wants.
 */
function openingProse(markdown: string): string {
  return toPlainText(markdown.split(/\n#{1,6}\s/)[0] ?? '')
}

/** How wide a front page runs, against the ~672px the reading column uses. */
const FRONT_WIDTH = 1120

/** Fewer than this and a topic row is noise rather than navigation, so it is not drawn. */
const MIN_TAG_LINKS = 3
const MAX_TAG_LINKS = 5

type Ctx = { settings: SiteSettings; front: FrontSettings; ready: ReadyImages }

/** A labelled row. The label is a link because a section heading that goes nowhere is a tease. */
function row(label: string, href: string, topics: string, inner: string): string {
  const head = label
    ? `<header class="front-head"><h2 class="front-label"><a class="link-accent" href="${
      escapeAttr(href)}">${escapeHtml(label)}</a></h2>${topics}</header>`
    : ''
  return `<section class="front-row">${head}${inner}</section>`
}

/**
 * A grid row, never wider than it has anything to put in it.
 *
 * The column count is clamped to the ITEM count. A three-column row holding one card was
 * photographed as a narrow lonely column with two thirds of the row empty, and that happens
 * whenever a category has fewer unused posts left than its setting asks for — which on a
 * small blog is most of them.
 */
const grid = (columns: number, items: string[]) =>
  `<div class="front-grid cols-${Math.min(columns, items.length)}">${items.join('\n')}</div>`

/**
 * The topic links beside a strip's label, derived rather than curated.
 *
 * Counted from the posts already in memory, so this is a group-by and not a query. It is
 * also why it can be honest about being thin: with fewer than three tags in a category the
 * row says nothing a reader could use, so it is not drawn at all.
 */
function topicLinks(posts: Post[], on: boolean): string {
  if (!on) return ''
  const counts = new Map<string, number>()
  for (const p of posts) for (const tag of p.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_TAG_LINKS)
  if (top.length < MIN_TAG_LINKS) return ''
  return `<p class="front-topics t-small">${top.map(([tag]) =>
    `<a class="link-accent" href="/tag/${escapeAttr(termSlug(tag))}">${escapeHtml(tag)}</a>`).join('')}</p>`
}

/**
 * The whole page.
 *
 * `used` is what stops the front page repeating itself. Without it the newest post is the
 * lead, the first card of its category's strip AND the first of "latest", which reads as a
 * site with three posts. Rows are therefore built in priority order and each one skips what
 * an earlier row already showed — so the LEAD wins, then featured, then strips, and latest
 * takes whatever is left. A row that empties out this way simply does not render.
 */
async function buildBody(settings: SiteSettings, ready: ReadyImages): Promise<string> {
  const front = settings.home.front
  const ctx: Ctx = { settings, front, ready }
  const tx = t(settings.language)
  const all = (await getPublicPosts()).filter((p) => isPublicallyVisible(p.status, p.date))
  const used = new Set<string>()
  const take = (from: Post[], n: number) => {
    const out = from.filter((p) => !used.has(p.slug)).slice(0, n)
    for (const p of out) used.add(p.slug)
    return out
  }
  const rows: string[] = []

  // ----- the lead, and the headlines stacked under it -------------------------
  if (front.lead.on && all.length) {
    const pinned = front.lead.source === 'pinned'
      ? all.find((p) => p.slug === front.lead.slug)
      : undefined
    // A pinned post that has been trashed, unpublished or scheduled forward is simply not
    // in `all`, and the newest post is a better answer than an empty front page.
    const [lead] = take(pinned ? [pinned] : all, 1)
    if (lead) {
      // The body, for the lead alone. `getPublicPosts` is an index and carries no content,
      // so this is one extra read for one post rather than a heavier index for every page
      // that uses it. A post that has vanished between the two reads simply has no opening.
      const full = await getPost(lead.slug)
      const opening = full ? openingProse(full.content) : ''
      const secondary = take(all, front.lead.secondary)
      rows.push(`<section class="front-row front-lead-row">${leadItem(lead, ctx, opening)}${
        secondary.length ? `<div class="front-secondary">${secondary.map((p) => lineItem(p, ctx)).join('\n')}</div>` : ''
      }</section>`)
    }
  }

  // ----- the owner's own list -------------------------------------------------
  if (front.featured.on && settings.featured.length) {
    const picked = settings.featured
      .map((slug) => all.find((p) => p.slug === slug))
      .filter((p): p is Post => !!p)
    const items = take(picked, front.featured.count)
    if (items.length) {
      rows.push(row(tx.frontFeatured, settings.home.listPath, '',
        grid(front.featured.columns, items.map((p) => cardItem(p, ctx)))))
    }
  }

  // ----- one row per category the owner chose ---------------------------------
  for (const strip of front.strips) {
    const inCategory = all.filter((p) => p.categories.includes(strip.category))
    const items = take(inCategory, strip.count)
    if (!items.length) continue // a category that has run dry is skipped, not left empty
    rows.push(row(strip.category, `/category/${termSlug(strip.category)}`,
      topicLinks(inCategory, front.tagLinks),
      // No category label on these cards: the row is already called that, and NYT does not
      // print the section name on every story under the section heading either.
      grid(strip.columns, items.map((p) => cardItem(p, ctx, { category: false })))))
  }

  // ----- what people are actually reading -------------------------------------
  if (front.popular.on) {
    const views = await getViewTotalsSince(front.popular.days)
    const ranked = all
      .map((p) => ({ post: p, n: views[`/${p.slug}`] ?? 0 }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .map((x) => x.post)
    const items = take(ranked, front.popular.count)
    if (items.length) {
      rows.push(row(tx.frontPopular, settings.home.listPath, '',
        `<div class="front-lines">${items.map((p) => lineItem(p, ctx)).join('\n')}</div>`))
    }
  }

  // ----- and everything else, newest first ------------------------------------
  if (front.latest.on) {
    const items = take(all, front.latest.count)
    if (items.length) {
      rows.push(row(tx.frontLatest, settings.home.listPath, '',
        grid(front.latest.columns, items.map((p) => cardItem(p, ctx)))))
    }
  }

  const more = `<p class="front-more"><a class="link-accent" href="${
    escapeAttr(settings.home.listPath)}">${escapeHtml(tx.frontAllPosts)}</a></p>`
  const body = rows.length ? rows.join('\n') : `<p class="empty">${escapeHtml(tx.emptyPosts)}</p>`
  return `<div class="front front-${front.kind}">${body}${rows.length ? more : ''}</div>`
}

/**
 * The front page, or null when it cannot be built.
 *
 * Null rather than an empty page: `renderHome` falls back to the post list on null, which is
 * the same contract the `page` mode already has and the same reason — the homepage is the
 * one page that must never be a dead end.
 */
export async function renderFront(): Promise<string | null> {
  const settings = await getSettings()
  const ready: ReadyImages = new Set()
  // Only needed for the kind that draws pictures, and it is a full table read.
  if (settings.home.front.kind === 'image') {
    for (const r of await getMediaRefs()) if (r.variants) ready.add(collapseBlob(r.url))
  }
  const body = await buildBody(settings, ready)
  return listingPage({
    title: settings.title,
    body,
    css: frontCss(),
    canonicalPath: '/',
    // The rows below already ARE the discovery blocks. Keeping the rail would put
    // most-viewed beside most-viewed on the same screen (ADR 0014).
    noRail: true,
  })
}

/**
 * The one thing that genuinely varies per render: how wide the page runs.
 *
 * The column counts used to be emitted here too, and that was a bug rather than a design:
 * this string lands in the page's inline style, AFTER the stylesheet, so it beat the sheet's
 * own responsive rules and a phone was handed a two-column grid it could not fit. The counts
 * are sanitized to 1, 2 or 3, so the sheet can state all three and this emits none of them.
 *
 * `--shell-w` is overridden for the WHOLE document, header and footer included, so the page
 * furniture lines up with the rows instead of sitting on the old narrow measure.
 */
function frontCss(): string {
  return `:root{--shell-w:${FRONT_WIDTH}px}`
}
