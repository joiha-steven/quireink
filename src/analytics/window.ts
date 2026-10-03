// Who read in a window — every piece, the one-page-only visitors, where they came from, the
// countries, channels, devices, browsers and systems — from ONE pass over its rows.
//
// The screen asks those eight questions of the same rows, and while a window is small each stays
// the single statement it always was (`aggregate.ts`). A long window is cut by visitor
// (`chunked.ts`), and there each piece reaches its rows through the visitor index with a table
// lookup a row: asked as eight statements a piece, 365 days of the 1,000,000-event copy cost
// 9.5 s of lookups (2026-10-03), the same rows fetched eight times. So a piece is read ONCE, as
// every distinct (visitor, path, referrer, country, device, browser, os) with its view count, and
// folded here into all eight answers.
//
// Exact by construction, and held to the eight statements by `chunked.test.ts`: each of them
// counts rows, or distinct visitors, over the same rows under the same filters this fold applies —
// an empty or NULL country, device, browser or system left out, a referrer only when it names a
// host — and a piece holds every row of each of its visitors, so a count of distinct visitors in a
// piece is disjoint from every other piece's and the window's is their sum.
//
// Memory is a piece's rows at a time. The parts are sized so a piece is about 20,000 rows, and the
// walk cap in `chunked.ts` bounds one even when the estimate of the window guesses low.

import { analyticsQuery } from '@/store/query'
import {
  allPieces, channelSets, channels, facet, rankChannels, rankReferrers, referrerSets, sizes,
  topCountries, topReferrers,
} from '@/analytics/aggregate'
import { binary, pause, partsFor } from '@/analytics/chunked'
import type { ChannelStat, NameStat, PieceStat, TopCountry, TopReferrer } from '@/analytics/types'

const { all } = analyticsQuery

/** Everything the fold answers, each list complete and ranked; a screen takes its top N. */
export type WindowFacts = {
  /** Every path read, ordered by path as `group by` returned them. */
  pieces: PieceStat[]
  singlePage: number
  referrers: TopReferrer[]
  countries: TopCountry[]
  channels: ChannelStat[]
  devices: NameStat[]
  browsers: NameStat[]
  systems: NameStat[]
}

type Row = {
  visitor: string; path: string; referrer_host: string | null; country: string | null
  device: string | null; browser: string | null; os: string | null; views: number
}

/** One piece's rows: its visitor range, seeked; the window then read off the same index. Exported for plan.test.ts. */
export const WINDOW_PART_SQL = `select visitor, path, referrer_host, country, device, browser, os, count(*) as views
  from analytics_events where visitor >= $lo and visitor < $hi and +created_at >= $since
 group by visitor, path, referrer_host, country, device, browser, os`

/**
 * Visitors who saw exactly ONE PAGE in the window. Shown as "One page only".
 *
 * ⚠️ It counted `count(*) = 1`, which is one EVENT, not one page. A reader who opened a
 * single post and reloaded it, or came back to the same post a week later, has two events on
 * one page and was dropped from the count — so the rate came out low by exactly the readers
 * who bounced twice. Measured on a live blog 2026-08-30: 198 of 380 visitors by the old
 * count, 228 by this one, a bounce rate reading 52% where the honest figure is 60%.
 *
 * The window, not a session, is still the unit: there are no sessions in this schema, so a
 * visitor who bounced in March and bounced again in April is one bouncer here, not two.
 * That is a real limit of the number and the reason it is a share of visitors rather than
 * of visits.
 *
 * ⚠️ `group by +visitor`: grouping on the bare column let SQLite walk the WHOLE visitor index,
 * every event ever recorded, with a table lookup for each row in the window. Measured 2026-10-03
 * on 1,000,000 events: a 7-day window took 2.06 s that way and 0.018 s off the created_at range.
 */
function singlePageVisitors(since: number): number {
  return all<{ n: number }>(
    `select count(*) as n from (
       select visitor from analytics_events where created_at >= $since
        group by +visitor having count(distinct path) = 1)`,
    { since },
  )[0]?.n ?? 0
}

/** The running sums: per-key visitor counts, added piece by piece. */
type Tally = {
  pieces: Map<string, PieceStat>
  singlePage: number
  sums: Record<'referrers' | 'countries' | 'channels' | 'devices' | 'browsers' | 'systems', Map<string, number>>
}

function addAll(into: Map<string, number>, counts: Map<string, number>): void {
  for (const [k, n] of counts) into.set(k, (into.get(k) ?? 0) + n)
}

