// The table, on its way back OUT of the editor.
//
// `tiptap-markdown` ships a table serializer and this file replaces it: three of the things
// it does are data loss rather than formatting. All three were found by running the repo's
// own fixtures through the parser that had never seen them (`editor-corpus.test.ts`), and
// each destroys a table by SAVING it.
//
//   1. A CELL WITH NO TEXT IS SKIPPED. The library asks `textContent.trim()`, and an atom
//      keeps its payload in an attribute — so `| $x^2$ |` and `| ![ảnh](/x.jpg) |` both
//      measure as empty and vanish on the first save. This asks whether the cell holds any
//      CONTENT, which is the question that was meant.
//
//   2. A PIPE IS NOT ESCAPED. `esc()` in prosemirror-markdown does not escape `|`, because
//      outside a table it is not special; inside one it is the column separator. Written
//      bare it RE-CUTS the row on the next open — two saves take a column and add two stray
//      backslashes. `golden/corpus/gfm-table-pipes.md` covered this and passed for a year,
//      because it was only ever handed to the READER'S parser.
//
//   3. A TABLE GFM CANNOT EXPRESS IS THROWN AWAY WHOLE. With `html: false` the fallback for
//      a merged cell, a multi-block cell, or a table whose first row is not headers is the
//      literal text `[table]` — every row replaced by seven characters. All three are two
//      clicks away: paste a table from the web, press Enter in a cell, delete the header row.
//      GFM has none of those, so something must be lost; what is chosen is to lose the SHAPE
//      and keep the WORDS — a spanned cell writes its content once and pads the row, a
//      multi-block cell joins with a space, a headerless table promotes its first row. Each
//      is a downgrade; `[table]` was a deletion.
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
 * The delimiter row, which is where GFM keeps COLUMN ALIGNMENT.
 *
 * markdown-it reads `|:--|:-:|--:|` into an `align` attribute on every cell, and the editor
 * has always shown it — the centred column is centred on screen. It was written back out as
 * a flat `| --- | --- |`, so every centred and right-aligned column in every table quietly
 * went left on the first save, and stayed there. Numbers in a right-aligned column are the
 * usual casualty and the one nobody re-checks.
 *
 * The FIRST row decides, because that is the only row GFM lets say anything: a table whose
 * body cells disagree with their header cannot be written down, and the header is what
 * markdown-it put the parsed alignment on.
 */
const RULE: Record<string, string> = { left: ':---', center: ':---:', right: '---:' }

function delimiterRow(firstRow: PMNode | undefined, width: number): string {
  const cells = firstRow ? children(firstRow) : []
  const marks: string[] = []
  for (const cell of cells) {
    const rule = RULE[String(cell.attrs.align ?? '')] ?? '---'
    // A spanned header covers columns that carry its alignment and nothing else.
    for (let extra = Math.max(1, Number(cell.attrs.colspan ?? 1)); extra > 0; extra--) marks.push(rule)
  }
  while (marks.length < width) marks.push('---')
  return `| ${marks.slice(0, width).join(' | ')} |`
}

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
      state.write(delimiterRow(rows[0], width))
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
