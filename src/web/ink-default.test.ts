// The highlighter's variety reaching the page.
//
// There used to be a three-way stroke setting here (marker / swipe / double). It was
// retired when the pen learned to vary itself — `render/pen-dies.ts` grows the dies, and
// each highlight is dealt one by the `data-pen` hash of its own text — so what this suite
// now holds is the DEAL: every variant has a grip, every die is reachable in every pigment
// in both modes, and the hash that deals them is stable. If one of these breaks, the page
// quietly collapses back toward one silhouette, which no other test would notice.

import { describe, expect, it, afterAll } from 'bun:test'
import { PUBLIC_CSS } from '@/web/public.css'
import { INK_CSS } from '@/web/ink.css'
import { freshDatabase, dropDatabase } from '@/test/db'
import { pageStyles } from '@/web/layout'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { INKS, penSeed } from '@/render/ink'
import {
  PEN_DIE_COUNT, PEN_GRIPS, PEN_VARIANT_COUNT, RING_DIE_COUNT, RING_GRIPS,
  UNDER_DIE_COUNT, UNDER_GRIPS,
} from '@/render/pen-dies'
import {
  PEN_AUX_DARK, PEN_AUX_LIGHT, PEN_DARK, PEN_LIGHT, PEN_LINE_DARK, PEN_LINE_LIGHT,
  penRing, penStroke, penUnder,
} from '@/render/pen'

