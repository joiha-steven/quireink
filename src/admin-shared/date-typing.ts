// TYPING A DATE, rather than clicking a calendar to it.
//
// The admin's date field was a button that opened a grid, and the only way to a month was the
// pair of arrows at the top of it: scheduling something for next March is nine clicks, and
// correcting the year is twelve. A person who knows the date they want should be able to write
// it down. The grid stays for browsing; this is the other door.
//
// ⚠️ THE DAY/MONTH ORDER COMES FROM THE ADMIN'S LANGUAGE, and it is ASKED rather than tabulated.
// `03/04` is the 3rd of April to most of the world and the 4th of March in the United States, so
// a field that guesses is a field that silently publishes three weeks early. `Intl` already
// knows the order for every locale this admin speaks; a table of eleven would be one more thing
// to keep in step with `locales/`.
//
// ⚠️ AND A FOUR-DIGIT FIRST FIELD IS ALWAYS A YEAR. `2026-03-04` means the same thing in every
// country, it is the shape the value is STORED in, and it is what somebody pastes. It is read
// that way whatever the language says, because there is no ambiguity to resolve.
import type { SiteLang } from '@/types'
import { dateLocale } from '@/i18n/format'

const pad = (n: number): string => String(n).padStart(2, '0')

/** The stored shape: a wall clock with no zone, exactly as `<input type="datetime-local">` holds it. */
export const toValue = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  + `T${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Does this language write the day before the month? Asked of `Intl`, not tabulated. */
export function dayFirst(lang: SiteLang): boolean {
  const parts = new Intl.DateTimeFormat(dateLocale(lang)).formatToParts(new Date(2026, 2, 4))
  for (const part of parts) {
    if (part.type === 'day') return true
    if (part.type === 'month') return false
  }
  // A locale whose short date leads with the year (ja, and others) is not day-first; the ISO
  // branch below catches what those people actually type anyway.
  return false
}

/**
 * What to write, in this language's own order — the field's placeholder and its only
 * instruction. Lower case, because it is a pattern rather than a value.
 */
export function typedShape(lang: SiteLang): string {
  return `${dayFirst(lang) ? 'dd/mm/yyyy' : 'mm/dd/yyyy'} hh:mm`
}

/**
 * Read what somebody typed, forgivingly.
 *
 * Accepts `/`, `-`, `.` and spaces between the numbers, a two- or four-digit year, an optional
 * time, and `24:00`-style hours with or without a leading zero. Returns null when it cannot be
 * sure — and null means the stored value is LEFT ALONE, so a half-typed date never destroys the
 * one that was there.
 *
 * `now` is passed in rather than read, so the tests do not depend on the day they run.
 */
export function parseTyped(text: string, lang: SiteLang, now: Date): string | null {
  const clean = text.trim()
  if (!clean) return null
  // Numbers in the order they were written, and nothing else. Anything that is not a digit is a
  // separator — which also means a locale's own month name is not understood, and that is the
  // honest limit of this field rather than a gap: `thg 9` and `Sept` and `сентября` are eleven
  // parsers, and the grid is one click away for anybody who would rather point.
  const bits = clean.split(/[^0-9]+/).filter(Boolean).map(Number)
  if (bits.length < 3) return null
  const [a, b, c, h = 0, min = 0] = bits as [number, number, number, number?, number?]

  let year: number
  let month: number
  let day: number
  if (String(bits[0]).length === 4) {
    // ISO, and unambiguous in every language.
    year = a; month = b; day = c
  } else {
    day = dayFirst(lang) ? a : b
    month = dayFirst(lang) ? b : a
    year = c
    // `26` is 2026, not the year 26. The century comes from the clock rather than a constant, so
    // this does not quietly become wrong in 2100.
    if (year < 100) year += Math.floor(now.getFullYear() / 100) * 100
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (h > 23 || min > 59) return null
  const made = new Date(year, month - 1, day, h, min)
  // ⚠️ THE ROUND TRIP IS THE VALIDATION. `new Date(2026, 1, 31)` is the 3rd of March, silently:
  // a typo of one digit would move a post to another month and the field would show it as
  // accepted. Asking the built date whether it is still the date that was asked for is the only
  // check that catches that.
  if (made.getFullYear() !== year || made.getMonth() !== month - 1 || made.getDate() !== day) return null
  return toValue(made)
}

/**
 * The stored value written back in the shape the field accepts.
 *
 * ⚠️ NOT the locale's pretty date, and that is the trade this field makes deliberately. A box
 * somebody can type in has to show what they would type: `15 thg 9, 2026, 14:30` is nicer to
 * read and impossible to correct without clearing it first. The pretty form is still printed
 * under the title, where it is read rather than edited.
 */
export function formatTyped(value: string, lang: SiteLang): string {
  const at = new Date(value)
  if (!value || Number.isNaN(at.getTime())) return ''
  const d = pad(at.getDate())
  const m = pad(at.getMonth() + 1)
  const first = dayFirst(lang) ? `${d}/${m}` : `${m}/${d}`
  return `${first}/${at.getFullYear()} ${pad(at.getHours())}:${pad(at.getMinutes())}`
}
