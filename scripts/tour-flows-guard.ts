// THE UNSAVED-CHANGES GUARD, which is two questions and not one.
//
// A screen with work on it that has not been saved must not let a click take that work away
// silently — and `useNavigationGuard` answers in two different ways depending on where the
// click goes. An IN-APP navigation gets the product's own three-way question (stay · discard ·
// save and go); a REAL navigation can only ever raise the browser's generic warning, because
// that is all `beforeunload` is allowed to do. Both halves exist for that reason.
//
// ⚠️ WHICH HALF A LINK GETS CHANGES AS ADR 0054 PROGRESSES, and that is why these flows have a
// file of their own rather than sitting among the settings flows they happen to use as a
// subject. `router.tsx` declines to route any path the server now draws, so every conversion
// moves another rail link from the first half to the second. A flow here must pick a
// destination React still owns, deliberately, and re-pick it when that stops being true.
import type { Tour } from './tour'

export function registerGuardFlows({ flow, expect }: Pick<Tour, 'flow' | 'expect'>): void {
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
      // ⚠️ A RAIL LINK THE ROUTER STILL OWNS (ADR 0054): this clicked home until /admin became
      // a server-drawn page, and a declined route is a REAL navigation, which destroys the
      // context this script runs in. The guard's in-app half is all this flow ever tested.
      const away = document.querySelector('aside nav a[href="/admin/media"]')
      if (!away) return 'no in-app destination left on the rail'
      away.click()
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
      if (location.pathname !== '/admin/media') return 'chose to discard and the page stayed put'
      return 'ok (landed on the library)'
    })()`, 1200))

}
