// The admin is set in TWO faces, and every way that has gone wrong so far was a way of
// asking the wrong question about which one a thing gets.
//
// `check:admin-kit` catches a screen that re-types a primitive or names a typeface. It cannot
// catch the primitives themselves drifting apart, and that is what shipped: `Setting` renders
// its hint as a `<p>`, `ui/Input` renders the IDENTICAL hint as a `<span>`, and while the face
// was decided by a `.admin p` rule those two rendered the same role in two different faces —
// on one card, four lines apart, on the first Settings tab. Nothing failed. Both call sites
// were correct. The rule was reading the HTML tag and calling it a role.
//
// So the invariant is here in code rather than in a stylesheet's guess: the roles that carry
// the reading face carry the SAME class, and the ones that must stay on the chrome font do
// not carry it at all.

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { CARD, CONTROL, NOTE, NOTE_TEXT, READING, SETTING_LABEL, THEAD, TROW } from './kit'

const ADMIN_CSS = readFileSync('src/admin/admin.css', 'utf8')

describe('the reading face travels on a role', () => {
  it('is one class, and the stylesheet points that class at --font-reading', () => {
    expect(READING).toBe('reading-font')
    expect(ADMIN_CSS).toContain(`.admin .${READING},`)
    expect(ADMIN_CSS).toContain('font-family: var(--font-reading)')
  })

  it('carries the hint, whichever primitive places it', () => {
    // The bug, as an assertion. `Setting` puts NOTE in a <p> and `ui/Input` puts it in a
    // <span>; they are the same role and must be the same face, so the face belongs to the
    // shared constant and not to either element.
    expect(NOTE_TEXT.split(' ')).toContain(READING)
    expect(NOTE.startsWith(NOTE_TEXT)).toBe(true)
    const input = readFileSync('src/admin/ui/Input.tsx', 'utf8')
    expect(input).toContain('NOTE')
    expect(input).not.toContain('text-xs leading-5')
  })

  it('leaves the chrome roles alone', () => {
    // A label, a field, a table head, a row and a card are the machine talking. If one of
    // these ever picks the class up, the division has collapsed to "everything".
    for (const chrome of [SETTING_LABEL, CONTROL, THEAD, TROW, CARD]) {
      expect(chrome.split(' ')).not.toContain(READING)
    }
  })
})

describe('the two faces are normalised to one apparent size', () => {
  // Measured in the browser, x-height per 1em: JetBrains Mono 0.550, Inter 0.539, IBM Plex
  // Mono 0.516, Literata 0.508, Source Sans 3 0.486, Source Serif 4 0.481. So a hint set in
  // the reading face beside a label set in the chrome face is up to 13% smaller at the same
  // `font-size`, which is what read as the second voice being an afterthought.
  it('takes the ratio from the chrome font, so an uploaded face is covered too', () => {
    // `from-font` on body computes to the chrome face's own ratio and INHERITS, so anything
    // switching to --font-reading is re-sized without either face being named. A lookup
    // table could not do this: `settings.customFont` accepts a face that does not exist yet.
    expect(ADMIN_CSS).toContain('font-size-adjust: from-font')
  })

  it('exempts the editor and the pickers, which must show a face as itself', () => {
    // WYSIWYG: a writing surface 8% larger than the published page is a broken promise, and
    // a font picker that renders four faces at one apparent size hides what is being chosen.
    const exempt = ADMIN_CSS.slice(ADMIN_CSS.indexOf('font-size-adjust: none'))
    expect(ADMIN_CSS).toContain('.admin .prose,')
    expect(ADMIN_CSS).toContain('[data-specimen]')
    expect(exempt).toContain('font-size-adjust: none')
    for (const file of ['FontFields', 'TypographyFields']) {
      expect(readFileSync(`src/admin/components/${file}.tsx`, 'utf8')).toContain('data-specimen')
    }
  })
})

describe('no rule decides a face by HTML tag', () => {
  it('has no bare element selector under .admin', () => {
    // The regression this whole change undoes: `.admin p { font-family: … }`. A tag is not a
    // role, and a stylesheet that guesses one from the other is how two identical hints came
    // out in two faces.
    //
    // The list must be EMPTY, not "empty or excused". The one sanctioned way to claim
    // elements is `data-prose`, a PAGE-level statement that everything inside is an article,
    // and its selectors open with `[` rather than a tag — so they do not match this pattern
    // by construction and the assertion stays absolute.
    expect(ADMIN_CSS.match(/^\.admin [a-z][^{,]*,?$/gm) ?? []).toEqual([])
    expect(ADMIN_CSS).toContain('.admin [data-prose] :is(p, li, td, dd, blockquote)')
  })
})
