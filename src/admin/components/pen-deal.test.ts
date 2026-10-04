// The pens the writing surface deals, kept right by the incremental pass.
//
// `dealChanged` replaced a whole-document pass on every update (0.99 ms a key on a 15,000-word
// post). The risk of an incremental answer is a stroke it misses, drawn with a stale pen until
// the next open. So every case here checks EVERY stroke against the answer the full pass would
// give — the stroke under the hand excepted, which is the deferral the plugin promises.
//
// happy-dom is registered for this file only, the rule every editor suite here follows.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { TextSelection } from 'prosemirror-state'
import { penSeed } from '@/pen/grammar'

beforeAll(() => { GlobalRegistrator.register() })
afterAll(async () => { await GlobalRegistrator.unregister() })

type Ed = import('@/admin/editor/editor').Editor

async function open(markdown: string): Promise<Ed> {
  const { Editor } = await import('@/admin/editor/editor')
  const host = document.createElement('div')
  document.body.appendChild(host)
  return new Editor({ element: host, content: markdown })
}

/** Strokes whose pen is not the one their words hash to, leaving out the one the hand is in. */
async function wrong(ed: Ed): Promise<string[]> {
  const { penRawOf } = await import('./pen-deal')
  const out: string[] = []
  const { from } = ed.state.selection
  let held: Element | null = null
  try {
    const at = ed.view.domAtPos(from).node
    held = (at instanceof Element ? at : at.parentElement)?.closest('mark,u') ?? null
  } catch { /* no DOM there */ }
  for (const el of ed.view.dom.querySelectorAll('mark,u')) {
    if (el === held) continue
    if (el.getAttribute('data-pen') !== String(penSeed(penRawOf(el)))) out.push(penRawOf(el))
  }
  return out
}

/** The document position of the first occurrence of `text`. */
function find(ed: Ed, text: string): number {
  let at = -1
  ed.state.doc.descendants((node, pos) => {
    if (at < 0 && node.isText && node.text?.includes(text)) at = pos + node.text.indexOf(text)
    return at < 0
  })
  if (at < 0) throw new Error(`no "${text}"`)
  return at
}

const DOC = 'First ==alpha== and ++beta++ here.\n\nSecond @@gamma@@ and ==delta#blue== there.\n\nThird plain line.'

describe('the pens, dealt one update at a time', () => {
  it('deals every stroke when the view is built', async () => {
    const ed = await open(DOC)
    expect(ed.view.dom.querySelectorAll('mark:not([data-pen]),u:not([data-pen])').length).toBe(0)
    expect(await wrong(ed)).toEqual([])
  })

  it('re-deals a stroke whose words changed while the hand was elsewhere (a replace, an undo)', async () => {
    const ed = await open(DOC)
    ed.commands.setTextSelection(find(ed, 'Third'))
    const at = find(ed, 'beta')
    ed.view.dispatch(ed.state.tr.insertText('BETA', at, at + 4))
    expect(await wrong(ed)).toEqual([])
    ed.view.dispatch(ed.state.tr.insertText('gam', find(ed, 'gamma'), find(ed, 'gamma') + 5))
    expect(await wrong(ed)).toEqual([])
  })

  it('leaves the stroke being typed in alone, and settles it once the caret leaves', async () => {
    const ed = await open(DOC)
    const inside = find(ed, 'alpha') + 2
    ed.commands.setTextSelection(inside)
    const el = ed.view.dom.querySelector('mark')!
    const before = el.getAttribute('data-pen')
    ed.view.dispatch(ed.state.tr.insertText('xyz', inside))
    const stroke = ed.view.dom.querySelector('mark')!
    // Held: whichever element now draws it, it keeps a pen and is not re-dealt per letter.
    expect(stroke.getAttribute('data-pen')).not.toBeNull()
    if (stroke === el) expect(stroke.getAttribute('data-pen')).toBe(before)
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, find(ed, 'Third'))))
    expect(await wrong(ed)).toEqual([])
  })

  it('deals a stroke just applied, and the blocks a paste brings in', async () => {
    const ed = await open(DOC)
    const at = find(ed, 'plain')
    ed.view.dispatch(ed.state.tr.addMark(at, at + 5, ed.schema.marks.ink!.create()))
    expect(await wrong(ed)).toEqual([])
    const { contentToNodes } = await import('@/admin/editor/commands-doc')
    const end = ed.state.doc.content.size
    ed.view.dispatch(ed.state.tr.insert(end, contentToNodes('Pasted ++omega++ and @@psi@@.') as never))
    expect(await wrong(ed)).toEqual([])
  })

  it('deals the strokes a find highlight redraws, anywhere in the piece', async () => {
    const ed = await open(DOC)
    const { setFind } = await import('./FindExtension')
    ed.commands.setTextSelection(find(ed, 'Third'))
    setFind(ed, { query: 'lt' })
    expect(await wrong(ed)).toEqual([])
    expect(ed.view.dom.querySelectorAll('mark:not([data-pen]),u:not([data-pen])').length).toBe(0)
    setFind(ed, { query: '' })
    expect(ed.view.dom.querySelectorAll('mark:not([data-pen]),u:not([data-pen])').length).toBe(0)
  })
})
