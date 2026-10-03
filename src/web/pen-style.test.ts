// The ink a page inlines is the ink the whole sheet would have painted it with (ADR 0070).
//
// `pen/ink-subset.ts` keeps every selector of the full sheet that matches an element on the
// page and drops the rest. Two ways that could go wrong without anything on a page looking
// broken at a glance: the parser could lose or reorder a rule — every page then carries a
// slightly different sheet — or the matcher could drop a selector that DOES match, and a
// highlight would fall back to the default die or the default ink. One red test each.
//
// The second is checked against an oracle that does not share the matcher's code: the deal
// itself, read from `PEN_GRIPS` and the pigments. For every variant in every ink, the stroke
// the deal says that element wears must be in its page's style, in both modes.

import { describe, expect, it } from 'bun:test'
import { assetBody, penStyleFor, PEN_LINES_SHEET, PEN_MARKS_SHEET } from '@/web/assets'
import { inkedElements, inkSubset, parseInk } from '@/pen/ink-subset'
import { INKS } from '@/pen/grammar'
import { PEN_GRIPS, PEN_VARIANT_COUNT, RING_GRIPS, UNDER_GRIPS } from '@/pen/dies'
import {
  PEN_AUX_DARK, PEN_AUX_LIGHT, PEN_DARK, PEN_LIGHT, PEN_LINE_DARK, PEN_LINE_LIGHT,
  penRing, penStroke, penUnder,
} from '@/pen/pigments'

const marks = assetBody(PEN_MARKS_SHEET)!
const lines = assetBody(PEN_LINES_SHEET)!
const variants = [...Array(PEN_VARIANT_COUNT).keys()]

/** Every element the grammar can write: each gesture, each variant, each ink and none. */
function everything(): string {
  const out: string[] = []
  for (const p of variants) {
    out.push(`<mark data-pen="${p}">a</mark>`, `<u data-pen="${p}">a</u>`, `<mark data-form="o" data-pen="${p}">a</mark>`)
    for (const ink of INKS) {
      out.push(`<mark data-ink="${ink}" data-pen="${p}">a</mark>`, `<u data-ink="${ink}" data-pen="${p}">a</u>`,
        `<mark data-form="o" data-ink="${ink}" data-pen="${p}">a</mark>`)
    }
  }
  return out.join('')
}

describe('the inlined ink', () => {
  it('is the whole sheet, byte for byte, on a page that uses every stroke there is', () => {
    const all = inkedElements(everything())
    expect(inkSubset(parseInk(marks), all)).toBe(marks)
    expect(inkSubset(parseInk(lines), all)).toBe(lines)
  })

  it('carries the die the deal gives every highlight, in its ink, in both modes', () => {
    for (const p of variants) {
      const die = PEN_GRIPS[p]!.die
      for (const ink of INKS) {
        const attr = ink === 'yellow' ? '' : ` data-ink="${ink}"`
        const style = penStyleFor(`<mark${attr} data-pen="${p}">a</mark>`)
        expect(style).toContain(`{--ink-stroke:${penStroke(PEN_LIGHT[ink], die)}}`)
        expect(style).toContain(`{--ink-stroke:${penStroke(PEN_DARK[ink], die)}}`)
        expect(style).toContain(`.prose mark[data-pen="${p}"]{--ink-h:${PEN_GRIPS[p]!.h}`)
      }
    }
  })

  it('carries the die the deal gives every underline and every ring', () => {
    for (const p of variants) {
      const u = UNDER_GRIPS[p]!.die
      const o = RING_GRIPS[p]!.die
      const pencil = penStyleFor(`<u data-pen="${p}">a</u>`)
      expect(pencil).toContain(`{--u-stroke:${penUnder(PEN_AUX_LIGHT.graphite, u)}}`)
      expect(pencil).toContain(`{--u-stroke:${penUnder(PEN_AUX_DARK.graphite, u)}}`)
      const ballpoint = penStyleFor(`<mark data-form="o" data-pen="${p}">a</mark>`)
      expect(ballpoint).toContain(penRing(PEN_AUX_LIGHT.red, o, 'l'))
      expect(ballpoint).toContain(penRing(PEN_AUX_DARK.red, o, 'r'))
      for (const ink of INKS) {
        const under = penStyleFor(`<u data-ink="${ink}" data-pen="${p}">a</u>`)
        expect(under).toContain(`{--u-stroke:${penUnder(PEN_LINE_LIGHT[ink], u)}}`)
        expect(under).toContain(`{--u-stroke:${penUnder(PEN_LINE_DARK[ink], u)}}`)
      }
    }
  })

  it('is a small fraction of the case for an ordinary post', () => {
    // Six highlights and an underline, the shape of a typical showcase article.
    const post = [3, 17, 41, 52, 60, 77].map((p) => `<mark data-pen="${p}">x</mark>`).join('')
      + '<mark data-ink="green" data-pen="9">y</mark><u data-pen="12">z</u>'
    const style = penStyleFor(post)
    expect(style.length).toBeLessThan((marks.length + lines.length) / 10)
  })

  it('reads a bare element, which the sheet still paints with its defaults', () => {
    // Inline Markdown in a caption writes `<u>` with no variant; the base rule and the
    // pencil's default stroke are what it wears, and both must arrive.
    const style = penStyleFor('<u>x</u>')
    expect(style).toContain('.prose u{text-decoration:none')
    expect(style).toContain(`.prose u{--u-stroke:${penUnder(PEN_AUX_LIGHT.graphite)}}`)
    expect(style).not.toContain('[data-pen=')
  })
})
