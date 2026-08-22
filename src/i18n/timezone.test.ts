// The date under a post used to be the SERVER's date, and nothing on any screen said so.
//
// A public page is rendered once and cached, so the machine's timezone decided what date
// every reader saw: a post published at 18:00 UTC read "22 tháng 8" from a box in London and
// "23 tháng 8" from a box in Hanoi, and moving the server silently moved every date on the
// site. Found 2026-08-22 while the analytics day boundary was being made a setting; the
// same zone now answers both.

import { describe, it, expect } from 'bun:test'
import { formatDate, formatMonth } from '@/i18n/i18n'
import { sanitizeTimezone } from '@/content/settings-sanitize'

// 18:00 UTC — which is already tomorrow in Hanoi and still today in London and New York.
const EVENING = '2026-08-22T18:00:00Z'

describe('formatDate in an explicit zone', () => {
  it('gives the same answer for one instant, whatever machine asks', () => {
    expect(formatDate(EVENING, 'vi', 'Asia/Ho_Chi_Minh')).toBe('23 tháng 8, 2026')
    expect(formatDate(EVENING, 'vi', 'UTC')).toBe('22 tháng 8, 2026')
    expect(formatDate(EVENING, 'vi', 'America/New_York')).toBe('22 tháng 8, 2026')
    // ...and the English path, which goes through Intl rather than the hand-built string.
    expect(formatDate(EVENING, 'en', 'Asia/Ho_Chi_Minh')).toBe('August 23, 2026')
    expect(formatDate(EVENING, 'en', 'UTC')).toBe('August 22, 2026')
  })

  it('crosses a month and a year boundary in the right direction', () => {
    expect(formatDate('2026-08-31T18:00:00Z', 'vi', 'Asia/Ho_Chi_Minh')).toBe('1 tháng 9, 2026')
    expect(formatMonth('2026-08-31T18:00:00Z', 'vi', 'Asia/Ho_Chi_Minh')).toBe('Tháng 9')
    expect(formatMonth('2026-08-31T18:00:00Z', 'vi', 'UTC')).toBe('Tháng 8')
    expect(formatDate('2026-12-31T18:00:00Z', 'en', 'Asia/Ho_Chi_Minh')).toBe('January 1, 2027')
  })

  it('reads a zone that observes DST on the correct side of the change', () => {
    // 2026-03-29 01:30 UTC is 02:30 in Berlin (CET, +1); an hour later Berlin is on CEST.
    expect(formatDate('2026-03-28T23:30:00Z', 'en', 'Europe/Berlin')).toBe('March 29, 2026')
  })

  it('falls back rather than throwing on a zone Intl does not know', () => {
    // A bad setting must not be able to take a public page down, and `Intl` throws on a
    // well-shaped but unknown name — which is exactly what a typo produces.
    expect(() => formatDate(EVENING, 'en', 'Asia/Atlantis')).not.toThrow()
    expect(formatDate(EVENING, 'en', 'Asia/Atlantis')).toBe(formatDate(EVENING, 'en', ''))
    expect(formatDate('not a date', 'en', 'UTC')).toBe('not a date')
  })
})

describe('sanitizeTimezone', () => {
  it('keeps a real zone, empties a blank, and refuses a fake one', () => {
    expect(sanitizeTimezone('Asia/Ho_Chi_Minh', '')).toBe('Asia/Ho_Chi_Minh')
    expect(sanitizeTimezone('  UTC  ', '')).toBe('UTC')
    expect(sanitizeTimezone('', 'Asia/Ho_Chi_Minh')).toBe('')
    // A fake keeps the CURRENT value rather than resetting to empty: a typo in one save
    // should not silently move every date on the site to the server's zone.
    expect(sanitizeTimezone('Asia/Atlantis', 'Asia/Ho_Chi_Minh')).toBe('Asia/Ho_Chi_Minh')
    expect(sanitizeTimezone(42, 'UTC')).toBe('UTC')
    expect(sanitizeTimezone(null, 'UTC')).toBe('UTC')
  })
})
