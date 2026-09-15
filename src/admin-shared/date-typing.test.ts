// Typing a date into the admin, in eleven languages.
//
// The case this file exists for is `03/04`: the 3rd of April to most of the world, the 4th of
// March in the United States. A field that guesses is a field that publishes three weeks early
// and says nothing.
import { describe, expect, it } from 'bun:test'
import { dayFirst, formatTyped, parseTyped, toValue, typedShape } from './date-typing'

const NOW = new Date(2026, 8, 15, 12, 0)

describe('which number is the day', () => {
  it('asks the language rather than a table', () => {
    expect(dayFirst('vi')).toBe(true)
    expect(dayFirst('en')).toBe(false)
    expect(dayFirst('fr')).toBe(true)
    expect(dayFirst('de')).toBe(true)
  })

  it('reads the same four digits as two different days', () => {
    expect(parseTyped('03/04/2026', 'vi', NOW)).toBe('2026-04-03T00:00')
    expect(parseTyped('03/04/2026', 'en', NOW)).toBe('2026-03-04T00:00')
  })

  it('says what to write, in the order that language writes it', () => {
    expect(typedShape('vi')).toBe('dd/mm/yyyy hh:mm')
    expect(typedShape('en')).toBe('mm/dd/yyyy hh:mm')
  })
})

describe('a four-digit first number is always a year', () => {
  // The stored shape, and what somebody pastes. Unambiguous everywhere, so the language does
  // not get a vote.
  for (const lang of ['vi', 'en', 'ja'] as const) {
    it(`reads ISO the same way in ${lang}`, () => {
      expect(parseTyped('2026-03-04 09:30', lang, NOW)).toBe('2026-03-04T09:30')
    })
  }
})

describe('forgiving about the rest', () => {
  it('takes any punctuation between the numbers', () => {
    for (const written of ['4/3/2026', '4-3-2026', '4.3.2026', '4 3 2026']) {
      expect(parseTyped(written, 'vi', NOW)).toBe('2026-03-04T00:00')
    }
  })

  it('takes a time, or leaves it at midnight', () => {
    expect(parseTyped('4/3/2026 9:05', 'vi', NOW)).toBe('2026-03-04T09:05')
    expect(parseTyped('4/3/2026 09:05', 'vi', NOW)).toBe('2026-03-04T09:05')
    expect(parseTyped('4/3/2026', 'vi', NOW)).toBe('2026-03-04T00:00')
  })

  it('reads a two-digit year against the clock, not a constant', () => {
    // `26` is 2026 today and must not become the year 26; the century is taken from `now`, so
    // this does not quietly go wrong in 2100.
    expect(parseTyped('4/3/26', 'vi', NOW)).toBe('2026-03-04T00:00')
    expect(parseTyped('4/3/26', 'vi', new Date(2103, 0, 1))).toBe('2126-03-04T00:00')
  })
})

describe('leaves the stored value alone when it cannot be sure', () => {
  // null means "do not touch what is saved", so a half-typed date never destroys a good one.
  for (const half of ['', '  ', '4', '4/3', 'tomorrow', '//']) {
    it(`refuses ${JSON.stringify(half)}`, () => {
      expect(parseTyped(half, 'vi', NOW)).toBeNull()
    })
  }

  it('refuses a day that is not in that month', () => {
    // ⚠️ THE ROUND TRIP IS THE VALIDATION. `new Date(2026, 1, 31)` is the 3rd of March, without
    // complaint — so a one-digit typo would move a post to another month and the field would
    // show it as accepted.
    expect(parseTyped('31/2/2026', 'vi', NOW)).toBeNull()
    expect(parseTyped('31/4/2026', 'vi', NOW)).toBeNull()
    expect(parseTyped('29/2/2026', 'vi', NOW)).toBeNull()
  })

  it('takes the 29th of February in a leap year', () => {
    expect(parseTyped('29/2/2028', 'vi', NOW)).toBe('2028-02-29T00:00')
  })

  it('refuses an impossible month or clock', () => {
    expect(parseTyped('4/13/2026', 'vi', NOW)).toBeNull()
    expect(parseTyped('4/3/2026 25:00', 'vi', NOW)).toBeNull()
    expect(parseTyped('4/3/2026 12:61', 'vi', NOW)).toBeNull()
  })
})

describe('writing the value back into the box', () => {
  it('uses the shape the box accepts, in that language order', () => {
    expect(formatTyped('2026-03-04T09:30', 'vi')).toBe('04/03/2026 09:30')
    expect(formatTyped('2026-03-04T09:30', 'en')).toBe('03/04/2026 09:30')
  })

  it('round-trips through the parser', () => {
    for (const lang of ['vi', 'en'] as const) {
      const written = formatTyped('2026-12-31T23:59', lang)
      expect(parseTyped(written, lang, NOW)).toBe('2026-12-31T23:59')
    }
  })

  it('is empty for an empty value, rather than today', () => {
    // A field that invents a date the moment it is empty is a field that schedules something
    // nobody asked for.
    expect(formatTyped('', 'vi')).toBe('')
    expect(formatTyped('not a date', 'vi')).toBe('')
  })
})

describe('the stored shape', () => {
  it('is a wall clock with no zone, padded', () => {
    expect(toValue(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02T03:04')
  })
})
