// The whole-site window reads, cut into pieces that a reader can get between.
//
// WHY. The driver is synchronous on both runtimes (`store/query.ts`), so one statement holds the
// whole Bun process, or the whole Durable Object, until it returns. Measured 2026-10-03 on a copy
// holding 1,000,000 events and 300,000 scroll samples over 365 days: the analytics screen at 365
// days ran about 10 s of statements back to back, and a reader asking for the front page in the
// meantime waited up to 10.5 s for it. One owner looking at last year froze every reader of the blog.
//
// THREE WAYS WERE WEIGHED, and this is the one that works on both runtimes:
//
//   - A Bun Worker with a read-only connection of its own. It takes the work off the thread
//     entirely — on Bun. A Durable Object has one thread and nothing to hand work to, and it is
//     the same blog with the same screen; a fix that leaves one runtime frozen is half a fix, and
//     a second path for the same numbers is how two answers to one question start to drift.
//   - Daily rollup tables. Views add up across days and could come from one, but visitors do not
//     (a reader on Monday and on Tuesday is ONE visitor in the week), and every expensive
//     statement on the screen is a `count(distinct visitor)`. A rollup buys the cheap half.
//   - Cutting each read into pieces and yielding between them. An await that is not a storage call
//     lets a Durable Object take its next request exactly as it lets Bun's event loop answer one,
//     so the same code unfreezes both.
//
// CUT BY VISITOR, NOT BY TIME. A window cut into weeks cannot add its weeks' distinct visitors —
// the reader who came in two weeks is counted twice — and merging the visitor lists instead would
// carry every visitor of the window in memory. A window cut by VISITOR adds up exactly: every row
// of a visitor is in one part, so the parts' visitors are disjoint and the window's count is their
// sum. Each part seeks its own range of `analytics_events_visitor_created_idx` (`+created_at`
// keeps the planner off the time indexes), and the parts together read that index once. The
// ranges are prefixes of the visitor's hex, so they come out even; '' sits below every text value
// and an empty blob above it (SQLite orders every TEXT before every BLOB, held on both drivers by
// `db.contract.ts`), so a visitor that is not hex at all — a test fixture, a 1.x import — still
// lands in exactly one part.
//
// The per-bucket chart is cut by TIME instead (`seriesIn`): each bucket's visitors are a question
// of their own, so a run of buckets is exactly as true as the whole chart.
//
// ONLY WHEN THE WINDOW IS BIG. The visitor index holds the whole history, so a part walks its
// share of every event ever recorded; on a 30-day window of a long-running blog that costs more
// than the window's own statement. Under `CHUNK_ROWS` the single statements in `aggregate.ts` run
// as they always have, and they are the reference the cut reads are tested against
// (`chunked.test.ts`). How many rows a window holds is ESTIMATED from rowids, two index seeks: it
// only picks the number of parts, and a wrong guess costs time, never a different answer.
//
// A flush can land between two pieces, so one screen may count rows that arrived a second apart;
// before this it could not. Every row is still counted once, by the part its visitor is in, and
// the buffer already holds writes for two seconds (`buffer.ts`), so the screen was never more
// exact than that.

import { analyticsQuery } from '@/store/query'
import type { BucketRange } from '@/analytics/buckets'
import { dailySeries, windowCounts } from '@/analytics/aggregate'
import type { DailyPoint } from '@/analytics/types'

const { all, one } = analyticsQuery

/**
 * Give the event loop a turn. `setImmediate` where the runtime has one (Bun, and a Worker with
 * `nodejs_compat`): measured on Bun, three hundred of them cost 1.7 ms against 385 ms for
 * `setTimeout(0)`, which waits for the next millisecond every time.
 */
const immediate = (globalThis as { setImmediate?: (run: () => void) => unknown }).setImmediate
export const pause: () => Promise<void> = immediate
  ? () => new Promise((resolve) => { immediate(resolve) })
  : () => new Promise((resolve) => { setTimeout(resolve, 0) })

/**
 * Rows per piece, and visitor-index entries per piece. A piece of 20,000 rows measured about 55 ms
 * at its heaviest on the machine that measured it (2026-10-03); 40,000 measured 85–110 ms, which
 * is how long a reader waited behind one, for the same total. The walk cap is the second bound: it
 * keeps one part of a long history from reading too much of the index at once, and since the
 * parts' rows are folded in memory (`window.ts`) it also bounds a piece when the estimate is low.
 */
let CHUNK_ROWS = 20_000
let WALK_ROWS = 200_000
const MAX_PARTS = 512

/** For tests, which cut a fixture of a few thousand rows into many parts. Pass nothing to reset. */
export function chunkSizes(rows = 20_000, walk = 200_000): void {
  CHUNK_ROWS = rows
  WALK_ROWS = walk
}

/** Every TEXT value sorts below every BLOB, so an empty blob is above every visitor there is. */
const ABOVE_EVERY_VISITOR = new Uint8Array(0)

export type Part = { lo: string; hi: string | Uint8Array }

/** The id of the first event at or after `t`: one seek of the created_at index. */
const firstIdFrom = (t: number): number | null =>
  one<{ id: number }>(
    'select id from analytics_events where created_at >= $t order by created_at limit 1', { t },
  )?.id ?? null

