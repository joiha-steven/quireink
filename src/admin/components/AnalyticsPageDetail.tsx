// Per-page analytics drill-down: one page's headline metrics, its time series,
// where its traffic came from (referrers + countries), and the read-depth split.
// Reached from the Top pages table in the overview (?path=…). Presentational.
import Link from '@/admin/router'
import type { PageSummary } from '@/analytics/types'
import { EmptyState, PageHeader, Card, SEGMENT_TRACK, tabItemClass } from './kit'
import { BarList, StatTile, TrendChart, flag, formatDuration } from './analytics-kit'
import { useAdminT } from './I18nProvider'
import type { Range } from './AnalyticsView'

const RANGES = [1, 7, 30, 365] as const
const DEPTH_LABELS = ['0–25%', '26–50%', '51–75%', '76–100%']

export function AnalyticsPageDetail({ data, title, range }: { data: PageSummary; title: string; range: Range }) {
  const t = useAdminT()
  const rangeLabel: Record<Range, string> = { 1: t.analyticsRange24h, 7: t.analyticsRange7, 30: t.analyticsRange30, 90: t.analyticsRange90, 365: t.analyticsRange365 }
  const hasData = data.totalViews > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-col gap-1">
            <Link href={`/admin/analytics?range=${range}`} className="text-xs font-medium text-neutral-500 hover:text-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-300">
              ← {t.analyticsAllPages}
            </Link>
            <span className="truncate">{title}</span>
          </span>
        }
        description={
          <a href={data.path} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {data.path}
          </a>
        }
        actions={
          <div className={SEGMENT_TRACK}>
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/admin/analytics?path=${encodeURIComponent(data.path)}&range=${r}`}
                className={tabItemClass(r === range, 'sm')}
              >
                {rangeLabel[r]}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label={t.analyticsViews} value={data.totalViews} prev={data.prevViews} />
        <StatTile label={t.analyticsVisitors} value={data.uniqueVisitors} prev={data.prevVisitors} />
        <StatTile label={t.analyticsAvgTime} value={formatDuration(data.avgDwellMs)} />
        <StatTile label={t.analyticsAvgDepth} value={`${data.avgReadDepth}%`} />
      </div>

      {!hasData ? (
        <EmptyState title={t.analyticsNoData} />
      ) : (
        <>
          <Card>
            <TrendChart points={data.daily} peakLabel={t.analyticsPeak} viewsLabel={t.analyticsViews} visitorsLabel={t.analyticsVisitors} />
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <BarList
              title={t.analyticsTopReferrers}
              unit={t.analyticsVisitors}
              empty={t.analyticsNoData}
              rows={data.topReferrers.map((r) => ({ key: r.host, label: r.host, value: r.visitors }))}
            />
            <BarList
              title={t.analyticsTopCountries}
              unit={t.analyticsVisitors}
              empty={t.analyticsNoData}
              rows={data.topCountries.map((c) => ({ key: c.country, label: `${flag(c.country)} ${c.country}`, value: c.visitors }))}
            />
          </div>

          {data.depthBuckets.length > 0 && (
            <BarList
              title={t.analyticsDepthDist}
              unit={t.analyticsUnitSamples}
              empty={t.analyticsNoData}
              rows={data.depthBuckets.map((b) => ({ key: String(b.bucket), label: DEPTH_LABELS[b.bucket] ?? `${b.bucket}`, value: b.samples }))}
            />
          )}
        </>
      )}
    </div>
  )
}
