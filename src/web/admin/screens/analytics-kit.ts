// The two drawings the analytics overview and the per-page drill-down both make, as HTML the
// server sends (ADR 0054). Every LABEL comes in as an argument, so the two screens cannot
// drift into two vocabularies — the rule the React `analytics-kit.tsx` was written under, and
// the only thing that came across from it unchanged.
//
// ⚠️ THE CHART HERE IS NOT THE DASHBOARD'S SPARKLINE, and merging them would be a loss. That
// one is a single series in `currentColor` at 48px, drawn to be glanced at inside a card; this
// is two series, a filled area, a printed peak and a hover column per bucket at 144px, drawn
// to be READ. They answer different questions at different sizes and the only thing they share
// is the word "chart".
//
// These live beside the screens rather than in `web/admin/kit.ts` for the reason that file
// states about itself: a primitive arrives there when it is the admin's vocabulary, and a
// bar list with a proportional ground is this screen's, exactly as `sparkline` is the
// dashboard's.
import type { SiteLang } from '@/types'
import type { DailyPoint } from '@/analytics/types'
import { escapeAttr, escapeHtml } from '@/utils'
import { formatCount } from '@/i18n/format'
import { CARD } from '@/admin-shared/kit'
import { trendOf } from '@/admin-shared/analytics'
import { formatDateShort } from '@/admin-shared/when'

/** The trend arrow that sits inside a figure. Empty when an arrow would be a lie — see `trendOf`. */
export function trendMark(cur: number, prev?: number): string {
  const t = trendOf(cur, prev)
  if (!t) return ''
  return `<span class="ml-2 align-middle text-xs font-medium text-neutral-500 dark:text-neutral-400">`
    + `${t.up ? '▲' : '▼'} ${escapeHtml(t.label)}</span>`
}

export type BarRow = { key: string; label: string; value: number; href?: string }

/**
 * A horizontal bar list: the proportional bar is the row's own GROUND, the label and the count
 * sit on it. Bars scale to the biggest value in the list, never to a global maximum — a column
 * of four bars all at 3% because one other list has a big number in it says nothing.
 *
 * `bare` inside the one-sheet page: the sheet draws the edges and hairlines divide, so the list
 * brings no card of its own.
 */
export function barList({ title, rows, unit, empty, lang, bare = false }: {
  title: string
  rows: BarRow[]
  unit: string
  empty: string
  lang: SiteLang
  bare?: boolean
}): string {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1
  const body = rows.length === 0
    ? `<p class="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">${escapeHtml(empty)}</p>`
    : `<ul class="space-y-1">` + rows.map((r) => {
      // A floor of 2%, so a row with one visitor against a row with nine hundred still has a
      // mark under it. A bar of zero width reads as a missing row rather than as a small one.
      const width = Math.max(2, (r.value / max) * 100)
      const inner = `<div class="absolute inset-y-0 left-0 rounded-md bg-neutral-100 dark:bg-neutral-800" style="width: ${width}%"></div>`
        + `<div class="relative flex items-center justify-between gap-3 px-2.5 py-1.5 text-sm">`
        + `<span class="min-w-0 truncate text-neutral-700 dark:text-neutral-200">${escapeHtml(r.label)}</span>`
        + `<span class="shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">${escapeHtml(formatCount(r.value, lang))}</span>`
        + `</div>`
      const cell = r.href
        ? `<a href="${escapeAttr(r.href)}" class="block transition-colors hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40">${inner}</a>`
        : inner
      return `<li class="relative overflow-hidden rounded">${cell}</li>`
    }).join('') + `</ul>`

  return `<div class="${bare ? 'p-5' : `${CARD} p-5`}">`
    + `<div class="mb-3 flex items-center justify-between">`
    + `<h2 class="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">${escapeHtml(title)}</h2>`
    + `<span class="text-xs font-medium text-neutral-500 dark:text-neutral-400">${escapeHtml(unit)}</span>`
    + `</div>${body}</div>`
}

/**
 * The dual-series time chart: a filled area for views, a line for visitors, no dependency.
 *
 * `preserveAspectRatio="none"` stretches the 720-unit box to whatever width it is given, which
 * is why every stroke carries `vector-effect="non-scaling-stroke"` — without it a chart on a
 * 1400px pane draws hairlines at two different weights depending on which way they run.
 *
 * The transparent columns are the tooltip: one `<title>` per bucket, so a pointer anywhere in
 * a column names the day and both figures. There is no JavaScript in this chart at all.
 */
