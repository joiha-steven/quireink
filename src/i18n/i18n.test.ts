import { describe, it, expect } from '@/test/vitest'
import { t, formatDate } from '@/i18n/i18n'
import { formatWallClock } from '@/i18n/format'
import en from '@/locales/en'
import type { SiteLang } from '@/types'

describe('t (locale lookup)', () => {
  it('returns the requested locale dictionary', () => {
    expect(t('vi')).not.toBe(en)
  })

  it('falls back to English for an unknown language', () => {
    expect(t('xx' as SiteLang)).toBe(en)
  })
})

describe('formatDate', () => {
  it('uses the explicit Vietnamese long form', () => {
    expect(formatDate('2026-06-19', 'vi')).toBe('19 tháng 6, 2026')
  })

  it('returns the raw input for an unparseable date', () => {
    expect(formatDate('not-a-date', 'en')).toBe('not-a-date')
  })
})

describe('formatWallClock', () => {
  it('prints the digits it was given, in the language it was asked for', () => {
    // The editor's date field holds the BLOG's wall clock. Reading it as the browser's and
    // printing it in the browser's zone told an owner in one place a time that was neither
    // theirs nor their blog's.
    const said = formatWallClock('2026-06-19T09:30', 'en')
    expect(said).toContain('9:30')
    expect(said).toContain('2026')
    expect(said).toContain('Jun')
    expect(formatWallClock('2026-06-19T09:30', 'vi')).toContain('09:30')
  })

  it('moves the hour by nothing, whatever the machine thinks the time is', () => {
    // Fourteen hours apart in the same string: if anything converted, one of these would
    // have rolled over into another day.
    expect(formatWallClock('2026-06-19T00:15', 'en')).toContain('Jun 19')
    expect(formatWallClock('2026-06-19T23:45', 'en')).toContain('Jun 19')
  })

  it('keeps an hour the machine\'s own timezone does not have', () => {
    // 02:30 on 2026-03-08 does not exist in New York: that zone springs forward at 02:00, and
    // building a Date from a zoneless string uses the MACHINE's zone. A browser there moved a
    // perfectly ordinary scheduled time to 03:30 and printed that back at the owner. This
    // assertion only has teeth when the suite runs in such a zone, which is why the reasoning
    // is written out where the function is: TZ=America/New_York, and the old spelling of this
    // said 3:30.
    expect(formatWallClock('2026-03-08T02:30', 'en')).toContain('2:30')
  })

  it('hands back what it cannot read', () => {
    expect(formatWallClock('', 'en')).toBe('')
    expect(formatWallClock('not a time', 'en')).toBe('not a time')
  })
})
