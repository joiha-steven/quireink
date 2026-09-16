// THE VOCABULARY'S OWN LOOK, pinned where nothing else was watching it.
//
// Every fault below shipped, none of them broke a type or a route, and all three were invisible
// to a test that asks whether a control is PRESENT — which is what the suite already asks. They
// were found by photographing the screen beside the React build it replaced (2026-09-15), and a
// comparison against a build that is about to be deleted is not a check anybody can run twice.
// So the three facts come back here as assertions on the markup itself.
import { describe, it, expect } from 'bun:test'
import { panelCard } from './fields'
import { pickControl, slider } from './fields-pick'
import { lamp } from './kit'

describe('a select', () => {
  const html = pickControl({ value: 'a', options: [['a', 'A'], ['b', 'B']], label: 'Pick' })

  it('draws a chevron with a line in it', () => {
    // `appearance-none` takes the platform's own caret away, so the drawn one is the ONLY thing
    // saying this opens. It shipped as `<svg data-glyph="down"></svg>` — an attribute that only
    // means something inside a Mark tree, which this is not — so the svg was empty and every
    // dropdown in the admin looked exactly like a text box.
    expect(html).toContain('<svg')
    expect(html).toContain('<path')
  })

  it('keeps the chevron out of the way of the pointer', () => {
    expect(html).toContain('pointer-events-none')
  })
})

describe('a slider', () => {
  it('prints its unit, on a readout the island will rewrite', () => {
    // The server drew "60%" from a string the caller passed and the island rewrote the box from
    // `value` + `data-unit` — so the percent sign vanished on load. One source now: the unit is
    // written once, as an attribute, and both faces read it.
    const html = slider({ k: 'motion.keyVolume', value: 60, min: 0, max: 100, readout: true, unit: '%' })
    expect(html).toContain('data-unit="%"')
    expect(html).toContain('>60%<')
  })

  it('leaves the box out when there is no readout to show', () => {
    expect(slider({ value: 3, min: 0, max: 10 })).not.toContain('data-readout')
  })
})

describe('a card title with a lamp', () => {
  const html = panelCard({ title: 'Backups', lampHtml: lamp({ state: 'good' }), body: '' })

  it('puts the mark at the END of the row, so every title starts at the same x', () => {
    // A lamp beside the name pushes that name right by the mark plus its gap, and only the
    // cards that have a state to report carry one. Measured on the account tab before this
    // moved: "Admin này" began at x=869 while the card beside it began at 851, on a screen
    // whose titles are read down their left edge.
    const mark = html.indexOf('data-lamp') > -1 ? html.indexOf('data-lamp') : html.indexOf('rounded-full')
    const words = html.indexOf('Backups')
    expect(mark).toBeGreaterThan(-1)
    expect(mark).toBeGreaterThan(words)
  })

  it('keeps the mark in a flex box, so a header with one is no taller than a header without', () => {
    // ⚠️ THIS IS A HEIGHT, not a class preference. An inline-block on its own gets a LINE BOX —
    // 24px of it at this type size, for an 8px mark — and a card with a lamp then wears a
    // header taller than every card without one. The row is `items-center`, and the lamp's own
    // wrapper is a flex box, so the mark contributes its 8px and nothing else.
    expect(html).toContain('<span class="flex items-center gap-3">')
    expect(html).not.toContain('mt-[7px]')
  })
})
