// The search's two load-bearing behaviours: accent folding, and never matching on English
// when the admin is not in English.
//
// The tour proves the index is COMPLETE against the rendered screen. This proves the parts of
// the matching that a rendered screen cannot show you — a Vietnamese owner typing without
// tone marks, and the fact that nothing here is keyed to English strings.

import { describe, expect, it } from 'bun:test'
import en from '@/locales/admin/en'
import vi from '@/locales/admin/vi'
import { SETTINGS_INDEX, fold, searchSettings } from './settings-index'

describe('fold', () => {
  it('strips Vietnamese tone marks and the stroke on đ', () => {
    expect(fold('Bề rộng')).toBe('be rong')
    expect(fold('Sao lưu tự động')).toBe('sao luu tu dong')
    expect(fold('Đọc')).toBe('doc')
    // The horn is a combining mark like any other, so ư and ơ fold too.
    expect(fold('Người dùng')).toBe('nguoi dung')
  })

  it('leaves plain ASCII alone apart from case', () => {
    expect(fold('SMTP Host')).toBe('smtp host')
  })
})

describe('searchSettings', () => {
  it('finds a setting typed WITHOUT tone marks', () => {
    const hits = searchSettings('be rong', vi)
    expect(hits.some((h) => h.label === 'siteWidth')).toBe(true)
  })

  it('finds the same setting typed WITH them', () => {
    const hits = searchSettings('bề rộng', vi)
    expect(hits.some((h) => h.label === 'siteWidth')).toBe(true)
  })

  it('matches the NOTE as well as the label, because people describe rather than name', () => {
    // "672" appears only in the width hint, never in any label.
    const hits = searchSettings('672', vi)
    expect(hits.map((h) => h.label)).toContain('siteWidth')
  })

  it('says which tab, which is the whole point', () => {
    expect(searchSettings('smtp', en).every((h) => h.tab === 'connections')).toBe(true)
  })

  it('ignores a query of one character, which would match half the index', () => {
    expect(searchSettings('a', en)).toEqual([])
    expect(searchSettings('', en)).toEqual([])
  })

  it('returns nothing rather than everything for a miss', () => {
    expect(searchSettings('zzzzz', vi)).toEqual([])
  })

  // The failure this guards against: indexing English and shipping a search that only works
  // for one of the six languages the admin ships in.
  it('searches the ACTIVE language, not English', () => {
    expect(searchSettings('sao luu', vi).length).toBeGreaterThan(0)
    expect(searchSettings('sao luu', en)).toEqual([])
    expect(searchSettings('backup', en).length).toBeGreaterThan(0)
  })
})

describe('the index itself', () => {
  it('names a tab that exists for every entry', () => {
    const tabs = new Set(['site', 'layout', 'reading', 'appearance', 'seo', 'connections', 'system'])
    expect(SETTINGS_INDEX.filter((e) => !tabs.has(e.tab))).toEqual([])
  })

  it('resolves to a non-empty string in every one of the six locales', async () => {
    const locales = await Promise.all(
      ['en', 'vi', 'de', 'ja', 'zh', 'ko'].map(async (l) =>
        [l, (await import(`@/locales/admin/${l}`)).default] as const),
    )
    const empty: string[] = []
    for (const [name, dict] of locales) {
      for (const e of SETTINGS_INDEX) {
        if (!String(dict[e.label] ?? '').trim()) empty.push(`${name}.${String(e.label)}`)
        if (e.note && !String(dict[e.note] ?? '').trim()) empty.push(`${name}.${String(e.note)}`)
      }
    }
    expect(empty).toEqual([])
  })

  it('lists nothing twice', () => {
    const keys = SETTINGS_INDEX.map((e) => `${e.tab}:${String(e.label)}`)
    expect(keys.length).toBe(new Set(keys).size)
  })
})
