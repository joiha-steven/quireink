// The analytics overview, as HTML the server sends (ADR 0054).
//
// ONE SHEET: the range on its first row, the numbers standing directly on the paper, then the
// chart, the pages, the sources — all divisions drawn by hairlines, nothing floating in its own
// little card.
//
// The whole screen is READING. Of 889 lines of React across six files, the only two pieces of
// state were a search box and a "show all" toggle, both of which work over rows the server can
// draw once; everything else was a fetch, a join and a re-render on the way to markup that
// never changed. That is why the island is small and this file is the shape of the page.
import type { SiteLang, SiteSettings } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { AnalyticsSummary, NameStat } from '@/analytics/types'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { formatCount } from '@/i18n/format'
import { flag, formatDuration } from '@/admin-shared/analytics'
import { emptyState, linkTabs, pageHeader, sheet, sheetTop } from '@/web/admin/kit'
import { numBand } from '@/web/admin/kit-figures'
import { analyticsSummaryView, rangeOf, type Window } from '@/web/admin/views'
import { barList, trendChart, trendMark, type BarRow } from '@/web/admin/screens/analytics-kit'
import { deliveryPanel, liveNow, topPages } from '@/web/admin/screens/analytics-cards'
import { pieceIndex } from '@/web/admin/screens/analytics-pieces'
import { analyticsDetailScreen } from '@/web/admin/screens/analytics-detail'

/**
 * What the TABS offer, which is not what the address accepts.
 *
 * `rangeOf` also honours 90 — the frozen tree's window, still reachable by URL. A 90-day
 * address renders correctly with no tab highlighted, which is the honest presentation of a
 * window the strip does not offer, and deriving this list from the parser would hide it.
 */
const RANGES = ['1', '7', '30', '365', 'all'] as const

const DEPTH_LABELS = ['0–25%', '26–50%', '51–75%', '76–100%']

export function rangeLabels(t: AdminStrings): Record<string, string> {
  return {
    1: t.analyticsRange24h,
    7: t.analyticsRange7,
    30: t.analyticsRange30,
    90: t.analyticsRange90,
    365: t.analyticsRange365,
    all: t.analyticsRangeAll,
  }
}

/** A facet row. `Unknown` is the only name in these lists that is ours to translate. */
const facetRows = (stats: NameStat[] | undefined, unknown: string): BarRow[] =>
  (stats ?? []).map((s) => ({ key: s.name, label: s.name === 'Unknown' ? unknown : s.name, value: s.visitors }))

/** The headline band: five figures, and the two that may not carry an arrow on all time. */
function band(t: AdminStrings, lang: SiteLang, d: AnalyticsSummary, window: Window): string {
  // No trend arrow and no new/returning split on the all-time window. Both compare against the
  // window of the same length immediately before, and before all time there is nothing — so
  // every figure would carry a rise of infinity and a blog with years of loyal readers would
  // read "Returning 0".
  const comparable = window.range !== 'all'
  const n = (x: number): string => formatCount(x, lang)
  const fig = (x: number): string => `<span class="tabular-nums">${escapeHtml(n(x))}</span>`

  const split = comparable && d.returningVisitors != null
    ? `${escapeHtml(t.analyticsNew)} ${fig(Math.max(0, d.uniqueVisitors - d.returningVisitors))}`
      + ` · ${escapeHtml(t.analyticsReturning)} ${fig(d.returningVisitors)}`
    : undefined

  /**
   * The share of readers who never opened a second page.
   *
   * It was labelled "Bounce rate" until 2026-08-31, and that name was borrowed from a metric
   * this schema cannot compute: bounce rate elsewhere means a single-page SESSION, and there
   * are no sessions here. What this counts is visitors who saw exactly one page in the whole
   * window — somebody who came back four times to the same post is one of them.
   */
  const onePage = d.uniqueVisitors > 0 && d.singlePageVisitors != null
    ? `${Math.round((d.singlePageVisitors / d.uniqueVisitors) * 100)}%`
    : '—'

  return numBand([
    { n: n(d.totalViews), label: t.analyticsViews, after: comparable ? trendMark(d.totalViews, d.prevViews) : '' },
    {
      n: n(d.uniqueVisitors),
      label: t.analyticsVisitors,
      after: comparable ? trendMark(d.uniqueVisitors, d.prevVisitors) : '',
      sub: split,
    },
    { n: formatDuration(d.avgDwellMs), label: t.analyticsAvgTime },
    { n: `${d.avgReadDepth}%`, label: t.analyticsAvgDepth },
    { n: onePage, label: t.analyticsOnePageOnly },
  ])
}

