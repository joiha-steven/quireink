// The admin is set in ONE face, and the one place that is not is the editor.
//
// This file was `two-faces.test.ts` and it guarded the opposite rule. Both rules came from the
// owner eight days apart — two faces on 2026-08-14, one face on 2026-08-15 (*"admin chỉ xài 1
// font thôi, inter"*, then *"trừ phần editor, khung soạn thảo và tiêu đề soạn thảo vẫn dùng
// font mà frontend xài"*) — and the file is rewritten rather than deleted because the FAILURE
// MODES it was built around are unchanged. Whichever rule is in force, the way it breaks is
// that a primitive and a screen disagree about which face a thing wears, and nothing goes red.
//
// The old file's finding, kept because it is the reason these assertions are in code rather
// than in a stylesheet: `Setting` renders its hint as a `<p>` and `ui/Input` renders the
// IDENTICAL hint as a `<span>`, so a `.admin p` rule put two hints of one kind, on one card,
// four lines apart, in two different faces — with both call sites correct. A tag is not a role.
// Under one face that particular bug cannot happen, and the mirror of it can: a screen that
// still carries `READING` keeps a second face alive on a surface that should have lost it.

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CARD, CONTROL, NOTE, NOTE_TEXT, READING, SETTING_LABEL, THEAD, TROW } from './kit'

const ADMIN_CSS = readFileSync('src/admin/admin.css', 'utf8')

/**
 * The sheet with its comments removed, for anything asserting what the CSS DOES.
 *
 * This file is mostly comments, and they quote the rules they are about — including the ones
 * that were deleted and why. Matching raw text therefore reports a declaration that is not
 * there: the `font-size-adjust` assertion below failed against the paragraph explaining that
 * `font-size-adjust` had been taken out.
 */
const DECLARATIONS = ADMIN_CSS.replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * Every admin source file, minus the built bundle (which contains everything by construction)
 * and minus THIS FILE, which quotes every string it forbids. Scanning itself is the same
 * false alarm `check:admin-kit` hit on a locale key called `fontFamilyLabel`, and a guard that
 * cries wolf is a guard somebody switches off.
 */
const SELF = 'one-face.test.ts'

/**
 * A file's CODE, with its comments taken out.
 *
 * Needed for the same reason `DECLARATIONS` is: `SettingsView` carries the line
 * `{/* READING — what a reader gets on a post … *\/}`, which is about the settings TAB called
 * Reading and has nothing to do with a typeface. A word-boundary match on the raw text called
 * it a holder of the reading face. This is the third time on this file that a guard has fired
 * on prose about the thing rather than the thing.
 */
const code = (file: string): string =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n')

function sources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.name === 'dist' || name.name === SELF) continue
    const path = join(dir, name.name)
    if (name.isDirectory()) out.push(...sources(path))
    else if (path.endsWith('.tsx') || path.endsWith('.ts')) out.push(path)
  }
  return out
}

describe('the admin wears one face', () => {
  it('does not put a second face on the roles that carry the chrome', () => {
    // The hint was the last holder. It is what a person READS on a settings screen, which is
    // exactly why it was the most tempting to set in the reading face, and exactly why it was
    // the most visible when the answer changed. Its distinction is now size and leading only.
    for (const role of [NOTE_TEXT, NOTE, SETTING_LABEL, CONTROL, THEAD, TROW, CARD]) {
      expect(role.split(' ')).not.toContain(READING)
    }
  })

  it('keeps the hint primitive shared, so no screen re-types it', () => {
    // `ui/Input` must place `NOTE`, not a copy of its classes. Pinned to the CURRENT size
    // string: the old assertion named `text-xs leading-5`, which the primitive stopped setting
    // in the 2026-08-15 type rework, so it would have passed for the wrong reason forever.
    const input = readFileSync('src/admin/ui/Input.tsx', 'utf8')
    expect(input).toContain('NOTE')
    expect(input).not.toContain('text-[0.8125rem]')
  })

  it('gives the reading face to the editor and nothing else', () => {
    // THE list, and it is short on purpose. `PostForm` is the title field — the published
    // headline being typed, so it has to be the published face. `TypographyFields` is the font
    // picker's specimen tiles, which are not a preview if they are not painted in the family
    // they offer. `type.ts` is the declaration. A fourth file means the 2026-08-15 decision is
    // being re-opened by accident.
    const holders = sources('src/admin')
      .filter((f) => /\bREADING\b/.test(code(f)))
      .map((f) => f.replaceAll('\\', '/'))
      .sort()
    expect(holders).toEqual([
      'src/admin/components/PostForm.tsx',
      'src/admin/components/TypographyFields.tsx',
      'src/admin/components/kit.tsx', // re-export only
      'src/admin/components/scale.ts',
    ].sort())
  })

  it('still points that class at the reading font, or the editor writes in the wrong one', () => {
    expect(READING).toBe('reading-font')
    expect(DECLARATIONS).toContain(`.admin .${READING}`)
    expect(DECLARATIONS).toContain('font-family: var(--font-reading)')
  })

  it('has retired the page-level prose escape hatch', () => {
    // `[data-prose]` claimed every `p`/`li`/`td` inside a page for the second face. With one
    // face there is nothing for it to switch to, and a rule that switches nothing is the thing
    // this file keeps being rewritten because of.
    expect(DECLARATIONS).not.toContain('data-prose')
    for (const file of sources('src/admin')) {
      expect(code(file)).not.toContain('data-prose')
    }
  })
})

describe('the admin does not wear the site\'s chrome font either', () => {
  // A mono chrome font is a branding choice about what a READER sees. Spending it on the tool
  // put a monospace on every label, tab, button and table cell; the owner's verdict on
  // 2026-08-14 was *"nhìn rối thiệt"*. That decision survives the one-face change — the face
  // the admin settled on is Inter, not the site's chrome font.
  it('emits neither the chrome font nor its tracking correction', () => {
    const spa = readFileSync('src/web/admin/spa.ts', 'utf8')
    expect(spa).not.toContain('chromeFontCss(')
    expect(spa).not.toContain('MONO_TRACKING,')
    expect(spa).not.toContain('data-chrome-font="')
  })

  it('still emits the reading font, because the editor is WYSIWYG', () => {
    // The line the editor depends on. Drop it and the owner writes in Inter and publishes in
    // the site's face — which is the whole reason the editor was carved out of the one-face
    // rule rather than swept into it.
    expect(readFileSync('src/web/admin/spa.ts', 'utf8')).toContain('fontPresetCss(settings.fontPreset)')
  })

  it('does not reach for font-size-adjust to even two faces up', () => {
    // Measured when there WERE two: `line-height` resolves against the COMPUTED font-size,
    // never the adjusted one, so the adjustment silently takes 8% of the leading off every
    // element it touches. Kept as an assertion because the editor still runs two faces on one
    // screen and the temptation returns with it.
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
    // The regression the whole two-faces effort undid: `.admin p { font-family: … }`. The list
    // must be EMPTY, not "empty or excused".
    expect(DECLARATIONS.match(/^\.admin [a-z][^{,]*,?$/gm) ?? []).toEqual([])
  })
})
