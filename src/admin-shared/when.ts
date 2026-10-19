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
 * The admin's one date shape: the day, the month's short NAME and all four digits of the year,
 * in the admin language's own order. "Oct 19, 2026" in English, "19 thg 10, 2026" in Vietnamese,
 * "19. Okt. 2026" in German, "2026年10月19日" in Japanese. `Intl` decides the order, the name and
 * the punctuation, so no table here goes stale.
 *
 * ⚠️ IT WAS NUMBERS TWICE, AND BOTH TIMES THE NUMBERS WERE THE FAULT. First `d/m/yy` for every
 * language, which an English reader took for month-first; then, from 2026-09-30, each language's
 * own numeric order, so "10/9/26" was the ninth of October on one install and the tenth of
 * September on the next, with a two-digit year on backups and logs meant to outlive a decade. A
 * month written as a word cannot be read in the wrong order. It is still ONE shape for the whole
 * admin: every table, list and meta line prints its dates through here.
 *
 * Always printed as UTC. A calendar day is that day wherever the reader sits, and a moment
 * arrives already turned into its local reading by `formatDateTimeShort`. A tag `Intl` refuses
 * falls back to ISO (`2026-10-19`), which nobody reads as another day either.
 */
const FMT = new Map<string, Intl.DateTimeFormat | null>()

