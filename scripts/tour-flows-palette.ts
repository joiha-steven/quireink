// ⌘K AND WHAT IT LANDS ON.
//
// Split out of `tour-flows-pane.ts` on 2026-09-15 when that file passed the 400-line ceiling —
// and the seam is right rather than merely convenient: the palette belongs to no screen. It is
// drawn by `web/admin/overlays.ts` on every admin page, where the write pane is one screen's
// furniture.
//
// ⚠️ NO BACKTICKS AND NO REGEX LITERALS inside the expressions. Each one is a template literal:
// a backtick in a comment closes it, and a backslash is eaten before the browser sees it.
import type { Tour } from './tour'
import { OPEN_DIALOG } from './tour-ask'

/**
 * ⌘K, pressed — and it has to LAND somewhere, not merely open.
 *
 * The palette's whole claim is that you no longer need to know which of eight tabs holds a
 * setting. A flow that opened it and counted rows would prove the list exists; what has to be
 * true is that choosing a row puts you on the tab with that setting on it.
 */
export function registerPaletteFlows({ flow, expect }: Tour): void {
  // The chord cannot be discovered, so the rail carries a control that opens the same thing
  // and PRINTS the chord beside itself. A button that does not open it teaches a shortcut that
  // does not exist, which is worse than teaching nothing.
  flow('admin: the rail teaches the palette chord by printing it', () => expect('/admin', `
    (async () => {
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) {
          const hit = fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }
      // The chord moved to Mod-Shift-K on 2026-09-07: Mod-K was assigned twice, and the
      // editor's link box is the one every editor anybody has used already binds it to.
      const chord = /⌘⇧K|Ctrl\\+Shift\\+K/
      const button = await wait(() => [...document.querySelectorAll('button')]
        .find((b) => chord.test(b.textContent || '') || chord.test(b.getAttribute('title') || '')))
      if (!button) return 'the rail prints the chord nowhere — nobody will find it'
      ${OPEN_DIALOG}
      const openBox = () => { const d = openDialog(); return d ? d.querySelector('input') : null }
      if (openBox()) return 'something was already open'
      button.click()
      const box = await wait(openBox)
      if (!box) return 'the control prints the chord and does not open the thing'
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      return 'ok (' + (button.textContent || button.getAttribute('title')).trim() + ')'
    })()`, 1200))

  /**
   * ⚠️ TWO VISITS, BECAUSE CHOOSING A ROW IS A REAL NAVIGATION (ADR 0054).
   *
   * This read `location.pathname` in a loop after the click, which worked while the palette
   * handed the route to React. `choose()` sets `location.href` now, and a navigation destroys
   * the context this script runs in — the flow came back `(no value)`.
   *
   * So the first visit proves everything a person does BEFORE the page turns: the chord opens
   * the palette, a typed word narrows it to a settings row, and that row NAMES where it goes.
   * The address is read from `data-pal-href`, which is the attribute the click itself reads, so
   * this is not a second source for it. The row is then clicked for real, last, after the value
   * is on its way back. The second visit walks to that address and proves it is a settings page
   * with that tab open — which is the half the navigation took away.
   */
  flow('admin: the palette chord finds a setting and lands on its tab', async () => {
    const said = await expect('/admin', `
    (async () => {
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) {
          const hit = await fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }
      ${OPEN_DIALOG}
      const openBox = () => { const d = openDialog(); return d ? d.querySelector('input') : null }
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, shiftKey: true, bubbles: true, cancelable: true }))
      const box = await wait(openBox)
      if (!box) return 'the palette did not open'

      // The native setter is how a real keystroke is simulated: assigning to .value directly
      // fires no input event, and the island filters on that event.
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setValue.call(box, 'font')
      box.dispatchEvent(new Event('input', { bubbles: true }))

      // ⚠️ THE ROW IS THE OPTION, not a button inside one (ADR 0054 step 6). The palette is a
      // combobox over a listbox: the keyboard moves a cursor the input announces rather than
      // landing on a control, because a focusable control inside an option is a second way in
      // that the pattern has no answer for. There is no button to find.
      //
      // ONE DOM PER STATE: all hundred-odd rows ship drawn and the island hides the ones that
      // do not match, so a row found by words alone is a row the owner cannot see.
      const row = await wait(() => [...box.closest('[role=dialog]').querySelectorAll('li[data-pal-row]')]
        .filter((r) => r.checkVisibility())
        .find((r) => /\\/admin\\/settings\\?tab=/.test(r.getAttribute('data-pal-href') || '')))
      if (!row) return 'typing a word found no setting'
      const href = row.getAttribute('data-pal-href')

      // Clicked LAST, and after the value is on its way back: the click navigates, and a
      // navigation takes this context with it.
      setTimeout(() => row.click(), 50)
      return 'ok ' + href
    })()`, 1500)
    if (!said.startsWith('ok ')) return said
    const href = said.slice(3)

    return await expect(href, `
    (() => {
      if (document.documentElement.dataset.adminScreen !== 'settings') return 'not the settings screen'
      const open = document.querySelector('[data-settings-panel]:not([hidden])')
      if (!open) return 'settings opened with no panel on screen'
      const want = new URL(location.href).searchParams.get('tab')
      const shown = open.getAttribute('data-settings-panel')
      if (shown !== want) return 'the address asked for ' + want + ' and ' + shown + ' is open'
      return 'ok (' + location.pathname + location.search + ')'
    })()`, 1200)
  })

  // TWO LINES OF SUMMARY, AND THE ROWS STAY A LIST. `line-clamp-2` works by switching the box
  // to a webkit box, so a display utility beside it wins the cascade and the clamp goes
  // quietly dead — no warning, and the only symptom is text longer than it was meant to be.
  // Measured on 2026-09-12 with `block` in that class list: the summary ran 112px, which is
  // SEVEN lines against the two it asked for, rows ran from 44px to 199px, and five pieces
  // fitted on a 900px screen out of forty-nine. `check:admin-kit` refuses the pairing now;
  // this proves the clamp is doing its job in a browser, which is the only place it can.
  flow('admin: a piece\'s summary in the write list stops after two lines', () => expect('/admin/content', `
    (async () => {
      const wait = async (fn, tries = 40) => {
        for (let i = 0; i < tries; i++) { const hit = fn(); if (hit) return hit; await new Promise((r) => setTimeout(r, 100)) }
        return null
      }
      const summaries = await wait(() => {
        const found = [...document.querySelectorAll('[data-write-summary]')]
        return found.length >= 3 ? found : null
      })
      if (!summaries) return 'skip: fewer than three pieces carry a summary'
      const tall = []
      for (const el of summaries) {
        const lines = el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)
        if (lines > 2.1) tall.push(lines.toFixed(1))
      }
      if (tall.length) return tall.length + ' summary line(s) past two lines: ' + tall.join(', ')
      const rows = [...document.querySelectorAll('[data-write-row]')].map((a) => a.getBoundingClientRect().height)
      return 'ok ' + summaries.length + ' summaries within two lines, rows '
        + Math.round(Math.min(...rows)) + '-' + Math.round(Math.max(...rows)) + 'px'
    })()`, 900))
}
