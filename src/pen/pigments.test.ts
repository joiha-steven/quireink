// The stamp, and what it puts inside a stroke.
//
// Since ADR 0042 a die carries its physics — fibre grain, edge tremor, wet-to-dry — and the
// stamp writes them into the data-URI as a filter and a gradient. That is the kind of thing
// that can silently stop happening (a mode flag dropped, a `defs` block skipped) while every
// stroke still paints, just flat, and no other test would notice the felt was gone.
import { describe, expect, it } from 'bun:test'
import { PEN_LIGHT, penRing, penStroke, penStrokeFlat, penUnder } from '@/pen/pigments'
import { DIES, PEN_DIE_COUNT } from '@/pen/dies'
import { PEN_SHORT_CHARS, PEN_SHORT_FROM, PEN_VARIANT_COUNT } from '@/pen/dies-kit'
import { penSeed } from '@/pen/grammar'

describe('the stamp', () => {
  it('writes every highlighter die with its felt: grain, tremor and a wet-to-dry gradient', () => {
    for (let d = 0; d < PEN_DIE_COUNT; d++) {
      const url = penStroke(PEN_LIGHT.yellow, d)
      expect(url).toContain("%3Cfilter id='f'%3E")
      expect(url).toContain("type='fractalNoise'")
      expect(url).toContain('feDisplacementMap')
      expect(url).toContain("%3ClinearGradient id='g'")
      expect(url).toContain("fill='url(%23g)'")
    }
  })

  it('prints a shared outline once and references it, so the ghost costs no path data', () => {
    for (let d = 0; d < PEN_DIE_COUNT; d++) {
      const url = penStroke(PEN_LIGHT.yellow, d)
      expect(url).toContain("%3Cuse href='%23p0'")
      // The ghost and the sweep are the same outline, by construction.
      expect(DIES[d]!.paths[0]![0]).toBe(DIES[d]!.paths[1]![0])
    }
  })

  it('gives the lines their tremor and nothing that would fade them', () => {
    const u = penUnder('5b574f', 1)
    expect(u).toContain('feDisplacementMap')
    expect(u).not.toContain('fractalNoise')
    expect(u).not.toContain('linearGradient')
    for (const part of ['l', 'm', 'r'] as const) {
      const o = penRing('c23b2b', 0, part)
      expect(o).toContain('feDisplacementMap')
      expect(o).not.toContain('linearGradient')
    }
  })

  it('keeps every die under the dark-mode ceiling: ghost, sweep and band compound below .91', () => {
    for (const die of DIES) {
      const [ghost, sweep] = die.paths
      const bands = die.paths.filter(([, , m], i) => i > 1 && m === 'f')
      const band = Math.max(...bands.map(([, o]) => Number(o)))
      const composite = 1 - (1 - Number(ghost![1])) * (1 - Number(sweep![1])) * (1 - band)
      expect(composite).toBeLessThanOrEqual(0.91)
    }
  })

  it('prints the card a flat stroke: no use, no filter, no gradient, and the sweep at .8', () => {
    const flat = penStrokeFlat(PEN_LIGHT.yellow)
    expect(flat).not.toContain('%3Cuse')
    expect(flat).not.toContain('%3Cfilter')
    expect(flat).not.toContain('linearGradient')
    expect(flat).toContain("opacity='.8'")
  })
})

describe('the deal', () => {
  it('sends a word or two to the short hand and a sentence to the long one', () => {
    const short = penSeed('==cease==')
    const long = penSeed('==a sentence that runs well past the four-word mark and keeps going==')
    expect(short).toBeGreaterThanOrEqual(PEN_SHORT_FROM)
    expect(short).toBeLessThan(PEN_VARIANT_COUNT)
    expect(long).toBeLessThan(PEN_SHORT_FROM)
  })

  it('measures the words inside the fences, not the fences or the colour', () => {
    const inner = 'x'.repeat(PEN_SHORT_CHARS)
    expect(penSeed(`==${inner}==#green`)).toBeGreaterThanOrEqual(PEN_SHORT_FROM)
    expect(penSeed(`++${inner}x++`)).toBeLessThan(PEN_SHORT_FROM)
    expect(penSeed(`@@${inner}@@`)).toBeGreaterThanOrEqual(PEN_SHORT_FROM)
  })

  it('is stable: the same source always draws the same variant', () => {
    expect(penSeed('==mang dấu vết==')).toBe(penSeed('==mang dấu vết=='))
    expect(penSeed('==mang dấu vết==')).not.toBe(penSeed('==mang dấu vết ==#pink'))
  })
})
