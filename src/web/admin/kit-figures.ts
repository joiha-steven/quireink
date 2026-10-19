// THE KIT'S FIGURES: the boxes that report a NUMBER rather than take an answer.
//
// Split out of `kit.ts` on 2026-09-15, when the write column's strip needed a second size and
// the file crossed 400 lines. The seam is real and not arbitrary: everything left in `kit.ts`
// is a control, a state or a piece of chrome, and these four are read-only — a titled panel, a
// stat tile, the band it sits in, and the row of big numbers a screen opens with.
import { escapeAttr, escapeHtml } from '@/utils'
import { CARD } from '@/admin-shared/kit'
import { formatDuration } from '@/admin-shared/analytics'
import type { SiteLang } from '@/types'
import { FIGURE, META, SECTION } from '@/admin-shared/scale'

/**
 * A TITLED PANEL on the canvas — the React `Card` without its `panel` variant, which is the
 * one a screen uses inside a sheet and which no server-drawn screen has needed yet.
 *
 * `title` and `actions` are raw HTML the caller has escaped, because both carry markup on
 * every screen that uses them: a link out, a count, a progress bar.
 */
export function card({ title = '', actions = '', body, className = '', bodyClass = '' }: {
  title?: string
  actions?: string
  body: string
  className?: string
  bodyClass?: string
}): string {
  const head = title || actions
    ? `<div class="mb-5 flex items-center justify-between gap-3">`
      + (title ? `<h2 class="${SECTION}">${title}</h2>` : '')
      + actions + `</div>`
    : ''
  return `<section class="${CARD} p-5 sm:p-6${className ? ` ${className}` : ''}">`
    + head + `<div class="${bodyClass}">${body}</div></section>`
}

/** A tile inside a band: no edge of its own, the band's divider does that job. */
const BARE_TILE = 'px-5 py-4'

/**
 * A headline figure with its label under it, bare (inside a band) or on its own card.
 *
 * `value` and `label` are already-escaped text; `after` is raw HTML (the analytics trend
 * arrow, which sits inside the figure). With `href` the whole tile is a link, and the hover
 * darkens its own edge rather than lifting — a tile that rises and casts a shadow is the
 * dashboard costume `admin-design.md` took out.
 */
export function statCard({ label, value, valueHtml, sub = '', after = '', href = '', bare = false }: {
  label: string
  value: string
  /** Raw HTML honoured before `value`, for a figure with words in it (`durationFigure`). */
  valueHtml?: string
  sub?: string
  after?: string
  href?: string
  bare?: boolean
}): string {
  const inner = `<div class="flex items-start justify-between gap-2"><div class="${FIGURE}">${valueHtml ?? escapeHtml(value)}${after}</div></div>`
    + `<div class="${META} mt-2.5">${escapeHtml(label)}</div>`
    + (sub ? `<div class="${META} mt-1">${escapeHtml(sub)}</div>` : '')
  const shape = bare ? BARE_TILE : `${CARD} p-5`
  if (!href) return `<div class="${shape}">${inner}</div>`
  const hover = bare
    ? 'hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40'
    : 'hover:border-neutral-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40'
  return `<a href="${escapeAttr(href)}" class="${shape} block transition ${hover}">${inner}</a>`
}

/**
 * The figures of a page as ONE BAND divided by hairlines, instead of five floating sheets.
 *
 * `divide-x` alone is wrong once the grid wraps — it skips only the very first child, so the
 * first cell of every later ROW keeps a left edge. The border goes on every cell and the
 * per-row firsts are cleared by column position, which is why the counts are spelled out.
 */
export const statBand = (tiles: string): string =>
  `<div class="${CARD} overflow-hidden grid grid-cols-2 divide-neutral-200 sm:grid-cols-3 lg:grid-cols-5 dark:divide-neutral-800
      [&>*]:border-l [&>*]:border-t [&>*]:border-neutral-200 dark:[&>*]:border-neutral-800
      [&>*:nth-child(-n+2)]:border-t-0 [&>*:nth-child(odd)]:border-l-0
      sm:[&>*:nth-child(-n+3)]:border-t-0 sm:[&>*:nth-child(odd)]:border-l sm:[&>*:nth-child(3n+1)]:border-l-0
      lg:[&>*]:border-t-0 lg:[&>*:nth-child(3n+1)]:border-l lg:[&>*:first-child]:border-l-0">${tiles}</div>`

/**
 * THE BAND OF NUMBERS at the head of a sheet: the figures somebody would otherwise work out by
 * scrolling. `n` and `label` are already-escaped text; `after`, `sub` (one line, or several) and `labelHtml` are raw
 * HTML, as in the React `NumBand` they mirror.
 *
 * `wide` gives a cell half again the share of the row: a duration figure in the longer languages
 * ("1 phút 52 giây", 117px) wrapped to a second line in the 102px an even fifth leaves at 768,
 * which pushed its label 30px below the others.
 *
 * `labelHtml` is the raw door beside `label`, and it exists because one label on the subscriber
 * band is not a string: "Pending" carries the pen's own mark in front of it, the same mark the
 * write list puts against an unfinished piece. Exactly one of the pair is honoured, raw first.
 */
export function numBand(items: { n: string; nHtml?: string; label?: string; labelHtml?: string; after?: string; sub?: string | string[]; wide?: boolean }[]): string {
  return `<div class="flex flex-wrap border-b border-neutral-100 dark:border-neutral-800">`
    + items.map((it) =>
      `<div class="min-w-32 ${it.wide ? 'flex-[1.5]' : 'flex-1'} border-r border-neutral-100 px-5 py-4 last:border-r-0 dark:border-neutral-800">`
      + `<span class="flex flex-wrap items-baseline gap-x-4">`
      + `<b class="${FIGURE}">${it.nHtml ?? escapeHtml(it.n)}</b>${it.after ?? ''}</span>`
      + `<span class="block text-xs text-neutral-500 dark:text-neutral-400">${it.labelHtml ?? escapeHtml(it.label ?? '')}</span>`
      + [it.sub ?? []].flat().filter(Boolean).map((line) => `<span class="block text-xs text-neutral-500 dark:text-neutral-400">${line}</span>`).join('')
      + `</div>`).join('')
    + `</div>`
}

/** The words of a duration figure: a body size beside the figure's digits. */
// leading-none: at its own 1.5rem line-height the smaller run hung below the figure's line box
// and pushed the label under it 2px lower than its neighbours' on the dashboard.
const FIGURE_UNIT = 'text-base leading-none font-normal'

/**
 * A dwell time as a headline figure: the digits at the figure's size, the language's own units
 * at body size. "1 phút 52 giây" and "1 Min., 52 Sek." set whole at 30px measured 200px and
 * more, and broke over two lines in the 135px figure on a 375px dashboard; "1m 52s", the same
 * figure in English, is 76px. `nHtml`/`valueHtml` carry it; `formatDuration` is the text.
 */
export function durationFigure(ms: number | undefined, lang: SiteLang): string {
  return formatDuration(ms, lang)
    .split(/(\d+)/)
    .map((run) => (run === '' || /^\d+$/.test(run) ? escapeHtml(run) : `<span class="${FIGURE_UNIT}">${escapeHtml(run)}</span>`))
    .join('')
}
