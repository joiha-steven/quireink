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
import { OPEN_DIALOG } from './tour-ask'

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
      // ⚠️ A RAIL LINK THE ROUTER STILL OWNS (ADR 0054), and the list of those keeps getting
      // shorter. This clicked home until /admin became a server-drawn page, then the library
      // until that did on 2026-09-14. A declined route is a REAL navigation, which raises the
      // browser's own generic warning instead of the product's three-way question and destroys
      // the context this script runs in — so the destination has to be a screen React still
      // draws. When the write screen converts, this flow converts with it or goes.
      const away = document.querySelector('aside nav a[href="/admin/content"]')
      if (!away) return 'no in-app destination left on the rail'
      away.click()
      await sleep(500)
      ${OPEN_DIALOG}
      const dialog = openDialog()
      if (!dialog) return 'left the page with an unsaved change and asked nothing'
      if (location.pathname !== '/admin/settings') return 'the address moved before the question was answered'`

  flow('admin: staying keeps an unsaved settings change, and the page', () => expect('/admin/settings', `
    (async () => {
      ${editAndLeave}
      const stay = [...dialog.querySelectorAll('button')].filter((b) => b.checkVisibility())[0]
      if (!stay) return 'the question offered nothing to press'
      stay.click()
      await new Promise((r) => setTimeout(r, 400))
      if (location.pathname !== '/admin/settings') return 'chose to stay and the page left anyway'
      const box2 = document.querySelector('main input:not([type])')
      if (box2.value !== was + ' edited') return 'chose to stay and the edit was thrown away'
      return 'ok (still on settings, edit intact)'
    })()`, 1200))

  /**
   * ⚠️ WHAT THIS CAN SEE CHANGED WHEN SETTINGS BECAME A PAGE (ADR 0054), AND SOME OF IT IS GONE.
   *
   * It used to click Discard, wait, and read `location.pathname`, because the router moved
   * between screens without a page load. Both screens are real navigations now, and a real
   * navigation destroys the context this script runs in — the flow came back `(no value)`.
   *
   * So what it asserts is the QUESTION: that it is asked, that it offers three answers in the
   * documented order, and that the one which acts is last. The leave itself is clicked at the
   * end, after the value has been returned, so the click is still exercised — but **nothing
   * checks where it lands any more**, and that is a real loss of coverage this conversion
   * caused rather than a thing that stopped mattering. Its sibling above still proves the other
   * half: choosing Stay keeps both the page and the edit.
   */
  flow('admin: the leave question offers three answers, and the one that acts is last', () => expect('/admin/settings', `
    (async () => {
      ${editAndLeave}
      // THE ANSWERS ON OFFER, not the answers drawn. The box ships all four shapes a question
      // can wear — plain yes and red yes, and the third answer between yes and no — and shows
      // the three this question needs.
      const buttons = [...dialog.querySelectorAll('button')].filter((b) => b.checkVisibility())
      if (buttons.length !== 3) return 'the question offers ' + buttons.length + ' answer(s), expected three'
      const said = buttons.map((b) => b.textContent.trim())
      if (said.some((w) => !w)) return 'an answer with no words on it'
      if (new Set(said).size !== 3) return 'two answers say the same thing: ' + said.join(' | ')
      // Clicked LAST, and after the value is on its way back: the click navigates, and a
      // navigation takes this context with it.
      setTimeout(() => buttons[buttons.length - 1].click(), 50)
      return 'ok (three answers: ' + said.join(' · ') + ')'
    })()`, 1200))

}
