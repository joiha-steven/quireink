// The Custom CSS box, in a real browser.
//
// This product ships no themes, so this box is the whole of the answer once the 155 settings
// run out — and what makes it usable is not the textarea, it is the list of names beside it.
// `check:contract` proves those names still describe the software; nothing but a browser can
// prove they are still OFFERED, that clicking one writes it where the caret is, and that a
// broken sheet says so instead of failing silently.
import type { Tour } from './tour'

export function registerCssFlows({ flow, expect }: Tour): void {
  flow('admin: the CSS box hands over the names it promises', () =>
    expect('/admin/settings?tab=appearance', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const ed = document.querySelector('[data-css-editor]')
      if (!ed) return 'no custom CSS editor on the appearance tab'

      const setValue = (v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
        setter.call(ed, v)
        ed.dispatchEvent(new Event('input', { bubbles: true }))
      }
      const status = () => document.querySelector('[data-css-status]')?.textContent ?? ''

      // A sheet that would do nothing has to SAY it does nothing.
      setValue('.prose {')
      await sleep(250)
      if (!/\\d/.test(status())) return 'an unclosed brace produced no warning: ' + status()
      const warned = status()

      // ...and a brace inside a comment is not an unclosed brace. A false alarm here is
      // worse than no alarm: it teaches the owner to ignore the line.
      setValue('/* } */ .prose { color: red }')
      await sleep(250)
      if (status() === warned || /brace/i.test(status())) return 'a braced comment cried wolf: ' + status()

      const toggle = document.querySelector('[data-css-reference]')
      if (!toggle) return 'no way to see the promised names'
      toggle.click()
      await sleep(250)

      const chips = [...document.querySelectorAll('button')]
        .filter((b) => /^(--|\\.|#|header\\.|footer\\.)/.test(b.textContent.trim()))
      if (chips.length < 30) return 'only ' + chips.length + ' promised names offered'
      if (!chips.every((b) => b.getAttribute('title'))) return 'a name is offered with no explanation'

      // The point of the list: it writes into the sheet, at the caret, not at the end.
      setValue(':root {  }')
      await sleep(200)
      ed.focus()
      ed.setSelectionRange(8, 8)
      const accent = chips.find((b) => b.textContent.trim() === '--c-accent')
      if (!accent) return 'the promised list does not offer --c-accent'
      accent.click()
      await sleep(400)
      if (ed.value !== ':root { --c-accent }') return 'insert landed wrong: ' + JSON.stringify(ed.value)
      if (ed.selectionStart !== 18) return 'caret left at ' + ed.selectionStart + ', not after the insert'

      setValue('')
      await sleep(200)
      return 'ok (' + chips.length + ' names)'
    })()`, 1500))
}

/**
 * The account screen, which is the third capability this week that existed and had no door.
 *
 * `listSessions` and `revokeAllSessions` were written and tested and called by nobody; the
 * spec described a screen nothing had ever built. A unit test proves the routes answer — only
 * a browser proves the owner can reach them.
 */
export function registerSecurityFlows({ flow, expect }: Tour): void {
  flow('admin: the account can be defended from the admin', () =>
    expect('/admin/settings?tab=system', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const cur = document.querySelector('[data-security-current]')
      if (!cur) return 'the System tab has no Security card'

      const rows = [...document.querySelectorAll('[data-security-session]')]
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
      if (document.querySelector('[data-security-codes]')) return 'a wrong password minted recovery codes'
      if (!/not right|không đúng/i.test(document.body.innerText)) return 'a wrong password was refused silently'

      set.call(cur, '')
      cur.dispatchEvent(new Event('input', { bubbles: true }))
      return 'ok (' + rows.length + ' device(s))'
    })()`, 1800))
}
