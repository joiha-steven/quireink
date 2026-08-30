// Every piece, and the way into its own numbers.
//
// The top table is the screen's default face and stays that way — it answers "what is doing
// well", which is the question most days. This answers the other one: "how is THIS piece
// doing", for a piece that is not in the top ten and never will be. Until now the only door
// to a piece's drill-down was a row in that table, so the fortieth piece had no route to its
// own page at all, while the number it wanted was already computed and the screen already
// built (`AnalyticsPageDetail`).
//
// Deliberately not a ranking, and deliberately not capped. A "top 50" here would put the
// same wall one row further down. It is ordered by views because that is the useful default
// order, but the FILTER is the control: type three letters and the list is the piece you
// meant, wherever it sits.
//
// Pieces with no views in the window are listed too, at zero. That a post was read by
// nobody this week is an answer, and leaving it out would make the list quietly agree with
// the top table about which pieces exist.
import { useMemo, useState } from 'react'
import Link from '@/admin/router'
import type { PieceStat } from '@/analytics/types'
import { TABLE_SCROLL, THEAD, TROW } from './kit'
import { useAdminT } from './I18nProvider'
import type { Range } from './AnalyticsView'

type Row = { path: string; title: string; views: number; visitors: number }

/** Fold to something a search can match across cases and Vietnamese diacritics. */
const fold = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')

export function PieceIndex({
  pieces,
  titles,
  range,
}: {
  pieces: PieceStat[]
  titles: Record<string, string>
  range: Range
}) {
  const t = useAdminT()
  const [query, setQuery] = useState('')

  // The join happens here rather than on the server so a piece with no row in the window
  // still appears. `titles` already carries every post and page; `pieces` carries only the
  // paths somebody actually opened.
  const rows = useMemo<Row[]>(() => {
    const stats = new Map(pieces.map((p) => [p.path, p]))
    const all: Row[] = Object.entries(titles).map(([path, title]) => ({
      path,
      title,
      views: stats.get(path)?.views ?? 0,
      visitors: stats.get(path)?.visitors ?? 0,
    }))
    // A path with views but no title is a real URL somebody read — the home page, an
    // archive, a slug since renamed. It belongs in the list under its own address.
    for (const p of pieces) {
      if (!(p.path in titles)) all.push({ path: p.path, title: p.path, views: p.views, visitors: p.visitors })
    }
    return all.sort((a, b) => b.views - a.views || a.title.localeCompare(b.title))
  }, [pieces, titles])

  const shown = useMemo(() => {
    const needle = fold(query.trim())
    if (!needle) return rows
    return rows.filter((r) => fold(r.title).includes(needle) || fold(r.path).includes(needle))
  }, [rows, query])

  return (
    <div className="border-b border-neutral-100 dark:border-neutral-800">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <h2 className="text-sm font-medium text-neutral-900 dark:text-white">{t.analyticsPieces}</h2>
        <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
          {shown.length.toLocaleString()}
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.analyticsFindPiece}
          aria-label={t.analyticsFindPiece}
          data-piece-search
          className="ml-auto h-8 w-full min-w-0 rounded-md border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none sm:w-56 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"
        />
      </div>

      {shown.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-neutral-500 dark:text-neutral-400">{t.analyticsNoData}</p>
      ) : (
        // Capped in HEIGHT, never in row count: everything is present and reachable by
        // scrolling or by typing, which is the difference between a long list and a top N.
        <div className={`${TABLE_SCROLL} max-h-96 overflow-y-auto`}>
          <table className="w-full text-sm">
            <thead className={THEAD}>
              <tr>
                <th className="w-full px-4 py-2.5 font-medium">{t.analyticsColPage}</th>
                <th className="w-px px-4 py-2.5 text-right font-medium">{t.analyticsViews}</th>
                <th className="w-px px-4 py-2.5 text-right font-medium">{t.analyticsVisitors}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.path} className={TROW}>
                  <td className="w-full max-w-0 px-4 py-2.5">
                    <Link
                      href={`/admin/analytics?path=${encodeURIComponent(r.path)}&range=${range}`}
                      data-piece-row
                      className="block truncate text-neutral-700 hover:underline dark:text-neutral-200"
                      title={r.path}
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="w-px px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-neutral-600 dark:text-neutral-300">{r.views.toLocaleString()}</td>
                  <td className="w-px px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-neutral-500 dark:text-neutral-400">{r.visitors.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