/** Sources and engagement, then the audience: three columns, then four. */
function columns(t: AdminStrings, lang: SiteLang, d: AnalyticsSummary): string {
  const channelLabel: Record<string, string> = {
    direct: t.analyticsChannelDirect,
    search: t.analyticsChannelSearch,
    social: t.analyticsChannelSocial,
    referral: t.analyticsChannelReferral,
  }
  const list = (title: string, unit: string, rows: BarRow[]): string =>
    barList({ title, unit, rows, empty: t.analyticsNoData, lang, bare: true })

  const sources = [
    list(t.analyticsChannels, t.analyticsVisitors, (d.channels ?? []).map((c) =>
      ({ key: c.channel, label: channelLabel[c.channel] ?? c.channel, value: c.visitors }))),
    list(t.analyticsTopReferrers, t.analyticsVisitors, (d.topReferrers ?? []).map((r) =>
      ({ key: r.host, label: r.host, value: r.visitors }))),
    list(t.analyticsDepthDist, t.analyticsUnitSamples, (d.depthBuckets ?? []).map((b) =>
      ({ key: String(b.bucket), label: DEPTH_LABELS[b.bucket] ?? `${b.bucket}`, value: b.samples }))),
  ].join('')

  const audience = [
    list(t.analyticsTopCountries, t.analyticsVisitors, (d.topCountries ?? []).map((c) =>
      ({ key: c.country, label: `${flag(c.country)} ${c.country}`, value: c.visitors }))),
    list(t.analyticsDevices, t.analyticsVisitors, facetRows(d.devices, t.analyticsUnknown)),
    list(t.analyticsBrowsers, t.analyticsVisitors, facetRows(d.browsers, t.analyticsUnknown)),
    list(t.analyticsSystems, t.analyticsVisitors, facetRows(d.systems, t.analyticsUnknown)),
  ].join('')

  return `<div class="grid border-b border-neutral-100 sm:grid-cols-3 sm:divide-x sm:divide-neutral-100 dark:border-neutral-800 dark:sm:divide-neutral-800">${sources}</div>`
    + `<div class="grid sm:grid-cols-2 sm:divide-x sm:divide-neutral-100 lg:grid-cols-4 dark:sm:divide-neutral-800">${audience}</div>`
}

/** The summary, or one page's detail when `?path=` is set. Two views behind one address. */
export async function analyticsScreen(settings: SiteSettings, query: URLSearchParams): Promise<string> {
  const window = rangeOf(query.get('range') ?? undefined)
  const path = query.get('path') ?? ''
  if (path) return analyticsDetailScreen(settings, path, window)

  const t = adminT(settings.language)
  const lang = settings.language
  const { summary, rightNow, titles, pieces, years } = await analyticsSummaryView(window)
  const range = String(window.range)
  const labels = rangeLabels(t)

  const tools = linkTabs({
    items: RANGES.map((r) => ({ key: r, label: labels[r] ?? r, href: `/admin/analytics?range=${r}` })),
    value: range,
  })
    + `<span class="flex-1"></span>`
    + `<span class="hidden text-xs text-neutral-500 lg:block dark:text-neutral-400">${escapeHtml(t.analyticsPrivacyNote)}</span>`

  /**
   * Every year on record, whatever the tabs say, and drawn only from the SECOND year on.
   *
   * On a blog in its first year it would repeat the headline figure under a heading promising a
   * comparison, which is worse than not being there. It is not windowed by the tabs above it
   * deliberately: "2024 against 2025" is not a question about the last thirty days.
   */
  const yearRows: BarRow[] = (years ?? []).map((y) => ({ key: y.year, label: y.year, value: y.views }))
  const byYear = yearRows.length > 1
    ? `<div class="border-b border-neutral-100 dark:border-neutral-800">`
      + barList({ title: t.analyticsByYear, unit: t.analyticsViews, rows: yearRows, empty: t.analyticsNoData, lang, bare: true })
      + `</div>`
    : ''

  const body = summary.totalViews > 0
    ? `<div class="border-b border-neutral-100 px-4 pb-2 pt-4 dark:border-neutral-800">`
      + trendChart({ points: summary.daily, peakLabel: t.analyticsPeak, viewsLabel: t.analyticsViews, visitorsLabel: t.analyticsVisitors, lang })
      + `</div>`
      // Under the chart rather than in the headline band: these two answer "what does my blog
      // cost to serve", which is a different question from the five reader metrics, and one of
      // them is not even windowed by the range tabs.
      + deliveryPanel(t, lang, summary)
      + byYear
      + topPages(t, lang, summary.topPages, titles, range)
      + pieceIndex(t, lang, pieces, titles, range)
      + columns(t, lang, summary)
    : `<div class="flex flex-1 items-center justify-center p-10">${emptyState({ title: t.analyticsNoData })}</div>`

  return `<div data-screen="analytics" data-lang="${escapeAttr(lang)}">`
    + pageHeader({ title: t.analyticsTitle })
    + sheet(sheetTop(tools) + liveNow(t, lang, rightNow, titles) + band(t, lang, summary, window) + body)
    + `</div>`
}
