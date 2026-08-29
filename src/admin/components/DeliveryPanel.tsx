// Analytics → Delivery: what readers downloaded, and whether this server's own page cache
// is doing anything.
//
// Both numbers are easy to read as something bigger than they are, so the panel says what
// they are not, on the page, in the owner's language:
//
//   * The bytes are what READERS' BROWSERS reported. A bot, a feed reader and anyone with
//     JavaScript off all download bytes and report none of them, and a CDN answers most
//     requests without the origin ever hearing about them. This is not server egress and
//     nothing here may call it bandwidth.
//   * The cache is THIS PROCESS's Map, counted since boot, and only for requests that got
//     past the CDN. A blog can read low here and still be served almost entirely from
//     cache at the edge. The edge's own rate is not visible from inside the origin.
//
// The denominator travels with the total for the same reason: `bytes` is NULL on every
// sample older than the column, on browsers without Navigation Timing, and on visits whose
// leave beacon never landed.

import type { AnalyticsSummary } from '@/analytics/types'
import { formatBytes, formatDateTimeShort } from '@/utils'
import { NOTE_TEXT } from './kit'
import { StatCard } from './stat-band'
import { useAdminT } from './I18nProvider'

export function DeliveryPanel({ transfer, cache }: {
  transfer: AnalyticsSummary['transfer']
  cache: AnalyticsSummary['cache']
}) {
  const t = useAdminT()
  const requests = (cache?.hits ?? 0) + (cache?.misses ?? 0)
  // No requests yet means no answer, not 0%. A freshly booted process has served nothing.
  const rate = requests > 0 ? Math.round(((cache?.hits ?? 0) / requests) * 100) : null
  if (!transfer && !cache) return null

  return (
    <div className="grid gap-6 border-b border-neutral-100 px-4 py-5 sm:grid-cols-2 dark:border-neutral-800">
      {/* `StatCard bare`, not a hand-drawn tile: the number's size, weight, tracking and
          tabular figures belong to the kit, and `check:admin-kit` fails a screen that
          re-types them. This panel tried to and was caught. */}
      {transfer && (
        <StatCard
          bare
          label={t.analyticsBytesTotal}
          value={transfer.measured > 0 ? formatBytes(transfer.totalBytes) : '—'}
          sub={
            <>
              {transfer.measured > 0 && (
                <>{t.analyticsBytesAvg} {formatBytes(transfer.avgBytes)}{' · '}</>
              )}
              {t.analyticsBytesMeasured} {transfer.measured.toLocaleString()} {t.analyticsBytesNote}
            </>
          }
        />
      )}
      {cache && (
        <div>
          <StatCard
            bare
            label={t.analyticsCache}
            value={rate === null ? '—' : `${rate}%`}
            sub={
              <>
                {t.analyticsCacheHits}{' · '}{cache.hits.toLocaleString()}/{requests.toLocaleString()}
                {' · '}
                {t.analyticsCacheSince} {formatDateTimeShort(new Date(cache.since).toISOString())}
              </>
            }
          />
          <p className={`${NOTE_TEXT} mt-2`}>{t.analyticsCacheNote}</p>
        </div>
      )}
    </div>
  )
}
