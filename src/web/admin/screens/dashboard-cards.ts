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
import { escapeAttr, escapeHtml, formatDateTimeShort } from '@/utils'
import { formatCount } from '@/i18n/format'
import { ICONS } from '@/icons'
import { UTIL } from '@/admin-shared/scale'
import { FEED_LIST, FEED_MARK, FEED_ROW, inkFor, markFor } from '@/admin-shared/activity-mark'
import { ago } from '@/admin-shared/when'
import { logSentence } from '@/admin-shared/log-sentence'
import { card } from '@/web/admin/kit-figures'

export type DashboardData = {
  traffic: { views30: number; visitors30: number; views7: number; spark: number[]; avgDwellMs: number; avgReadDepth: number }
  topPosts: { title: string; slug: string; views: number }[]
  pickUp: { items: { title: string; href: string; touched: string; untitledNo?: number }[]; total: number }
  needs: { noExcerpt: number; noImage: number }
  sources: { referrers: { label: string; visitors: number }[]; countries: { label: string; visitors: number }[] }
}

const VIEW_ALL = 'text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
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
    + `<span class="absolute bottom-full mb-0.5 text-[0.6875rem] font-medium tabular-nums text-neutral-500 dark:text-neutral-400 ${anchor}"`
    + ` style="left:${across(peak)}%">${escapeHtml(formatCount(max, lang))}</span></div>`
}

/**
 * Two numbers that belong together, side by side.
 *
 * They used to be `justify-between` inside a card spanning two thirds of the workspace, which
 * put views at the far left and visitors 800px away with nothing in between: two figures about
 * the same thirty days read as two unrelated facts.
 */
const figure = (value: string, label: string, lead = false): string =>
  `<div class="min-w-0"><div class="${lead ? 'text-3xl font-bold' : 'text-3xl font-semibold text-neutral-500 dark:text-neutral-400'} tracking-tight tabular-nums">`
  + `${escapeHtml(value)}</div>`
  + `<div class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">${escapeHtml(label)}</div></div>`

