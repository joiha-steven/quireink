// The admin's own fields and an input method that composes (the Mac's Telex, Windows' Telex).
//
// A composed word arrives one step at a time — `t`, `ti`, `tie`, `tiê` … `tiếng` — each step an
// `input` event with `isComposing` set, and the Enter or Escape that confirms or cancels it is a
// keydown with `isComposing` set too. A field that acts on the steps rewrites itself under the
// writer (the slug), searches for words nobody typed, or closes the panel the word was being
// typed into. Each case here is one of those, held to the settled word.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { onTyped } from '@/admin/components/composing'
import { wireTitle } from './lib/sheet-title'
import { wirePanel } from './lib/sheet-open'
import { TELEX_STEPS } from '@/admin/components/key-feedback.fixture'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())
beforeEach(() => { document.body.innerHTML = '' })

/** One composed word typed into a field, the way Chrome delivers it. */
function compose(field: HTMLInputElement | HTMLTextAreaElement, steps: string[], before = ''): void {
  field.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
  for (const step of steps) {
    field.value = before + step
    field.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText', data: step }))
  }
  field.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: steps.at(-1) }))
}

describe('a field that answers to typing', () => {
  it('hears a composed word once, settled, and not each step of it', () => {
    const box = document.createElement('input')
    const heard: string[] = []
    onTyped(box, () => heard.push(box.value))
    compose(box, TELEX_STEPS[0]!)
    expect(heard).toEqual(['Tiếng'])
  })

  it('hears every edit of a backspace-based input method, which is real text on screen', () => {
    const box = document.createElement('input')
    const heard: string[] = []
    onTyped(box, () => heard.push(box.value))
    for (const v of ['t', 'ti', 'tie', 'ti', 'tiê']) {
      box.value = v
      box.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    }
    expect(heard).toEqual(['t', 'ti', 'tie', 'ti', 'tiê'])
  })

  it('still hears an input event a script raised, which has no composing flag', () => {
    const box = document.createElement('input')
    let heard = 0
    onTyped(box, () => { heard += 1 })
    box.dispatchEvent(new Event('input', { bubbles: true }))
    expect(heard).toBe(1)
  })
})

describe('the title', () => {
  it('reports the settled title, so the slug is built from the word and not from its steps', () => {
    const box = document.createElement('textarea')
    const titles: string[] = []
    let toBody = 0
    wireTitle(box, (t) => titles.push(t), () => { toBody += 1 })
    compose(box, TELEX_STEPS[0]!)
    compose(box, [' ', ...TELEX_STEPS[1]!.map((s) => ` ${s}`)].slice(1), 'Tiếng')
    expect(titles).toEqual(['Tiếng', 'Tiếng Việt'])
    // The Enter that confirms the word stays with the input method; a plain one goes to the body.
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }))
    expect(toBody).toBe(0)
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(toBody).toBe(1)
  })
})

describe('the attributes panel', () => {
  it('stays open for the Escape an input method uses to drop the word, and shuts for a plain one', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div data-sheet-panel tabindex="-1"><input data-k="excerpt"></div>'
    document.body.appendChild(root)
    let shut = 0
    const panel = wirePanel(root, () => { shut += 1 })
    panel.show()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true }))
    expect(panel.open).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(panel.open).toBe(false)
    expect(shut).toBe(1)
    panel.destroy()
  })
})
