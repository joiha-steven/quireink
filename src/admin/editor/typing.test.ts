// WHAT HAPPENS WHILE SOMEBODY IS TYPING, which is the half of this editor nothing measured.
//
// ⚠️ THIS FILE EXISTS BECAUSE 3,572 TESTS AND 167 BROWSER FLOWS COULD NOT SEE ANY OF IT. They
// open a document and save it, and they were right about that: 116 real posts open and save
// byte-identically through this editor and the one it replaced. Every defect below was in the
// gap between those two acts — the keystroke. A writer typing `- [ ] buy milk` got
// `- [ ] \[ ]` and a stray paragraph; typing a URL lost the space after it and the last
// character of the address; typing `---` and carrying on destroyed the rule and four of the
// five characters. None of it touched a saved file, so none of it was visible to anything.
//
// The cases here are not invented: each one was run against the outgoing build too, and the
// answer recorded is the answer that build gave — except where it is marked as a deliberate
// improvement on it, which is three of them.
//
// happy-dom is registered for this file only, the rule every editor suite here follows.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => { GlobalRegistrator.register() })
afterAll(async () => { await GlobalRegistrator.unregister() })

type Ed = import('./editor').Editor

async function open(markdown = ''): Promise<Ed> {
  const { Editor } = await import('./editor')
  const ed = new Editor({ element: document.createElement('div'), content: markdown })
  ed.commands.setTextSelection(ed.state.doc.content.size)
  return ed
}

/**
 * Typing, one character at a time, through `handleTextInput` — which is the door a browser uses
 * and the door every input rule listens at. `\n` is sent as Enter, because it is a key.
 */
function type(ed: Ed, text: string): void {
  for (const ch of text) {
    if (ch === '\n') { press(ed, 'Enter', 13); continue }
    const { from, to } = ed.state.selection
    const handled = ed.view.someProp('handleTextInput',
      (fn) => Boolean(fn?.(ed.view, from, to, ch, () => ed.state.tr)))
    if (!handled) ed.view.dispatch(ed.state.tr.insertText(ch, from, to))
  }
}

/**
 * ⚠️ `keyCode` IS NOT OPTIONAL IN A TEST OF A KEYMAP, and leaving it out cost a wrong diagnosis.
 * `prosemirror-keymap` tries the chord, then the chord with Shift stripped, and only then falls
 * back to `base[event.keyCode]` — which is the path that resolves `Ctrl+Shift+B` (a browser
 * reports `key: "B"`) to the binding written as `Mod-Shift-b`. A synthetic event without a
 * keyCode cannot reach it, so the shift-stripped lookup wins and the test reports a collision
 * that no browser has.
 */
function press(ed: Ed, key: string, keyCode: number, mods: Record<string, boolean> = {}): boolean {
  const event = new KeyboardEvent('keydown', { key, keyCode, ...mods, bubbles: true } as never)
  return Boolean(ed.view.someProp('handleKeyDown', (fn) => Boolean(fn?.(ed.view, event))))
}

/** Put the caret immediately after the first occurrence of some text. */
function caretAfter(ed: Ed, text: string): void {
  let at = -1
  ed.state.doc.descendants((node, pos) => {
    if (at >= 0 || !node.isText) return true
    const i = (node.text ?? '').indexOf(text)
    if (i >= 0) { at = pos + i + text.length; return false }
    return true
  })
  ed.commands.setTextSelection(at < 0 ? 1 : at)
}

const md = (ed: Ed): string => ed.getMarkdown().trim()

