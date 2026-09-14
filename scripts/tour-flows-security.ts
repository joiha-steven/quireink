// THE ACCOUNT SCREEN, which was the third capability in one week that existed and had no door.
//
// `listSessions` and `revokeAllSessions` were written and tested and called by nobody; the spec
// described a screen nothing had ever built. A unit test proves the routes answer — only a
// browser proves the owner can reach them.
//
// It came out of `tour-flows-css.ts` on 2026-09-15, when that file crossed 400 lines. It never
// belonged beside the Custom CSS box; it was only ever there because both were written the same
// afternoon.
import type { Tour } from './tour'

export function registerAccountFlows({ flow, expect }: Tour): void {
  flow('admin: the account can be defended from the admin', () =>
    expect('/admin/settings?tab=account', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const cur = document.querySelector('[data-security-current]')
      if (!cur) return 'the Account tab has no Security card'

      // WAITED FOR, not assumed. The device list has always come from a round trip — React
      // fetched it on mount and the server-drawn card fetches it from its island — so reading
      // it straight away is asserting a race this flow happened to win. Four seconds, then the
      // same complaint as before.
      const seen = async () => {
        for (let i = 0; i < 40; i++) {
          const found = [...document.querySelectorAll('[data-security-session]')]
          if (found.length) return found
          await sleep(100)
        }
        return []
      }
      const rows = await seen()
      if (!rows.length) return 'no signed-in device is listed, not even this one'
      if (!rows.some((r) => /this device|thiết bị này/i.test(r.textContent))) {
        return 'the list does not say which session is the one asking'
      }

      // Re-read after every render: React replaces these nodes, so a reference captured
      // earlier reports the disabled state of a button that is no longer on the page.
      const acting = () => [...document.querySelectorAll('button')]
        .filter((b) => /codes|enrol|mã mới|Đăng ký lại/i.test(b.textContent))
      if (acting().length < 2) return 'only ' + acting().length + ' password-only actions on screen'
      // Both are changes, so neither may be reachable until the password is typed. "Change
      // password" is deliberately NOT in this set: it waits for the new password as well,
      // which is why asserting all three go live failed on its first run.
      if (!acting().every((b) => b.disabled)) return 'an action was live before the password was given'

      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(cur, 'definitely not the password')
      cur.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(250)
      if (acting().some((b) => b.disabled)) return 'typing a password left an action disabled'

      // THE POINT: a valid session plus a wrong password changes nothing.
      acting().find((b) => /codes|mã mới/i.test(b.textContent)).click()
      await sleep(900)
      // ⚠️ VISIBLE AND FILLED, not merely present. Under ADR 0054 the server draws every state,
      // so the codes panel ships in the markup EMPTY and hidden — a code written into it would
      // be a code in the page source of every account screen ever opened. Asking whether the
      // element exists is the React question and it now answers yes on a screen that has minted
      // nothing. docs/admin-one-dom.md: a filter HIDES, so a flow asks offsetParent.
      // (No backticks in here — this whole expression is a template literal.)
      const codesBox = document.querySelector('[data-security-codes]')
      const codesShown = codesBox && codesBox.offsetParent !== null && codesBox.children.length > 0
      if (codesShown) return 'a wrong password minted recovery codes'
      if (!/not right|không đúng/i.test(document.body.innerText)) return 'a wrong password was refused silently'

      set.call(cur, '')
      cur.dispatchEvent(new Event('input', { bubbles: true }))
      return 'ok (' + rows.length + ' device(s))'
    })()`, 1800))
}
