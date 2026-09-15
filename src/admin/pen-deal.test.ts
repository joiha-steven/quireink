// THE WRITER GETS THE SAME FORTY PENS THE PAGE DEALS.
//
// The page hashes every gesture's Markdown into one of forty grips; the editor wrote no
// `data-pen` at all and drew all of them with the four fallbacks at the foot of `ink.css.ts`.
// What is pinned here is the AGREEMENT — the number in the editor is the number
// `md/html.ts` puts on the same stroke — plus the one rule that makes it usable: the stroke
// under the hand does not change shape while it is being written in.
//
// happy-dom for THIS FILE ONLY, the island rule every editor suite here follows.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

async function open(content: string) {
  const { Editor } = await import('@/admin/editor/editor')
  const host = document.createElement('div')
  document.body.appendChild(host)
  return new Editor({ element: host, content })
}

/** What the published page would stamp on the same source, straight from the renderer. */
async function onThePage(source: string): Promise<string[]> {
  const { toHtml } = await import('@/md/index')
  return [...toHtml(source, {}).matchAll(/data-pen="(\d+)"/g)].map((m) => m[1]!)
}

const pensIn = (editor: { view: { dom: HTMLElement } }): string[] =>
  [...editor.view.dom.querySelectorAll('mark,u')].map((el) => el.getAttribute('data-pen') ?? '')

describe('penRawOf', () => {
  it('reads a drawn stroke back as the Markdown that would have written it', async () => {
    const { penRawOf } = await import('@/admin/components/pen-deal')
    const make = (html: string) => {
      const host = document.createElement('div')
      host.innerHTML = html
      return penRawOf(host.firstElementChild!)
    }
    // Yellow, graphite and red are what a bare gesture MEANS, so none of the three writes an
    // attribute and none of the three sources carries a suffix.
    expect(make('<mark>chữ</mark>')).toBe('==chữ==')
    expect(make('<mark data-ink="green">chữ</mark>')).toBe('==chữ==#green')
    expect(make('<u>chữ</u>')).toBe('++chữ++')
    expect(make('<u data-ink="pink">chữ</u>')).toBe('++chữ++#pink')
    expect(make('<mark data-form="o">chữ</mark>')).toBe('@@chữ@@')
    expect(make('<mark data-form="o" data-ink="blue">chữ</mark>')).toBe('@@chữ@@#blue')
  })
})

describe('the pen the writer sees', () => {
  it('is the pen the page deals the same stroke', async () => {
    const source = 'Một ==câu được tô==, một ++gạch chân++ và một @@vòng@@ nữa.\n'
    const editor = await open(source)
    expect(pensIn(editor)).toEqual(await onThePage(source))
    editor.destroy()
  })

  it('parts company with the page on a stroke drawn across markup, and only there', async () => {
    // The documented trade, pinned so it stays the one shape rather than growing into a
    // second. The element holds WORDS and the engine holds MARKDOWN, so a stroke over
    // emphasis hashes `==a b c==` here and `==a **b** c==` there: a different one of the
    // forty, not a wrong stroke. 6 of the 171 strokes on the live pages are this shape.
    const plain = 'Một ==câu thường== ở đây.\n'
    const marked = 'Một ==câu **đậm** ở đây== nữa.\n'
    const a = await open(plain)
    expect(pensIn(a)).toEqual(await onThePage(plain))
    a.destroy()
    const b = await open(marked)
    expect(pensIn(b)).not.toEqual(await onThePage(marked))
    // Still one of the forty, and still stable — the property the writer actually sees.
    expect(pensIn(b)[0]).toMatch(/^\d+$/)
    expect(Number(pensIn(b)[0])).toBeLessThan(80)
    b.destroy()
  })

  it('varies: forty strokes are not forty of the same pen', async () => {
    // The whole complaint. One fallback grip for every stroke is what this ends, so the
    // floor is "more than one" — and a hash over forty different sentences clears it by a
    // mile. Pinned as a fraction rather than a count so the deck can be re-cut.
    const source = Array.from({ length: 40 }, (_, i) => `Câu thứ ==${i} của bài này==.`).join('\n\n')
    const editor = await open(source)
    const dealt = pensIn(editor)
    expect(dealt).toHaveLength(40)
    expect(new Set(dealt).size).toBeGreaterThan(20)
    editor.destroy()
  })

  it('lands on a stroke the moment it is drawn', async () => {
    const editor = await open('a reed pen, cut to a broad edge')
    expect(pensIn(editor)).toEqual([])
    editor.commands.setTextSelection({ from: 3, to: 11 })
    editor.commands.toggleInk('green')
    expect(pensIn(editor)).toEqual(await onThePage('a ==reed pen==#green, cut to a broad edge'))
    editor.destroy()
  })

  it('holds still while the hand is on it, and settles when the hand leaves', async () => {
    // A seed is a hash of the words, so re-dealing on every keystroke would change the grip
    // — up to 0.22em of height and a different die — under the cursor, letter by letter.
    const editor = await open('Một ==câu được tô== nữa.\n')
    const first = pensIn(editor)[0]!
    // `tr.insertText` is what typing is: it carries the marks already at the position, so
    // the letters land INSIDE the stroke. `insertContent` does not, and splits it.
    const type = (text: string) => {
      const at = editor.state.selection.from
      editor.view.dispatch(editor.state.tr.insertText(text, at, at))
    }
    editor.commands.setTextSelection({ from: 8, to: 8 })
    type('x')
    expect(pensIn(editor)[0]).toBe(first)
    type('yz')
    expect(pensIn(editor)[0]).toBe(first)
    expect(editor.view.dom.querySelector('mark')?.textContent).toBe('câuxyz được tô')
    // Out of the stroke: now it is allowed to become what the page will draw.
    editor.commands.setTextSelection({ from: 1, to: 1 })
    expect(pensIn(editor)).toEqual(await onThePage('Một ==câuxyz được tô== nữa.\n'))
    editor.destroy()
  })

  it('deals a pen to a stroke that has none even under the hand', async () => {
    // Typing the syntax leaves the caret inside the mark it just made. Skipping it because
    // the hand is on it would leave the one stroke the writer is looking at on the fallback.
    const editor = await open('')
    editor.commands.insertContent('==tô đậm==')
    const dealt = pensIn(editor)
    expect(dealt).toHaveLength(1)
    expect(dealt[0]).toMatch(/^\d+$/)
    editor.destroy()
  })
})
