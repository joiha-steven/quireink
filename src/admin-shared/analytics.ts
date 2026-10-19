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

import type { SiteLang } from '@/types'
import { dateLocale } from '@/i18n/format'

/** Flag emoji from an ISO 3166-1 alpha-2 code (regional indicators); '' if invalid. */
export function flag(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc)) return ''
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

type DurationParts = { minutes?: number; seconds?: number }
type DurationFormatter = { format(parts: DurationParts): string }
type DurationFormatCtor = new (locale: string, options: { style: 'narrow' }) => DurationFormatter

/** One printer per language, or null where neither `Intl` route will build one. */
const DURATION = new Map<SiteLang, ((parts: DurationParts) => string) | null>()

/**
 * The language's own short units: "1m 52s" in English, "1 phút 52 giây" in Vietnamese, "1 Min.,
 * 52 Sek." in German, "1分钟52秒" in Chinese. `Intl.DurationFormat` where the engine has it (Bun
 * does, and every caller is on the server), else the two units from `Intl.NumberFormat`. Not in
 * the TypeScript library yet, hence the shape typed here.
 */
function durationWords(lang: SiteLang): ((parts: DurationParts) => string) | null {
  if (!DURATION.has(lang)) {
    let words: ((parts: DurationParts) => string) | null = null
    try {
      const locale = dateLocale(lang)
      const unit = (u: 'minute' | 'second') => new Intl.NumberFormat(locale, { style: 'unit', unit: u, unitDisplay: 'narrow' })
      const Ctor = (Intl as unknown as { DurationFormat?: DurationFormatCtor }).DurationFormat
      if (Ctor) {
        const fmt = new Ctor(locale, { style: 'narrow' })
        // A duration of all zeros prints as an empty string; zero seconds is the answer here.
        const zero = unit('second').format(0)
        words = (parts) => fmt.format(parts) || zero
      } else {
        const [min, sec] = [unit('minute'), unit('second')]
        words = ({ minutes, seconds }) =>
          [minutes ? min.format(minutes) : '', seconds || !minutes ? sec.format(seconds ?? 0) : ''].filter(Boolean).join(' ')
      }
    } catch {
      words = null
    }
    DURATION.set(lang, words)
  }
  return DURATION.get(lang) ?? null
}

/**
 * Human dwell time in the admin's language. Zero seconds for missing; seconds under a minute,
 * else minutes and seconds, the seconds dropped when there are none ("2m", never "2m 0s").
 * Minutes are not rolled into hours: nobody stays on a page long enough for that to read better.
 */
export function formatDuration(ms: number | undefined, lang: SiteLang): string {
  const total = Math.max(0, Math.round((ms ?? 0) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  const parts: DurationParts = m ? (s ? { minutes: m, seconds: s } : { minutes: m }) : { seconds: s }
  const words = durationWords(lang)
  if (words) return words(parts)
  return m ? (s ? `${m}m ${s}s` : `${m}m`) : `${s}s`
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
  // Three times or more is said as a MULTIPLE. From a quiet week to a busy one the percentage ran
  // into four figures and was clipped to ">999%", which reads as a broken counter; "×15" is the
  // same fact in the form anybody says it.
  const ratio = cur / prev
  if (ratio >= 3) return { up: true, label: `×${ratio < 10 ? ratio.toFixed(1).replace(/\.0$/, '') : Math.round(ratio)}` }
  return { up: pct > 0, label: `${Math.abs(pct)}%` }
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

/**
 * How many subscribers stand on a page of the newsletter list.
 *
 * Here for the same reason `TOP_N` is: the SERVER hides every row past the first fifty as it
 * draws them, and the ISLAND unhides a slice and writes the "showing 1-50 of 200" line under
 * it. Two copies of the number meant the sentence and the rows could disagree about what a
 * page is, silently, and the file that held each copy could not import the other: an island
 * that imports a server module drags `bun:sqlite` into the browser bundle, which
 * `check:bundle` fails, loudly and correctly.
 */
export const SUBSCRIBERS_PER_PAGE = 50