/** About how many events fall in [from, to), and how many there are at all. */
function estimate(from: number, to: number | null): { window: number; total: number } {
  // Two subqueries, not `select min(id), max(id)`: SQLite answers a lone min() or max() from
  // the end of the rowid tree, and the pair from a scan of every row (0.1 s on a million).
  const ids = one<{ lo: number | null; hi: number | null }>(
    `select (select min(id) from analytics_events) as lo, (select max(id) from analytics_events) as hi`,
  )
  if (ids?.lo == null || ids.hi == null) return { window: 0, total: 0 }
  const total = ids.hi - ids.lo + 1
  const start = firstIdFrom(from)
  if (start === null) return { window: 0, total }
  const end = to === null ? ids.hi + 1 : (firstIdFrom(to) ?? ids.hi + 1)
  // Clamped: a row imported with an old timestamp has a new id, and the subtraction can go wrong
  // either way. It only picks a number of parts.
  return { window: Math.max(0, Math.min(total, end - start)), total }
}

/** The visitor ranges a window is cut into, or none when its own statements are cheaper. */
export function partsFor(from: number, to: number | null): Part[] {
  const { window, total } = estimate(from, to)
  if (window <= CHUNK_ROWS) return []
  const n = Math.min(MAX_PARTS, Math.max(Math.ceil(window / CHUNK_ROWS), Math.ceil(total / WALK_ROWS)))
  const cuts = Array.from({ length: n - 1 }, (_, i) =>
    Math.floor(((i + 1) * 0x10000) / n).toString(16).padStart(4, '0'))
  const bounds: (string | Uint8Array)[] = ['', ...cuts, ABOVE_EVERY_VISITOR]
  return bounds.slice(0, -1).map((lo, i) => ({ lo: lo as string, hi: bounds[i + 1]! }))
}

/** One read per part, each on a turn of its own. */
export async function eachPart<T>(parts: Part[], read: (part: Part) => T): Promise<T[]> {
  const out: T[] = []
  for (const part of parts) {
    await pause()
    out.push(read(part))
  }
  return out
}

/**
 * SQLite's BINARY order, which is what `order by name` in a single statement sorted by. It
 * compares UTF-8 bytes, which is code point order; JavaScript's `<` compares UTF-16 units, and
 * the two disagree for anything past U+FFFF against U+E000–U+FFFF. A merged ranking has to tie
 * exactly where the statement's did, or the tenth row of a list changes with the part count.
 */
export function binary(a: string, b: string): number {
  if (a === b) return 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const x = a.codePointAt(i)!
    const y = b.codePointAt(i)!
    if (x !== y) return x - y
    if (x > 0xffff) i++
  }
  return a.length - b.length
}

/** The per-part statements here, exported for plan.test.ts. The window's own are in window.ts. */
export const PART_SQL = {
  counts: `select count(*) as views, count(distinct visitor) as visitors from analytics_events
            where visitor >= $lo and visitor < $hi and +created_at >= $from and +created_at < $upper`,
  returning: `select count(distinct e.visitor) as n from analytics_events e
               where e.visitor >= $lo and e.visitor < $hi and +e.created_at >= $since
                 and exists (select 1 from analytics_events p
                              where p.visitor = e.visitor and p.created_at < $since)`,
} as const

/**
 * Views and visitors over [from, to): `windowCounts(from, to, null)`, cut when it is big. A part
 * reads nothing but the visitor index here, which holds both columns, so 365 days of the copy
 * above is 0.13 s in all against 0.44 s for the one statement.
 */
export async function countsIn(from: number, to: number | null): Promise<{ views: number; visitors: number }> {
  await pause()
  const parts = partsFor(from, to)
  if (parts.length === 0) return windowCounts(from, to, null)
  const upper = to ?? Number.MAX_SAFE_INTEGER
  const rows = await eachPart(parts, (p) =>
    one<{ views: number; visitors: number }>(PART_SQL.counts, { lo: p.lo, hi: p.hi, from, upper }))
  return rows.reduce<{ views: number; visitors: number }>(
    (t, r) => ({ views: t.views + (r?.views ?? 0), visitors: t.visitors + (r?.visitors ?? 0) }),
    { views: 0, visitors: 0 },
  )
}

/**
 * Visitors in the window who had also been seen before it. The single statement reads the
 * visitor index whole and stays that way: it is covering, so the walk never touches the table
 * (0.06 s for 30 days, 0.23 s for 365, on the copy above), and moving it onto the created_at
 * range measured slower at every window.
 */
export async function returningIn(since: number): Promise<number> {
  await pause()
  const parts = partsFor(since, null)
  if (parts.length === 0) {
    return all<{ n: number }>(
      `select count(distinct e.visitor) as n from analytics_events e
        where e.created_at >= $since
          and exists (select 1 from analytics_events p
                       where p.visitor = e.visitor and p.created_at < $since)`,
      { since },
    )[0]?.n ?? 0
  }
  const rows = await eachPart(parts, (p) => one<{ n: number }>(PART_SQL.returning, { lo: p.lo, hi: p.hi, since }))
  return rows.reduce((t, r) => t + (r?.n ?? 0), 0)
}

/**
 * The chart, a run of buckets at a time, for the site or for one page. A bucket bigger than a
 * piece on its own is still one statement — it cannot be split without the problem above — which
 * on the all-time view is one month: about 80,000 rows on the copy above, 0.06 s. One page's chart
 * is cut by the SITE's rows, because that is what each of its buckets reads (`+e.path`,
 * aggregate.ts): 365 days of the front page was one 0.20 s statement, and is now pieces.
 */
export async function seriesIn(ranges: BucketRange[], path: string | null = null): Promise<DailyPoint[]> {
  const out: DailyPoint[] = []
  let start = 0
  while (start < ranges.length) {
    let end = start + 1
    while (end < ranges.length && estimate(ranges[start]!.lo, ranges[end]!.hi).window <= CHUNK_ROWS) end++
    await pause()
    out.push(...dailySeries(ranges.slice(start, end), path))
    start = end
  }
  return out
}
