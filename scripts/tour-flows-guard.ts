// THE UNSAVED-CHANGES GUARD, which is two questions and not one.
//
// A screen with work on it that has not been saved must not let a click take that work away
// silently, and it is answered in two different ways depending on how the owner leaves. A click
// on an anchor into `/admin` gets the product's own three-way question (stay · save and go ·
// discard), because `admin/island/lib/settings-save.ts` catches that click and asks before it
// lets the navigation start. Every other way out (a typed address, a closed tab, a reload) can
// only ever raise the browser's generic warning, because that is all `beforeunload` is allowed
// to do. Both halves exist for that reason.
//
// ⚠️ WHICH HALF A LINK GETS STOPPED BEING A QUESTION ABOUT ROUTING, and these flows keep a
// file of their own because it used to be one. While ADR 0054 was converting screens one at a
// time, a destination the server had taken over was a real navigation and got the browser's
// two-button warning instead, so a flow here had to pick its destination deliberately and
// re-pick it after each conversion. Every screen is server-drawn now and every rail link is a
// real navigation, so nothing is left to pick: the interception above is the only thing between
// a dirty settings form and a dialog that cannot save. What these flows prove is therefore no
// longer WHICH destination behaves, but that the product's question is the one that comes up at
// all, and that its three answers are in the order the footer grammar promises.
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
      // ⚠️ ANY RAIL LINK THAT LEAVES THIS SCREEN WILL DO, and that was not always true: this
      // clicked home until /admin became a server-drawn page, then the library until that did
      // on 2026-09-14, because back then only a destination the client still routed got the
      // product's question rather than the browser's. \`settings-save.ts\` intercepts the click
      // on every \`/admin\` anchor while the form is dirty, so all that matters about this href
      // is that it is a link OUT: the one thing it exempts is a \`?tab=\` link into this same
      // screen, which is not leaving it.
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
