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
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0)
    return { d, opts: { timeZone } }
  } catch {
    return { d, opts: {} }
  }
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
  return z.d.toLocaleDateString(DATE_LOCALE[lang] ?? 'en-US', {
    ...z.opts,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Month name only, for the infinite-scroll timeline markers (year shown separately).
export function formatMonth(iso: string, lang: SiteLang, tz = ''): string {
  const z = zoned(iso, tz)
  if (!z) return iso
  if (lang === 'vi') return `Tháng ${parts(z.d, z.opts).month}`
  return z.d.toLocaleDateString(DATE_LOCALE[lang] ?? 'en-US', { ...z.opts, month: 'long' })
}
