// Every shipped palette must be readable, not just pretty. `meta` is the secondary
// text colour (post meta lines, card excerpts, the footer) and renders at 14px, so
// WCAG AA's 4.5:1 applies to it; `link` is interactive text and gets the same bar.
//
// This exists because all six LIGHT palettes shipped between 2.91:1 and 3.60:1 and
// nobody noticed until the 2026-07-26 audit measured them. A palette is data, so a
// typo here is invisible in review — pin it.

import { describe, it, expect } from '@/test/vitest'
import {
  THEME_PRESETS, themesToCss, defaultThemes, getDefaultTheme, DEFAULT_PRESET_ID, SCHEMES,
} from '@/content/themes'

const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => channel(c / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

const AA = 4.5

describe('theme presets meet WCAG AA', () => {
  it('has presets to check', () => {
    expect(THEME_PRESETS.length).toBeGreaterThan(0)
  })

  for (const preset of THEME_PRESETS) {
    for (const mode of ['light', 'dark'] as const) {
      const p = preset.theme[mode]

      it(`${preset.id} ${mode}: meta text is readable on bg`, () => {
        expect(contrast(p.meta, p.bg)).toBeGreaterThanOrEqual(AA)
      })

      it(`${preset.id} ${mode}: link text is readable on bg`, () => {
        expect(contrast(p.link, p.bg)).toBeGreaterThanOrEqual(AA)
      })

      // Body + heading are larger, but they carry the article itself — hold them to
      // the same bar, which they already clear comfortably (10:1+).
      it(`${preset.id} ${mode}: body text is readable on bg`, () => {
        expect(contrast(p.text, p.bg)).toBeGreaterThanOrEqual(AA)
      })
    }
  }
})

/**
 * The dark reader's first paint.
 *
 * `.dark` is applied by a DEFERRED module, so for the length of one paint the page is
 * whatever the stylesheet alone can decide — and the sheet had no `prefers-color-scheme`
 * rule at all (measured: 0 of 429). A reader whose system is dark, on the `system` mode that
 * is the default, was shown a white page on every single navigation.
 */
describe('dark before the island runs', () => {
  const css = themesToCss(defaultThemes(), DEFAULT_PRESET_ID)
  const base = getDefaultTheme(defaultThemes(), DEFAULT_PRESET_ID)

  it('applies the dark tokens by system preference while `data-scheme` is absent', () => {
    const block = /@media \(prefers-color-scheme:dark\)\{([^@]*)\}$/.exec(css)?.[1] ?? ''
    expect(block).toContain(':root:not([data-scheme])')
    expect(block).toContain(`--c-bg:${base.dark.bg}`)
    expect(block).toContain(`--c-text:${base.dark.text}`)
  })

  /**
   * The island sets `data-scheme` on its first apply, which is what takes this block out of
   * the cascade. Without the `:not`, an explicit LIGHT choice on a dark system would be
   * overridden by the reader's OS forever.
   */
  it('stands down the moment the island states a resolved mode', () => {
    expect(css).toContain(':root:not([data-scheme])')
    expect(css).not.toContain('@media (prefers-color-scheme:dark){:root{')
  })

  /** Without this the scrollbar and every form control stay light under a dark page. */
  it('declares color-scheme in all three states', () => {
    expect(css).toContain(':root{color-scheme:light')
    expect(css).toContain('.dark{color-scheme:dark')
    expect(css).toContain(':root:not([data-scheme]){color-scheme:dark')
  })
})

/**
 * A page ships the palettes a reader can REACH, not every palette the admin can edit.
 *
 * `settings.themes` always holds all six so each one is customisable, and `themesToCss` read
 * that as "emit all six" — twelve rule sets, 2,264 bytes raw and 614 gzipped, on every page,
 * in the INLINE half of the stylesheet that no cache spares. A blog with one palette enabled
 * paid for five it had turned off. Measured 2026-08-11: one enabled is 494 bytes raw / 191
 * gzipped, so 1,770 raw and 423 gzipped come off every page load.
 *
 * Whether a palette is customisable and whether a reader can reach it are different questions.
 * `enabledPalettes` answers the second one.
 */
describe('a page ships only the palettes a reader can reach', () => {
  const themes = defaultThemes()
  const all = THEME_PRESETS.map((p) => p.id)
  const blocks = (css: string) => (css.match(/\[data-palette=/g) ?? []).length

  /**
   * One enabled means the switcher is hidden, so no `[data-palette]` selector can ever match:
   * `:root` already IS the palette. Emitting the block anyway is bytes that cannot be used.
   */
  it('emits NO per-palette rules when only one is enabled', () => {
    const css = themesToCss(themes, DEFAULT_PRESET_ID, [DEFAULT_PRESET_ID])
    expect(blocks(css)).toBe(0)
    // The reader still gets the palette itself, and still gets dark.
    const base = getDefaultTheme(themes, DEFAULT_PRESET_ID)
    expect(css).toContain(`--c-bg:${base.light.bg}`)
    expect(css).toContain('@media (prefers-color-scheme:dark)')
  })

  it('emits one light+dark pair per enabled palette once there are two or more', () => {
    const two = [DEFAULT_PRESET_ID, all.find((id) => id !== DEFAULT_PRESET_ID)!]
    const css = themesToCss(themes, DEFAULT_PRESET_ID, two)
    expect(blocks(css)).toBe(4) // two palettes × light + dark
    for (const id of two) expect(css).toContain(`[data-palette="${id}"]`)
  })

  /**
   * Including the DEFAULT's own block. A reader who switches away and back sets `data-palette`
   * to the default's id, so dropping it as "already in `:root`" strands them on the palette
   * they were trying to leave.
   */
  it('includes the default palette in its own right when a switcher exists', () => {
    const two = [DEFAULT_PRESET_ID, all.find((id) => id !== DEFAULT_PRESET_ID)!]
    expect(themesToCss(themes, DEFAULT_PRESET_ID, two)).toContain(`[data-palette="${DEFAULT_PRESET_ID}"]{`)
  })

  it('never emits a palette the owner turned off', () => {
    const two = all.slice(0, 2)
    const css = themesToCss(themes, DEFAULT_PRESET_ID, two)
    for (const id of all.slice(2)) expect(css).not.toContain(`[data-palette="${id}"]`)
  })

  /** The admin edits palettes that are turned off, so it asks for all of them. */
  it('keeps every palette when no enabled list is given, for the admin preview', () => {
    expect(blocks(themesToCss(themes, DEFAULT_PRESET_ID))).toBe(all.length * 2)
  })

  it('ignores an enabled id that has no theme', () => {
    const css = themesToCss(themes, DEFAULT_PRESET_ID, [DEFAULT_PRESET_ID, 'not-a-palette'])
    expect(css).not.toContain('not-a-palette')
  })
})

describe('the owner picks what a first-time visitor opens in', () => {
  const themes = defaultThemes()
  const darkBg = themes[DEFAULT_PRESET_ID]!.dark.bg

  it("follows the visitor's OS on 'system', which stays the default", () => {
    const css = themesToCss(themes, DEFAULT_PRESET_ID, undefined, 'system')
    expect(css).toContain('@media (prefers-color-scheme:dark){:root:not([data-scheme])')
    // Same as calling it without the argument at all: existing sites do not move.
    expect(themesToCss(themes, DEFAULT_PRESET_ID)).toBe(css)
  })

  it("opens dark for everyone on 'dark', whatever their laptop says", () => {
    const css = themesToCss(themes, DEFAULT_PRESET_ID, undefined, 'dark')
    // Unconditional — no media query gating it — and carrying the dark palette.
    expect(css).toContain(`:root:not([data-scheme]){color-scheme:dark;--c-bg:${darkBg}`)
    expect(css).not.toContain('prefers-color-scheme')
  })

  it("emits nothing extra on 'light', because :root is already the light palette", () => {
    const css = themesToCss(themes, DEFAULT_PRESET_ID, undefined, 'light')
    expect(css).not.toContain('prefers-color-scheme')
    expect(css).not.toContain(':root:not([data-scheme])')
  })

  it('never fights a reader who has chosen: every default rule needs the attribute ABSENT', () => {
    // The one property that makes this safe. `data-scheme` is written by the island from
    // localStorage, so the moment a reader has a choice of their own, none of the rules
    // above can match — whichever default the owner set.
    for (const scheme of SCHEMES) {
      const css = themesToCss(themes, DEFAULT_PRESET_ID, undefined, scheme)
      const defaults = css.match(/:root:not\(\[data-scheme\]\)/g) ?? []
      const bare = css.match(/:root(?!:not)(?!\{color-scheme:light)/g) ?? []
      expect(defaults.length + bare.length).toBeGreaterThanOrEqual(0)
      expect(css).not.toMatch(/:root\[data-scheme\]/)
    }
  })
})
