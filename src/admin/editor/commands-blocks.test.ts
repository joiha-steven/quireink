// WHAT A TOOLBAR BUTTON DOES TO THE BLOCK THE CARET IS IN.
//
// The library functions underneath — `setBlockType`, `wrapInList`, `liftListItem` — are tested
// where they live. What is tested here is the part this product had to write, and every case
// below is one a writer reaches by pressing a key twice or by pressing the wrong one.
//
// happy-dom is registered for this file only, the rule every editor suite here follows.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => { GlobalRegistrator.register() })
afterAll(async () => { await GlobalRegistrator.unregister() })

/** An editor over some Markdown, through the product's own parser. */
async function open(markdown: string) {
  const { EditorState, TextSelection } = await import('prosemirror-state')
  const { EditorView } = await import('prosemirror-view')
  const { schema } = await import('./schema')
  const { parse } = await import('@/md/index')
  const { toEditor } = await import('@/md/to-editor')
  const doc = schema.nodeFromJSON(toEditor(parse(markdown)))
  const place = document.createElement('div')
  const view: import('prosemirror-view').EditorView = new EditorView(place, {
    state: EditorState.create({ doc, schema }),
  })
  /** Put the caret inside the first text of the document. */
  const caretAtFirstText = (): void => {
    let at = 1
    view.state.doc.descendants((node, pos) => {
      if (at === 1 && node.isText) at = pos + 1
      return true
    })
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)))
  }
  const markdownOut = async (): Promise<string> => {
    const { documentToMarkdown } = await import('@/admin/components/MarkdownBridge')
    return documentToMarkdown(view.state.doc).trim()
  }
  return { view, caretAtFirstText, markdownOut }
}

describe('the list keys, and the one thing neither library does', () => {
  it('turns a plain paragraph into a bullet list and back', async () => {
    const { view, caretAtFirstText, markdownOut } = await open('a line')
    const { chainOn } = await import('./run')
    const { toggleBulletList } = await import('./commands-blocks')
    caretAtFirstText()

    chainOn(view).cmd(toggleBulletList).run()
    expect(await markdownOut()).toBe('- a line')

    chainOn(view).cmd(toggleBulletList).run()
    expect(await markdownOut()).toBe('a line')
    view.destroy()
  })

  /**
   * ⚠️ THE CASE THE WHOLE `toggleList` EXISTS FOR. `wrapInList` would put a bullet list INSIDE
   * the numbered item the caret is standing in — a nested list nobody asked for, and a Markdown
   * file with an indent nobody typed. Pressing the other list key means "make this list that
   * kind", which is what every editor a writer has used does.
   */
  it('changes a numbered list into a bulleted one instead of nesting a second list inside it', async () => {
    const { view, caretAtFirstText, markdownOut } = await open('1. first\n2. second')
    const { chainOn } = await import('./run')
    const { toggleBulletList } = await import('./commands-blocks')
    caretAtFirstText()

    chainOn(view).cmd(toggleBulletList).run()
    expect(await markdownOut()).toBe('- first\n- second')
    // And nothing is nested: one list, two items, at one depth.
    let depth = 0
    view.state.doc.descendants((node, _pos, _parent) => {
      if (node.type.name === 'bulletList') depth += 1
      return true
    })
    expect(depth).toBe(1)
    view.destroy()
  })

  it('changes a bullet list into a task list, rewriting the items with the wrapper', async () => {
    // A `listItem` cannot live inside a `taskList` — the content expression forbids it — so a
    // wrapper swapped on its own would produce a document the schema cannot hold.
    const { view, caretAtFirstText, markdownOut } = await open('- one\n- two')
    const { chainOn } = await import('./run')
    const { toggleTaskList } = await import('./commands-blocks')
    caretAtFirstText()

    chainOn(view).cmd(toggleTaskList).run()
    expect(await markdownOut()).toBe('- [ ] one\n- [ ] two')
    view.state.doc.check()
    view.destroy()
  })

  it('takes a task list back to plain paragraphs', async () => {
    const { view, caretAtFirstText, markdownOut } = await open('- [ ] one')
    const { chainOn } = await import('./run')
    const { toggleTaskList } = await import('./commands-blocks')
    caretAtFirstText()
    chainOn(view).cmd(toggleTaskList).run()
    expect(await markdownOut()).toBe('one')
    view.destroy()
  })
})

