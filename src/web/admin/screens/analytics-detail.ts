// One page's own numbers: the drill-down behind every title in the top table and the piece
// index (ADR 0054). Reached at `?path=…`, and it has no behaviour at all — no island touches
// this face, because there is nothing on it to narrow, sort or poll.
import type { SiteLang, SiteSettings } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { PageSummary } from '@/analytics/types'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { formatCount } from '@/i18n/format'
import { flag, formatDuration } from '@/admin-shared/analytics'
import { emptyState, linkTabs, pageHeader } from '@/web/admin/kit'
import { card, statCard } from '@/web/admin/kit-figures'
import { analyticsDetailView, type Window } from '@/web/admin/views'
import { barList, trendChart, trendMark, type BarRow } from '@/web/admin/screens/analytics-kit'
import { rangeLabels } from '@/web/admin/screens/analytics'

/**
 * Four windows here against the overview's five: ALL TIME IS DELIBERATELY ABSENT.
 *
 * A per-page window of all time sizes itself from the first event on the whole BLOG, so a post
 * published last month would draw three years of empty months to the left of its own first day.
 * The overview is the screen that question belongs to.
 */
const RANGES = ['1', '7', '30', '365'] as const

const DEPTH_LABELS = ['0–25%', '26–50%', '51–75%', '76–100%']

/** The five headline tiles. Each is the kit's own tile — never a hand-drawn copy of one. */
function tiles(t: AdminStrings, lang: SiteLang, d: PageSummary): string {
  const n = (x: number): string => formatCount(x, lang)
  return `<div class="grid grid-cols-2 gap-4 lg:grid-cols-5">`
    + statCard({ label: t.analyticsViews, value: n(d.totalViews), after: trendMark(d.totalViews, d.prevViews) })
    + statCard({ label: t.analyticsVisitors, value: n(d.uniqueVisitors), after: trendMark(d.uniqueVisitors, d.prevVisitors) })
    + statCard({ label: t.analyticsAvgTime, value: formatDuration(d.avgDwellMs) })
    + statCard({ label: t.analyticsAvgDepth, value: `${d.avgReadDepth}%` })
    // The glance share NEVER travels without the count it was taken over. A leave sample exists
    // only when the browser delivered the beacon, so the denominator is not the view count, and
    // pretending otherwise would read a partly-measured week as a week nobody bounced off.
    + statCard({
      label: t.analyticsLeftQuickly,
      value: `${d.leftQuickly?.share ?? 0}%`,
      sub: `${t.analyticsBytesMeasured} ${n(d.leftQuickly?.measured ?? 0)} ${t.analyticsBytesNote}`,
    })
    + `</div>`
}

export async function analyticsDetailScreen(settings: SiteSettings, path: string, window: Window): Promise<string> {
  const t = adminT(settings.language)
  const lang = settings.language
  const { detail, title, range } = await analyticsDetailView(path, window)
  const at = String(range)
  const labels = rangeLabels(t)

  const back = `<span class="flex flex-col gap-1">`
    + `<a href="/admin/analytics?range=${escapeAttr(at)}"`
    + ` class="text-xs font-medium text-neutral-500 hover:text-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-300">`
    + `← ${escapeHtml(t.analyticsAllPages)}</a>`
    + `<span class="truncate">${escapeHtml(title)}</span></span>`

  // `rel="noopener noreferrer"` on a link out to the reader's own site: it opens in a new tab,
  // and a new tab that can reach back into the admin through `window.opener` is a hole.
  const address = `<a href="${escapeAttr(detail.path)}" target="_blank" rel="noopener noreferrer"`
    + ` class="hover:underline">${escapeHtml(detail.path)}</a>`

  const strip = linkTabs({
    items: RANGES.map((r) => ({
      key: r,
      label: labels[r] ?? r,
      href: `/admin/analytics?path=${encodeURIComponent(detail.path)}&range=${r}`,
    })),
    value: at,
  })

  const list = (title2: string, unit: string, rows: BarRow[]): string =>
    barList({ title: title2, unit, rows, empty: t.analyticsNoData, lang })

  const body = detail.totalViews > 0
    ? card({
      body: trendChart({
        points: detail.daily,
        peakLabel: t.analyticsPeak,
        viewsLabel: t.analyticsViews,
        visitorsLabel: t.analyticsVisitors,
        lang,
      }),
    })
      + `<div class="grid gap-4 sm:grid-cols-2">`
      + list(t.analyticsTopReferrers, t.analyticsVisitors, detail.topReferrers.map((r) =>
        ({ key: r.host, label: r.host, value: r.visitors })))
      + list(t.analyticsTopCountries, t.analyticsVisitors, detail.topCountries.map((c) =>
        ({ key: c.country, label: `${flag(c.country)} ${c.country}`, value: c.visitors })))
      + `</div>`
      + (detail.depthBuckets.length > 0
        ? list(t.analyticsDepthDist, t.analyticsUnitSamples, detail.depthBuckets.map((b) =>
          ({ key: String(b.bucket), label: DEPTH_LABELS[b.bucket] ?? `${b.bucket}`, value: b.samples })))
        : '')
    : emptyState({ title: t.analyticsNoData })

  return `<div data-screen="analytics" data-analytics-detail="${escapeAttr(detail.path)}"`
    + ` data-lang="${escapeAttr(lang)}"><div class="space-y-6">`
    + pageHeader({ titleHtml: back, descriptionHtml: address, actions: strip })
    + tiles(t, lang, detail)
    + body
    + `</div></div>`
}
