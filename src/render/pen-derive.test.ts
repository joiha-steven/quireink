// The derivation is checked against the MEASURED inks, which is the only reason to trust it.
//
// The dark mix is not a number somebody liked: four of the five built-in dark strokes are
// their light pigment at 45% over the dark page, to the rounding. If this ever stops
// reproducing them, the formula has drifted from the values ADR 0018 audited at 5.0:1.

import { describe, expect, it } from 'bun:test'
import { PEN_DARK, PEN_LIGHT } from '@/render/pen'
import { contrastRatio, darkStroke, lineInk, parseHex } from '@/render/pen-derive'

describe('darkStroke', () => {
  it('reproduces the measured dark inks from their light pigments', () => {
    // Yellow is deliberately NOT in this list: ADR 0018 warms it by hand at dark luminance
    // so it does not read as the green. A default that a formula cannot reach is exactly
    // why the built-ins stay built in.
    for (const ink of ['green', 'pink', 'blue', 'orange'] as const) {
      const derived = parseHex(darkStroke(PEN_LIGHT[ink]))!
      const measured = parseHex(PEN_DARK[ink])!
      for (let i = 0; i < 3; i++) expect(Math.abs(derived[i]! - measured[i]!)).toBeLessThanOrEqual(2)
    }
  })

  it('hands back something usable for a colour that is not a colour', () => {
    expect(darkStroke('nonsense')).toBe('nonsense')
  })
})

describe('lineInk', () => {
  it('holds the hue and takes the pigment to ballpoint strength', () => {
    // A pale sweep is invisible as a 2px line; the derived line must be markedly darker.
    const line = parseHex(lineInk(PEN_LIGHT.pink, 'light'))!
    const pigment = parseHex(PEN_LIGHT.pink)!
    expect(line.reduce((a, b) => a + b)).toBeLessThan(pigment.reduce((a, b) => a + b))
    // ...and the dark-mode line is lighter than the light-mode one, because a line owes a
    // dark page visibility rather than a text-contrast ceiling.
    const dark = parseHex(lineInk(PEN_LIGHT.pink, 'dark'))!
    expect(dark.reduce((a, b) => a + b)).toBeGreaterThan(line.reduce((a, b) => a + b))
  })
})

describe('contrastRatio', () => {
  it('agrees with the numbers ADR 0018 published', () => {
    // Body text #262626 over the yellow stroke as it renders on paper: the ADR says 12.6:1.
    expect(contrastRatio('262626', 'daf677')).toBeGreaterThan(12)
    expect(contrastRatio('262626', 'daf677')).toBeLessThan(13.5)
    // Black on white is the fixed point every implementation agrees on.
    expect(contrastRatio('000000', 'ffffff')).toBeCloseTo(21, 0)
  })

  it('is symmetric, so callers cannot get it backwards', () => {
    expect(contrastRatio('123456', 'fedcba')).toBeCloseTo(contrastRatio('fedcba', '123456'), 5)
  })
})
