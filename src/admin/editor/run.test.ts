// THE CHAIN, WHICH IS THE ONE PIECE OF THIS EDITOR THAT IS NOT OBVIOUS.
//
// Everything else in `editor/` is a spec or a wrapper around a ProseMirror command. `run.ts`
// does something ProseMirror has no opinion about: it runs several commands against ONE
// transaction, so that a later one sees what an earlier one did and the whole gesture is a
// single entry in the undo history.
//
// ⚠️ WHAT WOULD GO WRONG IS SILENT, which is why this is tested rather than read. A chain that
// dispatched per command would work — every button would do its job — and the only symptom
// would be that one press of Bold needs three presses of Mod-Z to take back. Nobody files that.
// The assertions below are therefore about the SHAPE of what reaches the view, not only about
// the document that comes out.
//
// happy-dom is registered for this file only, the rule every editor suite here follows.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => { GlobalRegistrator.register() })
afterAll(async () => { await GlobalRegistrator.unregister() })

type Loaded = {
  view: import('prosemirror-view').EditorView
  dispatched: import('prosemirror-state').Transaction[]
}

/** An editor over a one-paragraph document, with every transaction it is handed recorded. */
async function open(text = 'one two three'): Promise<Loaded> {
  const { EditorState } = await import('prosemirror-state')
  const { EditorView } = await import('prosemirror-view')
  const { schema } = await import('./schema')
  const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text(text)])])
  const dispatched: import('prosemirror-state').Transaction[] = []
  const place = document.createElement('div')
  const view: import('prosemirror-view').EditorView = new EditorView(place, {
    state: EditorState.create({ doc, schema }),
    dispatchTransaction(tr) {
      dispatched.push(tr)
      view.updateState(view.state.apply(tr))
    },
  })
  return { view, dispatched }
}

describe('several commands, one edit', () => {
  it('reaches the view as ONE transaction, however many commands are in it', async () => {
    const { view, dispatched } = await open()
    const { chainOn } = await import('./run')
    const { toggleMark } = await import('./commands-marks')
    const { TextSelection } = await import('prosemirror-state')

    chainOn(view)
      .cmd((state, dispatch) => {
        dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 1, 4)))
        return true
      })
      .cmd(toggleMark('bold'))
      .cmd(toggleMark('italic'))
      .run()

    // THE NUMBER THAT MATTERS. Three commands, one trip through the plugins, one undo.
    expect(dispatched.length).toBe(1)
    const marks = view.state.doc.nodeAt(1)?.marks.map((m) => m.type.name).sort()
    expect(marks).toEqual(['bold', 'italic'])
    view.destroy()
  })

  it('shows a later command what an earlier one did', async () => {
    const { view } = await open()
    const { chainOn } = await import('./run')

    let sawText = ''
    chainOn(view)
      .cmd((state, dispatch) => {
        dispatch?.(state.tr.insertText('ZZ ', 1, 1))
        return true
      })
      .cmd((state) => {
        // ⚠️ THE POINT OF THE WHOLE FILE. Without `stateFor`, this second command would be
        // reading the document as it was before the first one ran, and would place its edit
        // three characters out.
        sawText = state.doc.textContent
        return true
      })
      .run()

    expect(sawText).toBe('ZZ one two three')
    view.destroy()
  })

  it('dispatches NOTHING when a command in the middle refuses', async () => {
    const { view, dispatched } = await open()
    const { chainOn } = await import('./run')

    const ok = chainOn(view)
      .cmd((state, dispatch) => { dispatch?.(state.tr.insertText('A', 1, 1)); return true })
      .cmd(() => false)
      .cmd((state, dispatch) => { dispatch?.(state.tr.insertText('B', 1, 1)); return true })
      .run()

    expect(ok).toBe(false)
    expect(dispatched.length).toBe(0)
    // Half of a gesture is worse than none of it: the first command's edit is gone too.
    expect(view.state.doc.textContent).toBe('one two three')
    view.destroy()
  })

  it('can() answers without touching the document', async () => {
    const { view, dispatched } = await open()
    const { chainOn } = await import('./run')

    const could = chainOn(view, true)
      .cmd((state, dispatch) => { dispatch?.(state.tr.insertText('A', 1, 1)); return true })
      .run()

    expect(could).toBe(true)
    expect(dispatched.length).toBe(0)
    expect(view.state.doc.textContent).toBe('one two three')
    view.destroy()
  })
})

