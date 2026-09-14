// The analytics overview's three fixed sections: who is reading right now, what the blog cost
// to deliver, and the top pages (ADR 0054).
//
// Everything here is drawn ONCE and never changes, with one exception that the exception
// proves: the live strip. Its numbers arrive from the network every ten seconds, so it is the
// only place on this screen where an island writes a value rather than flipping an attribute.
// Even there, every CLASS is written by the server and the island only unhides what it needs —
// a lamp whose emerald is typed into a `.ts` file in `src/admin/island` is a lamp that drifts
// from `LAMP_HUES` with nothing to catch it.
import type { SiteLang } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { AnalyticsSummary, RightNow, TopPage } from '@/analytics/types'
import { escapeAttr, escapeHtml, formatBytes, formatDateTimeShort } from '@/utils'
import { formatCount } from '@/i18n/format'
import { TABLE_SCROLL, THEAD, TROW } from '@/admin-shared/kit'
import { NOTE_TEXT } from '@/admin-shared/scale'
import { formatDuration } from '@/admin-shared/analytics'
import { lamp } from '@/web/admin/kit'
import { statCard } from '@/web/admin/kit-figures'

/** The address of one page's drill-down, at the window the reader is already looking at. */
export const detailHref = (path: string, range: string): string =>
  `/admin/analytics?path=${encodeURIComponent(path)}&range=${range}`

/**
 * THE LIVE STRIP: who is on the site right now.
 *
 * Both faces ship in the markup and the island unhides one, which is the same bargain the
 * greeting makes — but for a different reason. The greeting's fact is one the SERVER cannot
 * know; this one is a fact that goes stale while you look at it. The first paint is truthful
 * because `rightNow` came with the page; the poll only keeps it that way.
 *
 * ⚠️ THE NAMES COME FROM `titles`, NOT FROM THE ISLAND. The island has its own copy of the
 * map, read off the piece index, but it only runs on the ten-second poll — so leaving the
 * first paint to it printed `/the-em-the-en-and-three-dashes` where the React face printed
 * "The em, the en, and three dashes", for the ten seconds somebody is most likely looking.
 * Caught by diffing the two builds' text, not by the tour: the strip was structurally perfect
 * and saying the wrong thing.
 */
export function liveNow(t: AdminStrings, lang: SiteLang, now: RightNow, titles: Record<string, string>): string {
  const live = now.visitors > 0
  const reading = t.analyticsNowReading.replace('{n}', formatCount(now.visitors, lang))
  // `{n}` stays unreplaced in the island's copy: which count depends on what the poll returns.
  const words = escapeAttr(JSON.stringify({ reading: t.analyticsNowReading, quiet: t.analyticsNowQuiet }))
  // The separator lives INSIDE the span it precedes, as it did in React: pulled out to a bare
  // text node the glyphs land in the same places and the span boundary does not, which is one
  // more thing for the next comparison of these two builds to have to explain away.
  const named = (path: string, visitors: number, sep: string): string =>
    `<span data-live-page data-path="${escapeAttr(path)}">${sep}${escapeHtml(titles[path] ?? path)}`
    + (visitors > 1 ? `<span class="tabular-nums"> (${escapeHtml(formatCount(visitors, lang))})</span>` : '')
    + `</span>`

  return `<div data-live data-live-words="${words}"`
    + ` class="flex items-baseline gap-2 border-b border-neutral-100 px-4 py-2 text-xs dark:border-neutral-800">`
    + `<span class="flex shrink-0 self-center">`
    // Green and breathing while somebody is there, `off` when the site is quiet. Quiet is not
    // a fault, and amber here would say it was.
    + lamp({ state: 'good', title: reading, pulse: true, attrs: `data-live-lamp="on"${live ? '' : ' hidden'}` })
    + lamp({ state: 'off', title: t.analyticsNowQuiet, attrs: `data-live-lamp="off"${live ? ' hidden' : ''}` })
    + `</span>`
    + `<span data-live-count class="whitespace-nowrap text-neutral-700 dark:text-neutral-200"${live ? '' : ' hidden'}>`
    + `${escapeHtml(reading)}</span>`
    + `<span data-live-pages class="truncate text-neutral-500 dark:text-neutral-400"${live ? '' : ' hidden'}>`
    + now.pages.slice(0, 3).map((p, i) => named(p.path, p.visitors, i > 0 ? ' · ' : '')).join('')
    + `</span>`
    + `<span data-live-quiet class="text-neutral-500 dark:text-neutral-400"${live ? ' hidden' : ''}>`
    + `${escapeHtml(t.analyticsNowQuiet)}</span></div>`
}

/**
 * DELIVERY: what readers downloaded, and whether this process's page cache is doing anything.
 *
 * Both numbers are easy to read as something bigger than they are, so each one carries the
 * sentence saying what it is NOT, on the page, in the owner's language. The bytes are what
 * readers' BROWSERS reported — a bot, a feed reader and anyone with JavaScript off download
 * bytes and report none — so nothing here may call it bandwidth. The cache is THIS PROCESS's
 * Map since boot, and only for requests that got past the CDN.
 *
 * NO horizontal padding on the grid: `statCard bare` carries its own `px-5`, and a `px-4` here
 * put the two figures 36px in while every other row on the sheet sits at 20px.
 */
