// The series box at the top of a part: which series, which part of how many, a bar that shows
// how far along it is, and the list of parts.
//
// Split out of `article.ts` (which is long enough) the way `article-blocks.ts` was.
//
// THE HEAD IS TWO ELEMENTS, the name and the part indicator, so the sheet can put the first on
// the left and the second on the right of ONE row and let the name (not the indicator) wrap
// when the card is narrow. As one run of text with a middot between them the indicator wrapped
// alone onto a second line on a phone, and in the paper look, which sets the head in
// letterspaced capitals, it sat there as an orphan.
//
// THE BAR is decoration: the part indicator already says "2/4", so it is `aria-hidden` and
// carries no text. One segment per part, those up to and including the current one filled. A
// long series is CAPPED so the bar stays one row: past `BAR_MAX` parts the bar keeps `BAR_MAX`
// segments and fills the proportional share, which is still true to within a segment.

import type { SeriesInfo } from '@/content/series'
import type { SiteLang } from '@/types'
import { langAttr } from '@/content/translations'
import { postName } from '@/content/untitled'
import { escapeAttr, escapeHtml } from '@/utils'

/** Most segments the bar draws. 40 at the narrowest card (about 250px) is 4px each with a 2px gap. */
export const BAR_MAX = 40
/** From here the gap between segments narrows, so a 30-part series still reads as segments. */
export const BAR_DENSE = 16

/** The bar's segments: `total` of them, the first `done` filled. Exported for the test. */
export function seriesBar(parts: number, current: number): string {
  const total = Math.min(parts, BAR_MAX)
  const done = parts <= BAR_MAX ? current + 1 : Math.ceil(((current + 1) / parts) * total)
  const segments = Array.from({ length: total }, (_, i) => (i < done ? '<i class="on"></i>' : '<i></i>'))
  return `<div class="series-bar${total > BAR_DENSE ? ' series-bar-dense' : ''}" aria-hidden="true">${
    segments.join('')}</div>`
}

/** The whole `<aside class="series">`, or '' for a series of one. */
export function seriesBox(
  series: SeriesInfo | null,
  slug: string,
  language: SiteLang,
  partPrefix: string,
): string {
  if (!series || series.posts.length < 2) return ''
  const items = series.posts.map((p) => (p.slug === slug
    ? `<li aria-current="page"${langAttr(p, language)}>${escapeHtml(postName(p))}</li>`
    : `<li><a href="/${escapeAttr(p.slug)}"${langAttr(p, language)}>${escapeHtml(postName(p))}</a></li>`))
  return `<aside class="series"><p class="series-head"><span class="series-name"><a class="link-accent" href="/series/${
    escapeAttr(series.slug)}">${escapeHtml(series.name)}</a></span> <span class="series-part">${
    escapeHtml(partPrefix)} ${series.currentIndex + 1}/${series.posts.length}</span></p>${
    seriesBar(series.posts.length, series.currentIndex)}<ol>${items.join('')}</ol></aside>`
}
