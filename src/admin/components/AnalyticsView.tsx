// Analytics overview: range tabs + CSV export, headline metrics (views, visitors,
// avg time, avg read depth, bounce rate), a dual-series time chart, top pages
// (each links to its drill-down), traffic sources (channels + referrers), and the
// audience breakdown (countries, devices, browsers, systems) + read-depth split.
// Presentational — the server page fetches the data and passes it in; range tabs
// are plain links (?range=) since admin is already dynamic.
import { useEffect, useState } from 'react'
import Link from '@/admin/router'
import { view } from '@/admin/api'
import type { AnalyticsSummary, NameStat, RightNow } from '@/analytics/types'
import { EmptyState, PageHeader, SEGMENT_TRACK, tabItemClass, TABLE_SCROLL, THEAD, TROW } from './kit'
import { BarList, Trend, TrendChart, flag, formatDuration, type BarRow } from './analytics-kit'
import { NumBand, SHEET, SHEET_TOOL, SheetTop } from './sheet'
import { useAdminT } from './I18nProvider'

const RANGES = [1, 7, 30, 365] as const
export type Range = (typeof RANGES)[number]

function toCsv(data: AnalyticsSummary): string {
  return ['date,views,visitors', ...data.daily.map((d) => `${d.day},${d.views},${d.visitors}`)].join('\n')
}

const DEPTH_LABELS = ['0–25%', '26–50%', '51–75%', '76–100%']

// Localized display name for a facet row ('Unknown' is the only translatable one).
function facetRows(stats: NameStat[] | undefined, unknown: string): BarRow[] {
  return (stats ?? []).map((s) => ({ key: s.name, label: s.name === 'Unknown' ? unknown : s.name, value: s.visitors }))
}

/**
 * The live strip: who is on the site right now, refreshed every ten seconds.
 *
 * Polling, not a socket. The number is served by one indexed five-minute range scan, and a
 * poll that stops the moment the tab is hidden costs less than keeping a connection alive
 * for a page the owner reads a few times a day. The initial value arrives with the view
 * payload, so the strip is truthful at first paint and the poll only keeps it that way.
 */
