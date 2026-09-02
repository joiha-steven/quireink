// Analytics overview: range tabs, headline metrics (views, visitors,
// avg time, avg read depth, one-page-only share), a dual-series time chart, top pages
// (each links to its drill-down), traffic sources (channels + referrers), and the
// audience breakdown (countries, devices, browsers, systems) + read-depth split.
// Presentational — the server page fetches the data and passes it in; range tabs
// are plain links (?range=) since admin is already dynamic.
import { useEffect, useState } from 'react'
import Link from '@/admin/router'
import { view } from '@/admin/api'
import type { AnalyticsSummary, NameStat, PieceStat, RightNow, YearStat } from '@/analytics/types'
import { EmptyState, PageHeader, SEGMENT_TRACK, tabItemClass, TABLE_SCROLL, THEAD, TROW } from './kit'
import { BarList, Trend, TrendChart, flag, formatDuration, type BarRow } from './analytics-kit'
import { NumBand, SHEET, SheetTop } from './sheet'
import { DeliveryPanel } from './DeliveryPanel'
import { PieceIndex } from './PieceIndex'
import { useAdminT } from './I18nProvider'

const RANGES = [1, 7, 30, 365, 'all'] as const
// What the server can SEND, not what the tabs OFFER: `rangeOf` in `web/admin/views.ts`
// also honours 90 (the frozen tree's window), reachable by URL. Deriving this from RANGES
// hid that — the typed view contract caught the mismatch on its first compile. A 90-day
// URL renders correctly with no tab highlighted, which is the honest presentation of a
// window the tabs do not offer.
export type Range = 1 | 7 | 30 | 90 | 365 | 'all'

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
          <span className="truncate text-neutral-500 dark:text-neutral-400">
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
        <span className="text-neutral-500 dark:text-neutral-400">{t.analyticsNowQuiet}</span>
      )}
    </div>
  )
}

