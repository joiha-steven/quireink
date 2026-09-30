// Mod-Z after a restore, and after the way back from the Markdown view (2026-09-30).
//
// Both replaced the document with `addToHistory: false`, which voided every step before them:
// Mod-Z answered true and changed nothing, so the unsaved words a one-click Restore replaced were
// gone for good. Opening a piece still stays out of the history — that is not an edit.
//
// happy-dom is registered for THIS FILE ONLY, the rule every editor suite here follows.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

async function open(markdown: string) {
  const { Editor } = await import('@/admin/editor/editor')
  return new Editor({ element: document.createElement('div'), content: markdown })
}

describe('undo', () => {
  it('brings back the words a restore replaced', async () => {
    const e = await open('Hello world\n')
    e.view.dispatch(e.state.tr.insertText(' UNSAVED', e.state.doc.child(0).nodeSize - 1))
    e.commands.setContent('Old revision text\n', { history: true })
    expect(e.getMarkdown()).toBe('Old revision text\n')
    e.commands.undo()
    expect(e.getMarkdown()).toBe('Hello world UNSAVED\n')
    e.destroy()
  })

  it('still walks back past a return from the Markdown view', async () => {
    const e = await open('Hello world\n')
    e.view.dispatch(e.state.tr.insertText(' typed', e.state.doc.child(0).nodeSize - 1))
    e.commands.setContent('Hello world typed, then edited as Markdown\n', { history: true })
    e.commands.undo()
    expect(e.getMarkdown()).toBe('Hello world typed\n')
    e.commands.undo()
    expect(e.getMarkdown()).toBe('Hello world\n')
    e.destroy()
  })

  it('does not walk back into what was open before, when a piece is opened', async () => {
    const e = await open('First piece\n')
    e.commands.setContent('Second piece\n')
    e.commands.undo()
    expect(e.getMarkdown()).toBe('Second piece\n')
    e.destroy()
  })
})
