// Dates, times and numbers in the reader's language. NO DICTIONARIES.
//
// Split out of `i18n.ts` on 2026-09-07 because of what importing that file costs. It holds
// all eleven public dictionaries in a lookup table, so nothing tree-shakes them, and four
// admin components imported it for `formatDate` alone: about 70 KB of strings for a blog
// that speaks one language, in the chunk every admin screen waits for. This half needs only
// the language TAG.
import type { SiteLang } from '@/types'

// BCP-47 tags for Intl date formatting (vi keeps a custom format below).
const DATE_LOCALE: Record<SiteLang, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  de: 'de-DE',
  ja: 'ja-JP',
  zh: 'zh-CN',
  ko: 'ko-KR',
  fr: 'fr-FR',
  es: 'es-ES',
  pt: 'pt-BR',
  it: 'it-IT',
  ru: 'ru-RU',
}

/**
 * The same tag the functions below format with, for a caller that has to hand it to `Intl`
 * itself — the date field's calendar, which needs a weekday narrow and a month long and
 * cannot get either from a finished string.
 *
 * It exists so that "which locale does the admin print dates in" has ONE answer. The calendar
 * asked `Intl` with no locale at all, which means the machine's, and the note printed directly
 * under that same field had already been moved off that for the reason `formatWallClock`
 * states below.
 */
export const dateLocale = (lang: SiteLang): string => DATE_LOCALE[lang] ?? 'en-US'

// Group a plain integer (e.g. a word count) for the reader's language: 1234 -> "1.234"
// (vi/de) / "1,234" (en). Uses the same BCP-47 tag as dates.
export function formatCount(n: number, lang: SiteLang): string {
  return n.toLocaleString(DATE_LOCALE[lang] ?? 'en-US')
}

/**
 * The site's own zone, or the machine's if nothing has said otherwise.
 *
 * **`tz` is not optional decoration, and leaving it out is the bug this argument exists
 * for.** `getDate()` and a bare `toLocaleDateString` read the SERVER's timezone, and a
 * public page is rendered once and cached — so a post published at 18:00 UTC showed
 * "22 tháng 8" from a UTC box and "23 tháng 8" from a box in Vietnam, to every reader
 * either way, and moving the server silently moved every date on the site. Measured
 * 2026-08-22.
 *
 * An unknown zone falls back rather than throwing: `Intl` throws on a name it does not
 * know, and a bad setting must not be able to take a page down.
 */
function zoned(iso: string, tz: string): { d: Date; opts: Intl.DateTimeFormatOptions } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const timeZone = tz.trim()
  if (!timeZone) return { d, opts: {} }
  return ZONE_OK(timeZone) ? { d, opts: { timeZone } } : { d, opts: {} }
}

/**
 * Whether a zone name is one this runtime knows, remembered.
 *
 * The test used to be a whole `Intl.DateTimeFormat` built and thrown away, once per printed
 * date. Measured 2026-09-16: `formatDate` cost 40.5us with no zone and 76.7us with one, and a
 * home page render built 185 of these probes. Setting a timezone, which the comment above
 * argues every operator should do, made the home page render 4.3x slower than leaving it
 * unset. The failure is cached too: without that, an invalid zone pays the throw every time.
 */
const ZONES = new Map<string, boolean>()
function ZONE_OK(timeZone: string): boolean {
  const hit = ZONES.get(timeZone)
  if (hit !== undefined) return hit
  let ok = true
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0)
  } catch {
    ok = false
  }
  ZONES.set(timeZone, ok)
  return ok
}

/**
 * One formatter per zone, kept.
 *
 * `Intl.DateTimeFormat` is expensive to construct and this is now on the list renderer's
 * per-post path: the feed asks for the day of every card to group it, and a blog's archive
 * page asks for all of them at once.
 */
const DAY_PARTS = new Map<string, Intl.DateTimeFormat>()
function dayParts(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = String(opts.timeZone ?? '')
  const hit = DAY_PARTS.get(key)
  if (hit) return hit
  const made = new Intl.DateTimeFormat('en-US', {
    ...opts, year: 'numeric', month: 'numeric', day: 'numeric',
  })
  DAY_PARTS.set(key, made)
  return made
}

/**
 * One formatter per language, zone and shape, kept. Same reason as `DAY_PARTS` above.
 *
 * `toLocaleDateString(loc, opts)` is specified to be `Intl.DateTimeFormat(loc, opts).format(d)`,
 * so the output is byte identical; what changes is that the formatter is built once instead of
 * once per date. Measured 2026-09-16: 38.6us a call became 0.44us, and a home page render with
 * a timezone set went from 10,131us to 999us.
 */
const PRINTERS = new Map<string, Intl.DateTimeFormat>()
function printer(
  lang: SiteLang, zone: Intl.DateTimeFormatOptions, shape: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const loc = DATE_LOCALE[lang] ?? 'en-US'
  const key = `${loc}|${String(zone.timeZone ?? '')}|${Object.keys(shape).join(',')}`
  const hit = PRINTERS.get(key)
  if (hit) return hit
  const made = new Intl.DateTimeFormat(loc, { ...zone, ...shape })
  PRINTERS.set(key, made)
  return made
}

/** Wall-clock day/month/year in `tz`, for the languages formatted by hand below. */
function parts(d: Date, opts: Intl.DateTimeFormatOptions): { day: number; month: number; year: number } {
  const f = dayParts(opts).formatToParts(d)
  const get = (type: string) => Number(f.find((x) => x.type === type)?.value ?? '0')
  return { day: get('day'), month: get('month'), year: get('year') }
}

