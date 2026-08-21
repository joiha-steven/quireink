// The table, opened and saved.
//
// Three ways a table used to lose its contents on a SAVE — not on an edit, on a save, which
// means the writer does nothing wrong and finds out later. All three came out of one run of
// `editor-corpus.test.ts` on the day it was written. A fourth, older one is below them: any
// table GFM could not express was replaced whole by the literal text `[table]`.
// `components/TableMarkdown.ts` holds the fixes and the reasoning.
//
// The law each of these asserts is the same one that suite asserts: opening and saving must
// be a FIXED POINT. A table that loses a column per save is the worst kind of bug this editor
// can have, because every save looks like it worked.

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

async function open(content: string) {
  const { Editor } = await import('@tiptap/core')
  const { editorExtensions } = await import('@/admin/components/editorExtensions')
  return new Editor({ extensions: editorExtensions(''), content })
}

const md = (editor: { storage: unknown }) =>
  (editor.storage as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown().trim()

async function roundTrip(source: string): Promise<string> {
  const editor = await open(source)
  const out = md(editor)
  editor.destroy()
  return out
}

/** The row of a serialized table, for assertions that are about one row. */
const rowOf = (table: string, index: number) => table.split('\n')[index]

describe('a table keeps what is in its cells', () => {
  it('keeps a formula', async () => {
    // `textContent` of a maths atom is empty — the TeX rides in an attribute — so the library
    // measured the cell as blank and wrote nothing at all.
    const out = await roundTrip('| a | b |\n| --- | --- |\n| $x^2$ | hai |\n')
    expect(rowOf(out, 2)).toBe('| $x^2$ | hai |')
    expect(await roundTrip(out)).toBe(out)
  })

  it('keeps an image', async () => {
    // The same deletion by a different route: an image is a LEAF BLOCK in this schema, so it
    // replaces the cell's paragraph rather than sitting in one, and there is no inline content
    // to render. It is written through the image node's own serializer, so the `#grid` and
    // alignment suffixes `CaptionedImage` owns keep working here too.
    const out = await roundTrip('| a | b |\n| --- | --- |\n| ![anh](https://a.test/x.jpg) | hai |\n')
    expect(rowOf(out, 2)).toBe('| ![anh](https://a.test/x.jpg) | hai |')
    expect(await roundTrip(out)).toBe(out)
  })

  it('keeps a pen stroke and a code span', async () => {
    const out = await roundTrip('| a | b |\n| --- | --- |\n| ==mực== | `mã` |\n')
    expect(rowOf(out, 2)).toBe('| ==mực== | `mã` |')
    expect(await roundTrip(out)).toBe(out)
  })
})

describe('a pipe inside a cell stays inside it', () => {
  it('survives a save, and a second one', async () => {
    // The repo's own fixture, which the reader's parser has been passing for a year and the
    // writer's parser had never been shown. Unescaped, the pipes re-cut the row: two saves
    // took `| \`a \| b\` | c \| d |` down to a two-column row with stray backslashes in it.
    const source = '| a | b |\n|---|---|\n| `a \\| b` | c \\| d |\n'
    const once = await roundTrip(source)
    expect(rowOf(once, 2)).toBe('| `a \\| b` | c \\| d |')
    expect(await roundTrip(once)).toBe(once)
  })

  it('escapes a pipe that arrives as plain text', async () => {
    const once = await roundTrip('| a | b |\n| --- | --- |\n| một \\| hai | ba |\n')
    expect(rowOf(once, 2)).toBe('| một \\| hai | ba |')
    expect(await roundTrip(once)).toBe(once)
  })

  it('leaves pipes alone OUTSIDE a table', async () => {
    // The escaping is per-cell on purpose. Turning on `escapeExtraCharacters` globally would
    // have been two lines and would rewrite every writer's prose: `a | b` in a paragraph is
    // not syntax and must come back as it was typed.
    expect(await roundTrip('Chọn a | b | c trong menu.')).toBe('Chọn a | b | c trong menu.')
  })
})

describe('a table GFM cannot express is downgraded, not deleted', () => {
  // All four of these used to serialize to the literal text `[table]` — the whole table, every
  // row, replaced by seven characters, because `html: false` left the library no fallback. All
  // four are two clicks or one paste away. GFM cannot hold any of these shapes, so the SHAPE is
  // what is lost; the words are kept, the columns stay aligned, and the result is stable.

  /** Parse real HTML through the schema, the way a paste from a web page arrives. */
  async function fromHTML(html: string): Promise<string> {
    const editor = await open('')
    const { DOMParser } = await import('@tiptap/pm/model')
    const el = document.createElement('div')
    el.innerHTML = html
    editor.commands.setContent(DOMParser.fromSchema(editor.schema).parse(el).toJSON())
    const out = md(editor)
    editor.destroy()
    return out
  }

  it('joins a cell that holds two blocks', async () => {
    const editor = await open('| a | b |\n| --- | --- |\n| một | hai |\n')
    let cellPos = -1
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableCell' && cellPos < 0) cellPos = pos
    })
    const cell = editor.state.doc.nodeAt(cellPos)
    editor.commands.insertContentAt(cellPos + (cell?.firstChild?.nodeSize ?? 1), {
      type: 'paragraph',
      content: [{ type: 'text', text: 'thêm' }],
    })
    const out = md(editor)
    editor.destroy()
    expect(rowOf(out, 2)).toBe('| một thêm | hai |')
    expect(await roundTrip(out)).toBe(out)
  })

  it('pads the columns a merged cell covers', async () => {
    // A colspan cell writes once and leaves the columns it covered empty, so every row still
    // has the same number of pipes — which is the one thing GFM will not forgive.
    const out = await fromHTML('<table><tbody><tr><th colspan="2">gộp hai</th><th>ba</th></tr><tr><td>một</td><td>hai</td><td>ba</td></tr></tbody></table>')
    expect(rowOf(out, 0)).toBe('| gộp hai |  | ba |')
    expect(rowOf(out, 1)).toBe('| --- | --- | --- |')
    expect(rowOf(out, 2)).toBe('| một | hai | ba |')
    expect(await roundTrip(out)).toBe(out)
  })

  it('pads the rows a rowspan reaches into', async () => {
    // The other half of a merge: ProseMirror gives the second row one cell, not two, so the
    // row is short and the widest row decides the width.
    const out = await fromHTML('<table><tbody><tr><th>a</th><th>b</th></tr><tr><td rowspan="2">dọc</td><td>hai</td></tr><tr><td>ba</td></tr></tbody></table>')
    expect(rowOf(out, 2)).toBe('| dọc | hai |')
    expect(rowOf(out, 3)).toBe('| ba |  |')
    expect(await roundTrip(out)).toBe(out)
  })

  it('promotes the first row of a headerless table', async () => {
    // Deleting the header row is a button in the table tools. GFM has no headerless table, so
    // the first row is read as the header by every parser that will see it — including this
    // repo's own renderer — and writing it as one is the only honest answer.
    const out = await fromHTML('<table><tbody><tr><td>một</td><td>hai</td></tr><tr><td>ba</td><td>bốn</td></tr></tbody></table>')
    expect(rowOf(out, 0)).toBe('| một | hai |')
    expect(rowOf(out, 1)).toBe('| --- | --- |')
    expect(rowOf(out, 2)).toBe('| ba | bốn |')
    expect(await roundTrip(out)).toBe(out)
  })

  it('never writes the word [table]', async () => {
    // The old fallback, named here so it cannot come back quietly.
    const shapes = [
      '<table><tbody><tr><th colspan="3">một</th></tr><tr><td>a</td><td>b</td><td>c</td></tr></tbody></table>',
      '<table><tbody><tr><td>không</td><td>tiêu đề</td></tr></tbody></table>',
    ]
    for (const html of shapes) expect(await fromHTML(html)).not.toContain('[table]')
  })
})