describe('headings, quotes and fences', () => {
  it('sets a heading and takes the same level off again', async () => {
    const { view, caretAtFirstText, markdownOut } = await open('a line')
    const { chainOn } = await import('./run')
    const { toggleHeading } = await import('./commands-blocks')
    caretAtFirstText()

    chainOn(view).cmd(toggleHeading(2)).run()
    expect(await markdownOut()).toBe('## a line')
    // A DIFFERENT level changes the level rather than clearing it.
    chainOn(view).cmd(toggleHeading(3)).run()
    expect(await markdownOut()).toBe('### a line')
    chainOn(view).cmd(toggleHeading(3)).run()
    expect(await markdownOut()).toBe('a line')
    view.destroy()
  })

  it('wraps in a quote and lifts back out', async () => {
    const { view, caretAtFirstText, markdownOut } = await open('a line')
    const { chainOn } = await import('./run')
    const { toggleBlockquote } = await import('./commands-blocks')
    caretAtFirstText()

    chainOn(view).cmd(toggleBlockquote).run()
    expect(await markdownOut()).toBe('> a line')
    chainOn(view).cmd(toggleBlockquote).run()
    expect(await markdownOut()).toBe('a line')
    view.destroy()
  })

  it('makes a fence and takes it off', async () => {
    const { view, caretAtFirstText, markdownOut } = await open('a line')
    const { chainOn } = await import('./run')
    const { toggleCodeBlock } = await import('./commands-blocks')
    caretAtFirstText()

    chainOn(view).cmd(toggleCodeBlock).run()
    expect(await markdownOut()).toBe('```\na line\n```')
    chainOn(view).cmd(toggleCodeBlock).run()
    expect(await markdownOut()).toBe('a line')
    view.destroy()
  })
})

describe('the table the button makes', () => {
  it('is three by three with a header, and the schema accepts it', async () => {
    const { view, caretAtFirstText, markdownOut } = await open('a line')
    const { chainOn } = await import('./run')
    const { insertTable } = await import('./commands-blocks')
    caretAtFirstText()

    chainOn(view).cmd(insertTable()).run()
    view.state.doc.check()
    // Asked of the DOCUMENT rather than of the Markdown: the piece still has its paragraph, and
    // counting lines would be counting that too.
    let table: import('prosemirror-model').Node | null = null
    view.state.doc.descendants((node) => { if (node.type.name === 'table') table = node; return true })
    const found = table as unknown as import('prosemirror-model').Node
    expect(found).not.toBe(null)
    expect(found.childCount).toBe(3)
    expect(found.firstChild!.childCount).toBe(3)
    expect(found.firstChild!.firstChild!.type.name).toBe('tableHeader')
    expect(found.child(1).firstChild!.type.name).toBe('tableCell')
    // And it survives a save: the rule row is what a Markdown table needs to be one.
    const out = await markdownOut()
    expect(out).toMatch(/\n\|( -+ \|)+\n/)
    view.destroy()
  })

  it('refuses every table edit when the caret is not in a table', async () => {
    const { view, caretAtFirstText } = await open('a line')
    const { chainOn } = await import('./run')
    const b = await import('./commands-blocks')
    caretAtFirstText()
    for (const [name, cmd] of Object.entries({
      addColumnAfter: b.tableAddColumnAfter, addRowAfter: b.tableAddRowAfter,
      deleteColumn: b.tableDeleteColumn, deleteRow: b.tableDeleteRow, deleteTable: b.tableDelete,
    })) {
      expect(`${name}: ${chainOn(view).cmd(cmd).run()}`).toBe(`${name}: false`)
    }
    view.destroy()
  })
})
