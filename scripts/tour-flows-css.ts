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
