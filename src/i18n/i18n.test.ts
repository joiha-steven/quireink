import { describe, it, expect } from '@/test/vitest'
import { t, formatDate } from '@/i18n/i18n'
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
