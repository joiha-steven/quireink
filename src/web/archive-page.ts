// `/archive`: every published post on one page, newest year first.
//
// The blog had no surface that showed the whole of itself in time order. A reader could
// reach an old post through a tag, through search, or by paging back through the feed one
// screen at a time — measured on a 100-post blog, the eleventh page of the listing. None of
// those answers "what has this person written", which is the question somebody who just
// found the site is actually asking.
//
// One page, not `/archive/2024` per year. A year route would mint a URL per year with a
// dozen rows on it and split the one view that is worth having; the years here are anchors
// instead, so the jump row at the top costs no request. The rows are deliberately thin —
// date and title, no excerpt, no thumbnail — because 200 of them have to stay scannable and
// the excerpt is what the listing page is for.

import type { SiteSettings } from '@/types'
import { formatCount, t } from '@/i18n/i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { getPublicPosts } from '@/content/posts'
import { getSettings } from '@/content/settings'
import { byYear, yearAnchor, type ArchiveYear } from '@/content/archive'
import { listingPage } from '@/web/listing-page'

/**
 * `MM-DD`, and the year is the heading above it.
 *
 * Numeric on purpose. A month NAME would need the day and the month in each language's own
 * order — "19 tháng 6" against "June 19" — which is a twelfth locale string and a per-
 * language branch for a column two characters wide. The full date is on the `<time>` element
 * for anything reading the document rather than looking at it.
 */
const monthDay = (iso: string) => iso.slice(5, 10)

function yearBlock({ year, posts }: ArchiveYear, lang: SiteSettings['language']): string {
  const rows = posts.map((p) => `<li><time datetime="${escapeAttr(p.date.slice(0, 10))}">`
    + `${escapeHtml(monthDay(p.date))}</time>`
    + `<a class="link-accent" href="/${escapeAttr(p.slug)}">${escapeHtml(p.title)}</a></li>`).join('')
  return `<section class="arc-yr"><h2 id="${escapeAttr(yearAnchor(year))}">${year}`
    + `<span class="arc-count">${escapeHtml(formatCount(posts.length, lang))}</span>`
    + `</h2><ul>${rows}</ul></section>`
}

/**
 * The archive, or null when the owner has the feature switched off.
 *
 * Null rather than an empty page, so the router answers 404: a switched-off feature has no
 * URL, the same answer `/feed.xml` gives when the feed is off.
 */
export async function renderArchive(): Promise<string | null> {
  const settings = await getSettings()
  if (!settings.features.archive) return null
  const s = t(settings.language)
  const years = byYear(await getPublicPosts())

  // The jump row is a nav, not a list of chips: it is the page's own table of contents, and
  // on a blog with one year it is a single link, which is why it is dropped below two.
  const jump = years.length < 2 ? '' : `<nav class="arc-jump" aria-label="${escapeAttr(s.archiveYears)}">`
    + years.map(({ year }) => `<a class="link-accent" href="#${escapeAttr(yearAnchor(year))}">${year}</a>`).join('')
    + '</nav>'

  const body = years.length === 0
    ? `<p class="empty">${escapeHtml(s.archiveEmpty)}</p>`
    : jump + years.map((y) => yearBlock(y, settings.language)).join('')

  return listingPage({
    title: `${s.archiveTitle} · ${settings.title}`,
    description: s.archiveMeta.replace('{site}', settings.title),
    body: `<div class="listing-head"><h1>${escapeHtml(s.archiveTitle)}</h1></div>${body}`,
    canonicalPath: '/archive',
    cardTitle: s.archiveTitle,
    // No `activeHref`: the rail's year rows point at anchors WITHIN this page, so there is
    // no row that "is" this URL, and marking one would claim the reader is in a year they
    // may have scrolled past.
  })
}
