// Analytics overview: range tabs + CSV export, headline metrics (views, visitors,
// avg time, avg read depth, bounce rate), a dual-series time chart, top pages
// (each links to its drill-down), traffic sources (channels + referrers), and the
// audience breakdown (countries, devices, browsers, systems) + read-depth split.
// Presentational — the server page fetches the data and passes it in; range tabs
// are plain links (?range=) since admin is already dynamic.
import Link from '@/admin/router'
import type { AnalyticsSummary, NameStat } from '@/analytics/types'
import { Button } from '@/admin/ui/Button'
import { Card, EmptyState, NOTE_TEXT, PageHeader, SEGMENT_TRACK, tabItemClass, TableFrame, THEAD, TROW } from './kit'
import { BarList, StatTile, TrendChart, flag, formatDuration, type BarRow } from './analytics-kit'
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

export function AnalyticsView({ data, range, titles }: { data: AnalyticsSummary; range: Range; titles: Record<string, string> }) {
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
    <div className="space-y-6">
      <PageHeader
        title={t.analyticsTitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* The kit's tab strip, worn by LINKS: the range lives in the URL, so this cannot
                be a `<Tabs>` with an onChange. Four ranges plus Export are wider than 375px,
                so THIS row wraps — the segment box cannot (its border is one shared outline),
                which is what let the whole page scroll sideways by 36px on a phone. */}
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
            <Button variant="secondary" onClick={exportCsv} disabled={!hasData}>
              {t.analyticsExportCsv}
            </Button>
          </div>
        }
      />

      <p className={NOTE_TEXT}>{t.analyticsPrivacyNote}</p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label={t.analyticsViews} value={data.totalViews} prev={data.prevViews} />
        <StatTile
          label={t.analyticsVisitors}
          value={data.uniqueVisitors}
          prev={data.prevVisitors}
          sub={
            data.returningVisitors != null ? (
              <>
                {t.analyticsNew} <span className="tabular-nums">{Math.max(0, data.uniqueVisitors - data.returningVisitors).toLocaleString()}</span>
                {' · '}
                {t.analyticsReturning} <span className="tabular-nums">{data.returningVisitors.toLocaleString()}</span>
              </>
            ) : undefined
          }
        />
        <StatTile label={t.analyticsAvgTime} value={formatDuration(data.avgDwellMs)} />
        <StatTile label={t.analyticsAvgDepth} value={`${data.avgReadDepth}%`} />
        <StatTile label={t.analyticsBounceRate} value={bounce == null ? '—' : `${bounce}%`} />
      </div>

      {!hasData ? (
        <EmptyState title={t.analyticsNoData} />
      ) : (
        <>
          <Card>
            <TrendChart points={data.daily} peakLabel={t.analyticsPeak} viewsLabel={t.analyticsViews} visitorsLabel={t.analyticsVisitors} />
          </Card>

          {/* Top pages — by title where known, the bare path otherwise. Each row
              links to that page's drill-down. */}
          <TableFrame>
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
          </TableFrame>

          {/* Sources + engagement: traffic channels + top external referrers + read-depth
              split — three even columns (the row has room for all three). */}
          <div className="grid gap-4 sm:grid-cols-3">
            <BarList
              title={t.analyticsChannels}
              unit={t.analyticsVisitors}
              empty={t.analyticsNoData}
              rows={(data.channels ?? []).map((c) => ({ key: c.channel, label: channelLabel[c.channel] ?? c.channel, value: c.visitors }))}
            />
            <BarList
              title={t.analyticsTopReferrers}
              unit={t.analyticsVisitors}
              empty={t.analyticsNoData}
              rows={(data.topReferrers ?? []).map((r) => ({ key: r.host, label: r.host, value: r.visitors }))}
            />
            <BarList
              title={t.analyticsDepthDist}
              unit={t.analyticsUnitSamples}
              empty={t.analyticsNoData}
              rows={(data.depthBuckets ?? []).map((b) => ({ key: String(b.bucket), label: DEPTH_LABELS[b.bucket] ?? `${b.bucket}`, value: b.samples }))}
            />
          </div>

          {/* Audience: countries + device / browser / OS breakdown. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BarList
              title={t.analyticsTopCountries}
              unit={t.analyticsVisitors}
              empty={t.analyticsNoData}
              rows={(data.topCountries ?? []).map((c) => ({ key: c.country, label: `${flag(c.country)} ${c.country}`, value: c.visitors }))}
            />
            <BarList title={t.analyticsDevices} unit={t.analyticsVisitors} empty={t.analyticsNoData} rows={facetRows(data.devices, t.analyticsUnknown)} />
            <BarList title={t.analyticsBrowsers} unit={t.analyticsVisitors} empty={t.analyticsNoData} rows={facetRows(data.browsers, t.analyticsUnknown)} />
            <BarList title={t.analyticsSystems} unit={t.analyticsVisitors} empty={t.analyticsNoData} rows={facetRows(data.systems, t.analyticsUnknown)} />
          </div>
        </>
      )}
    </div>
  )
}
