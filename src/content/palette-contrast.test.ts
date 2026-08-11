// Every colour a reader has to READ clears a real contrast margin, in every palette.
//
// The six palettes were each tuned to land on WCAG AA's 4.5:1 and every one of them landed
// ON it: mono 4.56, sepia 4.56, forest 4.57, scifi 4.56, amber 4.54 — and ocean at exactly
// 4.50, a margin of zero. They passed, and any later nudge to a background or a hue would
// have taken one under without anything saying so, because nothing computed this.
//
// The bar is 5.0, not 4.5, and that number is the repository's own: `web/ink.css.ts` mixes
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
