// EVERY FIELD THE PANEL DRAWS HAS TO REACH THE DRAFT, and the way this fails is silent.
//
// A control the server drew carries `data-k`, which is the draft key it writes. If nothing in
// the island listens to that KIND of element, the control is drawn, is labelled, takes the
// owner's answer, looks exactly right — and saves nothing.
//
// That is not hypothetical. `wirePlain` knew `<input>` and `<textarea>` and not `<select>`,
// because the attributes panel had never held a select; the first one drawn on it (the piece's
// language, ADR 0056) saved nothing, and it took a browser tour flow to find out. This file is
// the fast version of that flow: one case per element kind, so the next kind added to the panel
// fails here in milliseconds rather than in a twelve-minute tour.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { emptyDraft, type SheetDraft } from '@/admin-shared/sheet-wire'
import { wireFields } from './sheet-fields'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

let root: HTMLElement
let patches: Partial<SheetDraft>[]

beforeEach(() => {
  document.body.innerHTML = ''
  root = document.createElement('div')
  document.body.appendChild(root)
  patches = []
})

/** Draw the markup, wire it, and collect every patch the fields send. */
function wire(markup: string): void {
  root.innerHTML = markup
  wireFields(root, { removeAria: '' } as never, 'en', emptyDraft(), (patch) => { patches.push(patch) })
}

/** The last value written for a key, or undefined when nothing was. */
const wrote = (key: keyof SheetDraft): unknown =>
  patches.filter((p) => key in p).map((p) => p[key]).pop()

describe('a field the panel drew reaches the draft', () => {
  it('takes a select, on change', () => {
    wire(`<select data-k="lang">
      <option value="" selected></option><option value="en">English</option>
    </select>`)
    const box = root.querySelector('select')!
    box.value = 'en'
    box.dispatchEvent(new Event('change', { bubbles: true }))
    expect(wrote('lang')).toBe('en')
  })

  it('does not take a select on input, which a keyboard fires on every option it passes', () => {
    // ⚠️ `change`, NOT `input`. A closed select walked with the arrow keys fires `input` on
    // every option on the way, so an `input` listener writes six languages before the owner
    // reaches the seventh — and on a control whose value is a language, each of those is a
    // page rendered in it.
    wire(`<select data-k="lang"><option value="" selected></option><option value="de">DE</option></select>`)
    const box = root.querySelector('select')!
    box.value = 'de'
    box.dispatchEvent(new Event('input', { bubbles: true }))
    expect(wrote('lang')).toBeUndefined()
  })

  it('takes an input and a textarea, on input', () => {
    // The counter-test for the two above: the kinds that DID work still work, so a case that
    // says "nothing was written" is about the element kind rather than about a broken harness.
    wire(`<input data-k="slug" value=""><textarea data-k="excerpt"></textarea>`)
    const box = root.querySelector('input')!
    box.value = 'a-slug'
    box.dispatchEvent(new Event('input', { bubbles: true }))
    const area = root.querySelector('textarea')!
    area.value = 'A summary'
    area.dispatchEvent(new Event('input', { bubbles: true }))
    expect(wrote('slug')).toBe('a-slug')
    expect(wrote('excerpt')).toBe('A summary')
  })

  it('reads a number field as a number, not as the digits somebody typed', () => {
    wire(`<input type="number" data-k="seriesOrder" value="0">`)
    const box = root.querySelector('input')!
    box.value = '3'
    box.dispatchEvent(new Event('input', { bubbles: true }))
    expect(wrote('seriesOrder')).toBe(3)
  })

  it('leaves the chip and pick boxes to their own wiring', () => {
    // Both draw an `<input data-k>` INSIDE themselves and handle it with rules of their own —
    // a chip box turns Enter into a term, a pick box paints a list. `wirePlain` skipping them
    // is what stops two handlers writing the same key with different ideas of what it holds.
    wire(`<div data-chips="tags"><input data-k="tags" value=""></div>
      <div data-pick="translationGroup"><input data-pick-box data-k="translationGroup" value=""></div>`)
    for (const box of root.querySelectorAll('input')) {
      box.value = 'x'
      box.dispatchEvent(new Event('input', { bubbles: true }))
    }
    // The pick box has its own handler and DOES write; the chip box does not write on a
    // keystroke. What matters here is that neither value arrived as a plain string from
    // `wirePlain` — `tags` is a list, and a string in it would replace one.
    expect(wrote('tags')).toBeUndefined()
  })
})
