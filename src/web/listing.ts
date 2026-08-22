// Everything that renders a LIST of posts: the home page, its pagination, category and
// tag pages, series pages and search results.
//
// One renderer for all of them. The frozen tree had a component per surface and the
// differences between them turned out to be the heading and the empty-state line, which is
// the kind of duplication that drifts: a card gains a field on the home page and quietly
// lacks it under a tag.

import type { Post } from '@/types'
import type { SiteSettings } from '@/types'
import { formatDate, formatMonth, t } from '@/i18n/i18n'
import type { Dict } from '@/locales/types'
import { termSlug } from '@/content/taxonomy'
import type { Paged } from '@/content/paginate'
import { escapeAttr, escapeHtml } from '@/utils'

const yearOf = (iso: string) => iso.slice(0, 4)
const monthOf = (iso: string) => iso.slice(0, 7)

type CardOptions = {
  /** The newest post on page 1 takes the h1 role, so a list has one clear entry point. */
  lead?: boolean
  /** First card of a month: its marker goes out in the gutter, level with the card. */
  month?: string
  /** Past the first page: hidden by the island until the reader scrolls that far. */
  more?: boolean
}

/**
 * One card. Metadata only: a listing never loads a body.
 *
 * The ORDER is load-bearing and was wrong: the meta line sits ABOVE the title, not below.
 * That is the frozen tree's `PostCard` and it is what the owner reads first — the date and
 * the reading time frame the headline rather than trailing it.
 *
 * Sizes come from the type roles, never a literal, so a listing and an article agree
 * without anyone keeping two numbers in step.
 */
function card(post: Post, settings: SiteSettings, opts: CardOptions = {}): string {
  const tx = t(settings.language)
  const { readingTime, categoryLabel } = settings.features
  const category = categoryLabel ? post.categories[0] : undefined
  const categoryLink = category
    ? `<a class="link-accent" href="/category/${escapeAttr(termSlug(category))}">${escapeHtml(category)}</a> · `
    : ''
  // The suffix comes from the locale table. It read a hardcoded " min" here, so a
  // Vietnamese blog said "38 min" where every other surface said "38 phút đọc".
  // The figure is wrapped and the unit is not, so the IDE chrome can set the literal apart.
  const minutes = readingTime && post.readingMinutes
    ? ` · <span class="meta-part"><span class="num">${post.readingMinutes}</span> ${escapeHtml(tx.readingSuffix)}</span>`
    : ''
  const Title = opts.lead ? 'h1' : 'h2'
  const size = opts.lead ? 'fs-h1' : 'fs-h2'
  // A month marker is a child of that month's first card, so it flows with the card and
  // the timeline needs no measurement and no script. CSS hides it below the breakpoint.
  const mark = opts.month
    ? `<span class="tl-mark t-small" aria-hidden="true"><span class="tl-dot"></span>${escapeHtml(opts.month)}</span>`
    : ''

  // `reveal` eases the card in as it scrolls into view, and is fully visible when motion
  // is off or unsupported (pure CSS, `animation-timeline: view()`).
  // `data-more` marks a card past the first page. The island hides those and reveals them
  // a chunk at a time; with no JavaScript nothing hides them and the whole archive renders.
  return `<article class="reveal"${opts.lead ? ' data-lead' : ''}${opts.more ? ' data-more' : ''}>${mark}
<p class="t-small text-meta">${categoryLink}<time class="meta-part" datetime="${escapeAttr(post.date)}">${escapeHtml(formatDate(post.date, settings.language, settings.timezone))}</time>${minutes}</p>
<${Title} class="reading-font mt-2 ${size} font-semibold"><a class="link-accent" href="/${escapeAttr(post.slug)}">${escapeHtml(post.title)}</a></${Title}>
${post.excerpt ? `<p class="reading-font mt-3 t-body text-text">${escapeHtml(post.excerpt)}</p>` : ''}
</article>`
}

/**
 * Prev/next links only. The frozen tree rendered numbered pages; deep page numbers are
 * navigation nobody uses and every one of them is a URL a crawler will walk, so this is a
 * deliberate simplification rather than an omission. Recorded in the ledger.
 */
