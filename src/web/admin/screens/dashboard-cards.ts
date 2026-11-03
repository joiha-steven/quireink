// The dashboard's cards, as HTML the server sends (ADR 0054).
//
// Split from `dashboard.ts` for the 400-line rule, and the seam is real: everything here draws
// one box out of data it is handed, and nothing here decides what the page is made of.
//
// ⚠️ THE WHOLE DASHBOARD IS READ-ONLY. 1,276 lines of React across seven files, and exactly one
// of them held any state — the first-run band's open/dismissed. That is why this screen was
// worth converting early: it is the admin's front door, every visit starts here, and every
// visit was paying for a React boot, a route chunk and a data fetch before a word appeared.
import type { ActivityEntry } from '@/server/activity'
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteLang } from '@/types'
import { escapeAttr, escapeHtml } from '@/utils'
import { siteDateTimeShort } from '@/admin-shared/sheet-state'
import { formatCount } from '@/i18n/format'
import { iconSvg } from '@/icons'
import { SECTION, TAP } from '@/admin-shared/scale'
import { FEED_LIST, FEED_MARK, FEED_ROW, inkFor, markFor } from '@/admin-shared/activity-mark'
import { ago } from '@/admin-shared/when'
import { logSentence } from '@/admin-shared/log-sentence'
import { durationFigure } from '@/web/admin/kit-figures'

export type DashboardData = {
  traffic: { views30: number; visitors30: number; views7: number; spark: number[]; avgDwellMs: number; avgReadDepth: number }
  topPosts: { title: string; slug: string; views: number }[]
  pickUp: { items: { title: string; href: string; touched: string; untitledNo?: number }[]; total: number }
  needs: { noExcerpt: number; noImage: number }
  sources: { referrers: { label: string; visitors: number }[]; countries: { label: string; visitors: number }[] }
}

const VIEW_ALL = `${TAP} text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200`
const QUIET = 'text-sm text-neutral-500 dark:text-neutral-400'
const ROW_LINK = '-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/50'

const link = (href: string, cls: string, text: string): string =>
  `<a href="${escapeAttr(href)}" class="${cls}">${escapeHtml(text)}</a>`

/**
 * The sparkline: no chart library, `currentColor` so it follows the text either side of it.
 *
 * ⚠️ THE MARKS ARE HTML OVER THE SVG, not shapes inside it, and the reason is
 * `preserveAspectRatio="none"`: the viewBox is 100x28 stretched to whatever the card is wide,
 * which is right for a path and turns a circle into a 6:1 ellipse and a label into smeared
 * type. Positioning in percent outside the stretched box is the only way both can be true.
 *
 * The wash under the line is 8% and not more: the shape is the fact, and a filled block would
 * be a chart competing with four figures above it. The dots give the line a beginning and an
 * end — "thirty days ago" and "yesterday" are the two points anybody reads off it — and the
 * peak is NAMED, because the vertical scale is set by the busiest day and 4-to-8 and 400-to-800
 * otherwise draw the identical picture.
 */
