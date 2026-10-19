// The admin's short dates name the month (2026-10-19). Before, they were numbers in each
// language's own order with a two-digit year, so "10/9/26" was a different day on an English
// install than on a Vietnamese one. Before THAT, every language got `d/m/yy`.
import { describe, expect, test } from 'bun:test'
import { formatDateShort, formatDateTimeShort } from '@/admin-shared/when'
import { LANG_CODES } from '@/locales/langs'

describe('formatDateShort', () => {
  test('a calendar day with the month named and four digits of year, in each language’s order', () => {
    expect(formatDateShort('2026-09-03', 'en')).toBe('Sep 3, 2026')
    expect(formatDateShort('2026-09-03', 'vi')).toBe('3 thg 9, 2026')
    expect(formatDateShort('2026-09-03', 'de')).toBe('3. Sept. 2026')
    expect(formatDateShort('2026-09-03', 'ja')).toBe('2026年9月3日')
  })

  test('no language prints a two-digit year or a day that can be read month-first', () => {
    for (const lang of LANG_CODES) {
      const out = formatDateShort('2026-10-09', lang)
      expect(out).toContain('2026')
      expect(out).not.toMatch(/\b10[./-]9\b|\b9[./-]10\b/)
    }
  })

  test('a calendar day is that day wherever the reader is', () => {
    // Midnight UTC is the evening before in the Americas; the day must not move.
    expect(formatDateShort('2026-01-01', 'en')).toBe('Jan 1, 2026')
  })

  test('a month keeps month and year only', () => {
    expect(formatDateShort('2026-09', 'en')).toBe('Sep 2026')
    expect(formatDateShort('2026-09', 'vi')).toBe('thg 9 2026')
  })

  test('a shape it does not know comes back as it came', () => {
    expect(formatDateShort('yesterday', 'en')).toBe('yesterday')
  })
})

describe('formatDateTimeShort', () => {
  const at = new Date(2026, 8, 3, 14, 5).toISOString()
  const morning = new Date(2026, 8, 3, 7, 8).toISOString()

  test('the date above, then the time the way the language writes it', () => {
    // `\s` because ICU puts a narrow no-break space before AM/PM.
    expect(formatDateTimeShort(at, 'en')).toMatch(/^Sep 3, 2026, 2:05\sPM$/)
    expect(formatDateTimeShort(at, 'de')).toBe('3. Sept. 2026, 14:05')
    expect(formatDateTimeShort(at, 'ja')).toBe('2026年9月3日 14:05')
  })

  test('the date leads even where the language writes the time first', () => {
    expect(formatDateTimeShort(at, 'vi')).toBe('3 thg 9, 2026, 14:05')
  })

  test('a 24-hour clock keeps two digits of hour, so a column of them lines up', () => {
    expect(formatDateTimeShort(morning, 'de')).toBe('3. Sept. 2026, 07:08')
    expect(formatDateTimeShort(morning, 'vi')).toBe('3 thg 9, 2026, 07:08')
  })

  test('every language prints the date first and the minutes last', () => {
    for (const lang of LANG_CODES) {
      const out = formatDateTimeShort(at, lang)
      expect(out.startsWith(formatDateShort('2026-09-03', lang))).toBe(true)
      expect(out).toMatch(/[0-5]5(\s?(PM|AM))?$/)
    }
  })

  test('epoch milliseconds read the same as the ISO text', () => {
    expect(formatDateTimeShort(Date.parse(at), 'fr')).toBe(formatDateTimeShort(at, 'fr'))
  })

  test('something that is not a time is returned as text', () => {
    expect(formatDateTimeShort('not a date', 'en')).toBe('not a date')
    expect(formatDateTimeShort('2026-02-30T10:00', 'en')).toBe('2026-02-30T10:00')
  })

  // A wall clock is the site's own time and must come back digit for digit. Parsed as local
  // time, half past two on the morning Berlin skips an hour came back as 03:30 on a machine
  // there. The process zone cannot be moved reliably (Bun on Windows ignores `TZ`), so instead
  // `Date` refuses, for the length of the test, to parse any string without an offset: the
  // function passes only if it never reads a wall clock through the local zone at all.
  test('reads a wall clock field by field, never through the local zone', () => {
    const Real = Date
    class NoLocalParse extends Real {
      constructor(v?: string | number | Date) {
        if (typeof v === 'string' && !/(Z|[+-]\d{2}:?\d{2})$/.test(v)) throw new Error(`local-time parse of ${v}`)
        if (v === undefined) super()
        else super(v)
      }
    }
    globalThis.Date = NoLocalParse as DateConstructor
    try {
      expect(formatDateTimeShort('2026-03-29T02:30', 'de')).toBe('29. März 2026, 02:30')
      expect(formatDateTimeShort('2026-03-29T02:30', 'vi')).toBe('29 thg 3, 2026, 02:30')
      expect(formatDateTimeShort('2026-03-29T02:30:23', 'en', true)).toMatch(/^Mar 29, 2026, 2:30:23\sAM$/)
    } finally {
      globalThis.Date = Real
    }
  })
})
