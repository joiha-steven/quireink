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
    // NO horizontal padding here, and that is the alignment fix rather than a tidy-up.
    // `StatCard bare` already carries the band's own `px-5`, so a `px-4` on this grid put
    // the two figures 36px in while every other row on the sheet — the range tabs, the
    // headline band, "By year", the source columns — sits at 20px. The note beneath each
    // figure got only the grid's 16px, so it did not even line up with the number it
    // explains. Measured at 1440px on 2026-09-02: figures at 293, notes at 273, everything
    // else at 277.
    <div className="grid gap-6 border-b border-neutral-100 pb-4 sm:grid-cols-2 dark:border-neutral-800">
      {/* TWO MATCHING CELLS: a figure, its sub-line, and a sentence saying what the figure
          is not. It was a figure-and-sub on the left against a figure, a sub AND a
          three-line note on the right, so the row hung several lines lower on one side than
          the other and read as a rendering fault rather than as two columns.
          The left column's caveat was the half that was missing, and it existed all along —
          in this file's own header comment, where a reader of the screen cannot see it.
          `StatCard bare`, not a hand-drawn tile: the number's size, weight, tracking and
          tabular figures belong to the kit, and `check:admin-kit` fails a screen that
          re-types them. This panel tried to and was caught. */}
      {transfer && (
        <div>
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
          <p className={`${NOTE_TEXT} mt-2 px-5`}>{t.analyticsBytesCaveat}</p>
        </div>
      )}
      {cache && (
        <div>
          <StatCard
            bare
            label={t.analyticsCache}
            value={rate === null ? '—' : `${rate}%`}
            sub={
              <>
                {/* The fraction only when there IS one. A process that has served nothing
                    since boot printed "served from cache · 0/0", which reads as a broken
                    counter rather than as an honest "nothing yet". */}
                {rate !== null && (
                  <>
                    {t.analyticsCacheHits}{' · '}{cache.hits.toLocaleString()}/{requests.toLocaleString()}
                    {' · '}
                  </>
                )}
                {t.analyticsCacheSince} {formatDateTimeShort(new Date(cache.since).toISOString())}
              </>
            }
          />
          <p className={`${NOTE_TEXT} mt-2 px-5`}>{t.analyticsCacheNote}</p>
        </div>
      )}
    </div>
  )
}
