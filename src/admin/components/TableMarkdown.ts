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
//   3. A TABLE GFM CANNOT EXPRESS IS THROWN AWAY WHOLE. With `html: false` the library's
//      fallback for a merged cell, a cell holding two blocks, or a table whose first row is
//      not headers, is to write the literal text `[table]` — the entire table, every row of
//      it, replaced by seven characters. All three are two clicks away: paste a table from a
//      web page and it arrives with `colspan`; press Enter inside a cell; delete the header
//      row with the button that offers to.
//
//      GFM has no merged cells and no multi-line cell, so something must be lost. What is
//      chosen here is to lose the SHAPE and keep the WORDS: a spanned cell writes its content
//      once and pads the row with empty cells so the columns still line up, a cell of several
//      blocks joins them with a space, and a table without a header row promotes its first
//      row — which is what the reader's parser would do with it anyway, since GFM has no
//      headerless table either. Every one of those is a downgrade; none of them is a deletion,
//      and `[table]` was a deletion.
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

/** How many columns a row occupies once its spans are counted. */
const widthOf = (row: PMNode): number =>
  children(row).reduce((n, cell) => n + Math.max(1, Number(cell.attrs.colspan ?? 1)), 0)

/**
 * Render one BLOCK of a cell, whatever kind it is, onto one line.
 *
 * Three doors, because a cell can hold three shapes. A paragraph is inline content and goes
 * through `renderInline`. An image is a leaf block with no inline content at all and has to go
 * through its own node serializer, or it writes nothing (see the header). Anything else — a
 * list, a quote, a code block someone pasted into a cell — is rendered as itself and then
 * FLATTENED, because a newline inside a row would end the row.
 *
 * `closed` is put back afterwards: a block serializer signals "a blank line goes here next",
 * and the next thing written is the rest of the row.
 */
function renderBlock(state: SerializerState, block: PMNode, cell: PMNode, index: number): void {
  const before = state.out.length
  if (block.isTextblock && !block.isLeaf) state.renderInline(block)
  else state.render(block, cell, index)
  state.closed = null
  const flattened = state.out.slice(before).replace(/\s*\n+\s*/g, ' ').trimEnd()
  state.out = state.out.slice(0, before) + flattened
}

/** Everything in one cell, on one line, with its pipes escaped. */
function renderCell(state: SerializerState, cell: PMNode): void {
  const before = state.out.length
  cell.forEach((block, _offset, index) => {
    // A space between blocks that both wrote something, so two paragraphs do not run together
    // into one word.
    if (state.out.length > before) state.write(' ')
    renderBlock(state, block, cell, index)
  })
  escapePipesSince(state, before)
}

/** Every pipe a cell produced is content, and inside a table content spells itself `\|`. */
function escapePipesSince(state: SerializerState, from: number): void {
  const written = state.out.slice(from)
  if (written.includes('|')) state.out = state.out.slice(0, from) + written.replaceAll('|', '\\|')
}

/**
 * The whole table, always as GFM.
 *
 * The column count is the WIDEST row, and every row is padded out to it. That one rule covers
 * both halves of a merge: a `colspan` cell writes once and leaves empty cells behind it, and
 * the rows a `rowspan` reaches down into are simply short and get padded. A ragged table —
 * which ProseMirror can hold and Markdown cannot — comes out square.
 */
function serializeTable(state: SerializerState, node: PMNode): void {
  const rows = children(node)
  const width = rows.reduce((n, row) => Math.max(n, widthOf(row)), 0)
  if (width === 0) {
    state.closeBlock(node)
    return
  }
  state.inTable = true
  rows.forEach((row, rowIndex) => {
    state.write('| ')
    let written = 0
    row.forEach((cell) => {
      if (written) state.write(' | ')
      renderCell(state, cell)
      written += 1
      // The columns a spanned cell covers exist in Markdown; they are just empty.
      for (let extra = Math.max(1, Number(cell.attrs.colspan ?? 1)); extra > 1; extra--) {
        state.write(' | ')
        written += 1
      }
    })
    while (written < width) {
      state.write(' | ')
      written += 1
    }
    state.write(' |')
    state.ensureNewLine()
    if (rowIndex === 0) {
      // Written whether or not the first row is made of header cells: GFM has no table
      // without a header, so a headerless one is read as having this row for a header by every
      // parser that will ever see it, including this repo's own.
      state.write(`| ${Array.from({ length: width }, () => '---').join(' | ')} |`)
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
