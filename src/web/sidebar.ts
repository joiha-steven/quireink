// The listing sidebar: the site menu, the discovery blocks and the taxonomy, in the gutter.
//
// Ported from the frozen tree's `ListingSidebar` + `SideIndex` + `SidebarMenu` + `Rail`,
// which were four components because React makes that free. The MARKUP is unchanged; the
// Tailwind utility strings became the `.rail-*` classes in `public.css.ts`, because there
// is no Tailwind here (ADR 0008) and forty utilities per row inlined into a hand-written
// sheet would be the same CSS with worse names.
//
// The geometry lives in `render/rail-css.ts` and is injected per page: the breakpoint is
// COMPUTED from the reading column and a media query cannot read a CSS variable.

import type { MenuItem, SiteSettings } from '@/types'
import { getPublicPosts, getPublicTaxonomy } from '@/content/posts'
import { getViewTotals } from '@/analytics/summary'
import { getSeriesList } from '@/content/series'
import { tagText, termSlug } from '@/content/taxonomy'
import { byYear, yearAnchor } from '@/content/archive'
import { listingRailCss } from '@/render/rail-css'
import { t } from '@/i18n/i18n'
import { escapeAttr, escapeHtml } from '@/utils'

/** Curated posts shown in the "Featured" block. */
const FEATURED_MAX = 5
/** Listing column = 80% of the post/reading width, in the two-rail layout. */
const LISTING_WIDTH_RATIO = 0.8

type IndexLink = {
  href: string
  label: string
  /** Categories show a post count; tags do not. */
  count?: number
}

/** `aria-current="page"` plus the classes that mark the row the reader is already on. */
function activeBits(href: string, activeHref: string | undefined): { attr: string; cls: string } {
  return href === activeHref
    ? { attr: ' aria-current="page"', cls: ' is-active' }
    : { attr: '', cls: '' }
}

/**
 * A heading over a vertical list of links. Used for "Most viewed" and "Featured".
 *
 * The count column is sized to the widest count on THIS list, in `ch`, which is exact
 * because the digits are tabular. A fixed em width leaves dead space on every single-digit
 * row, and no width at all lets a two-digit count push its label out of line.
 */
function indexBlock(title: string, links: IndexLink[], activeHref?: string): string {
  if (links.length === 0) return ''
  const digits = Math.max(1, ...links.map((l) => (l.count == null ? 1 : String(l.count).length)))
  const rows = links.map((l) => {
    const { attr, cls } = activeBits(l.href, activeHref)
    return `<li><a class="rail-row link-accent t-small${cls}" href="${escapeAttr(l.href)}"${attr}>`
      + `<span>${escapeHtml(l.label)}</span>`
      + (l.count == null ? '' : `<span class="rail-count">${l.count}</span>`)
      + '</a></li>'
  }).join('')
  return `<div><h2>${escapeHtml(title)}</h2><ul style="--count-w:${digits}ch">${rows}</ul></div>`
}

/**
 * A heading over a wrapped run of words. Categories keep a trailing count; tags do not and
 * are lowercased. No chips, no boxes: a long list has to stay compact in a 250px gutter.
 */
function termCloud(
  title: string, links: IndexLink[], opts: { lower?: boolean } = {}, activeHref?: string,
): string {
  if (links.length === 0) return ''
  const items = links.map((l) => {
    const { attr, cls } = activeBits(l.href, activeHref)
    return `<a class="link-accent t-small${cls}" href="${escapeAttr(l.href)}"${attr}>`
      // A tag's spaces become hyphens so each one is a single unbroken token: a cloud of
      // two-word tags reads as a sentence otherwise, with no way to see where one ends.
      + escapeHtml(opts.lower ? tagText(l.label) : l.label)
      // The parentheses are in the sheet, not here: the IDE chrome swaps them for square
      // brackets, and a renderer that types them makes that impossible.
      + (l.count == null ? '' : `<span class="term-count">${l.count}</span>`)
      + '</a>'
  }).join('')
  return `<div><h2>${escapeHtml(title)}</h2>`
    + `<div class="rail-tags${opts.lower ? ' lower' : ''}">${items}</div></div>`
}

/**
 * The site menu as the TOP block of the rail, moved out of the header by the frozen tree.
 * Headingless: the nav leads the rail. Rows reuse `rail-row`, so they range right in the
 * desktop gutter and left in the mobile drawer with no per-surface handling.
 */
export function menuBlock(items: MenuItem[], label: string): string {
  if (items.length === 0) return ''
  const rows = items.map((item) => {
    // An external link opens in a new tab; an internal one does not. `noopener` because
    // `target=_blank` otherwise hands the opened page a handle on this one.
    const external = /^https?:\/\//.test(item.href)
    const rel = external ? ' target="_blank" rel="noopener"' : ''
    return `<li><a class="rail-row link-accent t-small" href="${escapeAttr(item.href || '/')}"${rel}>`
      + `<span>${escapeHtml(item.label)}</span></a></li>`
  }).join('')
  return `<nav aria-label="${escapeAttr(label)}"><ul>${rows}</ul></nav>`
}

const rail = (variant: string, blocks: string) =>
  `<aside class="rail${variant}"><div class="rail-inner">${blocks}</div></aside>`

export type Sidebar = {
  /** The rail markup, or '' when there is nothing to show. */
  html: string
  /**
   * Rules the page must inject, or '' when the layout's own single-rail geometry serves.
   * The two-rail layout also narrows `--shell-w`, which is why this is not a fixed sheet.
   */
  css: string
}

