// The pen sheets when the owner has picked his own inks.
//
// Two things have to hold at once and they pull in opposite directions: a site that has
// chosen nothing must serve the very same immutable URL it served before this feature
// existed, and a site that HAS chosen must serve something else — with the old URL still
// answering, because a page rendered a second before the save still names it.

import { describe, expect, it } from 'bun:test'
import { assetBody, penSheets, penSheetsFor, PEN_LINES_SHEET, PEN_MARKS_SHEET } from '@/web/assets'
import { DEFAULT_INKS } from '@/render/ink-palette'
import { PEN_LIGHT } from '@/render/pen'

const MARKED = '<p><mark data-pen="3">một câu</mark></p>'

describe('penSheets', () => {
  it('is the prebuilt pair when nothing has been chosen', () => {
    expect(penSheets(DEFAULT_INKS)).toEqual({ marks: PEN_MARKS_SHEET, lines: PEN_LINES_SHEET })
    expect(penSheetsFor(MARKED, DEFAULT_INKS)).toEqual([PEN_MARKS_SHEET])
  })

  it('mints a new sheet for a chosen ink, and serves it', () => {
    const chosen = penSheets({ ...DEFAULT_INKS, yellow: '#ff8ad8' })
    expect(chosen.marks).not.toBe(PEN_MARKS_SHEET)
    const css = assetBody(chosen.marks)
    expect(css).toBeTruthy()
    expect(css).toContain('ff8ad8')
    // The measured pigment is GONE from that sheet, not merely outranked by a later rule.
    expect(css).not.toContain(PEN_LIGHT.yellow)
  })

  it('keeps the previous sheet answering after one more change', () => {
    const first = penSheets({ ...DEFAULT_INKS, green: '#112233' })
    const second = penSheets({ ...DEFAULT_INKS, green: '#445566' })
    expect(first.marks).not.toBe(second.marks)
    expect(assetBody(first.marks)).toBeTruthy()
    expect(assetBody(second.marks)).toBeTruthy()
  })

  it('answers the same URL for the same inks, rather than rebuilding', () => {
    const a = penSheets({ ...DEFAULT_INKS, pink: '#0f0f0f' })
    const b = penSheets({ ...DEFAULT_INKS, pink: '#0f0f0f' })
    expect(a).toBe(b)
  })
})
