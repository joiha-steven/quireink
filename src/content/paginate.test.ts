import { describe, it, expect } from '@/test/vitest'
import { parsePathPage, paginate } from '@/content/paginate'

describe('parsePathPage', () => {
  it('returns null for "1" (page 1 lives at the bare path, no dup URL)', () => {
    expect(parsePathPage('1')).toBeNull()
  })

  it('returns the number for a real deep page (>= 2)', () => {
    expect(parsePathPage('3')).toBe(3)
  })

  it('returns null for non-numeric junk', () => {
    expect(parsePathPage('abc')).toBeNull()
    expect(parsePathPage('2x')).toBeNull()
  })

  // `Number()` said yes to every one of these, so each was a second address for a page
  // that already had one, and leading zeros never run out.
  it('takes one spelling of a number and no others', () => {
    for (const raw of ['01', '007', '1.0', '2.0', '+2', ' 2', '2 ', '1e1', '0x2', '0b10', '2n', '', '-2', '٢']) {
      expect([raw, parsePathPage(raw)]).toEqual([raw, null])
    }
    expect(parsePathPage('2')).toBe(2)
    expect(parsePathPage('10')).toBe(10)
  })
})

describe('paginate', () => {
  const all = [1, 2, 3, 4, 5, 6, 7]

  it('slices the requested page and reports total pages', () => {
    expect(paginate(all, 2, 3)).toEqual({ items: [4, 5, 6], page: 2, totalPages: 3 })
  })

  it('clamps an out-of-range page into the valid range', () => {
    expect(paginate(all, 99, 3).page).toBe(3)
    expect(paginate(all, 0, 3).page).toBe(1)
  })

  it('always reports at least 1 page for an empty list', () => {
    expect(paginate([], 1, 3)).toEqual({ items: [], page: 1, totalPages: 1 })
  })
})