function sparkline(data: number[], lang: SiteLang): string {
  if (data.length < 2) return ''
  const max = Math.max(...data, 1)
  const w = 100
  const h = 28
  const last = data.length - 1
  const stepW = w / last
  const pts = data.map((v, i) => `${(i * stepW).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(' ')
  const peak = data.indexOf(max)
  const across = (i: number): number => (i / last) * 100
  const up = (v: number): number => (v / max) * 100
  const dot = 'absolute h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-current'
  // The label sits ABOVE the peak and flips its anchor in the last fifth of the strip: a peak
  // on the final day would otherwise print its number off the card's edge.
  const anchor = across(peak) > 80 ? '-translate-x-full' : across(peak) < 20 ? '' : '-translate-x-1/2'
  return `<div class="relative text-neutral-700 dark:text-neutral-300">`
    + `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="block h-12 w-full" aria-hidden="true">`
    + `<polygon points="0,${h} ${pts} ${w},${h}" fill="currentColor" opacity="0.08"/>`
    + `<polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.5"`
    + ` vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>`
    + `<span aria-hidden="true" class="${dot}" style="left:0;bottom:${up(data[0] ?? 0)}%"></span>`
    + `<span aria-hidden="true" class="${dot}" style="left:100%;bottom:${up(data[last] ?? 0)}%"></span>`
    + `<span class="absolute bottom-full mb-0.5 text-xs font-medium tabular-nums text-neutral-500 dark:text-neutral-400 ${anchor}"`
    + ` style="left:${across(peak)}%">${escapeHtml(formatCount(max, lang))}</span></div>`
}

/**
 * Two numbers that belong together, side by side.
 *
 * They used to be `justify-between` inside a card spanning two thirds of the workspace, which
 * put views at the far left and visitors 800px away with nothing in between: two figures about
 * the same thirty days read as two unrelated facts.
 */
/**
 * A BAND on Home's one sheet: its name, and whatever it holds (2026-11-03). Home was eight white
 * cards of one radius, one edge and one header shape (a 16px name left, a small link right): the
 * SaaS dashboard template, item for item. The rule between two bands is the sheet's `divide-y`,
 * so a band draws no edge of its own.
 */
export const band = ({ title, actions = '', body, className = '' }: {
  title: string; actions?: string; body: string; className?: string
}): string =>
  `<section class="py-6${className ? ` ${className}` : ''}">`
  + `<div class="mb-3 flex items-center justify-between gap-3"><h2 class="${SECTION}">${title}</h2>${actions}</div>`
  + body + `</section>`

/** A figure inside the traffic line: the number in ink, its name in the quiet ink after it. */
const figure = (valueHtml: string, label: string): string =>
  `<span class="whitespace-nowrap"><span data-figure class="font-medium text-neutral-900 tabular-nums dark:text-white">`
  + `${valueHtml}</span> ${escapeHtml(label)}</span>`

export function trafficCard(t: AdminStrings, lang: SiteLang, traffic: DashboardData['traffic']): string {
  const n = (x: number): string => formatCount(x, lang)
  return band({
    title: escapeHtml(t.dashTraffic),
    actions: link('/admin/analytics', VIEW_ALL, t.dashViewAnalytics),
    // ONE LINE OF INK, not four 30px figures in a row (2026-11-03): the same four names and number
    // shapes as the Analytics band one click away, said once with the window at the end. The
    // sparkline stays, under the line and with no frame round it.
    body: `<p class="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">`
      + [
        figure(escapeHtml(n(traffic.views30)), t.analyticsViews),
        figure(escapeHtml(n(traffic.visitors30)), t.analyticsVisitors),
        figure(durationFigure(traffic.avgDwellMs, lang), t.analyticsAvgTime),
        figure(`${traffic.avgReadDepth}%`, t.analyticsAvgDepth),
      ].join(' · ')
      + ` · ${escapeHtml(t.analyticsRange30)}</p>`
      + `<div class="mt-4">${sparkline(traffic.spark, lang)}</div>`
      + `<div class="mt-2 text-xs text-neutral-500 dark:text-neutral-400">${escapeHtml(t.dashViews7)}: `
      + `<span class="tabular-nums">${escapeHtml(n(traffic.views7))}</span></div>`,
  })
}

function topPostsCard(t: AdminStrings, lang: SiteLang, posts: DashboardData['topPosts']): string {
  const body = posts.length === 0
    ? `<p class="${QUIET}">${escapeHtml(t.dashTopEmpty)}</p>`
    : `<ol class="space-y-1">` + posts.map((p, i) =>
      `<li><a href="/${escapeAttr(p.slug)}" class="${ROW_LINK}">`
      + `<span class="w-4 shrink-0 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400">${i + 1}</span>`
      + `<span class="min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-200">${escapeHtml(p.title)}</span>`
      // ⚠️ THE COUNT IS THE ANSWER, so it is not the smallest thing on the row.
      + `<span class="shrink-0 text-sm text-neutral-600 tabular-nums dark:text-neutral-300">${escapeHtml(formatCount(p.views, lang))}</span>`
      + `</a></li>`).join('') + `</ol>`
  return band({ title: escapeHtml(t.dashTopPosts), body, className: 'border-t border-neutral-200 lg:border-t-0 dark:border-neutral-800' })
}

/**
 * Both rows are about a PUBLISHED post that will look wrong the moment somebody shares it,
 * which is the one kind of problem the owner cannot see by opening their own site. A row with
 * a zero still shows: the point of the card is the whole checklist, and a list that changes
 * length as counts hit zero makes the page jump and hides which checks are being run.
 */
function needsCard(t: AdminStrings, needs: DashboardData['needs']): string {
  const items = [
    { label: t.dashNoExcerpt, count: needs.noExcerpt, href: '/admin/content?needs=excerpt' },
    { label: t.dashNoImage, count: needs.noImage, href: '/admin/content?needs=image' },
  ]
  const body = items.every((i) => i.count === 0)
    ? `<p class="${QUIET}">${escapeHtml(t.dashAllClear)}</p>`
    : `<ul class="space-y-1">` + items.map((i) =>
      `<li><a href="${escapeAttr(i.href)}" class="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/50">`
      + `<span class="text-neutral-600 dark:text-neutral-300">${escapeHtml(i.label)}</span>`
      + `<span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${i.count > 0
        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}">${i.count}</span>`
      + `</a></li>`).join('') + `</ul>`
  return band({ title: escapeHtml(t.dashNeedsAttention), body })
}

/**
 * Where the last 30 days of readers came from: the referrers. The countries column went on
 * 2026-11-03; it is the Analytics screen's, one click away, and on Home it was the second half of
 * a two-up "TOP REFERRERS / TOP COUNTRIES" block the template always has.
 */
function sourcesCard(t: AdminStrings, lang: SiteLang, sources: DashboardData['sources']): string {
  const rows = sources.referrers.slice(0, 4)
  const body = rows.length === 0
    ? `<p class="${QUIET}">${escapeHtml(t.dashSourcesEmpty)}</p>`
    : `<ul class="space-y-1">` + rows.map((r) =>
      `<li class="flex items-baseline justify-between gap-3 py-0.5 text-sm">`
      + `<span class="min-w-0 truncate text-neutral-600 dark:text-neutral-300">${escapeHtml(r.label)}</span>`
      + `<span class="shrink-0 text-sm text-neutral-600 tabular-nums dark:text-neutral-300">${escapeHtml(formatCount(r.visitors, lang))}</span>`
      + `</li>`).join('') + `</ul>`
  return band({
    title: escapeHtml(t.dashSources),
    actions: link('/admin/analytics', VIEW_ALL, t.dashViewAnalytics),
    body,
  })
}

/**
 * The same thing done again and again is ONE line with a count. Six tiles of "Changed settings:
 * language" read as a feed that had stuck (seen 2026-09-23); the newest of a run stands for it.
 * Only neighbours fold: a thing done, then something else, then the first again is three lines,
 * because that is what happened.
 */
function runs(entries: ActivityEntry[]): { e: ActivityEntry; times: number }[] {
  const out: { e: ActivityEntry; times: number }[] = []
  for (const e of entries) {
    const last = out[out.length - 1]
    if (last && last.e.action === e.action && last.e.detail === e.detail) last.times += 1
    else out.push({ e, times: 1 })
  }
  return out
}

/**
 * The recent-activity card: a FEED rather than a sparse table.
 *
 * ONE clock for the whole list, read once: eight rows each asking the time can straddle a
 * minute boundary and print two different answers for the same instant.
 */
function activityCard(t: AdminStrings, lang: SiteLang, tz: string, entries: ActivityEntry[], enabled: boolean): string {
  const now = Date.now()
  const body = !enabled || entries.length === 0
    ? `<p class="${QUIET}">${escapeHtml(t.logEmpty)}</p>`
    : `<ul class="${FEED_LIST}">` + runs(entries).slice(0, 6).map(({ e, times }) => {
      // The stamp and the sentence in full; never the machine code (2026-09-30).
      const title = `${siteDateTimeShort(e.at, tz, lang)} · ${logSentence(t, e.action, e.detail)}`
      const when = (ago(e.at, now, lang) || siteDateTimeShort(e.at, tz, lang)) + (times > 1 ? ` · ×${times}` : '')
      return `<li class="${FEED_ROW}" title="${escapeAttr(title)}">`
        + `<span class="${FEED_MARK} ${inkFor(e.action)}">`
        + `${iconSvg(markFor(e.action), 'h-4 w-4')}</span>`
        + `<div class="min-w-0 flex-1">`
        // THE SENTENCE, from the same table the Log screen reads. The code stays in the title.
        + `<p class="truncate text-sm ${e.action === 'error'
          ? 'font-medium text-neutral-900 dark:text-white'
          : 'text-neutral-800 dark:text-neutral-200'}">${escapeHtml(logSentence(t, e.action, e.detail))}</p>`
        + `<p class="truncate text-xs text-neutral-500 dark:text-neutral-400">${escapeHtml(when)}</p>`
        + `</div></li>`
    }).join('') + `</ul>`
  return band({
    className: 'border-t border-neutral-200 lg:border-t-0 dark:border-neutral-800',
    title: escapeHtml(t.recentActivity),
    actions: link('/admin/log', `${TAP} text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white`, t.recentViewAll),
    body,
  })
}

/**
 * TWO ROWS OF TWO on the sheet, each row one of the sheet's ruled stripes; a phone stacks each
 * pair with a rule between (the second band's `border-t`, dropped from `lg` up).
 *
 * `min-w-0` on the cells is a bug fix, not a precaution: a grid item's automatic minimum size
 * is its content's min-content width, and `truncate` sets `white-space: nowrap`, so a "Most
 * viewed" row's min-content is the full untruncated headline. Measured at 375px before it:
 * `scrollWidth` 422 against a 375 viewport.
 *
 * THE ORDER IS THE OWNER'S QUESTION ORDER: what needs me, what did well, where they came from,
 * what happened.
 */
export function widgets(t: AdminStrings, lang: SiteLang, tz: string, data: DashboardData, recent: ActivityEntry[], activityEnabled: boolean): string {
  const row = (a: string, b: string): string =>
    `<div class="grid gap-x-8 lg:grid-cols-2"><div class="min-w-0">${a}</div><div class="min-w-0">${b}</div></div>`
  return row(needsCard(t, data.needs), topPostsCard(t, lang, data.topPosts))
    + row(sourcesCard(t, lang, data.sources), activityCard(t, lang, tz, recent, activityEnabled))
}