function pager(paged: Paged<Post>, basePath: string, tx: Dict): string {
  if (paged.totalPages <= 1) return ''
  const href = (n: number) => (n === 1 ? basePath || '/' : `${basePath}/page/${n}`)
  const prev = paged.page > 1
    ? `<a rel="prev" href="${escapeAttr(href(paged.page - 1))}">${escapeHtml(tx.pagerNewer)}</a>`
    : '<span></span>'
  const next = paged.page < paged.totalPages
    ? `<a rel="next" href="${escapeAttr(href(paged.page + 1))}">${escapeHtml(tx.pagerOlder)}</a>`
    : '<span></span>'
  return `<nav class="pager">${prev}<span class="pager-count">${paged.page} / ${paged.totalPages}</span>${next}</nav>`
}

/**
 * The feed, grouped by year, with a date timeline in the right gutter.
 *
 * Each year's group carries a STICKY marker that pins to the top of the gutter until the
 * next year pushes it out, and each month's first card carries its own marker. Both are
 * ordinary children in the flow, positioned out into the gutter by `timelineCss` — so the
 * years stay level with their posts with no JavaScript and no measurement.
 */
function timeline(posts: Post[], settings: SiteSettings, lead: boolean): string {
  // Everything past the first page is a chunk the island reveals on scroll. The frozen tree
  // held the tail in React state and revealed `postsPerPage` at a time; this renders it and
  // hides it instead, which reaches the same feed without giving up the no-script archive.
  const chunk = Math.max(1, settings.postsPerPage)
  const groups: { year: string; items: { post: Post; i: number }[] }[] = []
  posts.forEach((post, i) => {
    const year = yearOf(post.date)
    const last = groups[groups.length - 1]
    if (last && last.year === year) last.items.push({ post, i })
    else groups.push({ year, items: [{ post, i }] })
  })

  return groups.map((g) => {
    const cards = g.items.map(({ post, i }) => {
      // A month marker on the first card of each month, EXCEPT the year's own first
      // month, which the sticky year marker already covers.
      const prev = posts[i - 1]
      const firstOfYear = !prev || yearOf(prev.date) !== g.year
      const firstOfMonth = !prev || monthOf(prev.date) !== monthOf(post.date)
      return card(post, settings, {
        lead: lead && i === 0,
        month: firstOfMonth && !firstOfYear ? formatMonth(post.date, settings.language, settings.timezone) : undefined,
        more: i >= chunk,
      })
    }).join('\n')
    return `<div class="tl-yr"><div class="tl-year" aria-hidden="true">`
      + `<span class="tl-year-tag"><span class="tl-dot"></span>${g.year}</span></div>${cards}</div>`
  }).join('\n')
}

export type ListingView = {
  /**
   * The h1 above the list, as already-escaped markup. Absent on the home page, where the
   * site header says it. A taxonomy page reads "Danh muc: Kinh te" — the label, then the
   * term — so the caller builds it rather than this taking two fields and a flag.
   */
  heading?: string
  /** A line under the heading: the term description, the series blurb, the result count. */
  subheading?: string
  paged: Paged<Post>
  /** Base for pagination links: '' for home, '/category/x' for a term. */
  basePath: string
  /** What to say when there is nothing. */
  empty: string
  /**
   * Render the whole list as a year timeline with no pager. Set by the routes the owner's
   * `features.infiniteScroll` applies to; a series or a search result is never one.
   */
  timeline?: boolean
}

export function renderListing(view: ListingView, settings: SiteSettings): string {
  const head = view.heading
    ? `<header class="listing-head"><h1>${view.heading}</h1>${
        view.subheading ? `<p class="meta">${escapeHtml(view.subheading)}</p>` : ''
      }</header>`
    : ''
  if (view.paged.items.length === 0) {
    return `${head}<p class="empty">${escapeHtml(view.empty)}</p>`
  }
  // Only page 1 of the home feed promotes its newest post, and only when the owner asked
  // for it. A category archive has no lead post.
  const lead = settings.features.leadPost && view.basePath === '' && view.paged.page === 1
  if (view.timeline) {
    // The <noscript> is the safety catch on the chunking: the island sets `data-chunked` on
    // <html>, which hides the tail, and this undoes it where no island can ever run. Hiding
    // content is only ever safe when the thing that undoes it is guaranteed to exist.
    const guard = '<noscript><style>html[data-chunked] .post-list article[data-more]'
      + '{display:block}</style></noscript>'
    return `${head}<div class="post-list tl-feed">${timeline(view.paged.items, settings, lead)}</div>${guard}`
  }
  const body = view.paged.items
    .map((p, i) => card(p, settings, { lead: lead && i === 0 }))
    .join('\n')
  return `${head}<div class="post-list">${body}</div>${pager(view.paged, view.basePath, t(settings.language))}`
}
