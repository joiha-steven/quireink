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
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { websiteSchema } from '@/render/schema'
import { tagText, termSlug } from '@/content/taxonomy'
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

/**
 * A row's heading.
 *
 * `href` is OPTIONAL, and that is the correction: every label used to be a link, on the
 * reasoning that a section heading going nowhere is a tease. Only a category has a page of
 * its own, so "Featured" and "Most read" were pointed at the post list — and clicking a
 * heading called Featured to be handed every post the blog has ever published is worse than
 * a heading that does not move. A label links when it names a place and is plain text when
 * it does not.
 *
 * `more` is the continuation, and there is at most ONE per page: it goes on the LAST row
 * that has a heading, which is where a newspaper prints it.
 */
type Head = {
  label: string
  href?: string
  topics?: string
  more?: { href: string; label: string }
}

type Row = { head: Head | null; inner: string; cls?: string }

function row({ head, inner, cls }: Row): string {
  return `<section class="front-row${cls ? ` ${cls}` : ''}">${head ? rowHead(head) : ''}${inner}</section>`
}

function rowHead(head: Head): string {
  const label = head.href
    ? `<a class="link-accent" href="${escapeAttr(head.href)}">${escapeHtml(head.label)}</a>`
    : escapeHtml(head.label)
  const more = head.more
    ? `<a class="front-more link-accent t-small" href="${escapeAttr(head.more.href)}">${
      escapeHtml(head.more.label)}</a>`
    : ''
  return `<header class="front-head"><h2 class="front-label">${label}</h2>${
    head.topics ?? ''}${more}</header>`
}

/**
 * How many columns a row of `items` actually gets.
 *
 * Clamped to the ITEM count first. A three-column row holding one card was photographed as a
 * narrow lonely column with two thirds of the row empty, and that happens whenever a category
 * has fewer unused posts left than its setting asks for — which on a small blog is most of them.
 *
 * Then the orphan: four cards across three columns is one full line and then a single card
 * with two thirds of the row empty beside it, photographed on the Latest row. Dropping one
 * column makes it two even lines. Only ever ONE step, and only when the step actually helps —
 * seven across three would leave one on a line of two, so that row keeps its three columns
 * rather than trading one ragged line for a taller one.
 */
function columnsFor(columns: number, items: number): number {
  const c = Math.min(columns, items)
  if (c > 1 && items % c === 1 && items % (c - 1) !== 1) return c - 1
  return c
}

const grid = (columns: number, items: string[]) =>
  `<div class="front-grid cols-${columnsFor(columns, items.length)}">${items.join('\n')}</div>`

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
  // `tagText`, like every other place a tag is printed. This row was written without it and
  // shipped "the web" where the listing sidebar, the post footer and the tag page all say
  // "the-web" — and five multi-word tags in a row with only a gap between them read as one
  // sentence rather than as five links, which is the reason the dashes exist.
  return `<p class="front-topics t-small">${top.map(([tag]) =>
    `<a class="link-accent" href="/tag/${escapeAttr(termSlug(tag))}">${escapeHtml(tagText(tag))}</a>`).join('')}</p>`
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
  // Kept as heads + bodies rather than as finished HTML, because the continuation link can
  // only be placed once every row is known: it belongs to the LAST row that has a heading,
  // and which row that is depends on what emptied out along the way.
  const rows: Row[] = []

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
      // `has-kicker` is the lead's category line, and the secondary column needs to know
      // about it: the two columns top-align, so with a kicker on one of them the right-hand
      // headlines sat 30px ABOVE the lead headline and the eye read the wrong one first.
      // The class rather than `:has()`, because whether the lead prints a category is
      // already known here and a layout should not depend on a selector the renderer can
      // answer itself.
      rows.push({
        head: null,
        cls: `front-lead-row${lead.categories.length ? ' has-kicker' : ''}`,
        inner: `${leadItem(lead, ctx, opening)}${
          secondary.length ? `<div class="front-secondary">${secondary.map((p) => lineItem(p, ctx, 'h2')).join('\n')}</div>` : ''
        }`,
      })
    }
  }

  // ----- the owner's own list -------------------------------------------------
  if (front.featured.on && settings.featured.length) {
    const picked = settings.featured
      .map((slug) => all.find((p) => p.slug === slug))
      .filter((p): p is Post => !!p)
    const items = take(picked, front.featured.count)
    if (items.length) {
      // No href: there is no page that holds "the featured posts", and pointing this at the
      // full list made the heading a lie.
      rows.push({
        head: { label: tx.frontFeatured },
        inner: grid(front.featured.columns, items.map((p) => cardItem(p, ctx))),
      })
    }
  }

  // ----- one row per category the owner chose ---------------------------------
  for (const strip of front.strips) {
    const inCategory = all.filter((p) => p.categories.includes(strip.category))
    const items = take(inCategory, strip.count)
    if (!items.length) continue // a category that has run dry is skipped, not left empty
    rows.push({
      // The one heading that DOES name a place, so the one that stays a link.
      head: {
        label: strip.category,
        href: `/category/${termSlug(strip.category)}`,
        topics: topicLinks(inCategory, front.tagLinks),
      },
      // No category label on these cards: the row is already called that, and NYT does not
      // print the section name on every story under the section heading either.
      inner: grid(strip.columns, items.map((p) => cardItem(p, ctx, { category: false }))),
    })
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
      rows.push({
        head: { label: tx.frontPopular },
        inner: `<div class="front-lines">${items.map((p) => lineItem(p, ctx, 'h3')).join('\n')}</div>`,
      })
    }
  }

  // ----- and everything else, newest first ------------------------------------
  if (front.latest.on) {
    const items = take(all, front.latest.count)
    if (items.length) {
      rows.push({
        head: { label: tx.frontLatest },
        inner: grid(front.latest.columns, items.map((p) => cardItem(p, ctx))),
      })
    }
  }

  // The way on to the whole archive, and there is exactly one.
  //
  // It used to be a bare link below the last row: full width, no rule above it, forty pixels
  // of white on either side of it, reading as something left behind rather than as part of
  // the page. It now sits on the right of the LAST heading, which is where a newspaper prints
  // a section's continuation and where the admin's own cards already put theirs. A front page
  // whose only row is the lead has no heading to carry it and shows none — at that size the
  // list holds barely more than the page already does.
  const lastHead = rows.map((r) => r.head).filter((h): h is Head => !!h).at(-1)
  if (lastHead) lastHead.more = { href: settings.home.listPath, label: tx.frontAllPosts }

  const body = rows.length
    ? rows.map(row).join('\n')
    : `<p class="empty">${escapeHtml(tx.emptyPosts)}</p>`
  return `<div class="front front-${front.kind}">${body}</div>`
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
    jsonLd: settings.seo.autoSchema
      ? websiteSchema(settings, resolveSiteUrl(settings)) ?? undefined
      : undefined,
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
