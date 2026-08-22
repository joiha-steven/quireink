import type { SiteLang } from '@/types'
import type { Dict } from '@/locales/types'
import en from '@/locales/en'
import vi from '@/locales/vi'
import de from '@/locales/de'
import ja from '@/locales/ja'
import zh from '@/locales/zh'
import ko from '@/locales/ko'

export type { Dict }

const LOCALES: Record<SiteLang, Dict> = { en, vi, de, ja, zh, ko }

// English is the default fallback.
export function t(lang: SiteLang): Dict {
  return LOCALES[lang] ?? en
}

// BCP-47 tags for Intl date formatting (vi keeps a custom format below).
const DATE_LOCALE: Record<SiteLang, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  de: 'de-DE',
  ja: 'ja-JP',
  zh: 'zh-CN',
  ko: 'ko-KR',
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

/** Wall-clock day/month/year in `tz`, for the languages formatted by hand below. */
function parts(d: Date, opts: Intl.DateTimeFormatOptions): { day: number; month: number; year: number } {
  const f = new Intl.DateTimeFormat('en-US', {
    ...opts, year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(d)
  const get = (type: string) => Number(f.find((x) => x.type === type)?.value ?? '0')
  return { day: get('day'), month: get('month'), year: get('year') }
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
