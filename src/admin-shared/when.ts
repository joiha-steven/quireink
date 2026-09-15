// The admin's relative times, and the part of the day, as arithmetic both faces can read.
//
// Moved out of `Greeting.tsx`, `ActivityFeed.tsx` and `Overview.tsx` when the dashboard became
// a page (ADR 0054). The React versions each read `document.documentElement.lang` for the
// locale, which a server module cannot do, so the language is a parameter now — and that is
// the better shape anyway: the admin knows its own language from settings and does not have to
// ask the DOM what it wrote there.
//
// `Intl.RelativeTimeFormat` does the words, so eleven languages get their own plural rules
// without a table here, and "2 giờ trước" needs nobody to translate it.
//
// ⚠️ THREE BUCKETINGS, ON PURPOSE, and they are not interchangeable. A feed is read for
// recency and wants minutes; a publication date wants "today" and then days; a process uptime
// must never collapse four minutes and nineteen hours into the same word, because that is the
// difference between "it just came back" and "it has been fine all day".
import type { SiteLang } from '@/types'
import { dateLocale } from '@/i18n/format'

const MIN = 60_000
const HOUR = 60
const DAY = 1440

/** `Intl`, or null on an engine or tag it refuses. Every caller has a plain answer to fall to. */
function words(lang: SiteLang): Intl.RelativeTimeFormat | null {
  try {
    return new Intl.RelativeTimeFormat(dateLocale(lang), { numeric: 'auto' })
  } catch {
    return null
  }
}

/**
 * "2 hours ago" for an activity row: minutes, then hours to two days, then days to two weeks,
 * then weeks. Empty for a stamp that will not parse, and empty rather than a guess for an
 * engine without `Intl` — the caller prints the exact stamp instead.
 */
export function ago(at: string, nowMs: number, lang: SiteLang): string {
  const then = Date.parse(at)
  if (Number.isNaN(then)) return ''
  const minutes = Math.round((then - nowMs) / MIN)
  const fmt = words(lang)
  if (!fmt) return ''
  const size = Math.abs(minutes)
  if (size < HOUR) return fmt.format(Math.min(minutes, -1), 'minute')
  if (size < HOUR * 48) return fmt.format(Math.round(minutes / HOUR), 'hour')
  if (size < DAY * 14) return fmt.format(Math.round(minutes / DAY), 'day')
  return fmt.format(Math.round(minutes / (DAY * 7)), 'week')
}

/**
 * How long a process has been up, in the largest unit that still says something.
 *
 * NOT `relativeDay` below, which collapses anything from today down to "today" — right for a
 * publication date and useless for a restart.
 */
export function sinceStart(startedAt: string, nowMs: number, lang: SiteLang): string {
  const started = Date.parse(startedAt)
  if (Number.isNaN(started)) return ''
  const minutes = Math.round((started - nowMs) / MIN)
  const fmt = words(lang)
  if (!fmt) return ''
  const size = Math.abs(minutes)
  if (size < HOUR) return fmt.format(Math.min(minutes, -1), 'minute')
  if (size < HOUR * 48) return fmt.format(Math.round(minutes / HOUR), 'hour')
  return fmt.format(Math.round(minutes / DAY), 'day')
}

/**
 * "today" / "3 days ago" / "in March" — the resolution a person thinks a publication date in.
 *
 * `today` is the caller's word rather than `Intl`'s, because every language in the admin has
 * one and `Intl` would say "in 0 days".
 */
export function relativeDay(today: string, iso: string, nowMs: number, lang: SiteLang): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const days = Math.round((then.getTime() - nowMs) / 86_400_000)
  if (days === 0) return today
  const fmt = words(lang)
  // An unknown tag, which `Intl` throws on rather than falling back. The date itself is still
  // true, and a date is a better answer than an empty line.
  if (!fmt) return then.toLocaleDateString()
  const size = Math.abs(days)
  if (size < 30) return fmt.format(days, 'day')
  if (size < 365) return fmt.format(Math.round(days / 30), 'month')
  return fmt.format(Math.round(days / 365), 'year')
}

export type DayPart = 'greetMorning' | 'greetAfternoon' | 'greetEvening' | 'greetNight'

/** Morning / afternoon / evening / night, on the four boundaries most languages agree on. */
export function partOfDay(hour: number): DayPart {
  if (hour < 5) return 'greetNight'
  if (hour < 12) return 'greetMorning'
  if (hour < 18) return 'greetAfternoon'
  if (hour < 22) return 'greetEvening'
  return 'greetNight'
}

/**
 * The four, in the order the boot script's own arithmetic has to agree with.
 *
 * ⚠️ THE GREETING READS THE BROWSER'S CLOCK, NOT THE SERVER'S, and that is the one fact on the
 * dashboard the server cannot know. A site in Asia/Bangkok read by its owner in Berlin should
 * say good evening when it is evening where the EYES are. So the server draws all four
 * greetings and the boot script stamps `data-daypart` on `<html>` before the first paint; CSS
 * shows the one that matches. The same trick the rail uses for the Mac chord, for the same
 * reason: a fact only the browser holds, decided before anything is drawn rather than after.
 *
 * ⚠️ THE SPANS CARRY `data-greet`, NOT `data-daypart`. One name for both was tried and the
 * hide rule matched `<html>` itself, which is the element the boot script stamps: the entire
 * admin rendered as a blank page, on every screen.
 */
export const DAY_PARTS: DayPart[] = ['greetNight', 'greetMorning', 'greetAfternoon', 'greetEvening']

/** The attribute value for a part of day: the dictionary key without its prefix, lowercased. */
export const dayPartName = (part: DayPart): string => part.slice('greet'.length).toLowerCase()

/**
 * Terse date + 24h time for the admin tables, e.g. "4/6/26 - 14:05".
 *
 * In whichever timezone is asking: the server prints it for the rows it draws, and the island
 * prints it for a row it adds afterwards. On a blog whose owner sits in the server's own
 * timezone — which is the ordinary case for something self-hosted — those are the same clock.
 *
 * ⚠️ A STRING **OR** EPOCH MILLISECONDS, and the second is not a convenience. The admin holds
 * both: content stamps are ISO text, and a session row's `lastSeenAt` is the integer the
 * sessions table stores. Typed `string` alone, this function was already being handed numbers
 * by a caller whose own type was a lie — it survived only because `new Date()` takes either.
 * The next reader of that field reached for `.slice()` instead and the device list threw on
 * every load (2026-09-15). Saying out loud what may arrive is what stops the next one.
 */
export function formatDateTimeShort(at: string | number): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return String(at)
  const yy = String(d.getFullYear()).slice(-2)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()}/${d.getMonth() + 1}/${yy} - ${hh}:${mm}`
}

/**
 * An ISO time as `HH:mm`, on the reader's own clock.
 *
 * The autosave line's clock. Here rather than in `utils.ts` because the writing sheet's island
 * prints it on every tick and that module pulls the pen grammar and the maths syntax in behind
 * it; `utils.ts` re-exports it, so the dozen call sites that had it there keep their import.
 */
export function formatTime(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}
