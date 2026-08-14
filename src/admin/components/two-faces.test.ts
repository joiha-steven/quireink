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

describe('the reading face keeps its own letter-spacing', () => {
  // THE bug the owner reported, twice, in different words: "sát nhau" — the letters are on
  // top of each other. `MONO_TRACKING` pulls a mono chrome in by -0.04/-0.05em because IBM
  // Plex Mono and JetBrains Mono are wide faces, and it is applied to `body`, so it INHERITS.
  // Put a serif on any descendant and it is set -0.05em too: Literata at 12px came out at
  // -0.8px, on every hint in the admin.
  it('resets tracking wherever it claims the face', () => {
    // Not a separate rule: the reset sits in the SAME block as the font-family, so a future
    // selector cannot pick up one without the other.
    const at = DECLARATIONS.indexOf(`.admin .${READING},`)
    const block = DECLARATIONS.slice(at, DECLARATIONS.indexOf('}', at))
    expect(block).toContain('font-family: var(--font-reading)')
    expect(block).toContain('letter-spacing: normal')
  })

  it('is what the public sheet already does, on the same class name', () => {
    // `.t-small:not(.reading-font)` / `.t-body:not(.reading-font)` — the correction's own
    // comment says the reader's words "carry their own letter-spacing and are left alone".
    // It works there because public reading text is always inside one of those wrappers;
    // there is no wrapper in the admin, which is why it has to be said again here.
    const faces = readFileSync('src/render/font-faces.ts', 'utf8')
    expect(faces).toContain(`.t-small:not(.${READING})`)
    expect(faces).toContain(`.t-body:not(.${READING})`)
  })

  it('lets a specimen show a face as itself', () => {
    // A picker tile painted in Literata under a mono chrome was previewing it crushed, which
    // is the one place the face is the thing being judged.
    expect(DECLARATIONS).toContain('.admin [data-specimen],')
    for (const file of ['FontFields', 'TypographyFields', 'PostForm', 'PageForm']) {
      expect(readFileSync(`src/admin/components/${file}.tsx`, 'utf8')).toContain('data-specimen')
    }
  })

  it('does not reach for font-size-adjust to even the two faces up', () => {
    // Measured: `line-height` resolves against the COMPUTED font-size, never the adjusted
    // one — `20px`, unitless `1.6` and `normal` all give an identical line box with the
    // adjustment on and off, while the glyphs inside grow 8%. So it silently takes 8% of the
    // leading off every element it touches (12.5% for a Source Serif 4 reading face), and
    // Tailwind's absolute line-heights mean that is every one of them. The x-height gap is
    // ordinary typography; text with less air than it was drawn for is what a reader feels.
    expect(DECLARATIONS).not.toContain('font-size-adjust')
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
