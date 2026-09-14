// THE PIECE INDEX: every piece, and the way into its own numbers (ADR 0054).
//
// The top table is the screen's default face and stays that way — it answers "what is doing
// well", which is the question most days. This answers the other one, "how is THIS piece
// doing", for a piece that is not in the top ten and never will be. Before it existed the only
// door to a drill-down was a row in that table, so the fortieth piece had no route to its own
// page at all while the number it wanted was already computed.
//
// Deliberately not a ranking and deliberately not capped: a "top 50" here would put the same
// wall one row further down. It is ordered by views because that is the useful default order,
// and the FILTER is the control — type three letters and the list is the piece you meant.
//
// THE JOIN MOVED TO THE SERVER with the conversion, and that is the one change of substance.
// React joined `pieces` to `titles` on every render so that a piece with no views still had a
// row; the server does it once, into markup, and the island never builds a row at all.
//
// ⚠️ TEN ROWS AND A WAY TO SEE THE REST, with no scroll box of its own. It was
// `max-h-96 overflow-y-auto`: a 384px window inside a page that already scrolls, so a wheel
// over the table moved the table and a wheel two pixels left moved the page, and the box ended
// wherever 384px happened to fall — measured, through the middle of a row's glyphs.
import type { SiteLang } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { PieceStat } from '@/analytics/types'
import { escapeAttr, escapeHtml } from '@/utils'
import { formatCount } from '@/i18n/format'
import { CONTROL_SM, TABLE_SCROLL, THEAD, TROW } from '@/admin-shared/kit'
import { TAP } from '@/admin-shared/scale'
import { fold } from '@/admin-shared/fold'
import { TOP_N } from '@/admin-shared/analytics'
import { detailHref } from '@/web/admin/screens/analytics-cards'

const QUIET_BUTTON = 'text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'

type Row = { path: string; title: string; views: number; visitors: number }

/**
 * Every piece with a title, plus every path somebody read that has no title of its own — a home
 * page, an archive, a slug since renamed. Pieces with no views in the window are listed at
 * zero: that a post was read by nobody this week is an answer, and leaving it out would make
 * the list quietly agree with the top table about which pieces exist.
 */
function rowsOf(pieces: PieceStat[], titles: Record<string, string>): Row[] {
  const stats = new Map(pieces.map((p) => [p.path, p]))
  const rows: Row[] = Object.entries(titles).map(([path, title]) => ({
    path,
    title,
    views: stats.get(path)?.views ?? 0,
    visitors: stats.get(path)?.visitors ?? 0,
  }))
  for (const p of pieces) {
    if (!(p.path in titles)) rows.push({ path: p.path, title: p.path, views: p.views, visitors: p.visitors })
  }
  return rows.sort((a, b) => b.views - a.views || a.title.localeCompare(b.title))
}

export function pieceIndex(t: AdminStrings, lang: SiteLang, pieces: PieceStat[], titles: Record<string, string>, range: string): string {
  const rows = rowsOf(pieces, titles)
  const n = (x: number): string => escapeHtml(formatCount(x, lang))

  // `data-find` is FOLDED, the way the log screen folds and unlike the comments queue: this box
  // searches the owner's own titles, where typing "be rong" for "Bề rộng" is what people
  // actually do. The island folds the needle with the same function.
  // ⚠️ `data-last` MARKS THE LAST ROW SHOWING, which is not `:last-child`. `TROW` drops the
  // hairline under the final row, and the final row of this table is number forty-one standing
  // hidden behind thirty others — so the ten on screen ended with a rule under them that the
  // React face never drew, between the last title and the "Show all" link. `admin.css` keys
  // the rule off this attribute and the island moves it as the filter opens and closes.
  const lastShown = Math.min(TOP_N, rows.length) - 1
  const body = rows.map((r, i) =>
    `<tr data-piece data-rank="${i}"${i === lastShown ? ' data-last' : ''}`
    + ` data-find="${escapeAttr(fold(`${r.title} ${r.path}`))}"`
    + ` class="${TROW}"${i < TOP_N ? '' : ' hidden'}>`
    + `<td class="w-full max-w-0 px-4 py-2.5">`
    + `<a href="${escapeAttr(detailHref(r.path, range))}" data-piece-row`
    + ` class="block truncate text-neutral-700 hover:underline dark:text-neutral-200"`
    + ` title="${escapeAttr(r.path)}">${escapeHtml(r.title)}</a></td>`
    + `<td class="w-px px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-neutral-600 dark:text-neutral-300">${n(r.views)}</td>`
    + `<td class="w-px px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-neutral-500 dark:text-neutral-400">${n(r.visitors)}</td>`
    + `</tr>`).join('')

  const table = `<div data-piece-table class="${TABLE_SCROLL}"${rows.length ? '' : ' hidden'}>`
    + `<table class="w-full text-sm"><thead class="${THEAD}"><tr>`
    + `<th class="w-full px-4 py-2.5 font-medium">${escapeHtml(t.analyticsColPage)}</th>`
    + `<th class="w-px px-4 py-2.5 text-right font-medium">${escapeHtml(t.analyticsViews)}</th>`
    + `<th class="w-px px-4 py-2.5 text-right font-medium">${escapeHtml(t.analyticsVisitors)}</th>`
    + `</tr></thead><tbody>${body}</tbody></table></div>`

  // The two buttons are never both useful, and neither is useful while something is typed — a
  // search already shows everything it matched. `Show all` can only ever name the FULL count,
  // because it is hidden the moment the list is narrowed, so the island never rewrites it.
  const more = rows.length > TOP_N
    ? `<div data-piece-more class="px-4 pb-3"><button type="button" data-piece-showall`
      + ` class="${TAP} ${QUIET_BUTTON}">${escapeHtml(t.analyticsShowAll.replace('{n}', formatCount(rows.length, lang)))}</button></div>`
      + `<div data-piece-fewer class="px-4 pb-3" hidden><button type="button" data-piece-showfewer`
      + ` class="${TAP} ${QUIET_BUTTON}">${escapeHtml(t.analyticsShowFewer)}</button></div>`
    : ''

  return `<div data-piece-index class="border-b border-neutral-100 dark:border-neutral-800">`
    + `<div class="flex flex-wrap items-center gap-3 px-4 py-3">`
    + `<h2 class="text-sm font-medium text-neutral-900 dark:text-white">${escapeHtml(t.analyticsPieces)}</h2>`
    + `<span data-piece-count class="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">${n(rows.length)}</span>`
    + `<input type="search" data-piece-search placeholder="${escapeAttr(t.analyticsFindPiece)}"`
    + ` aria-label="${escapeAttr(t.analyticsFindPiece)}" class="${CONTROL_SM} ml-auto w-full min-w-0 sm:w-56">`
    + `</div>`
    + `<p data-piece-none class="px-4 pb-4 text-sm text-neutral-500 dark:text-neutral-400"${rows.length ? ' hidden' : ''}>`
    + `${escapeHtml(t.analyticsNoData)}</p>`
    + table + more + `</div>`
}