export function deliveryPanel(t: AdminStrings, lang: SiteLang, summary: AnalyticsSummary): string {
  const { transfer, cache } = summary
  if (!transfer && !cache) return ''
  const cells: string[] = []

  if (transfer) {
    const avg = transfer.measured > 0 ? `${t.analyticsBytesAvg} ${formatBytes(transfer.avgBytes)} · ` : ''
    cells.push(`<div>` + statCard({
      bare: true,
      label: t.analyticsBytesTotal,
      value: transfer.measured > 0 ? formatBytes(transfer.totalBytes) : '—',
      sub: `${avg}${t.analyticsBytesMeasured} ${formatCount(transfer.measured, lang)} ${t.analyticsBytesNote}`,
    }) + `<p class="${NOTE_TEXT} mt-2 px-5">${escapeHtml(t.analyticsBytesCaveat)}</p></div>`)
  }

  if (cache) {
    const requests = cache.hits + cache.misses
    // No requests yet means no answer, not 0%. A freshly booted process has served nothing,
    // and "served from cache · 0/0" reads as a broken counter rather than as an honest nothing.
    const rate = requests > 0 ? Math.round((cache.hits / requests) * 100) : null
    const fraction = rate === null
      ? ''
      : `${t.analyticsCacheHits} · ${formatCount(cache.hits, lang)}/${formatCount(requests, lang)} · `
    cells.push(`<div>` + statCard({
      bare: true,
      label: t.analyticsCache,
      value: rate === null ? '—' : `${rate}%`,
      sub: `${fraction}${t.analyticsCacheSince} ${formatDateTimeShort(new Date(cache.since).toISOString())}`,
    }) + `<p class="${NOTE_TEXT} mt-2 px-5">${escapeHtml(t.analyticsCacheNote)}</p></div>`)
  }

  return `<div class="grid gap-6 border-b border-neutral-100 pb-4 sm:grid-cols-2 dark:border-neutral-800">`
    + cells.join('') + `</div>`
}

/** An em-dash, never a zero: nothing measured is a different fact from "they left at once". */
const dwell = (ms?: number | null): string => (ms == null ? '—' : formatDuration(ms))
const depth = (pct?: number | null): string => (pct == null ? '—' : `${pct}%`)

const NUM = 'w-px px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-neutral-600 dark:text-neutral-300'
const NUM_QUIET = 'w-px px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-neutral-500 dark:text-neutral-400'
const TITLE_CELL = 'block truncate text-neutral-700 hover:underline dark:text-neutral-200'

/**
 * TOP PAGES, twice: a table from 640px up and a list of cards below it.
 *
 * ⚠️ A TABLE BELOW 640px IS A LIST OF CARDS. Five columns in 358px gives each number 41px to
 * hold "1,522" and leaves the title 120px, so the useful half of every row is truncated and the
 * other half unreadable — measured at 390 on 2026-09-07. Scrolling it sideways is the other
 * answer and it is worse: the titles scroll away from the numbers they name.
 *
 * `w-full` on the title column and `w-px` on the four numbers is how an auto-layout table is
 * told where the slack goes. `max-w-0` alone collapses the column it is on, so it needs
 * `w-full` beside it to mean "take the rest, then truncate".
 */
export function topPages(t: AdminStrings, lang: SiteLang, pages: TopPage[], titles: Record<string, string>, range: string): string {
  const n = (x: number): string => escapeHtml(formatCount(x, lang))
  const name = (path: string): string => escapeHtml(titles[path] ?? path)
  const head = [t.analyticsViews, t.analyticsVisitors, t.analyticsColTime, t.analyticsColDepth]

  const table = `<div class="hidden border-b border-neutral-100 sm:block dark:border-neutral-800">`
    + `<div class="${TABLE_SCROLL}"><table class="w-full text-sm"><thead class="${THEAD}"><tr>`
    + `<th class="w-full px-4 py-2.5 font-medium">${escapeHtml(t.analyticsColPage)}</th>`
    + head.map((h) => `<th class="w-px px-4 py-2.5 text-right font-medium">${escapeHtml(h)}</th>`).join('')
    + `</tr></thead><tbody>`
    + pages.map((p) => `<tr class="${TROW}"><td class="w-full max-w-0 px-4 py-2.5">`
      + `<a href="${escapeAttr(detailHref(p.path, range))}" class="${TITLE_CELL}" title="${escapeAttr(p.path)}">${name(p.path)}</a></td>`
      + `<td class="${NUM}">${n(p.views)}</td><td class="${NUM}">${n(p.visitors)}</td>`
      + `<td class="${NUM_QUIET}">${escapeHtml(dwell(p.avgDwellMs))}</td>`
      + `<td class="${NUM_QUIET}">${escapeHtml(depth(p.avgDepth))}</td></tr>`).join('')
    + `</tbody></table></div></div>`

  // The four figures under the title, each keeping its name: a number with no column head over
  // it is a number nobody can read.
  const cards = `<ul class="border-b border-neutral-100 sm:hidden dark:border-neutral-800">`
    + pages.map((p) => `<li class="border-b border-neutral-100 px-4 py-3 last:border-b-0 dark:border-neutral-800">`
      + `<a href="${escapeAttr(detailHref(p.path, range))}" class="${TITLE_CELL} text-sm" title="${escapeAttr(p.path)}">${name(p.path)}</a>`
      + `<dl class="mt-1.5 grid grid-cols-4 gap-2 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">`
      + [n(p.views), n(p.visitors), escapeHtml(dwell(p.avgDwellMs)), escapeHtml(depth(p.avgDepth))]
        .map((v, i) => `<div><dt>${escapeHtml(head[i] ?? '')}</dt>`
          + `<dd class="text-neutral-700 dark:text-neutral-300">${v}</dd></div>`).join('')
      + `</dl></li>`).join('')
    + `</ul>`

  return table + cards
}
