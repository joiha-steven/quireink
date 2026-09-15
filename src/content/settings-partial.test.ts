// WHAT A PARTIAL SAVE MUST NOT DESTROY.
//
// `PUT /api/settings` takes a DEEP PARTIAL: the admin walks the fields that changed and sends
// only those. That is what makes one Save key over seven tabs affordable, and it is also what
// gives an ABSENT key a meaning — and for three days the meaning some of them had was "erase it".
//
// Three live faults, all found on 2026-09-15 by running the sanitisers rather than by reading
// them, and none of which could exist before ADR 0054 (the React admin PUT the whole settings
// object, so nothing was ever absent):
//
//   1. A save that never mentioned `customFont` returned `DEFAULT_FONT`. Changing the blog's
//      title on one tab deleted an uploaded typeface stored from another.
//   2. Editing ONE field of ONE menu row wiped the whole menu. `settings-form.ts` builds
//      `menu.1.href` as an array with a hole at 0; `JSON.stringify` writes the hole as `null`;
//      `sanitizeMenu` dropped the `null` for not being an object and dropped the survivor for
//      having no `label`. Result: `[]`.
//   3. The same shape cost `featured` every slug before the one touched, and cost every
//      surviving front-page strip its count and columns.
//
// The rule these assert: an absent key means UNCHANGED, a hole in an array means that element
// is unchanged, and an object inside a partial array is a patch on the stored element rather
// than a replacement for it. A removal is not expressible as a hole — it renumbers and sends
// every row — so nothing here is ambiguous.
import { describe, expect, it } from 'bun:test'
import { sanitizeFont } from './settings-type'
import { sanitizeFeatured, sanitizeMenu } from './settings-sanitize'
import { sanitizeFront } from './settings-front'
import { DEFAULT_SETTINGS } from './settings'

/** What `place()` produces for a dirty field at `i`, after a round trip through JSON. */
const partialAt = (i: number, value: unknown): unknown[] => {
  const sparse: unknown[] = []
  sparse[i] = value
  return JSON.parse(JSON.stringify(sparse)) as unknown[]
}

describe('a save that does not mention a setting leaves it alone', () => {
  const font = { family: 'Souvenir', faces: [{ weight: 400, url: '/files/a.woff2' }] }

  it('keeps the uploaded typeface when customFont is absent', () => {
    expect(sanitizeFont(undefined, font)).toEqual(font)
  })

  it('keeps the faces when only the family is sent', () => {
    expect(sanitizeFont({ family: 'Souvenir Two' }, font))
      .toEqual({ family: 'Souvenir Two', faces: font.faces })
  })

  it('still clears the font when the faces are sent EMPTY, which is what Remove means', () => {
    expect(sanitizeFont({ family: '', faces: [] }, font)).toEqual({ family: '', faces: [] })
  })
})

describe('editing one row of a list does not delete the others', () => {
  const menu = [{ label: 'Home', href: '/' }, { label: 'About', href: '/about' }]

  it('keeps every menu row, and applies the one field that changed', () => {
    expect(sanitizeMenu(partialAt(1, { href: '/about-us' }), menu))
      .toEqual([{ label: 'Home', href: '/' }, { label: 'About', href: '/about-us' }])
  })

  it('keeps the featured slugs before the one that moved', () => {
    expect(sanitizeFeatured(partialAt(2, 'three'), ['one', 'two', 'three']))
      .toEqual(['one', 'two', 'three'])
  })

  it('keeps each front strip\'s own count when another strip is edited', () => {
    const stored = {
      ...DEFAULT_SETTINGS.home.front,
      strips: [
        { category: 'essays', count: 6, columns: 2 },
        { category: 'notes', count: 9, columns: 1 },
      ],
    }
    const out = sanitizeFront({ strips: partialAt(1, { count: 4 }) }, stored)
    expect(out.strips).toEqual([
      { category: 'essays', count: 6, columns: 2 },
      { category: 'notes', count: 4, columns: 1 },
    ])
  })
})

describe('a whole list sent whole still replaces it', () => {
  it('shortens the menu when every surviving row is sent', () => {
    const menu = [{ label: 'Home', href: '/' }, { label: 'About', href: '/about' }]
    expect(sanitizeMenu([{ label: 'Home', href: '/' }], menu))
      .toEqual([{ label: 'Home', href: '/' }])
  })

  it('empties the featured list when an empty array is sent', () => {
    expect(sanitizeFeatured([], ['one', 'two'])).toEqual([])
  })
})
