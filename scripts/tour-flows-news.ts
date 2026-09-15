// The newsletter's own flows. Split from `tour-flows-admin.ts`, which sits at the 400-line
// ceiling — same seam as the editor, home and pane flows beside it.

import type { Tour } from './tour'

export function registerNewsFlows({ flow, expect }: Tour): void {
  // The send latch, end to end minus the send itself: a newsletter cannot be unsent, so the
  // button arms on the first press — amber, the recipient count the send would use, a
  // countdown — and Escape stands it down. `check:all` proves the pieces compile; only a
  // browser proves that the second press is really required and that Esc really disarms.
  // Nothing here ever fires the POST, so the flow needs no cleanup.
  flow('admin: the newsletter send button arms, counts, and stands down', () => expect('/admin/newsletter', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const byText = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()))
      const tab = byText(/^Send$/)
      if (!tab) return 'no Send tab'
      tab.click(); await sleep(500)
      // The armed label prints the count the PREVIEW carried, so wait for the preview.
      for (let i = 0; i < 20 && !document.querySelector('iframe'); i++) await sleep(200)
      // The seed has already mailed one post; if that is the one ticked, give the resend
      // consent so the latch unlocks. The flow still never sends.
      const consent = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('send it again'))
      const box = consent && consent.querySelector('input')
      if (box && !box.checked) { box.click(); await sleep(200) }
      const send = byText(/^Send to subscribers$/)
      if (!send) return 'no send button'
      if (send.disabled) return 'send button locked before the first press'
      send.click(); await sleep(300)
      const armedBtn = [...document.querySelectorAll('button')].find((b) => /press again/.test(b.textContent))
      if (!armedBtn) return 'first press did not arm the latch'
      if (!/[0-9]+ subscribers/.test(armedBtn.textContent)) return 'armed label carries no recipient count: ' + armedBtn.textContent
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await sleep(250)
      if (!byText(/^Send to subscribers$/)) return 'Escape did not stand the latch down'
      return 'ok (armed with a count, stood down, nothing sent)'
    })()`, 900))

  /**
   * ⚠️ THE SAFETY FLOW. `POST /api/broadcast` puts mail on a relay and a newsletter cannot be
   * unsent, and `ui/Button` renders a `<button>` with NO `type` — which HTML reads as
   * `type="submit"`. So the day this screen grows a `<form>`, Enter pressed anywhere inside it
   * fires the real send and walks straight past the two-press latch, which lives in
   * JavaScript and has no say in a native submit.
   *
   * The screen is server-rendered HTML now (ADR 0054), which is exactly the change that makes
   * a form the obvious thing to reach for. This asserts it never was.
   */
  flow('admin: nothing on the newsletter can be submitted', () => expect('/admin/newsletter', `
    (() => {
      const screen = document.querySelector('[data-screen="newsletter"]')
      if (!screen) return 'the server did not draw the newsletter'
      const forms = screen.querySelectorAll('form')
      if (forms.length) return forms.length + ' form(s) on a screen that can send mail'
      const loose = [...screen.querySelectorAll('button')].filter((b) => b.getAttribute('type') !== 'button')
      if (loose.length) {
        return loose.length + ' button(s) without type="button", first: ' + loose[0].textContent.trim()
      }
      // And the one control that would carry an Enter: the test-send address field.
      const fields = [...screen.querySelectorAll('input')].filter((i) => i.closest('form'))
      if (fields.length) return fields.length + ' input(s) sit inside a form'
      return 'ok (' + screen.querySelectorAll('button').length + ' buttons, every one type=button, no form)'
    })()`, 700))

  /** The whole screen in the first response: three panels drawn, every subscriber a row. */
  flow('admin: the newsletter arrives finished, without React drawing it', () => expect('/admin/newsletter', `
    (async () => {
      const html = await (await fetch('/admin/newsletter')).text()
      if (!html.includes('data-screen="newsletter"')) return 'the server did not draw the newsletter'
      if (!html.includes('data-admin-screen="newsletter"')) return 'the server did not name the newsletter as the screen it drew'
      const panels = (html.match(/data-nl-panel=/g) || []).length
      if (panels !== 3) return 'expected three panels in the markup, found ' + panels
      const inMarkup = (html.match(/data-sub /g) || []).length
      const onScreen = document.querySelectorAll('[data-sub]').length
      if (!inMarkup) return 'skip: this instance has no subscribers'
      if (inMarkup !== onScreen) return 'markup held ' + inMarkup + ' rows, the page shows ' + onScreen
      // The picker arrived with a post ticked, which is what the preview and the latch read.
      const ticked = [...document.querySelectorAll('[data-nl-post]')].filter((b) => b.checked)
      if (ticked.length !== 1) return ticked.length + ' posts ticked on arrival, expected one'
      return 'ok three panels, ' + inMarkup + ' subscriber(s), all of it in the first response'
    })()`, 900))

  /**
   * The list narrows and the selection bar counts. VISIBLE rows only: every subscriber is in
   * the markup and the filter sets `hidden` (docs/admin-one-dom.md).
   */
  flow('admin: the subscriber list narrows, and picking raises the bar', () => expect('/admin/newsletter', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const rows = () => [...document.querySelectorAll('[data-sub]')].filter((r) => r.offsetParent !== null)
      const before = rows()
      if (!before.length) return 'skip: this instance has no subscribers'

      const bar = document.querySelector('[data-sub-bar]')
      if (!bar) return 'no selection bar in the markup'
      if (bar.offsetParent !== null) return 'the selection bar is up with nothing ticked'

      const box = before[0].querySelector('[data-sub-pick]')
      box.click(); await sleep(150)
      if (bar.offsetParent === null) return 'ticking a row did not raise the selection bar'
      const said = document.querySelector('[data-pick-count]').textContent.trim()
      if (said !== '1') return 'the bar counted "' + said + '" for one ticked row'
      document.querySelector('[data-pick-clear]').click(); await sleep(150)
      if (bar.offsetParent !== null) return 'Clear did not put the bar away'

      // A status the seed has fewer of than the whole list, so the filter must narrow.
      const scope = document.querySelector('[data-sub-scope] [data-tab="pending"]')
      if (!scope) return 'no pending filter'
      scope.click(); await sleep(200)
      const after = rows()
      if (!after.length) return 'filtering to pending emptied the list'
      if (after.length >= before.length) return 'the pending filter did not narrow anything'
      if (after.some((r) => r.getAttribute('data-status') !== 'pending')) return 'a non-pending row survived'

      const search = document.querySelector('[data-sub-search]')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(search, 'zzzz-no-such-address')
      search.dispatchEvent(new Event('input', { bubbles: true })); await sleep(200)
      if (rows().length) return 'a nonsense search still matched rows'
      const none = document.querySelector('[data-sub-nomatch]')
      if (!none || none.offsetParent === null) return 'nothing matched and the screen said nothing'
      return 'ok (' + before.length + ' -> ' + after.length + ' pending, then none)'
    })()`, 900))

  /** Three tabs, one screen, and the address remembers which. */
  flow('admin: the newsletter tabs swap in a frame and the address follows', () => expect('/admin/newsletter', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const panel = (k) => document.querySelector('[data-nl-panel="' + k + '"]')
      if (panel('people').offsetParent === null) return 'the newsletter did not open on People'
      const tab = document.querySelector('[data-nl-tabs] [data-tab="test"]')
      if (!tab) return 'no Test tab'
      tab.click(); await sleep(250)
      if (panel('test').offsetParent === null) return 'the Test panel did not open'
      if (panel('people').offsetParent !== null) return 'two panels are open at once'
      if (!location.search.includes('tab=test')) return 'the address did not follow the strip'
      if (tab.getAttribute('aria-pressed') !== 'true') return 'the pressed tab is not marked'
      document.querySelector('[data-nl-tabs] [data-tab="people"]').click(); await sleep(250)
      if (location.search.includes('tab=')) return 'going back to People left a tab in the address'
      return 'ok (three panels drawn, one shown, the address in step)'
    })()`, 900))
}
