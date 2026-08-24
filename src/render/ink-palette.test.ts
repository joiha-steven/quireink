// An install that has chosen nothing must be bit-identical to one that could not choose.
//
// That is the property this whole feature rests on: the pen sheets are hashed by content
// and served immutable, so if resolving "no overrides" produced anything other than the
// measured inks, every install on earth would silently mint a new sheet URL on upgrade and
// throw away a cache it had every right to keep.

import { describe, expect, it } from 'bun:test'
import { BUILT_IN_INKS, DEFAULT_INKS, inkSignature, resolveInks } from '@/render/ink-palette'
import { PEN_AUX_LIGHT, PEN_LIGHT } from '@/render/pen'

describe('inkSignature', () => {
  it('is empty when nothing has been chosen', () => {
    expect(inkSignature(DEFAULT_INKS)).toBe('')
    // The selection colours are NOT part of it: they are two inline rules, not a sheet.
    expect(inkSignature({ ...DEFAULT_INKS, selection: '#000000' })).toBe('')
  })

  it('changes when any pen colour does', () => {
    const one = inkSignature({ ...DEFAULT_INKS, yellow: '#ff8ad8' })
    const two = inkSignature({ ...DEFAULT_INKS, yellow: '#ff8ad9' })
    expect(one).not.toBe('')
    expect(one).not.toBe(two)
  })
})

describe('resolveInks', () => {
  it('hands back the built-ins THEMSELVES when nothing is overridden', () => {
    expect(resolveInks(DEFAULT_INKS)).toBe(BUILT_IN_INKS)
  })

  it('moves one ink and leaves the other four measured', () => {
    const p = resolveInks({ ...DEFAULT_INKS, yellow: '#ff8ad8' })
    expect(p.light.yellow).toBe('ff8ad8')
    expect(p.light.green).toBe(PEN_LIGHT.green)
    // ...and the chosen one brings its own dark and line versions with it, because a
    // pigment is not one value (`pen-derive.ts` explains the three).
    expect(p.dark.yellow).not.toBe(p.light.yellow)
    expect(p.lineLight.yellow).not.toBe(p.light.yellow)
    expect(p.lineDark.yellow).not.toBe(p.lineLight.yellow)
  })

  it('keeps the ring and the underline apart', () => {
    const ring = resolveInks({ ...DEFAULT_INKS, ring: '#1a7f37' })
    expect(ring.auxLight.red).toBe('1a7f37')
    expect(ring.auxLight.graphite).toBe(PEN_AUX_LIGHT.graphite)
    const under = resolveInks({ ...DEFAULT_INKS, underline: '#1a7f37' })
    expect(under.auxLight.graphite).toBe('1a7f37')
    expect(under.auxLight.red).toBe(PEN_AUX_LIGHT.red)
  })

  it('takes a colour with or without its hash', () => {
    expect(resolveInks({ ...DEFAULT_INKS, blue: 'AABBCC' }).light.blue).toBe('aabbcc')
    expect(resolveInks({ ...DEFAULT_INKS, blue: '#AABBCC' }).light.blue).toBe('aabbcc')
  })
})
