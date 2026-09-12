// The writing sheet's CHROME: the button strip over the paper, and the attributes panel
// beside it. Both faults below are about a thing MOVING under the hand that is using it, and
// a moving layout is exactly what no unit test and no screenshot can catch.
//
// Its own file because `tour-flows-editor.ts` and `tour-flows-admin.ts` are both within a
// dozen lines of the 400-line rule, and because the seam is real: that file drives the FORM
// — the title, the save, the recovery copy — and these two drive the furniture around it.
import type { Tour } from './tour'

export function registerSheetFlows({ flow, atWidth }: Pick<Tour, 'flow' | 'atWidth'>): void {
  // THE TOOLBAR HOLDS STILL. It is centred over the writing, so anything joining the run
  // moves every button already in it: putting the caret in a table added five and slid the
  // row 62.5px to the left, measured at 1440 on 2026-09-12, and taking the caret out slid it
  // back. The button a hand was travelling towards was somewhere else by the time it arrived.
  // The table's tools have their own line now. NOTE: a template literal. No backticks.
  //
  // A BLANK SHEET on purpose: a piece with no row has no server autosave (there is nothing to
  // hang a snapshot on), so this flow can insert a table and leave nothing behind.
  flow('editor: the toolbar holds still when the caret enters a table', () => atWidth(1440, '/admin/editor', `
    (async () => {
      const wait = async (fn, tries = 60) => {
        for (let i = 0; i < tries; i++) { const hit = fn(); if (hit) return hit; await new Promise((r) => setTimeout(r, 100)) }
        return null
      }
      const button = (test) => [...document.querySelectorAll('button')].find(test)
      const bold = await wait(() => button((b) => (b.textContent || '').trim() === 'B'))
      if (!bold) return 'no toolbar over the paper'
      const before = bold.getBoundingClientRect().x
      const table = button((b) => /^Table/.test(b.getAttribute('aria-label') || ''))
      if (!table) return 'skip: this build offers no table button'

      table.click()
      const grew = await wait(() => document.querySelectorAll('button').length > 0
        && button((b) => (b.textContent || '').trim() === 'C+') ? true : null, 30)
      if (!grew) return 'the table tools never arrived'
      const after = bold.getBoundingClientRect().x
      const slid = Math.abs(after - before)
      if (slid > 0.5) return 'the toolbar slid ' + slid.toFixed(1) + 'px when the caret entered a table'

      // And the tools it brought stand on the sheet's own left edge, under the row above.
      const cplus = button((b) => (b.textContent || '').trim() === 'C+')
      const strip = cplus.closest('div').parentElement
      const pad = parseFloat(getComputedStyle(strip).paddingLeft)
      const edge = strip.getBoundingClientRect().x + pad
      const off = Math.abs(cplus.getBoundingClientRect().x - edge)
      if (off > 1) return 'the table tools start ' + off.toFixed(1) + 'px off the sheet edge'
      return 'ok bold held at ' + before.toFixed(1) + ', the table tools ranged left'
    })()`, 1200))

  // THE ATTRIBUTES SHEET STANDS BESIDE THE WRITING, above the width where there is room for
  // both. It used to lie on top of it at every width: measured on 2026-09-12 it hid 232px of
  // the writing column at 1280 (34.5% of every line), 104px at 1440 and 200px at 1920, with
  // 348px of empty paper standing beside the text at that last one. The publish step is the
  // exception and keeps its sheet on top, which is what that step is.
  flow('editor: the attributes stand beside the writing, not on it', () => atWidth(1440,
    '/admin/editor/ligatures-and-the-three-you-can-turn-off', `
    (async () => {
      const wait = async (fn, tries = 60) => {
        for (let i = 0; i < tries; i++) { const hit = fn(); if (hit) return hit; await new Promise((r) => setTimeout(r, 100)) }
        return null
      }
      const paper = await wait(() => document.querySelector('.ProseMirror'))
      if (!paper) return 'the editor never mounted'
      const open = document.querySelector('[data-attrs]')
      if (!open) return 'no way to open the attributes'
      open.click()

      const panel = await wait(() => document.querySelector('aside[role=dialog]'))
      if (!panel) return 'the attributes never opened'
      await new Promise((r) => setTimeout(r, 500))
      // Re-read the paper: the sheet remounts around it when the canvas makes room.
      const column = document.querySelector('.ProseMirror').getBoundingClientRect()
      const sheet = panel.getBoundingClientRect()
      const covered = column.right - sheet.x
      if (covered > 0) return 'the sheet covers ' + Math.round(covered) + 'px of the writing column'
      if (Math.round(column.width) < 600) return 'the column narrowed to ' + Math.round(column.width) + 'px to make room'
      // A sheet standing beside the page must not claim the page has gone.
      if (panel.getAttribute('aria-modal') === 'true') return 'the docked sheet still calls itself modal'
      return 'ok ' + Math.round(-covered) + 'px of paper between the words and the sheet'
    })()`, 1200))
}