function LiveNow({ initial, titles }: { initial: RightNow; titles: Record<string, string> }) {
  const t = useAdminT()
  const [now, setNow] = useState(initial)
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState !== 'visible') return
      view<RightNow>('analytics-now').then(setNow).catch(() => { /* keep the last value */ })
    }
    const interval = setInterval(poll, 10_000)
    return () => clearInterval(interval)
  }, [])

  const live = now.visitors > 0
  return (
    <div className="flex items-baseline gap-2 border-b border-neutral-100 px-4 py-2 text-xs dark:border-neutral-800">
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 shrink-0 self-center rounded-full ${
          live ? 'animate-pulse bg-[var(--pen-edge)]' : 'bg-neutral-300 dark:bg-neutral-600'
        }`}
      />
      {live ? (
        <>
          <span className="whitespace-nowrap text-neutral-700 dark:text-neutral-200">
            {t.analyticsNowReading.replace('{n}', String(now.visitors))}
          </span>
          <span className="truncate text-neutral-400 dark:text-neutral-500">
            {now.pages.slice(0, 3).map((p, i) => (
              <span key={p.path}>
                {i > 0 && ' · '}
                {titles[p.path] ?? p.path}
                {p.visitors > 1 && <span className="tabular-nums"> ({p.visitors})</span>}
              </span>
            ))}
          </span>
        </>
      ) : (
        <span className="text-neutral-400 dark:text-neutral-500">{t.analyticsNowQuiet}</span>
      )}
    </div>
  )
}

export function AnalyticsView({ data, range, titles, rightNow }: {
  data: AnalyticsSummary
  range: Range
  titles: Record<string, string>
  rightNow?: RightNow
}) {
  const t = useAdminT()
  const rangeLabel: Record<Range, string> = { 1: t.analyticsRange24h, 7: t.analyticsRange7, 30: t.analyticsRange30, 365: t.analyticsRange365 }
  const hasData = data.totalViews > 0

  const exportCsv = () => {
    const blob = new Blob([toCsv(data)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${range}d.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const channelLabel: Record<string, string> = {
    direct: t.analyticsChannelDirect,
    search: t.analyticsChannelSearch,
    social: t.analyticsChannelSocial,
    referral: t.analyticsChannelReferral,
  }
  const bounce = data.uniqueVisitors > 0 && data.singlePageVisitors != null
    ? Math.round((data.singlePageVisitors / data.uniqueVisitors) * 100)
    : null

  return (
    <div>
      {/* Export in the page head, quiet — the sheet's first row belongs to the range. */}
      <PageHeader
        title={t.analyticsTitle}
        actions={
          <button type="button" onClick={exportCsv} disabled={!hasData} className={SHEET_TOOL}>
            {t.analyticsExportCsv}
          </button>
        }
      />

      {/* ONE SHEET (the admin-pages mock): range on the sheet's first row, the numbers
          standing directly on the paper, then the chart, the pages, the sources — all
          divisions drawn by hairlines, nothing floating in its own little card. */}
      <div className={SHEET}>
        <SheetTop>
          {/* The kit's tab strip, worn by LINKS: the range lives in the URL, so this
              cannot be a `<Tabs>` with an onChange. */}
          <div className={SEGMENT_TRACK}>
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/admin/analytics?range=${r}`}
                aria-current={r === range ? 'page' : undefined}
                className={`${tabItemClass(r === range, 'sm')} whitespace-nowrap`}
              >
                {rangeLabel[r]}
              </Link>
            ))}
          </div>
          <span className="flex-1" />
          <span className="hidden text-xs text-neutral-400 lg:block dark:text-neutral-500">{t.analyticsPrivacyNote}</span>
        </SheetTop>

        {rightNow && <LiveNow initial={rightNow} titles={titles} />}

        <NumBand
          items={[
            { n: data.totalViews.toLocaleString(), label: t.analyticsViews, after: data.prevViews != null ? <Trend cur={data.totalViews} prev={data.prevViews} /> : undefined },
            {
              n: data.uniqueVisitors.toLocaleString(),
              label: t.analyticsVisitors,
              after: data.prevVisitors != null ? <Trend cur={data.uniqueVisitors} prev={data.prevVisitors} /> : undefined,
              sub:
                data.returningVisitors != null ? (
                  <>
                    {t.analyticsNew} <span className="tabular-nums">{Math.max(0, data.uniqueVisitors - data.returningVisitors).toLocaleString()}</span>
                    {' · '}
                    {t.analyticsReturning} <span className="tabular-nums">{data.returningVisitors.toLocaleString()}</span>
                  </>
                ) : undefined,
            },
            { n: formatDuration(data.avgDwellMs), label: t.analyticsAvgTime },
            { n: `${data.avgReadDepth}%`, label: t.analyticsAvgDepth },
            { n: bounce == null ? '—' : `${bounce}%`, label: t.analyticsBounceRate },
          ]}
        />

      {!hasData ? (
        <div className="flex flex-1 items-center justify-center p-10"><EmptyState title={t.analyticsNoData} /></div>
      ) : (
        <>
          <div className="border-b border-neutral-100 px-4 pb-2 pt-4 dark:border-neutral-800">
            <TrendChart points={data.daily} peakLabel={t.analyticsPeak} viewsLabel={t.analyticsViews} visitorsLabel={t.analyticsVisitors} />
          </div>

          {/* Top pages — by title where known, the bare path otherwise. Each row
              links to that page's drill-down. In the sheet, the table needs no frame
              of its own: the hairline under it closes the section. */}
          <div className={`${TABLE_SCROLL} border-b border-neutral-100 dark:border-neutral-800`}>
            <table className="w-full text-sm">
            {/* `w-full` on the title column and `w-px` on the four numbers, which is how an
                auto-layout table is told where the slack goes. Without it the numbers took
                a quarter of the table each to hold three characters and the titles were
                truncated at 206px: measured 1294px wide, 8 of 10 titles cut, 214-229px of
                nothing in every numeric column. `max-w-0` alone collapses the column it is
                on, so it needs `w-full` beside it to mean "take the rest, then truncate". */}
            <thead className={THEAD}>
              <tr>
                <th className="w-full px-4 py-2.5 font-medium">{t.analyticsColPage}</th>
                <th className="w-px px-4 py-2.5 text-right font-medium">{t.analyticsViews}</th>
                <th className="w-px px-4 py-2.5 text-right font-medium">{t.analyticsVisitors}</th>
                <th className="w-px px-4 py-2.5 text-right font-medium">{t.analyticsColTime}</th>
                <th className="w-px px-4 py-2.5 text-right font-medium">{t.analyticsColDepth}</th>
              </tr>
            </thead>
            <tbody>
              {data.topPages.map((p) => (
                <tr key={p.path} className={TROW}>
                  {/* The face follows what this cell actually IS, which changes per row: a
                      post title is the owner's words and takes the reading face, exactly as
                      the same title does on Overview's Most-viewed list; the bare-path
                      fallback is an address and stays on the chrome font, where a URL
                      belongs. */}
                  <td className="w-full max-w-0 px-4 py-2.5">
                    <Link
                      href={`/admin/analytics?path=${encodeURIComponent(p.path)}&range=${range}`}
                      className="block truncate text-neutral-700 hover:underline dark:text-neutral-200"
                      title={p.path}
                    >
                      {titles[p.path] ?? p.path}
                    </Link>
                  </td>
                  <td className="w-px px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-neutral-600 dark:text-neutral-300">{p.views.toLocaleString()}</td>
                  <td className="w-px px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-neutral-600 dark:text-neutral-300">{p.visitors.toLocaleString()}</td>
                  <td className="w-px px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-neutral-500 dark:text-neutral-400">{formatDuration(p.avgDwellMs)}</td>
                  <td className="w-px px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-neutral-500 dark:text-neutral-400">{p.avgDepth}%</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>

          {/* Sources + engagement: traffic channels + top external referrers + read-depth
              split — three columns divided by vertical hairlines, on the sheet itself. */}
          <div className="grid border-b border-neutral-100 sm:grid-cols-3 sm:divide-x sm:divide-neutral-100 dark:border-neutral-800 dark:sm:divide-neutral-800">
            <BarList
              bare
              title={t.analyticsChannels}
              unit={t.analyticsVisitors}
              empty={t.analyticsNoData}
              rows={(data.channels ?? []).map((c) => ({ key: c.channel, label: channelLabel[c.channel] ?? c.channel, value: c.visitors }))}
            />
            <BarList
              bare
              title={t.analyticsTopReferrers}
              unit={t.analyticsVisitors}
              empty={t.analyticsNoData}
              rows={(data.topReferrers ?? []).map((r) => ({ key: r.host, label: r.host, value: r.visitors }))}
            />
            <BarList
              bare
              title={t.analyticsDepthDist}
              unit={t.analyticsUnitSamples}
              empty={t.analyticsNoData}
              rows={(data.depthBuckets ?? []).map((b) => ({ key: String(b.bucket), label: DEPTH_LABELS[b.bucket] ?? `${b.bucket}`, value: b.samples }))}
            />
          </div>

          {/* Audience: countries + device / browser / OS breakdown. */}
          <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-neutral-100 lg:grid-cols-4 dark:sm:divide-neutral-800">
            <BarList
              bare
              title={t.analyticsTopCountries}
              unit={t.analyticsVisitors}
              empty={t.analyticsNoData}
              rows={(data.topCountries ?? []).map((c) => ({ key: c.country, label: `${flag(c.country)} ${c.country}`, value: c.visitors }))}
            />
            <BarList bare title={t.analyticsDevices} unit={t.analyticsVisitors} empty={t.analyticsNoData} rows={facetRows(data.devices, t.analyticsUnknown)} />
            <BarList bare title={t.analyticsBrowsers} unit={t.analyticsVisitors} empty={t.analyticsNoData} rows={facetRows(data.browsers, t.analyticsUnknown)} />
            <BarList bare title={t.analyticsSystems} unit={t.analyticsVisitors} empty={t.analyticsNoData} rows={facetRows(data.systems, t.analyticsUnknown)} />
          </div>
        </>
      )}
      </div>
    </div>
  )
}
