// The table, on its way back OUT of the editor.
//
// `tiptap-markdown` ships a table serializer and this file replaces it, because two things it
// does are data loss rather than formatting differences. Both were found the day the editor
// corpus suite was written, by running the repo's own fixtures through the parser that had
// never seen them (`editor-corpus.test.ts`), and both destroy a table by SAVING it:
//
//   1. A CELL WITH NO TEXT IS SKIPPED. The library asks `cellContent.textContent.trim()`
//      before rendering a cell, and an atom keeps its payload in an attribute rather than in
//      text — so a formula and an image both measure as empty:
//
//          | $x^2$ | hai |                ->   |  | hai |
//          | ![ảnh](/x.jpg) | hai |       ->   |  | hai |
//
//      Gone, on the first save, with nothing said. What is asked here instead is whether the
//      cell holds any CONTENT, which is the question that was meant.
//
//   2. A PIPE IS NOT ESCAPED. `esc()` in prosemirror-markdown escapes backticks, asterisks,
//      brackets and underscores; `|` is not on the list, because outside a table it is not
//      special. Inside one it is the column separator, and GFM's answer is `\|`. Writing it
//      bare does not merely look wrong, it re-cuts the row on the next open:
//
//          | `a \| b` | c \| d |   ->  | `a | b` | c | d |   ->  | \`a | b\` |
//
//      Two saves and the row has lost a column and gained two stray backslashes. The repo had
//      a fixture for exactly this (`golden/corpus/gfm-table-pipes.md`) and it passed for a
//      year, because it was only ever handed to the READER'S parser.
//
// WHAT IS DELIBERATELY UNCHANGED: a table GFM cannot express — merged cells, or a cell holding
// more than one block — still serializes to the literal text `[table]`, which is the library's
// `html: false` fallback and is also total loss. It is left alone here because fixing it means
// deciding what a merged cell BECOMES in a format that has no merged cells, and that is the
// owner's call, not a bug fix. It is pinned by a test so it stays a known shortfall.
import { Table } from '@tiptap/extension-table'
import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * The parts of prosemirror-markdown's serializer state this file touches.
 *
 * Written out rather than imported because `tiptap-markdown` hands the spec an untyped state,
 * and `out` — the buffer the escaping below reaches into — is not in prosemirror-markdown's
 * published types at all. A structural type says exactly what is being relied on.
 */
type SerializerState = {
  out: string
  /** Set by `closeBlock`; the next write turns it into a blank line. A row is not a block
      break, so a cell that closed a block has to put it back to null. */
  closed: unknown
  write: (text: string) => void
  ensureNewLine: () => void
  closeBlock: (node: unknown) => void
  renderInline: (node: PMNode) => void
  render: (node: PMNode, parent: PMNode, index: number) => void
  inTable?: boolean
}

const children = (node: PMNode): PMNode[] => {
  const out: PMNode[] = []
  node.forEach((child) => out.push(child))
  return out
}

const spans = (cell: PMNode): boolean =>
  Number(cell.attrs.colspan ?? 1) > 1 || Number(cell.attrs.rowspan ?? 1) > 1

/**
 * Can this table be written as GFM at all? The library's rule, kept whole: a header row of
 * header cells, body rows of body cells, no spans, one block per cell.
 */
function isGfmShaped(table: PMNode): boolean {
  const rows = children(table)
  const [head, ...body] = rows
  if (!head) return false
  if (children(head).some((c) => c.type.name !== 'tableHeader' || spans(c) || c.childCount > 1)) return false
  return !body.some((row) =>
    children(row).some((c) => c.type.name === 'tableHeader' || spans(c) || c.childCount > 1))
}

/**
 * Render one cell, then escape every pipe it produced.
 *
 * The escaping is done on the OUTPUT rather than on the text nodes, and that is the point: a
 * pipe can arrive from a text node, from a link's URL, or from inside a code span, and inside
 * a table every one of them has to be `\|`. Taking the slice this cell just appended catches
 * all three without teaching the escaper about tables.
 *
 * A backslash already in the text has been doubled by `esc()` before this runs, so escaping
 * the pipe after it cannot merge with it into something else.
 */
function renderCell(state: SerializerState, block: PMNode): void {
  const before = state.out.length
  state.renderInline(block)
  escapePipesSince(state, before)
}

/**
 * A cell whose single child is a LEAF BLOCK — in practice an image, which is a block node in
 * this schema and replaces the cell's paragraph rather than sitting inside one. It has no
 * inline content to render, so `renderInline` writes nothing and the image disappears; this
 * is the third shape of the same deletion the file header describes.
 *
 * It is rendered through the node's OWN serializer rather than by writing `![alt](src)` here,
 * because `CaptionedImage` owns a syntax with suffixes (`#grid`, alignment) and a second
 * writer of it would drift from the first. What is undone afterwards is only the BLOCK part:
 * the trailing newline, and the `closed` flag that would otherwise open a blank line in the
 * middle of the row.
 */
function renderLeafCell(state: SerializerState, block: PMNode, cell: PMNode): void {
  const before = state.out.length
  state.render(block, cell, 0)
  state.closed = null
  state.out = state.out.slice(0, before) + state.out.slice(before).replace(/\n+$/, '')
  escapePipesSince(state, before)
}

/** Every pipe a cell produced is content, and inside a table content spells itself `\|`. */
function escapePipesSince(state: SerializerState, from: number): void {
  const written = state.out.slice(from)
  if (written.includes('|')) state.out = state.out.slice(0, from) + written.replaceAll('|', '\\|')
}

function serializeTable(state: SerializerState, node: PMNode): void {
  if (!isGfmShaped(node)) {
    // Unchanged from the library, including the loss. See the note at the top.
    state.write('[table]')
    state.closeBlock(node)
    return
  }
  state.inTable = true
  node.forEach((row, _offset, rowIndex) => {
    state.write('| ')
    row.forEach((cell, _o, cellIndex) => {
      if (cellIndex) state.write(' | ')
      const block = cell.firstChild
      // `content.size`, NOT `textContent`: a formula is content without text. And a leaf
      // block (an image) has neither, which is why it needs the other door.
      if (!block) return
      if (block.isLeaf) renderLeafCell(state, block, cell)
      else if (block.content.size > 0) renderCell(state, block)
    })
    state.write(' |')
    state.ensureNewLine()
    if (rowIndex === 0) {
      state.write(`| ${children(row).map(() => '---').join(' | ')} |`)
      state.ensureNewLine()
    }
  })
  state.closeBlock(node)
  state.inTable = false
}

/**
 * The table extension the editor mounts.
 *
 * `getMarkdownSpec` merges an extension's own `storage.markdown` OVER the library's default
 * for that node name, so defining `serialize` here replaces theirs and nothing else changes.
 * Parsing is untouched: markdown-it builds the table on the way in.
 */
export const MarkdownTable = Table.extend({
  addStorage() {
    return {
      markdown: {
        serialize: (state: SerializerState, node: PMNode) => serializeTable(state, node),
        parse: {},
      },
    }
  },
}).configure({ resizable: false })
