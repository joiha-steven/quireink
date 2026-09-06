// The Settings screen's own flows. Split from `tour-flows-admin.ts` at its 400-line cap —
// the same seam as the editor, home, pane and newsletter flows beside it.

import type { Tour } from './tour'

export function registerSettingsFlows({ flow, expect }: Tour): void {
  flow('admin: every settings label is reachable from the search', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const frame = () => new Promise((r) => requestAnimationFrame(r))
      const box = document.querySelector('input[type=search]')
      if (!box) return 'no search box'
      const setValue = (v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(box, v)
        box.dispatchEvent(new Event('input', { bubbles: true }))
      }
      // Every SETTING LABEL the seven tabs render — matched on \`SETTING_LABEL\`'s own class
      // signature (kit.tsx), not on "looks like a label". The looser sweep tried first
      // collected 110 strings and called 51 unfindable, and every one of those was a tab
      // name, a palette name or a language in a picker: things that are not settings and
      // have no business in the index. A guard that cries wolf gets switched off.
      // ⚠️ Tabs are found by STRUCTURE (the sheet-top track, aria-pressed), never by a
      // paint shade: as [class*="bg-neutral-200"] a hover elsewhere matched the shade, the
      // sweep took in the sidebar, and this flow CLICKED SIGN OUT — everything after it
      // failed on a dead session and nothing pointed here. (Empty ⇒ the zero-label guard.)
      const labels = new Set()
      const tabs = [...(document.querySelector('main .no-scrollbar')?.querySelectorAll('button[aria-pressed]') ?? [])]
      for (const tab of tabs) {
        tab.click()
        await sleep(500)
        // \`SETTING_LABEL\`'s exact signature (kit.tsx), all four parts. Two parts of it was
        // not enough: \`FontUpload\` prints the CURRENT family in \`font-medium
        // text-neutral-800\` and that is a value readout, not a label — the guard called it an
        // unfindable setting and it never was one.
        const sel = '[class*="block"][class*="text-sm"][class*="font-medium"][class*="text-neutral-800"]'
        for (const el of document.querySelectorAll('main ' + sel)) {
          const text = el.textContent.trim()
          if (!text || text.length <= 2 || text.length >= 60 || el.children.length) continue
          // A button wears the label style too — "Choose image", "Add item", a font tile.
          // Those are actions and options, not settings, and indexing them would put four
          // "Choose image" rows in a result list that has one useful answer.
          if (el.closest('button')) continue
          // A file picker's label names the FILE it wants, not a setting.
          if (el.closest('label')?.querySelector('input[type=file]')) continue
          // A tile inside a picker is an OPTION — "Default (Inter)", a palette, a ratio.
          // The picker itself is the setting and is indexed; its choices are not.
          if (el.closest('label')?.querySelector('input[type=radio], input[type=checkbox]')) continue
          labels.add(text)
        }
      }
      const missing = []
      for (const label of labels) {
        setValue(label)
        await frame(); await frame()
        if (!document.querySelector('main ul li button')) missing.push(label)
      }
      setValue('')
      if (!labels.size) return 'collected no labels — this flow would pass forever'
      // Reported rather than asserted at zero: the sweep also picks up option names inside a
      // picker (a palette, a font, a language), which are not settings and are not indexed.
      // What must never appear here is a FIELD.
      return missing.length === 0
        ? 'ok (' + labels.size + ' labels, all findable)'
        : missing.length + ' of ' + labels.size + ' not findable: ' + missing.slice(0, 6).join(' | ')
    })()`, 1200))

  // Unsaved settings are not lost by a click on the rail. Two flows, because the interesting
  // half is the SECOND answer: a dialog that offers "stay" and then leaves anyway is worse
  // than no dialog, and one that offers "discard" and then keeps the edit is a lie about
  // what the button did.
  // The shared opening move of both flows below: put one change on the form, confirm the
  // save key counted it, then try to walk out. Inlined as STATEMENTS into each flow's async
  // body — so a failure returns the verdict string straight out of the flow — and it leaves
  // `was` and `dialog` behind for the half that differs.
  const editAndLeave = `
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      // \`:not([type])\` and not \`[type=text]\`: \`ui/Input\` leaves the attribute off unless a
      // caller names one, so the site title — the first field on this sheet — matches neither
      // \`input[type=text]\` nor anything else a habit would reach for.
      const box = document.querySelector('main input:not([type])')
      if (!box) return 'no text field on the settings sheet'
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      const was = box.value
      setter.call(box, was + ' edited')
      box.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(250)
      const save = [...document.querySelectorAll('main button')].find((b) => /[0-9]/.test(b.textContent) && !b.disabled)
      if (!save) return 'the save key never counted the change'
      const home = document.querySelector('aside nav a[href="/admin"]')
      if (!home) return 'no way back to home in the rail'
      home.click()
      await sleep(500)
      const dialog = document.querySelector('[role=dialog]')
      if (!dialog) return 'left the page with an unsaved change and asked nothing'
      if (location.pathname !== '/admin/settings') return 'the address moved before the question was answered'`

  flow('admin: staying keeps an unsaved settings change, and the page', () => expect('/admin/settings', `
    (async () => {
      ${editAndLeave}
      const stay = [...dialog.querySelectorAll('button')][0]
      stay.click()
      await new Promise((r) => setTimeout(r, 400))
      if (location.pathname !== '/admin/settings') return 'chose to stay and the page left anyway'
      const box2 = document.querySelector('main input:not([type])')
      if (box2.value !== was + ' edited') return 'chose to stay and the edit was thrown away'
      return 'ok (still on settings, edit intact)'
    })()`, 1200))

  flow('admin: discarding an unsaved settings change lets the page go', () => expect('/admin/settings', `
    (async () => {
      ${editAndLeave}
      // The LAST button is the committing one, which is the order every footer in this admin
      // uses: back out, then the alternative, then the answer that acts.
      const buttons = [...dialog.querySelectorAll('button')]
      buttons[buttons.length - 1].click()
      await new Promise((r) => setTimeout(r, 600))
      if (location.pathname !== '/admin') return 'chose to discard and the page stayed put'
      return 'ok (landed on home)'
    })()`, 1200))
}