/** Average dwell as `m:ss`. Seconds alone read as a serial number at four digits. */
function minutesSeconds(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function trafficCard(t: AdminStrings, lang: SiteLang, traffic: DashboardData['traffic']): string {
  const n = (x: number): string => formatCount(x, lang)
  return card({
    title: escapeHtml(t.dashTraffic),
    // The window, said ONCE. It used to be repeated inside two of the labels, which at four
    // figures wrapped one label to two lines and left the row on a ragged baseline.
    actions: `<div class="flex items-center gap-3">`
      + `<span class="text-xs text-neutral-500 dark:text-neutral-400">${escapeHtml(t.analyticsRange30)}</span>`
      + link('/admin/analytics', VIEW_ALL, t.dashViewAnalytics) + `</div>`,
    body: `<div class="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">`
      + figure(n(traffic.views30), t.dashViews, true)
      + figure(n(traffic.visitors30), t.dashVisitors)
      // The two that say whether anybody READ it, as opposed to how many arrived.
      + figure(minutesSeconds(traffic.avgDwellMs), t.dashAvgTime)
      + figure(`${traffic.avgReadDepth}%`, t.dashReadDepth)
      + `</div>`
      + `<div class="mt-5">${sparkline(traffic.spark, lang)}</div>`
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
  return card({ title: escapeHtml(t.dashTopPosts), body })
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
        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}">${i.count}</span>`
      + `</a></li>`).join('') + `</ul>`
  return card({ title: escapeHtml(t.dashNeedsAttention), body })
}

/** Where the last 30 days of readers came from. Two short lists, side by side. */
function sourcesCard(t: AdminStrings, lang: SiteLang, sources: DashboardData['sources']): string {
  const columns = [
    { heading: t.analyticsTopReferrers, rows: sources.referrers.slice(0, 4) },
    { heading: t.analyticsTopCountries, rows: sources.countries.slice(0, 4) },
  ]
  const body = columns.every((c) => c.rows.length === 0)
    ? `<p class="${QUIET}">${escapeHtml(t.dashSourcesEmpty)}</p>`
    : `<div class="grid gap-x-8 gap-y-4 sm:grid-cols-2">` + columns.map((col) =>
      // An eyebrow over a stretch of rows: `UTIL`, the one role in the scale allowed uppercase.
      `<div><div class="${UTIL} mb-1.5">${escapeHtml(col.heading)}</div><ul class="space-y-1">`
      + (col.rows.length === 0 ? `<li class="py-1 text-sm text-neutral-300 dark:text-neutral-600">—</li>` : '')
      + col.rows.map((r) =>
        `<li class="flex items-baseline justify-between gap-3 py-0.5 text-sm">`
        + `<span class="min-w-0 truncate text-neutral-600 dark:text-neutral-300">${escapeHtml(r.label)}</span>`
        + `<span class="shrink-0 text-sm text-neutral-600 tabular-nums dark:text-neutral-300">${escapeHtml(formatCount(r.visitors, lang))}</span>`
        + `</li>`).join('')
      + `</ul></div>`).join('') + `</div>`
  return card({
    title: escapeHtml(t.dashSources),
    actions: link('/admin/analytics', VIEW_ALL, t.dashViewAnalytics),
    body,
  })
}

/**
 * The recent-activity card: a FEED rather than a sparse table.
 *
 * ONE clock for the whole list, read once: eight rows each asking the time can straddle a
 * minute boundary and print two different answers for the same instant.
 */
function activityCard(t: AdminStrings, lang: SiteLang, entries: ActivityEntry[], enabled: boolean): string {
  const now = Date.now()
  const body = !enabled || entries.length === 0
    ? `<p class="${QUIET}">${escapeHtml(t.logEmpty)}</p>`
    : `<ul class="${FEED_LIST}">` + entries.slice(0, 10).map((e) => {
      const title = `${formatDateTimeShort(e.at)} · ${e.action}${e.detail ? ` — ${e.detail}` : ''}`
      const when = ago(e.at, now, lang) || formatDateTimeShort(e.at)
      return `<li class="${FEED_ROW}" title="${escapeAttr(title)}">`
        + `<span class="${FEED_MARK} ${inkFor(e.action)}">`
        + `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"`
        + ` stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[markFor(e.action)]}</svg></span>`
        + `<div class="min-w-0 flex-1">`
        // THE SENTENCE, from the same table the Log screen reads. The code stays in the title.
        + `<p class="truncate text-sm ${e.action === 'error'
          ? 'font-medium text-neutral-900 dark:text-white'
          : 'text-neutral-800 dark:text-neutral-200'}">${escapeHtml(logSentence(t, e.action, e.detail))}</p>`
        + `<p class="truncate text-xs text-neutral-500 dark:text-neutral-400">${escapeHtml(when)}</p>`
        + `</div></li>`
    }).join('') + `</ul>`
  return card({
    title: escapeHtml(t.recentActivity),
    actions: link('/admin/log', 'text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white', t.recentViewAll),
    body,
  })
}

/**
 * ONE 2x2 grid, rows stretching — and the even count is what makes that right.
 *
 * ⚠️ `items-stretch` (the default) is load-bearing HERE and nowhere else. At an ODD count a
 * stretched row strands the leftover card full-width around a sentence, which is the failure
 * `admin-design.md` describes for the Settings tabs. At an even count a stretched row is
 * exactly what is wanted, because the pair in it is the thing being compared. Do not put
 * `items-start` back without also giving the band an odd number of cards again.
 *
 * `min-w-0` on the STACKS is a bug fix, not a precaution: a grid item's automatic minimum size
 * is its content's min-content width, and `truncate` sets `white-space: nowrap`, so a "Most
 * viewed" row's min-content is the full untruncated headline. Measured at 375px before it:
 * `scrollWidth` 422 against a 375 viewport.
 *
 * THE ORDER IS THE OWNER'S QUESTION ORDER: what needs me, what did well, where they came from,
 * what happened.
 */
export function widgets(t: AdminStrings, lang: SiteLang, data: DashboardData, recent: ActivityEntry[], activityEnabled: boolean): string {
  const cell = (inner: string): string => `<div class="min-w-0 [&>section]:h-full">${inner}</div>`
  return cell(needsCard(t, data.needs))
    + cell(topPostsCard(t, lang, data.topPosts))
    + cell(sourcesCard(t, lang, data.sources))
    + cell(activityCard(t, lang, recent, activityEnabled))
}
