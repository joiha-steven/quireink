import { describe, expect, it } from 'bun:test'
import { plural, pluralOrder } from '@/i18n/plural'
import { SITE_LANGS } from '../../locales/langs'

describe('an engine with older plural data', () => {
  // FIRST IN THE FILE, on purpose: the helper keeps one PluralRules per locale, so once any
  // test below has asked for Spanish the stand-in engine here would never be consulted.
  it('still picks the plural by its name, not by where it falls in the engine list', () => {
    // A browser from before about 2022 has no "many" for Spanish, so it answers "other" for 5;
    // by POSITION that was the middle form. The forms are keyed on the table now.
    const Real = Intl.PluralRules
    class Old extends Real {
      override resolvedOptions() { return { ...super.resolvedOptions(), pluralCategories: ['one', 'other'] as Intl.LDMLPluralRule[] } }
      override select(n: number) { return n === 1 ? 'one' : 'other' as Intl.LDMLPluralRule }
    }
    ;(Intl as { PluralRules: unknown }).PluralRules = Old
    try {
      expect(plural('{n} palabra|{n} de palabras|{n} palabras', 5, 'es')).toBe('5 palabras')
      expect(plural('{n} palabra|{n} de palabras|{n} palabras', 1, 'es')).toBe('1 palabra')
    } finally {
      ;(Intl as { PluralRules: unknown }).PluralRules = Real
    }
  })
})

describe('plural', () => {
  it('picks one and other in English', () => {
    expect(plural('{n} word|{n} words', 1, 'en')).toBe('1 word')
    expect(plural('{n} word|{n} words', 0, 'en')).toBe('0 words')
    expect(plural('{n} word|{n} words', 2, 'en')).toBe('2 words')
  })

  it('picks all three Russian forms that the first five counts need', () => {
    const t = '{n} слово|{n} слова|{n} слов|{n} слова'
    expect([1, 2, 3, 4, 5, 21, 22, 25].map((n) => plural(t, n, 'ru')))
      .toEqual(['1 слово', '2 слова', '3 слова', '4 слова', '5 слов', '21 слово', '22 слова', '25 слов'])
  })

  it('leaves a single-form string alone, which is every language without plurals', () => {
    expect(plural('{n} 語', 1, 'ja')).toBe('1 語')
    expect(plural('{n} chữ', 7, 'vi')).toBe('7 chữ')
  })

  it('shows the formatted number when given one', () => {
    expect(plural('{n} view|{n} views', 1200, 'en', '1.2K')).toBe('1.2K views')
  })

  it('knows every language this product ships', () => {
    for (const { value } of SITE_LANGS) expect(pluralOrder(value)).toContain('other')
  })
})

