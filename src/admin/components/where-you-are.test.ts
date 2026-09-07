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

  it('strokes the rail gutter beside that key, in the tab marker ink', () => {
    // Since 2026-09-07. The wash alone is a pale field on a pale column; the stroke is what
    // the eye catches scanning down. `--pen-edge`, which is the ink an active TAB strokes
    // under its label, so where-you-are is one shape in two orientations.
    expect(SIDEBAR_NAV_ACTIVE).toContain('before:bg-[var(--pen-edge)]')
    // OUTSIDE the key, in the rail's own 12px gutter. Inside, #c3e844 on #d5f856 is four
    // points of lightness and invisible — the placement is the whole reason it reads.
    expect(SIDEBAR_NAV_ACTIVE).toContain('before:-left-3')
    // And the row it hangs off has to be a positioning parent, or the stroke lands on the
    // page instead of the row.
    expect(SIDEBAR_NAV_QUIET).toContain('relative')
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
    // The seam. `Tabs` is the admin's only navigation strip; 'place' reaches tabItemClass
    // solely through Tabs' own DEFAULT (a caller may opt DOWN to 'choice' — the write
    // pane's scope strip does, to keep the pen away from the writing — but never up).
    // A chooser that starts passing 'place' is the drift this whole file exists to catch.
    const tabs = readFileSync('src/admin/components/tabs.tsx', 'utf8')
    expect(tabs).toContain("role = 'place'")
    expect(tabs).toContain('tabItemClass(value === tb.key, size, dense, role)')
    for (const f of ['SiteFields.tsx', 'WritePane.tsx']) {
      const caller = readFileSync('src/admin/components/' + f, 'utf8')
      expect(caller).not.toContain("'place'")
    }
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
    // In `NavColumn.tsx` since 2026-09-06: the rail's rows moved out of `AdminSidebar` when
    // arrange mode arrived, and this guard has to follow the row definition rather than the
    // file it used to live in.
    const rows = readFileSync('src/admin/components/NavColumn.tsx', 'utf8')
    expect(rows).toContain('active ? SIDEBAR_NAV_QUIET : SIDEBAR_NAV')
  })
})

describe('the dark highlighter is legible, and it is measured', () => {
  /** WCAG relative luminance from a `#rrggbb` string. */
  const lum = (hex: string): number => {
    const p = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * (p[0] ?? 0) + 0.7152 * (p[1] ?? 0) + 0.0722 * (p[2] ?? 0)
  }
  const ratio = (a: string, b: string): number => {
    const x = lum(a), y = lum(b)
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }
  /** Every `--pen:` declaration in the admin sheet, in source order: light first, then dark. */
  const pens = [...readFileSync('src/admin/admin.css', 'utf8').matchAll(/--pen:\s*(#[0-9a-f]{6})/gi)]
    .map((m) => m[1] as string)

  it('has a pen of its own in dark, not the light one dimmed', () => {
    // ⚠️ TWO INKS, and the second is the reason this file has a section about dark at all.
    // The light pen is #d5f856, a highlighter on white paper. Painted into a dark admin it
    // is a slab of lime with no relation to anything around it, so dark gets an OLIVE — the
    // same marker seen under low light.
    expect(pens.length).toBeGreaterThanOrEqual(2)
    expect(pens[0]).not.toBe(pens[1])
  })

  it('carries a label that clears 4.5:1 on each pen', () => {
    // The ink FLIPS with the theme and only the ink: near-black on the light pen, white on
    // the dark one. Measured rather than asserted, because the first dark cut kept the
    // near-black and it came out at 3.8:1 — under the 4.5 a label has to clear, and it read
    // as grey smeared on mustard.
    const light = pens[0] as string
    const dark = pens[1] as string
    expect(ratio('#0a0a0a', light)).toBeGreaterThanOrEqual(4.5)
    expect(ratio('#ffffff', dark)).toBeGreaterThanOrEqual(4.5)
    // And the pairing the code does NOT use, so the number that drove the decision is on
    // the record rather than in a comment somebody can edit without re-measuring.
    expect(ratio('#0a0a0a', dark)).toBeLessThan(4.5)
  })
})
