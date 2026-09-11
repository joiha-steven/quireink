// The rule in `accent.ts`, which is one sentence with two halves: a word typed WITHOUT
// accents finds any, a word typed WITH them means them. Both halves are load-bearing —
// dropping the first breaks somebody typing on a keyboard with no Vietnamese layout, and
// dropping the second is the bug this file was written for.
import { describe, it, expect } from 'bun:test'
import { accentedWords, indexIn, isAccented, keepsAccents, lanes } from '@/accent'

describe('isAccented', () => {
  it('sees a tone mark, and sees đ', () => {
    expect(isAccented('lề')).toBe(true)
    expect(isAccented('Đường')).toBe(true)
    expect(isAccented('le')).toBe(false)
    expect(isAccented('LAP')).toBe(false)
  })

  it('sees a mark typed as a combining character, not only a precomposed one', () => {
    // What a `<input>` on macOS can hand over: e + U+0302 + U+0300 rather than U+1EC1.
    expect(isAccented('lề')).toBe(true)
  })
})

describe('indexIn', () => {
  const hay = lanes('Căn lề trái, rồi xét tỉ lệ chuyển đổi.')

  it('an unaccented word finds accented text — the reason the index folds at all', () => {
    expect(indexIn(hay, 'can')).toBe(0)
    expect(indexIn(hay, 'ti le')).toBeGreaterThan(0)
  })

  it('an accented word means the accents: "lề" is not "lệ"', () => {
    expect(hay.text.slice(indexIn(hay, 'lề'), indexIn(hay, 'lề') + 2)).toBe('lề')
    // And the other tone finds its own, further along the same sentence.
    expect(indexIn(hay, 'lệ')).toBeGreaterThan(indexIn(hay, 'lề'))
  })

  it('is case-insensitive on both lanes', () => {
    expect(indexIn(hay, 'LỀ')).toBe(indexIn(hay, 'lề'))
    expect(indexIn(hay, 'CAN')).toBe(0)
  })

  it('lines its indices up with the text, whatever the word folds to', () => {
    // The point of the per-character lanes: `đ` folds to `d` and the marks vanish, and a
    // whole-string fold would shift every index after the first of them.
    const h = lanes('Một đường chuyền')
    const at = indexIn(h, 'duong')
    expect(h.text.slice(at, at + 5)).toBe('đường')
  })
})

describe('keepsAccents', () => {
  const text = 'Tỉ lệ chuyển đổi của trang'

  it('lets everything through when the query has no accent to check', () => {
    expect(keepsAccents(text, 'ti le')).toBe(true)
    expect(keepsAccents(text, '')).toBe(true)
  })

  it('drops the row the folded index matched on a different word', () => {
    expect(keepsAccents(text, 'lề')).toBe(false)
    expect(keepsAccents(text, 'lệ')).toBe(true)
  })

  it('keeps a row that holds BOTH spellings, because it holds the one that was asked for', () => {
    expect(keepsAccents('Căn lề trái, rồi xét tỉ lệ', 'lề')).toBe(true)
  })

  it('checks each accented word, and leaves the unaccented ones to the index', () => {
    // "trang" is unaccented, so it is not re-checked here; "lề" is, and it is not there.
    expect(keepsAccents(text, 'lề trang')).toBe(false)
    expect(keepsAccents(text, 'lệ trang')).toBe(true)
  })
})

describe('accentedWords', () => {
  it('names only the words worth a second pass', () => {
    expect(accentedWords('can lề trái')).toEqual(['lề', 'trái'])
    expect(accentedWords('lap trinh')).toEqual([])
  })
})
