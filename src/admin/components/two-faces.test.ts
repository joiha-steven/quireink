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

/**
 * The sheet with its comments removed, for anything asserting what the CSS DOES.
 *
 * This file is mostly comments, and they quote the rules they are about — including the ones
 * that were deleted and why. Matching raw text therefore reports a declaration that is not
 * there: the `font-size-adjust` assertion below failed against the paragraph explaining that
 * `font-size-adjust` had been taken out. Same shape as the `fontFamily` rule in
 * `check:admin-kit`, which failed on a locale key called `fontFamilyLabel`.
 */
const DECLARATIONS = ADMIN_CSS.replace(/\/\*[\s\S]*?\*\//g, '')

describe('the reading face travels on a role', () => {
  it('is one class, and the stylesheet points that class at --font-reading', () => {
    expect(READING).toBe('reading-font')
    expect(DECLARATIONS).toContain(`.admin .${READING},`)
    expect(DECLARATIONS).toContain('font-family: var(--font-reading)')
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

describe('the admin does not wear the site\'s chrome font', () => {
  // The whole reason the tracking bug existed. `MONO_TRACKING` corrects a wide monospace by
  // -0.05em, it was applied to `body`, and it INHERITED — so every serif on a descendant was
  // drawn at -0.05em: Literata at 12px at -0.8px, letters touching, on every hint, and both
  // serif tiles in the font picker previewed crushed. That was "sát nhau".
  //
  // It is fixed at the source rather than patched at each site: the admin has its own chrome
  // face. A mono chrome font is a branding choice about what a READER sees; the tool the
  // owner works in is not the place to spend it.
  it('emits neither the chrome font nor its tracking correction', () => {
    const spa = readFileSync('src/web/admin/spa.ts', 'utf8')
    expect(spa).not.toContain('chromeFontCss(')
    expect(spa).not.toContain('MONO_TRACKING,')
    expect(spa).not.toContain('data-chrome-font="')
  })

  it('still emits the reading font, because the editor is WYSIWYG', () => {
    // The line the two faces depend on. Drop this and the editor writes in the chrome face
    // and publishes in another.
    expect(readFileSync('src/web/admin/spa.ts', 'utf8')).toContain('fontPresetCss(settings.fontPreset)')
  })

  it('does not reach for font-size-adjust to even the two faces up', () => {
    // Measured: `line-height` resolves against the COMPUTED font-size, never the adjusted
    // one — `20px`, unitless `1.6` and `normal` all give an identical line box with the
    // adjustment on and off, while the glyphs inside grow 8%. So it silently takes 8% of the
    // leading off every element it touches, and Tailwind's absolute line-heights mean that is
    // every one of them. An x-height gap between two faces is ordinary typography; text with
    // less air than it was drawn for is what a reader feels.
    expect(DECLARATIONS).not.toContain('font-size-adjust')
  })

  it('marks a surface that names a typeface, which is what check:admin-kit allows one on', () => {
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
    expect(DECLARATIONS.match(/^\.admin [a-z][^{,]*,?$/gm) ?? []).toEqual([])
    expect(DECLARATIONS).toContain('.admin [data-prose] :is(p, li, td, dd, blockquote)')
  })
})