export function AnalyticsView({ data, range, titles, pieces, years, rightNow }: {
  data: AnalyticsSummary
  range: Range
  titles: Record<string, string>
  /** Every path read in the window. Joined to `titles` by `PieceIndex`, not here. */
  pieces: PieceStat[]
  /** Every calendar year that has data. NOT windowed by the tabs — see below. */
  years?: YearStat[]
  rightNow?: RightNow
}) {
  const t = useAdminT()
  const rangeLabel: Record<Range, string> = { 1: t.analyticsRange24h, 7: t.analyticsRange7, 30: t.analyticsRange30, 90: t.analyticsRange90, 365: t.analyticsRange365, all: t.analyticsRangeAll }
  const hasData = data.totalViews > 0
  /**
   * The year list, and the one rule about when to draw it: MORE THAN ONE year.
   *
   * On a blog in its first year it would repeat the headline figure under a heading that
   * promises a comparison, which is worse than not being there. From the second year on it
   * is the only thing on the screen that answers "is this year better than last".
   *
   * It is NOT windowed by the tabs above it, deliberately: "2024 against 2025" is not a
   * question about the last thirty days, and answering it by making the owner set a window
   * twice and hold both numbers in their head is not answering it.
   */
  const yearRows: BarRow[] = (years ?? []).map((y) => ({ key: y.year, label: y.year, value: y.views }))
  /**
   * No trend arrow on the all-time window. `getAnalytics` compares against the window of
   * the same length immediately before, and before all time there is nothing — so every
   * figure would carry a rise of infinity, which is arithmetic rather than information.
   */
  const comparable = range !== 'all'

  const channelLabel: Record<string, string> = {
    direct: t.analyticsChannelDirect,
    search: t.analyticsChannelSearch,
    social: t.analyticsChannelSocial,
    referral: t.analyticsChannelReferral,
  }
  /**
   * The share of readers who never opened a second page.
   *
   * It was labelled "Bounce rate" until 2026-08-31, and that name was borrowed from a
   * metric this schema cannot compute. Bounce rate elsewhere means a single-page SESSION;
   * there are no sessions here, so what this actually counts is visitors who saw exactly one
   * page in the whole window — a person who came back four times and read the same post
   * every time is one of them. Under the old name that number invited comparison with a
   * Google Analytics figure measuring something else.
   *
   * It is also a different question from the per-page screen's "Left quickly", which is why
   * the two now have names that cannot be confused: this asks whether readers go on to
   * something else, that one asks whether they stayed on the piece in front of them.
   */
  const onePageOnly = data.uniqueVisitors > 0 && data.singlePageVisitors != null
    ? Math.round((data.singlePageVisitors / data.uniqueVisitors) * 100)
    : null

  return (
    <div>
      <PageHeader title={t.analyticsTitle} />

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
          <span className="hidden text-xs text-neutral-500 lg:block dark:text-neutral-400">{t.analyticsPrivacyNote}</span>
        </SheetTop>

        {rightNow && <LiveNow initial={rightNow} titles={titles} />}

        <NumBand
          items={[
            { n: data.totalViews.toLocaleString(), label: t.analyticsViews, after: comparable && data.prevViews != null ? <Trend cur={data.totalViews} prev={data.prevViews} /> : undefined },
            {
              n: data.uniqueVisitors.toLocaleString(),
              label: t.analyticsVisitors,
              after: comparable && data.prevVisitors != null ? <Trend cur={data.uniqueVisitors} prev={data.prevVisitors} /> : undefined,
              // Suppressed on all time for the same reason as the arrow: "returning" means
              // seen BEFORE this window, and before all time there is nothing, so the split
              // would read "Returning 0" on a blog with years of loyal readers.
              sub:
                comparable && data.returningVisitors != null ? (
                  <>
                    {t.analyticsNew} <span className="tabular-nums">{Math.max(0, data.uniqueVisitors - data.returningVisitors).toLocaleString()}</span>
                    {' · '}
                    {t.analyticsReturning} <span className="tabular-nums">{data.returningVisitors.toLocaleString()}</span>
                  </>
                ) : undefined,
            },
            { n: formatDuration(data.avgDwellMs), label: t.analyticsAvgTime },
            { n: `${data.avgReadDepth}%`, label: t.analyticsAvgDepth },
            { n: onePageOnly == null ? '—' : `${onePageOnly}%`, label: t.analyticsOnePageOnly },
          ]}
        />

      {!hasData ? (
        <div className="flex flex-1 items-center justify-center p-10"><EmptyState title={t.analyticsNoData} /></div>
      ) : (
        <>
          <div className="border-b border-neutral-100 px-4 pb-2 pt-4 dark:border-neutral-800">
            <TrendChart points={data.daily} peakLabel={t.analyticsPeak} viewsLabel={t.analyticsViews} visitorsLabel={t.analyticsVisitors} />
          </div>

          {/* Under the chart rather than in the headline band above it: these two answer
              "what does my blog cost to serve", which is a different question from the five
              reader metrics, and one of them is not even windowed by the range tabs. */}
          <DeliveryPanel transfer={data.transfer} cache={data.cache} />

          {/* Every year on record, whatever the tabs say. Drawn only from the second year
              on: see `yearRows`. */}
          {yearRows.length > 1 && (
            <div className="border-b border-neutral-100 dark:border-neutral-800">
              <BarList bare title={t.analyticsByYear} unit={t.analyticsViews} empty={t.analyticsNoData} rows={yearRows} />
            </div>
          )}

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
                  {/* An em-dash, never a zero. Nothing measured is a different fact from
                      "they left immediately", and after the beacon fix a depth of 0 is a
                      real reading that this column has to be able to print. */}
                  <td className="w-px px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-neutral-500 dark:text-neutral-400">{p.avgDwellMs == null ? '—' : formatDuration(p.avgDwellMs)}</td>
                  <td className="w-px px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-neutral-500 dark:text-neutral-400">{p.avgDepth == null ? '—' : `${p.avgDepth}%`}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>

          {/* The complete index, under the top table rather than instead of it: the table
              answers "what is doing well", this answers "how is THIS piece doing" for a
              piece the table will never show. */}
          <PieceIndex pieces={pieces} titles={titles} range={range} />

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
