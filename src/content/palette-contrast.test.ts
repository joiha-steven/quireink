// Every colour a reader has to READ clears a real contrast margin, in every palette.
//
// The six palettes were each tuned to land on WCAG AA's 4.5:1 and every one of them landed
// ON it: mono 4.56, sepia 4.56, forest 4.57, scifi 4.56, amber 4.54 — and ocean at exactly
// 4.50, a margin of zero. They passed, and any later nudge to a background or a hue would
// have taken one under without anything saying so, because nothing computed this.
//
// The bar is 5.0, not 4.5, and that number is the repository's own: `pen/ink.css.ts` mixes
// the dark-mode highlighter at "the brightest mix at which all five clear 5.0:1", having
// rejected 55% for putting three inks in the 3.7-4.4 range. A site cannot hold its
// highlighter to 5.0 and its dates to 4.5.
//
// `--c-meta` in particular is not a minor role. `docs/conventions/type.md` lists what is set in
// `small`: dates, tags, footnotes, the footer, the related list and the whole comment
// thread — most of the page that is not the article, at 15px, which is below every
// large-text exemption there is.
import { describe, expect, it } from 'bun:test'
import { THEME_PRESETS } from '@/content/themes'

/** Relative luminance, WCAG 2.x. */
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)]
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

const MIN = 5.0
/** `rule` is a hairline and `accent` tracks `link`; neither is read as text. */
const TEXT_ROLES = ['text', 'heading', 'meta', 'link'] as const

describe('palette contrast', () => {
  it('is measured against a known pair, so the maths itself is pinned', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })

  for (const preset of THEME_PRESETS) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${preset.id} ${mode}: every text role clears ${MIN}:1`, () => {
        const colors = preset.theme[mode]
        // Collected rather than asserted one at a time, so a failure names the role, the
        // colour and the number it reached. "Expected 4.5 to be >= 5" identifies neither
        // which of six palettes nor which of four roles is the one to open.
        const under = TEXT_ROLES
          .map((role) => ({ role, hex: colors[role], ratio: +contrast(colors[role], colors.bg).toFixed(2) }))
          .filter((r) => r.ratio < MIN)
        expect(under).toEqual([])
      })
    }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// ONE ARCHITECTURE, SIX HUES. Clearing a floor is not the same as being a SET: before the
// 2026-09-13 rebalance every palette cleared 5.0 and the six were still six separate
// designs — body text ran 10.22:1 on Sepia against 14.75:1 on Mono, headings 13.83 against
// 18.26. The same words came out a third heavier or lighter depending on a choice that
// should only have changed a colour, and nothing computed it.
//
// So the SPREAD is the assertion. Each role's six ratios must sit inside one band; the band
// is wide enough that a hex may be nudged and narrow enough that a palette cannot drift back
// into a design of its own. `palettes.ts` carries the targets and how they were solved.
describe('the six are one set', () => {
  /** `rule` is not read as text, so it is measured too — the notebook draws the page with it. */
  const ROLES = [
    { role: 'text', band: [12.4, 13.6] },
    { role: 'heading', band: [16.3, 17.7] },
    { role: 'meta', band: [4.9, 5.6] },
    { role: 'rule', band: [1.2, 1.42] },
  ] as const

  for (const mode of ['light', 'dark'] as const) {
    for (const { role, band } of ROLES) {
      it(`${mode}: every palette's ${role} lands in ${band[0]}-${band[1]}:1`, () => {
        const out = THEME_PRESETS
          .map((p) => ({ id: p.id, ratio: +contrast(p.theme[mode][role], p.theme[mode].bg).toFixed(2) }))
          .filter((r) => r.ratio < band[0] || r.ratio > band[1])
        expect(out).toEqual([])
      })
    }
  }

  /**
   * How much colour a hex carries, as the spread between its channels.
   *
   * Crude on purpose. Contrast is the wrong tool here — it measures LIGHTNESS, and these two
   * papers are meant to differ in HUE at the same lightness, so a contrast ratio between
   * them reads 1.00 whatever their colours. This reads 15 for a blue page and 2 for a grey
   * one, which is the whole distinction in one number and needs no colour space.
   */
  const colourfulness = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    return Math.max(r!, g!, b!) - Math.min(r!, g!, b!)
  }

  it('gives Ocean and Sci-Fi papers a reader can tell apart', () => {
    // They had become the same palette: papers at L97 with chroma 5 and 4, inks at L31 and
    // L28 with chroma 24 and 23. The only thing telling them apart was a link, and a page
    // can go a screen without one. Ocean is a blue PAGE now; Sci-Fi is graphite with an
    // electric mark on it, and the papers are where a reader meets that difference first.
    for (const mode of ['light', 'dark'] as const) {
      const ocean = THEME_PRESETS.find((p) => p.id === 'ocean')!.theme[mode]
      const scifi = THEME_PRESETS.find((p) => p.id === 'scifi')!.theme[mode]
      expect(colourfulness(scifi.bg)).toBeLessThanOrEqual(6)
      expect(colourfulness(ocean.bg)).toBeGreaterThanOrEqual(colourfulness(scifi.bg) * 3)
    }
  })
})
