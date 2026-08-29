// The five highlighter swatches have five different names.
//
// They shipped with one. Every button carried `title={t.tbHighlight}` and nothing else: no
// text, no `aria-label`, five controls with one identical accessible name, told apart only
// by an inline background colour on the span inside them. Anything not reading colour — a
// screen reader, and anyone who cannot separate those five hues — was offered five buttons
// it had no way to choose between. Found by listing the bubble bar's accessible names in a
// browser and seeing "Highlighter" five times.
//
// The names already existed in all eleven languages, because the settings screen has always
// labelled the same five pickers. This asserts the lookup that reaches them still resolves
// for every ink and every language, which is the part that can rot: `INKS` is a list in the
// renderer and the strings are keys in `locales/`, and nothing but this connects them.

import { describe, expect, it } from 'bun:test'
import { INKS } from '@/render/ink'
import { adminT } from '@/i18n/admin-i18n'
import { LANG_CODES } from '@/locales/langs'

/** The same derivation `EditorMenus` and `InkFields` both use. */
const key = (ink: string) => `ink${ink[0]!.toUpperCase()}${ink.slice(1)}` as 'inkYellow'

describe('the highlighter inks are named', () => {
  it('has a string for every ink, in every language', () => {
    expect(INKS.length).toBe(5)
    for (const lang of LANG_CODES) {
      const t = adminT(lang)
      for (const ink of INKS) {
        const name = t[key(ink)]
        expect(typeof name).toBe('string')
        expect(name.length).toBeGreaterThan(0)
      }
    }
  })

  it('gives the five DIFFERENT names, which is the whole point', () => {
    for (const lang of LANG_CODES) {
      const t = adminT(lang)
      const names = INKS.map((ink) => t[key(ink)])
      // A language that translated two inks to the same word would put the bug back
      // without failing anything else.
      expect(new Set(names).size).toBe(INKS.length)
    }
  })

  it('builds a label that says what the button does as well as which ink', () => {
    const t = adminT('en')
    const labels = INKS.map((ink) => `${t.tbHighlight}: ${t[key(ink)]}`)
    expect(new Set(labels).size).toBe(INKS.length)
    for (const l of labels) expect(l).toContain(t.tbHighlight)
  })
})