function formatter(key: string, lang: SiteLang, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat | null {
  const id = `${lang}|${key}`
  if (!FMT.has(id)) {
    try {
      FMT.set(id, new Intl.DateTimeFormat(dateLocale(lang), options))
    } catch {
      FMT.set(id, null)
    }
  }
  return FMT.get(id) ?? null
}

const NAMED_DAY = { day: 'numeric', month: 'short', year: 'numeric' } as const
const pad2 = (n: number): string => String(n).padStart(2, '0')

function namedDay(d: Date, lang: SiteLang, withDay: boolean): string {
  const fmt = withDay
    ? formatter('day', lang, { ...NAMED_DAY, timeZone: 'UTC' })
    : formatter('month', lang, { month: 'short', year: 'numeric', timeZone: 'UTC' })
  if (fmt) return fmt.format(d)
  const [year, month, day] = [d.getUTCFullYear(), pad2(d.getUTCMonth() + 1), pad2(d.getUTCDate())]
  return withDay ? `${year}-${month}-${day}` : `${year}-${month}`
}

/**
 * The hour as the language writes it by default: `14:05` where the day has 24 hours, "2:05 PM"
 * in English and "오후 2:05" in Korean. Where the clock is 24-hour the hour keeps two digits, so a
 * column of them lines up.
 */
function clockOptions(lang: SiteLang, seconds: boolean): Intl.DateTimeFormatOptions {
  const twelve = formatter('cycle', lang, { hour: 'numeric' })?.resolvedOptions().hour12 === true
  return { hour: twelve ? 'numeric' : '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}) }
}

/** A wall clock with no offset: `2026-03-29T02:30`, seconds optional. */
const WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/**
 * The reading to print, as a UTC instant whose UTC fields ARE that reading; null if it will not parse.
 *
 * ⚠️ A WALL CLOCK IS READ FIELD BY FIELD, never through `new Date(wall)`. That parses in the
 * process's own zone, and an hour the zone skips does not exist there: on a machine in
 * Europe/Berlin, `2026-03-29T02:30` (a site in Hanoi's ordinary half past two) came back as
 * 03:30. The site-zone wrapper, the editor's scheduled date and the hourly chart axis all hand
 * this a wall clock, so the digits that go in are now the digits that come out.
 *
 * Anything else (ISO with an offset, epoch milliseconds) is a moment, printed on the clock of
 * whoever asks: its local reading is copied into UTC fields. Printing that as UTC rather than
 * asking `Intl` for the local zone matters too: `Intl` may fix its idea of the zone when a
 * formatter is built while `Date` follows `TZ` as it changes, and the formatters here are cached,
 * so the two disagreed by hours under a test that moves `TZ`.
 */
function wallAsUtc(at: string | number): Date | null {
  const wall = typeof at === 'string' ? WALL.exec(at) : null
  if (wall) {
    const [y, mo, da, h, mi, se] = wall.slice(1).map((v) => Number(v ?? 0)) as [number, number, number, number, number, number]
    const d = new Date(Date.UTC(y, mo - 1, da, h, mi, se))
    // 2026-02-30 rolls into March; a wall clock that names no real day is not one.
    return d.getUTCMonth() === mo - 1 && d.getUTCDate() === da && h < 24 && mi < 60 && se < 60 ? d : null
  }
  const parsed = new Date(at)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(Date.UTC(
    parsed.getFullYear(), parsed.getMonth(), parsed.getDate(),
    parsed.getHours(), parsed.getMinutes(), parsed.getSeconds(),
  ))
}

/**
 * Date and time for the admin's tables and meta lines: the date above, then the time, joined the
 * way the language joins them. "Oct 19, 2026, 2:05 PM" in English, "19. Okt. 2026, 14:05" in
 * German, "2026年10月19日 14:05" in Japanese.
 *
 * The join is `Intl`'s own when it writes the date first. Vietnamese writes the time first
 * ("14:05 19 thg 10, 2026"), and a list scanned for WHEN reads the date first in every language,
 * so there the date leads and a comma joins them: "19 thg 10, 2026, 14:05".
 *
 * In whichever timezone is asking: the server prints it for the rows it draws, and the island
 * prints it for a row it adds afterwards. On a blog whose owner sits in the server's own
 * timezone — which is the ordinary case for something self-hosted — those are the same clock.
 * The site-timezone wrapper is `siteDateTimeShort` in `sheet-state.ts`, which hands this a wall
 * clock with no offset.
 *
 * ⚠️ A STRING **OR** EPOCH MILLISECONDS, and the second is not a convenience. The admin holds
 * both: content stamps are ISO text, and a session row's `lastSeenAt` is the integer the
 * sessions table stores. Typed `string` alone, this function was already being handed numbers
 * by a caller whose own type was a lie — it survived only because `new Date()` takes either.
 * The next reader of that field reached for `.slice()` instead and the device list threw on
 * every load (2026-09-15). Saying out loud what may arrive is what stops the next one.
 *
 * `seconds` puts them on the clock, for the one line that needs them (the backup's last run,
 * where two runs inside a minute otherwise print the same stamp). It is an option here rather
 * than `:ss` appended by the caller, because the time is not always last: "2:05 PM" ends in
 * the day period, and the appended version printed "2:05 PM:23".
 */
export function formatDateTimeShort(at: string | number, lang: SiteLang, seconds = false): string {
  const d = wallAsUtc(at)
  if (!d) return String(at)
  const day = namedDay(d, lang, true)
  const clock = { ...clockOptions(lang, seconds), timeZone: 'UTC' }
  const time = formatter(`clock|${seconds}`, lang, clock)?.format(d)
  if (!time) return `${day} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}${seconds ? `:${pad2(d.getUTCSeconds())}` : ''}`
  const both = formatter(`both|${seconds}`, lang, { ...NAMED_DAY, ...clock })?.format(d) ?? ''
  if (both.startsWith(day) && both.endsWith(time) && both.length > day.length + time.length) return both
  return `${day}, ${time}`
}

/**
 * The date half of `formatDateTimeShort`, for the lines that carry no time.
 *
 * ONE SHAPE FOR A DATE ACROSS THE ADMIN. The newsletter printed "2026-09-19" and the Analytics
 * axis "2026-08-25" beside tables printing a different shape again: four formats on as many
 * screens (counted 2026-09-23). A calendar DAY (`2026-09-19`) is read as that day wherever the
 * reader is, never shifted by a timezone; a MONTH (`2026-09`) keeps month and year only ("Sep
 * 2026"). Anything else is returned as it came, which is the honest answer to a shape this does
 * not know.
 */
export function formatDateShort(at: string, lang: SiteLang): string {
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(at)
  if (day) return namedDay(new Date(Date.UTC(+day[1]!, +day[2]! - 1, +day[3]!)), lang, true)
  const month = /^(\d{4})-(\d{2})$/.exec(at)
  if (month) return namedDay(new Date(Date.UTC(+month[1]!, +month[2]! - 1, 1)), lang, false)
  return at
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
  // On the SITE's clock when the page names its zone (`<html data-tz>`, as the header and Settings
  // print), so the editor's "Saved at" agrees with them. No document or an unknown zone: the
  // reader's own clock.
  // (This file compiles for the server too, which has no DOM types.)
  const page = (globalThis as { document?: { documentElement?: { dataset?: Record<string, string | undefined> } } }).document
  const zone = page?.documentElement?.dataset?.tz ?? ''
  if (zone) {
    try {
      return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
    } catch { /* an unknown zone falls through to the reader's clock */ }
  }
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}
