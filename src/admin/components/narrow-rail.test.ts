// The rail arrives already shut between 1024 and 1279, and the band never overwrites a choice.
//
// Two separate questions decide what the left edge of the admin looks like, and they were
// answered a day apart. WHETHER a rail belongs on screen was settled on 2026-08-28 by
// measuring content width: below 1024 it does not, because a 768px tablet was left 560px for
// the form and a folded-open phone had more room than that. HOW WIDE it should be was never
// asked until 2026-08-29, and in the 1024-1279 band the answer is different from the answer
// above it: 72px of icons rather than 208px of words gives the form back 136px, on exactly
// the screens the owner named (an iPad in landscape, a foldable opened and turned).
//
// The trap this file exists to catch is the second one: a width is not a preference. The band
// must force the rail shut WITHOUT touching localStorage, because the stored value is the
// owner saying what they want and a 1100px window is not them saying anything. Anyone who
// "simplifies" this by calling toggleCollapsed from the media query passes every visual
// review and quietly rewrites the owner's setting the first time they resize a window.

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { NARROW } from '@/admin/components/AdminSidebar'

const source = readFileSync('src/admin/components/AdminSidebar.tsx', 'utf8')

describe('the band lines up with the rail it modifies', () => {
  it('starts exactly where the rail starts, so there is no gap and no overlap', () => {
    // `lg` in Tailwind is 64rem. The rail is drawn by `hidden lg:flex`, so the band's floor
    // has to be the same number: a band starting one pixel later leaves a width where the
    // rail is open for no reason, and one starting earlier contradicts the 28/08 measurement.
    expect(NARROW).toContain('(min-width: 64rem)')
    expect(source).toContain('hidden lg:flex')
  })

  it('stops just below xl, so a wide screen gets the owner their choice back', () => {
    // 79.9375rem is 1279px: the last width before `xl`. Written in rem to match the floor,
    // so a root font-size change moves both ends together instead of opening a dead zone.
    expect(NARROW).toContain('(max-width: 79.9375rem)')
  })
})

describe('the band forces, it does not save', () => {
  it('reads the stored value but never writes it', () => {
    // THE INVARIANT. `apply` is what the media query calls, and the only localStorage verb
    // it may use is getItem. Every setItem in this file belongs to a click handler.
    const apply = source.slice(source.indexOf('const apply = ()'), source.indexOf('Promise.resolve()'))
    expect(apply).toContain('localStorage.getItem(STORE_KEY)')
    expect(apply).not.toContain('setItem')
    // A media query that is OR-ed with the stored value can only ever close the rail, never
    // open one the owner had shut.
    expect(apply).toContain("mq.matches || localStorage.getItem(STORE_KEY) === '1'")
  })

  it('leaves the click handler as the only thing that persists', () => {
    const toggle = source.slice(source.indexOf('function toggleCollapsed'))
    expect(toggle.slice(0, 220)).toContain('localStorage.setItem(STORE_KEY')
  })
})

describe('restore and band cannot race', () => {
  it('sets the width from one place only', () => {
    // Two effects both calling setCollapsed on mount is a coin flip, and the deferred
    // microtask in the restore path means the loser wins about half the time. Folding the
    // band into the same effect is the fix, so there is exactly one setCollapsed outside the
    // toggle. If this count moves, the race is back whatever the diff says it did.
    const outsideToggle = source.slice(0, source.indexOf('function toggleCollapsed'))
    expect(outsideToggle.match(/setCollapsed\(/g) ?? []).toHaveLength(1)
  })

  it('unsubscribes, so a remounted admin does not stack listeners', () => {
    expect(source).toContain("mq.removeEventListener('change', apply)")
  })
})

describe('the 136px that justifies all of this', () => {
  it('keeps both rail widths at the numbers the measurement used', () => {
    // 13rem = 208px open, 4.5rem = 72px shut. The difference is the entire argument; if
    // someone tunes either number the band may no longer be worth having, and this test is
    // where they find that out.
    expect(source).toContain("applyWidthVar = (c: boolean) =>")
    expect(source).toContain("c ? '4.5rem' : '13rem'")
    // The CSS var and the Tailwind class have to agree, or fixed chrome offsets past a rail
    // that is not the width it thinks: w-52 IS 13rem.
    expect(source).toContain("collapsed ? 'lg:w-[4.5rem]' : 'lg:w-52'")
    expect(13 * 16 - 4.5 * 16).toBe(136)
  })
})
