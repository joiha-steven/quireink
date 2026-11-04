// One mark across the admin: a stroke of the pen behind the word that is ON.
//
// The rail's current page, the settings tab and the value chosen in a strip all wear it. A chosen
// value kept a white key carved into a grey groove until 2026-11-04, eight lines under a tab with
// the stroke, so one screen spoke the admin's new look and its old one at the same time. The
// pointer gets the same band, fainter, rather than a grey box.

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { SEGMENT_TRACK, SEGMENT_TRACK_DENSE, tabItemClass as tabItemNames } from '@/admin-shared/tabs'
import * as rail from '@/admin-shared/rail'
import { expandComponents } from '@/admin-shared/component'

// What each key is STYLED AS, through its component names (`admin-shared/component.ts`): the
// ink this file defends lives in the lists, and a name is only how the page spells them.
const tabItemClass = (...a: Parameters<typeof tabItemNames>) => expandComponents(tabItemNames(...a))
const SIDEBAR_NAV = expandComponents(rail.SIDEBAR_NAV)
const SIDEBAR_NAV_ACTIVE = expandComponents(rail.SIDEBAR_NAV_ACTIVE)
const SIDEBAR_NAV_QUIET = expandComponents(rail.SIDEBAR_NAV_QUIET)

describe('the highlighter marks what is on', () => {
  it('strokes the active key of a strip', () => {
    // A highlighter stroke behind the word (`.pen-stroke`), not the key filled with the pen.
    expect(tabItemClass(true, 'sm')).toContain('pen-stroke')
    expect(tabItemClass(true, 'sm')).not.toContain('bg-[var(--pen)]')
    // Ink, not `--on-pen`: the olive belongs to marks in running text; on a pressed key it
    // read as grey. Full contrast on the control.
    expect(tabItemClass(true, 'sm')).toContain('text-neutral-950')
  })

  it('leaves an underlined strip as a marker STROKE, not a wash', () => {
    // A lime block inside an underlined strip would be the loudest thing on the page, and
    // the strip is meant to be quiet. The ink stays on the word so the label reads as a word.
    const lg = tabItemClass(true, 'lg')
    expect(lg).toContain('border-[var(--pen-edge)]')
    expect(lg).not.toContain('bg-[var(--pen)]')
  })

  it('marks the page you are on in the rail with the same stroke, behind the word', () => {
    // Since 2026-11-03 the rail's current row is the tab's mark in the rail: the label in ink
    // with a band of the pen behind it, and no fill, no inset and no gutter bar on the row.
    // The filled, carved key with a 3px bar beside it was the "active pill tab" of every
    // generated dashboard, in this product's colour.
    expect(SIDEBAR_NAV_ACTIVE).toContain('text-neutral-950')
    expect(SIDEBAR_NAV_ACTIVE).not.toContain('bg-[var(--pen)]')
    expect(SIDEBAR_NAV_ACTIVE).not.toContain('shadow-[inset')
    expect(SIDEBAR_NAV_ACTIVE).not.toContain('before:')
    const css = readFileSync('src/admin/admin.css', 'utf8')
    // One rule draws both marks, so the rail and the strip cannot drift into two shapes.
    const rule = css.slice(css.indexOf('.pen-stroke,'), css.indexOf('}', css.indexOf('.pen-stroke,')))
    expect(rule).toContain('.kit-rail-here .rail-label')
    expect(rule).toContain('var(--pen)')
    // A band about two thirds of the line, not the whole box.
    expect(rule).toContain('.95em')
  })
})

describe('one mark, not two', () => {
  it('leaves no carved key in a strip', () => {
    expect(tabItemClass(true, 'sm')).not.toContain('shadow-[inset')
    expect(tabItemClass(false, 'sm')).not.toContain('shadow-[inset')
    // Nor a groove for one to sit in.
    expect(expandComponents(SEGMENT_TRACK)).not.toContain('bg-neutral-200')
    expect(expandComponents(SEGMENT_TRACK_DENSE)).not.toContain('bg-neutral-200')
  })

  it('answers the pointer with the band, not with a grey box', () => {
    const css = readFileSync('src/admin/admin.css', 'utf8')
    const rule = css.slice(css.indexOf('.pen-stroke,'), css.indexOf('}', css.indexOf('.pen-stroke,')))
    expect(rule).toContain('.kit-rail-hover:hover .rail-label')
    expect(rule).toContain('.kit-seg-idle:hover')
    expect(SIDEBAR_NAV).not.toContain('hover:bg-')
    expect(SIDEBAR_NAV).not.toContain('hover:shadow-')
    expect(tabItemClass(false, 'sm')).not.toContain('hover:bg-')
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
    // The same absence for the INK: the base named the resting grey, the active row its ink,
    // and the grey was emitted later, so the current page read #6b6b6b on the pen (4.41:1).
    expect(SIDEBAR_NAV_QUIET).not.toMatch(/(^|\s)(dark:)?text-neutral-\d/)
    expect(SIDEBAR_NAV).toContain('text-neutral-500')
    // The inactive row still has one: it is the only feedback that a row is a link.
    expect(SIDEBAR_NAV).toContain('hover:text-neutral-900')
  })

  it('composes the active row from the quiet base', () => {
    // In `web/admin/rail.ts` since 2026-09-14: the rail is server-rendered HTML (ADR 0054), and
    // this guard follows the row definition rather than the file it used to live in. It has
    // moved twice now — out of `AdminSidebar` when arrange mode arrived, and out of React
    // altogether — which is the argument for asserting the COMPOSITION and not the address.
    const rows = readFileSync('src/web/admin/rail-rows.ts', 'utf8')
    expect(rows).toContain('isActive ? SIDEBAR_NAV_QUIET : SIDEBAR_NAV')
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