/**
 * The calendar day the SITE is on, as `YYYY-MM-DD`.
 *
 * Dates are stored as an instant and handed around as UTC ISO, and every surface that
 * PRINTS one already passes `settings.timezone` through `formatDate`. Every surface that
 * GROUPED one read the first characters of the ISO string instead, which is a different
 * day whenever the site's zone and UTC disagree. Measured in Asia/Ho_Chi_Minh: a post
 * dated 1 January 02:00 local is 31 December 19:00 UTC, so its card printed "1 tháng 1,
 * 2026" underneath a year marker reading 2025, and the archive filed it under the wrong
 * year with a `datetime` attribute a day out.
 *
 * Returns the ISO day unchanged when the instant or the zone cannot be read, because a bad
 * timezone setting must not be able to take a listing down.
 */
export function zonedDay(iso: string, tz = ''): string {
  const z = zoned(iso, tz)
  if (!z) return iso.slice(0, 10)
  const { day, month, year } = parts(z.d, z.opts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}

export function formatDate(iso: string, lang: SiteLang, tz = ''): string {
  const z = zoned(iso, tz)
  if (!z) return iso
  // Vietnamese: explicit "19 tháng 6, 2026" (more reliable than Intl long form).
  if (lang === 'vi') {
    const { day, month, year } = parts(z.d, z.opts)
    return `${day} tháng ${month}, ${year}`
  }
  return printer(lang, z.opts, { year: 'numeric', month: 'long', day: 'numeric' }).format(z.d)
}

// Month name only, for the infinite-scroll timeline markers (year shown separately).
export function formatMonth(iso: string, lang: SiteLang, tz = ''): string {
  const z = zoned(iso, tz)
  if (!z) return iso
  if (lang === 'vi') return `Tháng ${parts(z.d, z.opts).month}`
  return printer(lang, z.opts, { month: 'long' }).format(z.d)
}

/**
 * A `datetime-local` value ("YYYY-MM-DDTHH:mm") printed in the admin's language, with NO
 * zone conversion at all.
 *
 * The editor's date field holds the blog's own wall clock (see `isoToZonedInput`), and the
 * line under it used to print `new Date(value).toLocaleString()`. Two things were wrong with
 * that, and only one of them is obvious.
 *
 * The obvious one is the language: no argument means the BROWSER's locale, so an admin set to
 * Vietnamese printed one line of the screen in whatever the machine was configured for.
 *
 * The other is the hour. Reading a zoneless string builds a Date in the MACHINE's zone, and
 * an hour that the machine's zone does not have is silently moved to one it does. On a
 * browser in New York, a post scheduled for 02:30 on 2026-03-08 — inside that zone's own
 * spring-forward gap, and a perfectly ordinary time for a blog set to anywhere else — was
 * printed back as 03:30. Parsing as UTC and printing as UTC has no gaps and no zone: the
 * digits that go in are the digits that come out, in the reader's own order and language.
 */
export function formatWallClock(value: string, lang: SiteLang): string {
  const at = new Date(`${value}Z`)
  if (Number.isNaN(at.getTime())) return value
  return new Intl.DateTimeFormat(DATE_LOCALE[lang] ?? 'en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }).format(at)
}

/**
 * Bytes, read at a glance: `4.2 MB` rather than `4404019`.
 *
 * Not localised, and deliberately: `KB`/`MB`/`GB` are the same three letters in every language
 * this admin speaks, and a translated unit would be one more thing eleven files could disagree
 * about. The DIGITS take the reader's locale wherever they are set beside a count that does.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}

/**
 * A weekday's own name, by the index `Date.getUTCDay` uses — 0 is Sunday.
 *
 * Anchored on a date that IS a Sunday and read in UTC, so the name is a fact about the index
 * and not about the reader's clock: the caller already knows which weekday it means, and all
 * it wants is what that day is called here.
 */
const SUNDAY = Date.UTC(2024, 0, 7)
export function formatWeekday(dow: number, lang: SiteLang): string {
  return printer(lang, { timeZone: 'UTC' }, { weekday: 'short' })
    .format(new Date(SUNDAY + dow * 86_400_000))
}

/**
 * The seven weekday indices in the order this language writes a week.
 *
 * ⚠️ THE WEEK DOES NOT START ON THE SAME DAY EVERYWHERE, and a list that always opened on
 * Monday would be wrong in English and Japanese while a list that always opened on Sunday
 * would be wrong in Vietnamese, German and Russian. `Intl` knows: `getWeekInfo().firstDay` is
 * 1 for Monday through 7 for Sunday. Falls back to Monday, which is ISO 8601's answer, for a
 * runtime that does not carry it.
 */
export function weekdayOrder(lang: SiteLang): number[] {
  // `getWeekInfo` is standards-track and shipped, and TypeScript's `Intl.Locale` has not caught
  // up — so the shape is named here rather than reached for with a cast to anything.
  type WithWeek = Intl.Locale & { getWeekInfo?: () => { firstDay?: number } }
  let first = 1
  try {
    first = (new Intl.Locale(dateLocale(lang)) as WithWeek).getWeekInfo?.().firstDay ?? 1
  } catch {
    first = 1
  }
  // `firstDay` counts Monday..Sunday as 1..7; `getUTCDay` counts Sunday..Saturday as 0..6.
  const start = first % 7
  return Array.from({ length: 7 }, (_, i) => (start + i) % 7)
}
