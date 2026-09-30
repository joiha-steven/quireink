// The admin's short dates follow the admin's language (2026-09-30). Before, every language got
// `d/m/yy`, and an English reader took "3/9/26" for the ninth of March.
import { describe, expect, test } from 'bun:test'
import { formatDateShort, formatDateTimeShort } from '@/admin-shared/when'

describe('formatDateShort', () => {
  test('a calendar day in each language’s own order', () => {
    expect(formatDateShort('2026-09-03', 'en')).toBe('9/3/26')
    expect(formatDateShort('2026-09-03', 'vi')).toBe('3/9/26')
    expect(formatDateShort('2026-09-03', 'de')).toBe('3.9.26')
    expect(formatDateShort('2026-09-03', 'ja')).toBe('26/9/3')
  })

  test('a calendar day is that day wherever the reader is', () => {
    // Midnight UTC is the evening before in the Americas; the day must not move.
    expect(formatDateShort('2026-01-01', 'en')).toBe('1/1/26')
  })

  test('a month keeps month and year only', () => {
    expect(formatDateShort('2026-09', 'en')).toBe('9/26')
    expect(formatDateShort('2026-09', 'vi')).toBe('9/26')
  })

  test('a shape it does not know comes back as it came', () => {
    expect(formatDateShort('yesterday', 'en')).toBe('yesterday')
  })
})

describe('formatDateTimeShort', () => {
  const at = new Date(2026, 8, 3, 14, 5).toISOString()

  test('the day in the language’s order, then a 24-hour time', () => {
    expect(formatDateTimeShort(at, 'en')).toBe('9/3/26 - 14:05')
    expect(formatDateTimeShort(at, 'vi')).toBe('3/9/26 - 14:05')
    expect(formatDateTimeShort(at, 'de')).toBe('3.9.26 - 14:05')
  })

  test('epoch milliseconds read the same as the ISO text', () => {
    expect(formatDateTimeShort(Date.parse(at), 'fr')).toBe(formatDateTimeShort(at, 'fr'))
  })

  test('something that is not a time is returned as text', () => {
    expect(formatDateTimeShort('not a date', 'en')).toBe('not a date')
  })
})
