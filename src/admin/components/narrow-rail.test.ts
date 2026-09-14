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
// The trap this file exists to catch is the second one: A WIDTH IS NOT A PREFERENCE. The band
// must force the rail shut WITHOUT touching localStorage, because the stored value is the owner
// saying what they want and a 1100px window is not them saying anything. Anyone who
// "simplifies" this by persisting from the media query passes every visual review and quietly
// rewrites the owner's setting the first time they resize a window.
//
// ⚠️ IT IS ASKED IN TWO PLACES NOW, and that is the change ADR 0054 made. The band is read
// before the first paint by the boot script the server puts in the head, and again by the
// island for every resize afterwards. Both are checked here: a rule enforced in one of two
// copies is the copy nobody reads.
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { NARROW, RAIL_WIDTH } from '@/admin-shared/rail'

const boot = readFileSync('src/web/admin/rail.ts', 'utf8')
const island = readFileSync('src/admin/island/rail.ts', 'utf8')
const sheet = readFileSync('src/admin/admin.css', 'utf8')

describe('the band lines up with the rail it modifies', () => {
  it('starts exactly where the rail starts, so there is no gap and no overlap', () => {
    // `lg` in Tailwind is 64rem. The rail is drawn by `hidden lg:flex`, so the band's floor
    // has to be the same number: a band starting one pixel later leaves a width where the
    // rail is open for no reason, and one starting earlier contradicts the 28/08 measurement.
    expect(NARROW).toContain('(min-width: 64rem)')
    expect(boot).toContain('hidden lg:flex')
    // And the width rules are inside the same query, or a rail that is not drawn still
    // reserves its column below 1024.
    expect(sheet).toContain('@media (min-width: 64rem)')
  })

  it('stops just below xl, so a wide screen gets the owner their choice back', () => {
    // 79.9375rem is 1279px: the last width before `xl`. Written in rem to match the floor,
    // so a root font-size change moves both ends together instead of opening a dead zone.
    expect(NARROW).toContain('(max-width: 79.9375rem)')
  })
})

describe('the band forces, it does not save', () => {
  it('the first paint reads the band and the stored value, and writes neither', () => {
    // The boot script runs in the head, before anything is drawn, and it is the only thing
    // that decides what the rail's first frame looks like. `getItem` only: a script that
    // persisted here would rewrite the owner's setting on every load from a narrow window.
    const script = boot.slice(boot.indexOf('export function railBootScript'))
    expect(script).toContain('matchMedia(')
    expect(script).toContain('.getItem(')
    expect(script).not.toContain('setItem')
  })

  it('the island re-reads the band on resize, and still writes nothing', () => {
    // `apply` is what the media query calls. Every `remember(` in this file belongs to a click.
    const apply = island.slice(island.indexOf('const apply = ()'), island.indexOf('band.addEventListener'))
    expect(apply).toContain('flag(RAIL_KEYS.collapsed')
    expect(apply).not.toContain('remember(')
    // OR-ed with the stored value, so the band can only ever CLOSE the rail — never open one
    // the owner had shut.
    expect(apply).toContain('band.matches || flag(RAIL_KEYS.collapsed, false)')
  })

  it('leaves the click handler as the only thing that persists', () => {
    const click = island.slice(island.indexOf("key?.addEventListener('click'"))
    expect(click.slice(0, 260)).toContain('remember(RAIL_KEYS.collapsed, next)')
  })

  it('unsubscribes nothing, because the island lives as long as the page', () => {
    // Deliberate, and the opposite of what the React version had to do. A component that can
    // unmount has to take its listeners with it; this file runs once per page load and is torn
    // down by the navigation, so a removeEventListener here would be ceremony.
    expect(island).toContain("band.addEventListener('change', apply)")
    expect(island).not.toContain("band.removeEventListener")
  })
})

describe('the 136px that justifies all of this', () => {
  it('keeps all three rail widths at the numbers the measurement used', () => {
    // 13rem = 208px open, 4.5rem = 72px shut. The difference is the entire argument; if
    // someone tunes either number the band may no longer be worth having, and this test is
    // where they find that out.
    expect(RAIL_WIDTH).toEqual({ shut: '4.5rem', open: '13rem', arranging: '16rem' })
    expect(13 * 16 - 4.5 * 16).toBe(136)
  })

  it('says the same three widths in the stylesheet as in the variable', () => {
    // The CSS var and the rule have to agree, or fixed chrome offsets past a rail that is not
    // the width it thinks: the settings save bar is positioned off `--admin-nav-w`.
    //
    // ⚠️ READ FROM `RAIL_WIDTH`, never retyped. This assertion used to be a copy of the source
    // line that spelled the three numbers, so moving them into one exported constant failed it
    // while the rail was pixel for pixel unchanged — a guard that watches how code is SPELLED.
    expect(sheet).toContain(`#admin-rail { width: ${RAIL_WIDTH.open}; }`)
    expect(sheet).toContain(`:root[data-rail-arranging='1'] #admin-rail { width: ${RAIL_WIDTH.arranging}; }`)
    expect(sheet).toContain(`:root[data-rail-collapsed='1'] #admin-rail { width: ${RAIL_WIDTH.shut}; }`)
    // COLLAPSED LAST, because it wins: arrange mode belongs to the open rail and does not draw
    // on a shut one. Two rules of equal specificity are decided by order, and getting this
    // backwards makes a shut rail 256px wide the moment somebody opens arrange mode.
    expect(sheet.indexOf("data-rail-arranging='1'] #admin-rail { width"))
      .toBeLessThan(sheet.indexOf("data-rail-collapsed='1'] #admin-rail { width"))
  })

  it('publishes the variable from the same constant, in both places that set it', () => {
    expect(boot).toContain('RAIL_WIDTH.shut')
    expect(boot).toContain('RAIL_WIDTH.open')
    expect(island).toContain('RAIL_WIDTH.shut')
    expect(island).toContain('RAIL_WIDTH.arranging')
    expect(island).toContain('RAIL_WIDTH.open')
  })
})