export function trendChart({ points, peakLabel, viewsLabel, visitorsLabel, partialLabel, lang }: {
  points: DailyPoint[]
  peakLabel: string
  viewsLabel: string
  visitorsLabel: string
  /**
   * ⚠️ THE LAST BUCKET IS ALWAYS PART OF ONE. Every window here ends at `now`, so its final
   * column holds a few hours of a day (or a few days of a month) against neighbours that hold
   * a whole one — and drawn the same way it reads as a collapse. Measured on the fixture: 65,
   * 65, 64 … and then 3, a vertical drop to the floor, which is what the owner sees every
   * morning. `analytics/summary.ts` already knows this fact and already corrects for it one
   * place over, where it shortens the PREVIOUS window to the same elapsed length so the
   * comparison does not open showing a fall.
   *
   * So the chart draws the FINISHED buckets, across the whole width, and the one still being
   * counted is a number in the legend: "Still counting: 3". It was a dashed segment until
   * 2026-09-23, and a dashed line from 65 down to 3 is still a line falling off a cliff — the
   * eye reads the slope before it reads the dash. Nothing is hidden and nothing is guessed at.
   */
  partialLabel: string
  lang: SiteLang
}): string {
  const W = 720
  const H = 150
  // ⚠️ A SPLIT NEEDS A BODY TO HANG OFF. Under three buckets there is nothing to compare the
  // partial one against, and one finished point draws neither a line nor an area, so a short
  // window is drawn whole and its tooltip says the rest.
  const split = points.length >= 3
  const counting = split ? points[points.length - 1]! : null
  const drawn = split ? points.slice(0, -1) : points
  const n = drawn.length
  const max = drawn.reduce((m, p) => Math.max(m, p.views), 0) || 1
  // A single bucket has no line to draw, so it stands in the middle rather than at x=0, where
  // it would be half off the left edge of its own chart.
  const x = (i: number): number => (n <= 1 ? W / 2 : (i / (n - 1)) * W)
  const y = (v: number): number => H - (v / max) * (H - 6) - 3
  const at = (p: DailyPoint, i: number): string => `${x(i)},${y(p.views)}`
  const viewsPts = drawn.map(at).join(' ')
  const visitorPts = drawn.map((p, i) => `${x(i)},${y(p.visitors)}`).join(' ')
  const area = n > 0 ? `M0,${H} L${drawn.map(at).join(' L')} L${x(n - 1)},${H} Z` : ''
  const colW = n > 0 ? W / n : W

  const legendMark = (cls: string, label: string): string =>
    `<span class="flex items-center gap-1.5"><i class="inline-block h-2 w-2 rounded-sm ${cls}"></i>${escapeHtml(label)}</span>`

  // An HOURLY bucket keeps its hour on the axis: the 24-hour range is labelled
  // `2026-09-22 15:00`, and the date alone printed both ends as two dates a day apart with
  // no time on either (release review, 2026-09-23).
  const axis = (day: string): string => {
    const hour = /\d{2}:\d{2}$/.exec(day)
    return hour ? `${formatDateShort(day)} ${hour[0]}` : formatDateShort(day)
  }
  const ends = n > 1 && drawn[0] && drawn[n - 1]
    ? `<div class="mt-1.5 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">`
      + `<span class="tabular-nums">${escapeHtml(axis(drawn[0].day))}</span>`
      + `<span class="tabular-nums">${escapeHtml(axis(drawn[n - 1].day))}</span></div>`
    : ''

  return `<div class="w-full">`
    + `<div class="mb-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">`
    + `<div class="flex items-center gap-3">`
    + legendMark('bg-neutral-400 dark:bg-neutral-500', viewsLabel)
    + legendMark('bg-neutral-800 dark:bg-neutral-200', visitorsLabel)
    + (counting
      ? `<span>${escapeHtml(partialLabel)}: `
        + `<span class="tabular-nums">${escapeHtml(formatCount(counting.views, lang))}</span></span>`
      : '')
    + `</div><span>${escapeHtml(peakLabel)}: <span class="tabular-nums">${escapeHtml(formatCount(max, lang))}</span></span></div>`
    + `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="h-36 w-full" role="img">`
    + (area ? `<path d="${area}" class="fill-neutral-200/50 dark:fill-neutral-700/30"/>` : '')
    + `<polyline points="${viewsPts}" fill="none" class="stroke-neutral-400 dark:stroke-neutral-500" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
    + `<polyline points="${visitorPts}" fill="none" class="stroke-neutral-800 dark:stroke-neutral-200" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
    + drawn.map((p, i) => {
      // A short window is drawn whole, so its last point is the one still being counted, and
      // its tooltip is the only place left to say so.
      const still = !split && i === n - 1 ? ` · ${partialLabel}` : ''
      const said = `${p.day} · ${p.views} ${viewsLabel} · ${p.visitors} ${visitorsLabel}${still}`
      return `<rect x="${x(i) - colW / 2}" y="0" width="${colW}" height="${H}" fill="transparent">`
        + `<title>${escapeHtml(said)}</title></rect>`
    }).join('')
    + `</svg>${ends}</div>`
}
