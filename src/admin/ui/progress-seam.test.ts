// One navigation, one sweep — and the number that makes it true.
//
// The bar is a CSS animation that restarts whenever `data-done` is removed from it, because
// `[data-done] { animation: none }` and taking that away runs the keyframes again from the
// left edge. So marking the bar finished and then un-marking it does not "carry on", as the
// code once said it did: it draws the whole bar a second time, in the same element, which is
// why counting elements found nothing and the owner still saw it happen.
//
// Measured in a real browser at 6x CPU throttle with 150ms of added latency, recording every
// insertion and every `data-done` change:
//
//   COLD /admin/content   add@232 DONE@519 undone@699 DONE@1461 gone@1783
//   COLD /admin/settings  add@191 DONE@482 undone@688 DONE@1045 gone@1366
//
// The gap between the shell's answer and the page's first request — the `DONE`→`undone`
// distance — was 179 / 180 / 180 / 206ms across four screens. Every one of them was longer
// than the 120ms the bar was willing to wait, so every cold load drew twice. In-app
// navigation showed no `undone` at all, because the router's transition holds `pending` true
// across its own seam; that is why it read as happening only "sometimes".
//
// What is pinned here is the FLOOR, not the exact value. The realistic regression is somebody
// tidying 400 back down to match the other constant, which would look like a simplification
// and would put the second sweep straight back on every page open.

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { BOOT_SEAM_MS, SEAM_MS } from '@/admin/ui/TopProgress'

/** The widest boot seam measured, above. */
const MEASURED_WORST_MS = 206

describe('the seam the progress bar waits out', () => {
  it('covers the measured boot seam with room for a slower phone', () => {
    expect(BOOT_SEAM_MS).toBeGreaterThan(MEASURED_WORST_MS)
    // Half again as much, because 6x throttle is a mid phone and not the worst one.
    expect(BOOT_SEAM_MS).toBeGreaterThanOrEqual(Math.round(MEASURED_WORST_MS * 1.5))
  })

  it('does not make every click pay for it', () => {
    // The boot seam is structural and happens once; an in-app navigation has none, so
    // charging it the same wait would leave the bar on screen after the page was ready.
    expect(SEAM_MS).toBeLessThan(BOOT_SEAM_MS)
  })

  it('is spent on the FIRST run only', () => {
    const source = readFileSync('src/admin/ui/TopProgress.tsx', 'utf8')
    expect(source).toContain('booted.current ? SEAM_MS : BOOT_SEAM_MS')
    // And the flag flips when a run has actually finished, not when one starts.
    const exit = source.slice(source.indexOf('if (!done) return'))
    expect(exit).toContain('booted.current = true')
  })
})
