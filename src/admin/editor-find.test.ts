// Find and replace: the matching, and what it does to a real document.
//
// THE ONE THAT MATTERS is the last suite. The editor's hard contract is that a save may not
// change the reader's page (`docs/admin-editor.md`), and a find box is the feature most able
// to break it quietly: highlighting is drawn ON the text, so an implementation that reaches
// for a mark instead of a decoration serialises its own highlighter into the piece and the
// writer finds out when the post publishes with `==Gogh==` in it.
//
// happy-dom is registered for THIS FILE ONLY and unregistered afterwards — see the island
// tests for the rule.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { findAll, firstAfter, replaceAllIn, step } from '@/admin/components/editorFind'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const insensitive = { caseSensitive: false }

async function open(content: string) {
  const { Editor } = await import('@tiptap/core')
  const { editorExtensions } = await import('@/admin/components/editorExtensions')
  return new Editor({ extensions: editorExtensions(''), content })
}

const md = (editor: { storage: unknown }) =>
  (editor.storage as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown().trim()

describe('what counts as a match', () => {
  it('ignores case unless asked, because somebody searching a word means the word', () => {
    expect(findAll('Paris, paris, PARIS', 'paris', insensitive)).toHaveLength(3)
    expect(findAll('Paris, paris, PARIS', 'paris', { caseSensitive: true })).toEqual([{ from: 7, to: 12 }])
  })

  it('never overlaps, so stepping through agrees with what Replace all will do', () => {
    // Four overlapping matches cannot all be replaced; two can, and two is what both halves
    // of this feature see.
    expect(findAll('aaaa', 'aa', insensitive)).toEqual([{ from: 0, to: 2 }, { from: 2, to: 4 }])
  })

  it('treats the query as characters rather than as a pattern', () => {
    // The whole reason this is not a regular expression: every one of these is an ordinary
    // thing to go looking for, and every one of them is a pattern that would misfire.
    expect(findAll('cost: $5.00 (net)', '$5.00', insensitive)).toEqual([{ from: 6, to: 11 }])
    expect(findAll('a.b and axb', 'a.b', insensitive)).toEqual([{ from: 0, to: 3 }])
    expect(findAll('(net)', '(net)', insensitive)).toHaveLength(1)
  })

  it('finds nothing for an empty query rather than a hit per character', () => {
    expect(findAll('anything', '', insensitive)).toEqual([])
  })
})

describe('stepping', () => {
  it('wraps both ways, because a button that stops working near the end says nothing', () => {
    expect(step(3, 2, 1)).toBe(0)
    expect(step(3, 0, -1)).toBe(2)
    expect(step(0, 0, 1)).toBe(0)
  })

  it('opens on the first hit after the cursor, not on the first hit in the piece', () => {
    const hits = [{ from: 2, to: 4 }, { from: 40, to: 42 }, { from: 80, to: 82 }]
    expect(firstAfter(hits, 0)).toBe(0)
    expect(firstAfter(hits, 10)).toBe(1)
    // Past the last one it wraps to the top rather than pointing at nothing.
    expect(firstAfter(hits, 900)).toBe(0)
  })
})

describe('replacing a string', () => {
  it('puts the replacement in literally, including the characters a pattern would eat', () => {
    // `String.replaceAll` reads `$&` in the replacement as "whatever matched", so a writer
    // replacing a price with `$5` would get the old text back. This walks the hits instead.
    const text = 'price TBD, price TBD'
    expect(replaceAllIn(text, findAll(text, 'TBD', insensitive), '$5')).toBe('price $5, price $5')
    expect(replaceAllIn(text, findAll(text, 'TBD', insensitive), '$&')).toBe('price $&, price $&')
  })

  it('can delete every hit by replacing it with nothing', () => {
    const text = 'one, two, one'
    expect(replaceAllIn(text, findAll(text, 'one', insensitive), '')).toBe(', two, ')
  })
})

describe('finding inside the document', () => {
  it('matches across a mark boundary, because a reader sees words and not markup', async () => {
    const { hitsIn } = await import('@/admin/components/FindExtension')
    const editor = await open('**Van** Gogh wrote')
    expect(hitsIn(editor.state.doc, 'Van Gogh', insensitive)).toHaveLength(1)
    editor.destroy()
  })

  it('never matches across a paragraph break, because that hit is on no page', async () => {
    const { hitsIn } = await import('@/admin/components/FindExtension')
    const editor = await open('the quire\n\nink and paper')
    // The two words are adjacent in the source and in no reader's eye.
    expect(hitsIn(editor.state.doc, 'quire ink', insensitive)).toHaveLength(0)
    expect(hitsIn(editor.state.doc, 'quire', insensitive)).toHaveLength(1)
    editor.destroy()
  })
})

describe('a save may not change the reader\'s page', () => {
  it('leaves the Markdown untouched while a query is highlighted', async () => {
    const { setFind } = await import('@/admin/components/FindExtension')
    const editor = await open('the reed pen, and the reed it was cut from')
    const before = md(editor)
    setFind(editor, { query: 'reed' })
    // Three hits are drawn on this document and not one character of it has moved.
    expect(md(editor)).toBe(before)
    editor.destroy()
  })

  it('replaces the current hit and keeps standing on the one that takes its place', async () => {
    const { replaceCurrent, readFind, setFind } = await import('@/admin/components/FindExtension')
    const editor = await open('reed, reed, reed')
    setFind(editor, { query: 'reed', index: 0 })
    replaceCurrent(editor, 'quill')
    expect(md(editor)).toBe('quill, reed, reed')
    // The index stays where it was, so a second press takes the next one rather than
    // skipping it — the classic off-by-one in a replace button.
    expect(readFind(editor.state).index).toBe(0)
    replaceCurrent(editor, 'quill')
    expect(md(editor)).toBe('quill, quill, reed')
    editor.destroy()
  })

  it('replaces every hit in one step, so one undo puts them all back', async () => {
    const { replaceEveryHit, setFind } = await import('@/admin/components/FindExtension')
    const editor = await open('reed, reed, reed')
    setFind(editor, { query: 'reed' })
    expect(replaceEveryHit(editor, 'quill')).toBe(3)
    expect(md(editor)).toBe('quill, quill, quill')
    editor.commands.undo()
    expect(md(editor)).toBe('reed, reed, reed')
    editor.destroy()
  })

  it('keeps the formatting a replaced word was wearing', async () => {
    const { replaceEveryHit, setFind } = await import('@/admin/components/FindExtension')
    const editor = await open('a **reed** pen')
    setFind(editor, { query: 'reed' })
    replaceEveryHit(editor, 'quill')
    expect(md(editor)).toBe('a **quill** pen')
    editor.destroy()
  })

  it('replaces a hit that spans a mark boundary without losing the rest of the sentence', async () => {
    const { replaceEveryHit, setFind } = await import('@/admin/components/FindExtension')
    const editor = await open('**Van** Gogh wrote')
    setFind(editor, { query: 'Van Gogh' })
    replaceEveryHit(editor, 'Vincent')
    expect(md(editor)).toBe('**Vincent** wrote')
    editor.destroy()
  })
})