describe('the run of a mark under the caret', () => {
  it('finds the whole phrase from a caret anywhere inside it', async () => {
    const { view } = await open()
    const { schema } = await import('./schema')
    const { markRange } = await import('./commands-marks')
    const link = schema.marks.link!
    // Mark "two" — positions 5..8 in `one two three`.
    view.dispatch(view.state.tr.addMark(5, 8, link.create({ href: 'https://x.test' })))

    for (const at of [5, 6, 7, 8]) {
      const range = markRange(view.state.doc.resolve(at), link)
      expect(`from ${at}: ${JSON.stringify(range)}`).toBe(`from ${at}: {"from":5,"to":8}`)
    }
    // And nothing outside it.
    expect(markRange(view.state.doc.resolve(2), link)).toBe(null)
    view.destroy()
  })

  it('treats two different links side by side as two runs, not one', async () => {
    const { view } = await open('abcdef')
    const { schema } = await import('./schema')
    const { markRange } = await import('./commands-marks')
    const link = schema.marks.link!
    view.dispatch(view.state.tr
      .addMark(1, 4, link.create({ href: 'https://a.test' }))
      .addMark(4, 7, link.create({ href: 'https://b.test' })))

    // ⚠️ WITHOUT THE ATTRIBUTE COMPARISON this answers 1..7 and the link box would rewrite
    // both addresses as one.
    expect(markRange(view.state.doc.resolve(2), link, { href: 'https://a.test' }))
      .toEqual({ from: 1, to: 4 })
    expect(markRange(view.state.doc.resolve(5), link, { href: 'https://b.test' }))
      .toEqual({ from: 4, to: 7 })
    view.destroy()
  })

  it('grows an empty selection over the whole link and leaves other text alone', async () => {
    const { view } = await open()
    const { schema } = await import('./schema')
    const { extendMarkRange } = await import('./commands-marks')
    const { chainOn } = await import('./run')
    const { TextSelection } = await import('prosemirror-state')
    view.dispatch(view.state.tr.addMark(5, 8, schema.marks.link!.create({ href: 'https://x.test' })))

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 6)))
    chainOn(view).cmd(extendMarkRange('link')).run()
    expect([view.state.selection.from, view.state.selection.to]).toEqual([5, 8])

    // A caret in plain text is left where it is, and the chain still succeeds — making a link
    // from scratch is built on exactly that.
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)))
    const ok = chainOn(view).cmd(extendMarkRange('link')).run()
    expect(ok).toBe(true)
    expect([view.state.selection.from, view.state.selection.to]).toEqual([2, 2])
    view.destroy()
  })
})

describe('what the toolbar asks the document', () => {
  it('reports a mark on a selection and on the caret that would carry it', async () => {
    const { view } = await open()
    const { schema } = await import('./schema')
    const { markActive, markAttrs } = await import('./commands-marks')
    const { TextSelection } = await import('prosemirror-state')
    view.dispatch(view.state.tr.addMark(5, 8, schema.marks.ink!.create({ ink: 'pink' })))

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 5, 8)))
    expect(markActive(view.state, 'ink')).toBe(true)
    expect(markActive(view.state, 'ink', { ink: 'pink' })).toBe(true)
    expect(markActive(view.state, 'ink', { ink: 'green' })).toBe(false)
    expect(markAttrs(view.state, 'ink')).toEqual({ ink: 'pink' })

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2, 3)))
    expect(markActive(view.state, 'ink')).toBe(false)
    expect(markAttrs(view.state, 'ink')).toEqual({})
    view.destroy()
  })

  it('recolours a highlight in place rather than lifting and re-laying it', async () => {
    const { view, dispatched } = await open()
    const { schema } = await import('./schema')
    const { updateMarkAttrs } = await import('./commands-marks')
    const { chainOn } = await import('./run')
    const { TextSelection } = await import('prosemirror-state')
    view.dispatch(view.state.tr.addMark(5, 8, schema.marks.ink!.create({ ink: 'yellow' })))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 6)))
    dispatched.length = 0

    chainOn(view).cmd(updateMarkAttrs('ink', { ink: 'green' })).run()

    expect(dispatched.length).toBe(1)
    expect(view.state.doc.nodeAt(5)?.marks[0]?.attrs.ink).toBe('green')
    view.destroy()
  })
})
