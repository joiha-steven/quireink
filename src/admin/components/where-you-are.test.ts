// The highlighter marks WHERE YOU ARE, and never what you chose.
//
// Before this, an active tab and a selected value wore the identical black pill. On the
// Settings screen that put "Site" — the section you are in — eight lines above "English" — a
// field's current value — in the same ink, size and shape, with nothing saying which of the
// two was answering "where am I". A screen where everything is the same rectangle has told
// you nothing by the time you have looked at all of it, and that sameness is most of what
// made the admin read as stiff and mechanical.
//
// So the ink carries a meaning and the meaning is the thing worth defending: a second colour
// that means ONE thing is a signal, and a palette is not. The day someone highlights a
// selected value too, the signal is gone and no screenshot review will catch it — it will
// look livelier, which is the trap.

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { tabItemClass } from '@/admin/components/tabs'
import { SIDEBAR_NAV, SIDEBAR_NAV_ACTIVE, SIDEBAR_NAV_QUIET } from '@/admin/components/headerActions'

describe('the highlighter marks a place', () => {
  it('paints an active tab you navigated to', () => {
    expect(tabItemClass(true, 'sm', false, 'place')).toContain('bg-[var(--pen)]')
    // Ink, not `--on-pen`: the olive belongs to marks in running text; on a pressed key it
    // read as grey. Full contrast on the control.
    expect(tabItemClass(true, 'sm', false, 'place')).toContain('text-neutral-950')
  })

  it('leaves an underlined strip as a marker STROKE, not a wash', () => {
    // A lime block inside an underlined strip would be the loudest thing on the page, and
    // the strip is meant to be quiet. The ink stays on the word so the label reads as a word.
    const lg = tabItemClass(true, 'lg', false, 'place')
    expect(lg).toContain('border-[var(--pen-edge)]')
    expect(lg).not.toContain('bg-[var(--pen)]')
  })

  it('marks the page you are on in the rail', () => {
    // A KEY HELD DOWN in the pen — the SAME full ink the active tab wears, carved in. What
    // this pins is the INK and the STATE: drawn from --pen, at full strength, with an inset.
    expect(SIDEBAR_NAV_ACTIVE).toContain('bg-[var(--pen)]')
    expect(SIDEBAR_NAV_ACTIVE).toContain('text-neutral-950')
    expect(SIDEBAR_NAV_ACTIVE).toContain('shadow-[inset')
  })
})

describe('the highlighter does NOT mark a choice', () => {
  it('leaves a selected value on the sunken paper key, never the pen', () => {
    // The default role. Ten call sites build a chooser out of this directly — the language
    // picker, the home mode, the gallery ratio — and every one of them is a value, not a
    // place. It was the solid ink pill; ink can show no relief, so the chosen value is now
    // the paper key pressed into the groove. What stays pinned: no --pen on a value.
    expect(tabItemClass(true, 'sm')).toContain('shadow-[inset')
    expect(tabItemClass(true, 'sm')).not.toContain('--pen')
    expect(tabItemClass(true, 'lg')).not.toContain('--pen')
  })

  it('is asked for only by the one component that renders navigation', () => {
    // The seam. `Tabs` is the admin's only navigation strip; a chooser that starts passing
    // 'place' is the drift this whole file exists to catch.
    const tabs = readFileSync('src/admin/components/tabs.tsx', 'utf8')
    expect(tabs).toContain("tabItemClass(value === tb.key, size, dense, 'place')")
    const callers = readFileSync('src/admin/components/SiteFields.tsx', 'utf8')
    expect(callers).not.toContain("'place'")
  })
})

describe('the mark cannot be painted over', () => {
  it('gives the active row no hover of its own to lose', () => {
    // THE BUG THIS CAUGHT, and it is a bug about CSS ordering rather than about classes.
    // Both `hover:bg-neutral-100` and `hover:bg-[var(--pen)]` are hover rules on the same
    // property, and which one lands last in the built stylesheet is Tailwind's decision, not
    // the order they appear on the element: measured, the neutral was emitted 418 bytes after
    // the highlighter, so pointing at the page you were already on repainted it grey.
    //
    // Fixed by structure instead of by out-ranking: the active row is built from the QUIET
    // base, which has no hover at all. That is why this asserts an ABSENCE.
    expect(SIDEBAR_NAV_QUIET).not.toContain('hover:')
    expect(SIDEBAR_NAV_ACTIVE).not.toContain('hover:')
    // The inactive row still has one — it is the only feedback that a row is a link.
    // `neutral-200/70`, because the rail sits on the paper canvas and neutral-100 was
    // invisible against it.
    expect(SIDEBAR_NAV).toContain('hover:bg-neutral-200/70')
  })

  it('composes the active row from the quiet base', () => {
    const sidebar = readFileSync('src/admin/components/AdminSidebar.tsx', 'utf8')
    expect(sidebar).toContain('active ? SIDEBAR_NAV_QUIET : SIDEBAR_NAV')
  })
})
