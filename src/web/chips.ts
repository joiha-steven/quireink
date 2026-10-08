// The chip row: categories and series as one row of links under the site header, for the
// width band where the rail is neither a gutter nor on the page.
//
// Between 40rem and the width where the rail's gutter fits (`breakpoint`, rail-css.ts) the
// sidebar is a closed drawer, so a tablet reader met a list of posts with no way to the
// subjects except the menu button. The row is that way in, drawn from the SAME terms and
// the SAME switches as the sidebar's blocks (`features.sidebar`, `sidebarCategories`,
// `sidebarSeries`), so what the rail would have listed is what the row lists.
//
// No new query: `getPublicTaxonomy` and `getSeriesList` are both folds over the cached public
// post list, which is exactly what `renderSidebar` reads on the same request.
//
// The rules are in the hashed sheets (chips.css.ts says which). `css` here is only the band
// for an owner who has moved the column width, whose upper edge cannot be precomputed.

import type { SiteSettings } from '@/types'
import { getPublicTaxonomy } from '@/content/posts'
import { getSeriesList } from '@/content/series'
import { termSlug } from '@/content/taxonomy'
import { LISTING_WIDTH_RATIO } from '@/web/sidebar'
import { chipsBandCss } from '@/web/chips.css'
import { t } from '@/i18n/i18n'
import { escapeAttr, escapeHtml } from '@/utils'

export type Chips = { html: string; css: string }

const NONE: Chips = { html: '', css: '' }

export async function renderChips(settings: SiteSettings, activeHref?: string): Promise<Chips> {
  if (!settings.features.sidebar) return NONE
  const wantCategories = settings.features.sidebarCategories
  const wantSeries = settings.features.sidebarSeries
  if (!wantCategories && !wantSeries) return NONE

  const [{ categories }, series] = await Promise.all([
    wantCategories ? getPublicTaxonomy() : Promise.resolve({ categories: [] }),
    wantSeries ? getSeriesList() : Promise.resolve([]),
  ])
  const links = [
    ...categories.map((c) => ({ href: `/category/${termSlug(c.name)}`, label: c.name, kind: 'category' })),
    ...series.map((x) => ({ href: `/series/${x.slug}`, label: x.name, kind: 'series' })),
  ]
  if (links.length === 0) return NONE

  const labels = t(settings.language)
  const name = [categories.length > 0 ? labels.categoriesTitle : '', series.length > 0 ? labels.seriesTitle : '']
    .filter(Boolean).join(' · ')
  const items = links.map((l) => {
    const current = l.href === activeHref
    return `<a class="chip chip-${l.kind}${current ? ' is-active' : ''}" href="${escapeAttr(l.href)}"`
      + `${current ? ' aria-current="page"' : ''}>${escapeHtml(l.label)}</a>`
  }).join('')

  // The rail's own breakpoint: the same column the listing lays out, narrowed in the
  // two-rail layout. Infinite scroll forces the single rail (see `renderSidebar`).
  const col = settings.features.infiniteScroll || settings.sidebarLayout !== 'two'
    ? settings.contentWidth
    : Math.round(settings.contentWidth * LISTING_WIDTH_RATIO)
  return {
    html: `<nav class="chips" aria-label="${escapeAttr(name)}">${items}</nav>`,
    css: chipsBandCss(col),
  }
}
