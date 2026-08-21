// The table, opened and saved.
//
// Three ways a table used to lose its contents on a SAVE — not on an edit, on a save, which
// means the writer does nothing wrong and finds out later. All three came out of one run of
// `editor-corpus.test.ts` on the day it was written, and `components/TableMarkdown.ts` holds
// the fixes and the reasoning.
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

describe('what a GFM table still cannot hold', () => {
  it('writes [table] for a cell with two blocks, and says so out loud here', async () => {
    // NOT a fix, a PIN. GFM has no merged cells and no multi-block cell, and the library's
    // answer — the literal text `[table]` — is total loss. It is left exactly as it was
    // because what a merged cell should BECOME in a format without merged cells is a decision
    // about the product, not a bug with a right answer. This test exists so the shortfall is
    // a known number rather than a surprise in somebody's draft.
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
    expect(out).toBe('[table]')
  })
})