/** A set of visitors per key, skipping what the statements' `is not null and != ''` skipped. */
function setsBy(rows: Row[], key: (r: Row) => string | null): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const r of rows) {
    const k = key(r)
    if (k === null || k === '') continue
    const set = out.get(k) ?? new Set<string>()
    set.add(r.visitor)
    out.set(k, set)
  }
  return out
}

/** One piece folded into the tally. */
function fold(rows: Row[], t: Tally): void {
  // Per path, every row: an empty path is still a path, where a country of '' is no country.
  const readers = new Map<string, Set<string>>()
  for (const r of rows) {
    const seen = t.pieces.get(r.path)
    if (seen) seen.views += r.views
    else t.pieces.set(r.path, { path: r.path, views: r.views, visitors: 0 })
    const set = readers.get(r.path) ?? new Set<string>()
    set.add(r.visitor)
    readers.set(r.path, set)
  }
  for (const [path, visitors] of readers) t.pieces.get(path)!.visitors += visitors.size
  const onlyPath = new Map<string, string | null>()
  for (const r of rows) {
    const seen = onlyPath.get(r.visitor)
    if (seen === undefined) onlyPath.set(r.visitor, r.path)
    else if (seen !== r.path) onlyPath.set(r.visitor, null)
  }
  for (const p of onlyPath.values()) if (p !== null) t.singlePage++
  const hosts = rows.filter((r) => r.referrer_host).map((r) => ({ host: r.referrer_host!, visitor: r.visitor }))
  addAll(t.sums.referrers, sizes(referrerSets(hosts)))
  addAll(t.sums.channels, sizes(channelSets(rows)))
  addAll(t.sums.countries, sizes(setsBy(rows, (r) => r.country)))
  addAll(t.sums.devices, sizes(setsBy(rows, (r) => r.device)))
  addAll(t.sums.browsers, sizes(setsBy(rows, (r) => r.browser)))
  addAll(t.sums.systems, sizes(setsBy(rows, (r) => r.os)))
}

/** Ranked as `order by visitors desc, name` ranks. */
const rankNames = (counts: Map<string, number>): NameStat[] =>
  [...counts].map(([name, visitors]) => ({ name, visitors }))
    .sort((a, b) => b.visitors - a.visitors || binary(a.name, b.name))

/** `limit -1` is SQLite for no limit at all: the window's lists whole, ranked by the statement. */
const WHOLE = -1

/** Every answer of the fold for the window that starts at `since`. */
export async function windowIn(since: number): Promise<WindowFacts> {
  await pause()
  const parts = partsFor(since, null)
  if (parts.length === 0) {
    const step = async <T>(read: () => T): Promise<T> => { await pause(); return read() }
    return {
      pieces: allPieces(since),
      singlePage: await step(() => singlePageVisitors(since)),
      referrers: await step(() => topReferrers(since, Infinity, null)),
      countries: await step(() => topCountries(since, WHOLE, null)),
      channels: await step(() => channels(since)),
      devices: await step(() => facet(since, 'device', WHOLE)),
      browsers: await step(() => facet(since, 'browser', WHOLE)),
      systems: await step(() => facet(since, 'os', WHOLE)),
    }
  }
  const t: Tally = {
    pieces: new Map(), singlePage: 0,
    sums: { referrers: new Map(), countries: new Map(), channels: new Map(), devices: new Map(), browsers: new Map(), systems: new Map() },
  }
  for (const part of parts) {
    await pause()
    fold(all<Row>(WINDOW_PART_SQL, { lo: part.lo, hi: part.hi, since }), t)
  }
  return {
    pieces: [...t.pieces.values()].sort((a, b) => binary(a.path, b.path)),
    singlePage: t.singlePage,
    referrers: rankReferrers(t.sums.referrers, Infinity),
    countries: rankNames(t.sums.countries).map((r) => ({ country: r.name, visitors: r.visitors })),
    channels: rankChannels(t.sums.channels),
    devices: rankNames(t.sums.devices),
    browsers: rankNames(t.sums.browsers),
    systems: rankNames(t.sums.systems),
  }
}

/** Every piece alone: one statement while the window is small, the fold once it is cut. */
export async function piecesIn(since: number): Promise<PieceStat[]> {
  await pause()
  return partsFor(since, null).length === 0 ? allPieces(since) : (await windowIn(since)).pieces
}

/** The busiest of `pieces`, ranked as `order by views desc, path`. */
export const rankPieces = (pieces: PieceStat[], limit: number): PieceStat[] =>
  [...pieces].sort((a, b) => b.views - a.views || binary(a.path, b.path)).slice(0, limit)
