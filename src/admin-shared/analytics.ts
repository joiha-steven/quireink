// The analytics screen's arithmetic, as functions both faces can read.
//
// Moved out of `admin/components/analytics-kit.tsx` when the screen became a page (ADR 0054).
// All three are pure: a country code in, a string out. Nothing here touches the DOM, reads a
// context or asks the browser for a locale, which is what let them cross to the server
// unchanged — the React versions were already written that way.
//
// The one that did NOT come across is `StatTile`: it was `StatCard` plus a trend arrow, and
// the server kit's `statCard` already takes an `after` slot. A second name for the same tile
// is how the two faces drifted by one shade of grey the last time.

/** Flag emoji from an ISO 3166-1 alpha-2 code (regional indicators); '' if invalid. */
export function flag(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc)) return ''
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

/** Human dwell time. `0s` for missing; seconds under a minute, else "m s". */
export function formatDuration(ms?: number): string {
  const secs = Math.round((ms ?? 0) / 1000)
  if (secs <= 0) return '0s'
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return s ? `${m}m ${s}s` : `${m}m`
}

/** Which way a figure moved, and by how much, or null when there is nothing to say. */
export type Trend = { up: boolean; label: string }

/**
 * Period-over-period change against the previous window of the same length.
 *
 * Null in three cases, and each one is a case where an arrow would be a lie rather than a
 * number: no previous figure at all, a previous figure of zero (every rise from nothing is
 * infinite), and a change of exactly zero (an arrow pointing at 0% is an arrow pointing
 * nowhere).
 *
 * A young site's first real month is "▲12583%" against a near-empty baseline, which reads as
 * a rendering fault rather than as growth. Past 10x the percentage stops carrying
 * information — the figure it sits beside is already printed — so it caps at >999%.
 */
export function trendOf(cur: number, prev?: number): Trend | null {
  if (prev == null || prev === 0) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return null
  return { up: pct > 0, label: pct > 999 ? '>999%' : `${Math.abs(pct)}%` }
}

/**
 * How many pieces stand in the index without being asked for. Ten is the shape of "what is
 * read most"; the rest is one click away, and typing in the box searches all of it either way.
 *
 * Here rather than beside the renderer because the ISLAND needs the same number to decide
 * which rows to unhide, and an island that imports a server module drags `bun:sqlite` into the
 * browser bundle — which `check:bundle` fails, loudly and correctly.
 */
export const TOP_N = 10