describe('a URL typed as itself', () => {
  it('links it and keeps every character the writer pressed', async () => {
    const ed = await open()
    type(ed, 'see https://a.test done')
    // ⚠️ THE SPACE. `prosemirror-inputrules` hands a rule the range of the match that is IN the
    // document; the character just typed is not in it yet, and a rule that returns a
    // transaction has taken responsibility for it. Forgetting gave `…testdone`.
    expect(md(ed)).toBe('see https://a.test done')
    ed.destroy()
  })

  it('leaves a sentence-final full stop outside the link', async () => {
    const ed = await open()
    type(ed, 'go https://a.test/a. ok')
    expect(md(ed)).toBe('go https://a.test/a. ok')
    ed.destroy()
  })

  it('leaves `www.` and an address alone, because marking them would rewrite the file', async () => {
    // Both are links to the READER — `md/gfm-autolink.ts` gives them `http://` and `mailto:` —
    // but a link whose href differs from its label saves as `[label](href)`. Marking them here
    // would turn what the writer typed into something else on the next save.
    const ed = await open()
    type(ed, 'see www.a.test and a@b.test done')
    expect(md(ed)).toBe('see www.a.test and a@b.test done')
    ed.destroy()
  })

  it('does not link an ordinary word', async () => {
    const ed = await open()
    type(ed, 'hello world here')
    expect(md(ed)).toBe('hello world here')
    ed.destroy()
  })
})

describe('a checkbox typed as `- [ ] `', () => {
  /**
   * ⚠️ AN IMPROVEMENT ON THE OUTGOING BUILD, and one of three in this file. That one answered
   * `- \[ ] buy milk` — the rule did not fire and the brackets were escaped into the post. This
   * one makes the checkbox, which is what opening the same Markdown does.
   */
  it('makes a checkbox and leaves the caret in it', async () => {
    const ed = await open()
    type(ed, '- [ ] buy milk')
    expect(md(ed)).toBe('- [ ] buy milk')
    ed.destroy()
  })

  it('ticks it when the writer typed an x', async () => {
    const ed = await open()
    type(ed, '- [x] done thing')
    expect(md(ed)).toBe('- [x] done thing')
    ed.destroy()
  })

  it('converts the list it is in WITHOUT ticking the items nobody touched', async () => {
    // The whole list converts because the schema says so — a `taskItem` cannot live in a
    // `bulletList`. Only the item being typed in takes the tick.
    const ed = await open('- a\n- b')
    press(ed, 'Enter', 13)
    type(ed, '[x] c')
    expect(md(ed)).toBe('- [ ] a\n- [ ] b\n- [x] c')
    ed.destroy()
  })

  it('refuses an ordered list, which would lose the numbering', async () => {
    const ed = await open('1. a\n2. b')
    press(ed, 'Enter', 13)
    type(ed, '[ ] c')
    expect(md(ed)).toBe('1. a\n2. b\n3. \\[ ] c')
    ed.destroy()
  })
})

describe('a rule that inserts a block, and the next thing typed', () => {
  /**
   * ⚠️ TWO MORE IMPROVEMENTS ON THE OUTGOING BUILD. `replaceRangeWith` leaves the new node
   * SELECTED, so the next character replaces it: typing `---` then `after` left `ftera` on both
   * builds — the rule gone and four of the five characters with it. The caret moves on now.
   */
  it('a rule leaves the caret after the rule, not on it', async () => {
    const ed = await open()
    type(ed, '---after')
    expect(md(ed)).toBe('---\n\nafter')
    ed.destroy()
  })

  it('a block formula keeps what is typed after it', async () => {
    const ed = await open()
    type(ed, '$$x^2$$after')
    expect(md(ed)).toBe('$$x^2$$\n\nafter')
    ed.destroy()
  })

  it('a picture keeps what is typed after it', async () => {
    const ed = await open()
    type(ed, '![a](/u/i.png)after')
    expect(md(ed)).toBe('![a](/u/i.png)\n\nafter')
    ed.destroy()
  })
})