/**
 * Build the rail for a listing page.
 *
 * `activeHref` marks the row a category or tag page is already showing. Returns empty
 * markup rather than an empty rail when the owner has configured nothing into it: an
 * empty gutter box with a divider beside it reads as a rendering fault.
 */
export async function renderSidebar(
  settings: SiteSettings, activeHref?: string,
): Promise<Sidebar> {
  const none: Sidebar = { html: '', css: '' }
  // The sidebar switch owns the DISCOVERY blocks — categories, tags, the years. It does not
  // own the owner's menu, which is the site's navigation and has to be reachable from every
  // page. Switching it off used to take the menu with it and put it nowhere else: measured
  // on 2026-09-01, four configured links appearing zero times in the served HTML. What is
  // left when it is off is a rail carrying the menu and nothing but.
  if (!settings.features.sidebar) {
    const labels = t(settings.language)
    return settings.menu.length === 0
      ? none
      : { html: rail('', menuBlock(settings.menu, labels.menu)), css: '' }
  }

  const [{ categories, tags }, posts, viewTotals, allSeries] = await Promise.all([
    getPublicTaxonomy(), getPublicPosts(), getViewTotals(),
    // Only fetched when the block is on. A series list is its own query and the sidebar
    // renders on every listing page.
    settings.features.sidebarSeries
      ? getSeriesList()
      : Promise.resolve([] as Awaited<ReturnType<typeof getSeriesList>>),
  ])
  const titleBySlug = new Map(posts.map((p) => [p.slug, p.title]))
  const labels = t(settings.language)

  // Most viewed: public posts ranked by all-time views (`viewTotals` is keyed by path).
  // The count is owner-set, and 0 hides the block.
  const mostViewed = posts
    .map((p) => ({ slug: p.slug, title: p.title, views: viewTotals[`/${p.slug}`] ?? 0 }))
    .filter((p) => p.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, settings.mostViewedCount)
    .map((p) => ({ href: `/${p.slug}`, label: p.title }))

  // Featured: the owner's order, keeping only slugs that are still public.
  const featured = settings.featured
    .filter((slug) => titleBySlug.has(slug))
    .slice(0, FEATURED_MAX)
    .map((slug) => ({ href: `/${slug}`, label: titleBySlug.get(slug) ?? '' }))

  // The years, which are the only axis in the rail that is not a subject. Every row points
  // at an anchor inside `/archive` rather than at a page of its own: one document holds all
  // of them, so a year is a jump, not a fetch. Read off the SAME public post list the rest
  // of this file uses, so a year that exists only on a draft never appears.
  // Two switches, and they are not the same question. `archive` owns the /archive ROUTE —
  // off means the page 404s, so the years would point at nothing. `sidebarArchive` owns the
  // BLOCK: the years leave the rail while the page they link to stays reachable.
  const years = settings.features.archive && settings.features.sidebarArchive
    ? byYear(posts).map(({ year, posts: inYear }) => ({
      href: `/archive#${yearAnchor(year)}`, label: String(year), count: inYear.length,
    }))
    : []
  const shownCategories = settings.features.sidebarCategories ? categories : []
  const shownTags = settings.features.sidebarTags ? tags : []

  // Counted on what will actually RENDER, not on what exists: with every block switched
  // off the rail is an empty box with a divider beside it, which reads as a fault.
  if (settings.menu.length === 0 && shownCategories.length === 0 && allSeries.length === 0
    && mostViewed.length === 0 && featured.length === 0 && shownTags.length === 0
    && years.length === 0) return none

  const discovery = indexBlock(labels.mostViewedTitle, mostViewed, activeHref)
    + indexBlock(labels.featuredTitle, featured, activeHref)
  // Categories, then series, then tags. A series is a reading ORDER rather than a subject,
  // so it sits below the subjects and above the tags, which are the loosest of the three.
  // It carries a count for the same reason a category does: how long is this.
  const nav = termCloud(labels.categoriesTitle,
    shownCategories.map((c) => ({ href: `/category/${termSlug(c.name)}`, label: c.name, count: c.count })),
    {}, activeHref)
    + termCloud(labels.seriesTitle,
      allSeries.map((x) => ({ href: `/series/${x.slug}`, label: x.name, count: x.count })),
      {}, activeHref)
    // Above the tags, not below them: it is a short, bounded, counted list like the two
    // above it, and a tag cloud is the one block on this rail with no ceiling on its length.
    // Under it, the years would sit below a hundred words on a real blog.
    + termCloud(labels.archiveTitle, years, {}, activeHref)
    + termCloud(labels.tagsTitle,
      shownTags.map((tag) => ({ href: `/tag/${termSlug(tag.name)}`, label: tag.name })),
      { lower: true }, activeHref)

  // Infinite scroll forces the single left rail: the right gutter is taken by the
  // timeline, so a two-rail split cannot apply.
  const layout = settings.features.infiniteScroll ? 'single' : settings.sidebarLayout

  // Single (the default): one left rail, everything stacked, full-width column. The
  // layout's own `singleRailCss` already positions `.rail`, so this needs no extra sheet.
  if (layout !== 'two') {
    return { html: rail('', menuBlock(settings.menu, labels.menu) + discovery + nav), css: '' }
  }

  // Two: discovery left, nav right, narrower column. The right rail is also the mobile
  // drawer, so it carries a desktop-hidden copy of the discovery blocks — without it the
  // drawer would lose them entirely on a phone, where the left rail does not exist.
  return {
    html: rail(' rail-left', discovery)
      + rail(' rail-right', menuBlock(settings.menu, labels.menu)
        + `<div class="drawer-only">${discovery}</div>` + nav),
    css: listingRailCss(Math.round(settings.contentWidth * LISTING_WIDTH_RATIO)),
  }
}