describe('the pen deal', () => {
  it('retired the stroke setting: no site-settings variables are left in the sheet', () => {
    expect(PUBLIC_CSS).not.toContain('--ink-h0')
    expect(PUBLIC_CSS).not.toContain('--ink-h2')
  })

  it('gives every variant a grip rule, keyed by data-pen', () => {
    expect(PEN_GRIPS.length).toBe(PEN_VARIANT_COUNT)
    for (let i = 0; i < PEN_VARIANT_COUNT; i++) {
      expect(PUBLIC_CSS).toContain(`.prose mark[data-pen="${i}"]{--ink-h:${PEN_GRIPS[i]!.h}`)
    }
  })

  it('ships a base stroke for every ink, in both light and dark', () => {
    for (const ink of INKS) {
      const selector = ink === 'yellow' ? '.prose mark{' : `.prose mark[data-ink=${ink}]{`
      expect(PUBLIC_CSS).toContain(selector)
      expect(PUBLIC_CSS).toContain(`.dark ${selector}`)
    }
  })

  it('makes every non-default die reachable in every pigment, in both modes', () => {
    for (let d = 1; d < PEN_DIE_COUNT; d++) {
      for (const ink of INKS) {
        expect(INK_CSS).toContain(`{--ink-stroke:${penStroke(PEN_LIGHT[ink], d)}}`)
        expect(INK_CSS).toContain(`{--ink-stroke:${penStroke(PEN_DARK[ink], d)}}`)
      }
    }
    // And every variant maps to a die that exists.
    for (const g of PEN_GRIPS) expect(g.die).toBeLessThan(PEN_DIE_COUNT)
  })

  it("scopes yellow's die rules so a coloured mark can never win a yellow stroke", () => {
    // A bare `mark[data-pen="…"]` rule would tie with `mark[data-ink=green]` on specificity
    // and, sitting later in the sheet, would win — hence :not([data-ink]) on every yellow
    // die rule. Pin the shape of the selector, not just the outcome.
    expect(INK_CSS).toMatch(/\.prose mark:not\(\[data-ink\]\)\[data-pen="\d+"\]/)
    expect(INK_CSS).not.toMatch(/\.prose mark\[data-pen="\d+"\]\[data-ink/)
  })

  it('drops the multiply blend in dark mode and lifts the words to the heading colour', () => {
    // Multiply on a near-black page turns every ink to mud; `opacity` on the mark would fade
    // the TEXT with it, making a highlighted word dimmer than the words around it.
    expect(PUBLIC_CSS).toContain('.dark .prose mark{mix-blend-mode:normal;color:var(--c-heading)}')
  })

  it('draws the underline in graphite by default and in ballpoint-strength inks by name', () => {
    // The pastel highlighter pigments vanish as thin lines, so the line gestures carry
    // their own five hues — if a rule ever reaches for PEN_LIGHT here, green underlines
    // go back to being invisible.
    expect(INK_CSS).toContain(`.prose u{--u-stroke:${penUnder(PEN_AUX_LIGHT.graphite)}}`)
    expect(INK_CSS).toContain(`.dark .prose u{--u-stroke:${penUnder(PEN_AUX_DARK.graphite)}}`)
    for (const ink of INKS) {
      expect(INK_CSS).toContain(`.prose u[data-ink=${ink}]{--u-stroke:${penUnder(PEN_LINE_LIGHT[ink])}}`)
      expect(INK_CSS).toContain(`.dark .prose u[data-ink=${ink}]{--u-stroke:${penUnder(PEN_LINE_DARK[ink])}}`)
    }
    for (const g of UNDER_GRIPS) expect(g.die).toBeLessThan(UNDER_DIE_COUNT)
    // The bottom padding is load-bearing: an inline background clips at the font's
    // descent, which is exactly where an underline lives.
    expect(INK_CSS).toContain('.prose u{text-decoration:none')
    expect(INK_CSS).toMatch(/\.prose u\[data-pen="0"\]\{[^}]*padding:0 [^ ]+ \.4em /)
  })

  it('builds the ring from two fixed caps and one stretching middle, red unless named', () => {
    // Three images, not one: a stretched loop is not a hand-drawn loop, and the caps are
    // what keep the end curves round on a long word.
    const set = (hex: string) =>
      `${penRing(hex, 0, 'l')},${penRing(hex, 0, 'm')},${penRing(hex, 0, 'r')}`
    expect(INK_CSS).toContain(`.prose mark[data-form=o]{--o-set:${set(PEN_AUX_LIGHT.red)}}`)
    expect(INK_CSS).toContain(
      `.prose mark[data-form=o][data-ink=blue]{--o-set:${set(PEN_LINE_LIGHT.blue)}}`)
    expect(INK_CSS).toContain(
      `.dark .prose mark[data-form=o]{--o-set:${set(PEN_AUX_DARK.red)}}`)
    expect(INK_CSS).toMatch(/background-size:\.62em 100%,calc\(100% - \.96em\) 100%,\.62em 100%/)
    for (const g of RING_GRIPS) expect(g.die).toBeLessThan(RING_DIE_COUNT)
  })

  it('lets an owner turn each line gesture off, and charges nothing while they are on', () => {
    const DIR = './.tmp/test-ink-toggle'
    freshDatabase(DIR)
    afterAll(() => dropDatabase(DIR))
    const styles = (penUnderline: boolean, penRing: boolean) => pageStyles({
      ...DEFAULT_SETTINGS,
      features: { ...DEFAULT_SETTINGS.features, penUnderline, penRing },
    })
    // On is the built-in behaviour: not a byte in the settings CSS.
    expect(styles(true, true)).not.toContain('.prose u,')
    expect(styles(true, true)).not.toContain('[data-form=o],')
    // Off swaps the pen line for the browser's underline, and hides the loop. The selector
    // lists carry [data-pen] because the grip rules in the hashed sheet outrank a bare
    // `.prose u` — this block only wins that fight as a tie broken by coming later.
    expect(styles(false, true)).toContain(
      '.prose u,.prose u[data-pen]{background-image:none;padding:0;margin:0;'
      + 'text-decoration:underline;text-decoration-thickness:.05em;text-underline-offset:.16em}')
    expect(styles(true, false)).toContain(
      '.prose mark[data-form=o],.prose mark[data-form=o][data-pen]'
      + '{background-image:none;padding:0;margin:0}')
  })

  it('deals stably: the hash is a pure function of the source and stays in range', () => {
    expect(penSeed('==mang dấu vết==')).toBe(penSeed('==mang dấu vết=='))
    // Distinct sources land on distinct variants often enough to matter. Not asserted
    // pairwise — with forty buckets, two chosen strings colliding is not a bug (the first
    // pair this test tried DID collide) — but across a small sample the deal must spread.
    const sample = Array.from({ length: 12 }, (_, i) => penSeed(`==câu thứ ${i}==`))
    expect(new Set(sample).size).toBeGreaterThan(6)
    for (const raw of ['', '==a==', '==một câu dài hơn hẳn==#blue']) {
      const n = penSeed(raw)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(PEN_VARIANT_COUNT)
      expect(Number.isInteger(n)).toBe(true)
    }
  })
})