describe('the rules that were already right, held here so they stay right', () => {
  const CASES: [string, string, string][] = [
    ['bold', 'a **b** c', 'a **b** c'],
    ['italic', 'a *b* c', 'a *b* c'],
    ['strike', 'a ~~b~~ c', 'a ~~b~~ c'],
    ['inline code', 'say `code` here', 'say `code` here'],
    ['heading', '## a heading', '## a heading'],
    ['quote', '> a quote', '> a quote'],
    ['bullet', '- an item', '- an item'],
    ['ordered', '1. an item', '1. an item'],
    ['ink with a colour', 'x ==go tay==#pink xong', 'x ==go tay==#pink xong'],
    ['the pencil', 'x ++gach++ y', 'x ++gach++ y'],
    ['the ring', 'x @@vong@@ y', 'x @@vong@@ y'],
    ['inline maths', 'x \\(a^2\\) y', 'x \\(a^2\\) y'],
  ]
  for (const [name, typed, want] of CASES) {
    it(name, async () => {
      const ed = await open()
      type(ed, typed)
      expect(`${name}: ${md(ed)}`).toBe(`${name}: ${want}`)
      ed.destroy()
    })
  }

  it('a fence, which Enter has to close because a typing rule cannot', async () => {
    // `^```([a-z]+)?[\s\n]$` fires on a typed whitespace CHARACTER, and Enter is a key. Without
    // the Enter command the three backticks stayed text and the save escaped them.
    const ed = await open()
    type(ed, '```js\nlet a')
    expect(md(ed)).toBe('```js\nlet a\n```')
    ed.destroy()
  })
})

describe('the keys that were bound wrong, or not at all', () => {
  it('Delete at the end of a list item MERGES the two items', async () => {
    // ⚠️ IT WAS BOUND NOWHERE, so the base keymap's `joinForward` answered — and that pulls the
    // next item's paragraph INSIDE the current one, so the list loses a row and gains an indent
    // nobody typed. The outgoing build merged them.
    const ed = await open('- one\n- two')
    caretAfter(ed, 'one')
    expect(press(ed, 'Delete', 46)).toBe(true)
    expect(md(ed)).toBe('- onetwo')
    ed.destroy()
  })

  it('Tab in the last cell of a table adds a row instead of leaving the editor', async () => {
    const ed = await open('| a | b |\n| --- | --- |\n| 1 | 2 |')
    caretAfter(ed, '2')
    expect(press(ed, 'Tab', 9)).toBe(true)
    expect(md(ed)).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |\n|  |  |')
    ed.destroy()
  })

  it('Ctrl+Shift+B is the blockquote the Help sheet prints, and Ctrl+B is still bold', async () => {
    // ⚠️ A `Mod-B` BINDING SHADOWS `Mod-Shift-b`. `prosemirror-keymap` tries the chord, then the
    // chord with Shift stripped, before the keyCode fallback that resolves the shifted one — so
    // bold answered first. `admin-shared/keys.ts` prints this chord as Blockquote.
    const bold = await open('hello world')
    bold.commands.setTextSelection({ from: 1, to: 6 })
    press(bold, 'b', 66, { ctrlKey: true })
    expect(md(bold)).toBe('**hello** world')
    bold.destroy()

    const quote = await open('hello world')
    quote.commands.setTextSelection({ from: 1, to: 6 })
    press(quote, 'B', 66, { ctrlKey: true, shiftKey: true })
    expect(md(quote)).toBe('> hello world')
    quote.destroy()
  })

  it('answers the emphasis chords a browser actually sends', async () => {
    const CHORDS: [string, string, number, Record<string, boolean>, string][] = [
      ['italic', 'i', 73, { ctrlKey: true }, '*hello* world'],
      ['strike', 'S', 83, { ctrlKey: true, shiftKey: true }, '~~hello~~ world'],
      ['the pen', 'H', 72, { ctrlKey: true, shiftKey: true }, '==hello== world'],
      ['inline code', 'e', 69, { ctrlKey: true }, '`hello` world'],
      ['the pencil', 'u', 85, { ctrlKey: true }, '++hello++ world'],
    ]
    for (const [name, key, code, mods, want] of CHORDS) {
      const ed = await open('hello world')
      ed.commands.setTextSelection({ from: 1, to: 6 })
      press(ed, key, code, mods)
      expect(`${name}: ${md(ed)}`).toBe(`${name}: ${want}`)
      ed.destroy()
    }
  })
})
