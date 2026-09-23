// The editor's document, as the tree. The other half of a save.
//
// ProseMirror holds a post while somebody is writing it, in a shape of its own: nodes and
// marks named by the editor's own schema (`admin/editor/schema.ts`). This turns
// that shape into `ast.ts`, and `to-markdown.ts` turns the tree into the file. Two steps
// where `prosemirror-markdown` had one — and the step is what buys the property that matters:
// the thing a save writes is produced by the same serializer the rest of this engine uses, so
// a fix to escaping reaches the editor and the importer and the API at once, instead of one
// of three places.
//
// MARKS ARE A RANGE, NOT A TREE, and that is the whole difficulty of this file. ProseMirror
// gives a paragraph as a flat run of text pieces, each carrying a SET of marks:
//
//   [ "a", {} ] [ "bold link", {strong, link} ] [ "c", {} ]
//
// while the tree wants nesting: strong(link("bold link")). So the run is grouped — consecutive
// pieces sharing a mark become one node — and the order the marks nest in is fixed rather than
// discovered, because `{strong, link}` could nest either way and the two spellings serialize
// differently. `MARK_ORDER` below is that decision, written down once.

import type { Block, Inline, ListItem, Document } from './ast'
import type { MathDelim } from './math-syntax'

/** The minimum of a ProseMirror node this file reads. Structural, so tests can stand in. */
export type PMNode = {
  type: { name: string }
  attrs?: Record<string, unknown>
  text?: string
  marks?: readonly { type: { name: string }; attrs?: Record<string, unknown> }[]
  content?: { size: number }
  childCount: number
  child(index: number): PMNode
  forEach(fn: (node: PMNode, offset: number, index: number) => void): void
}

/**
 * THE TIEBREAK, not the rule. Which mark nests outside which is decided by how far each one
 * RUNS (see `group` below); this list only settles the case where two cover the same words,
 * where either spelling means the same thing to a reader and the serializer has to pick one
 * and always pick it. A link wraps emphasis, and the pen sits under both.
 */
const MARK_ORDER = ['link', 'strong', 'bold', 'em', 'italic', 'strike', 'ink', 'underline', 'ring', 'code']

const rank = (name: string): number => {
  const i = MARK_ORDER.indexOf(name)
  return i === -1 ? MARK_ORDER.length : i
}

type Piece = { node: PMNode; marks: { name: string; attrs: Record<string, unknown> }[] }

/** One text piece's marks. Order settled per run in `group`, not here. */
function marksOf(node: PMNode): Piece['marks'] {
  return [...(node.marks ?? [])].map((m) => ({ name: m.type.name, attrs: m.attrs ?? {} }))
}

/** How many consecutive pieces from `i` carry this same mark, attributes included. */
function runOf(pieces: Piece[], i: number, mark: Piece['marks'][number]): number {
  let end = i + 1
  while (end < pieces.length) {
    const here = pieces[end]!.marks.find((m) => m.name === mark.name)
    if (!here || JSON.stringify(here.attrs) !== JSON.stringify(mark.attrs)) break
    end += 1
  }
  return end - i
}

/**
 * Which delimiter the author wrote a formula with. `MathNode.tsx` stores it on the node for
 * exactly this moment: normalising `\(a\)` to `$a$` on save edits a file nobody asked to have
 * edited, and the editor has carried the attribute since the feature shipped.
 */
function mathDelimOf(node: PMNode): MathDelim {
  const d = String(node.attrs?.delim ?? 'dollar')
  return d === 'bracket' || d === 'paren' ? d : 'dollar'
}

/** A leaf inline node — text, a break, a formula — with no marks left to apply. */
function leaf(node: PMNode): Inline[] {
  switch (node.type.name) {
    case 'text': {
      if (!node.text) return []
      // A NEWLINE INSIDE A TEXT NODE IS A SOFT BREAK, not a character. The editor has no node
      // for one, so it rides in the text — and reading it back as an ordinary character makes
      // the serializer escape the line away, which is how `> [!NOTE]` on its own line became
      // `> [!NOTE] Body` and stopped being a callout.
      if (!node.text.includes('\n')) return [{ type: 'text', value: node.text }]
      const out: Inline[] = []
      node.text.split('\n').forEach((part, i) => {
        if (i > 0) out.push({ type: 'softbreak' })
        if (part !== '') out.push({ type: 'text', value: part })
      })
      return out
    }
    case 'hardBreak':
      return [{ type: 'hardbreak' }]
    case 'image':
      return [{
        type: 'image',
        url: String(node.attrs?.src ?? ''),
        title: node.attrs?.title ? String(node.attrs.title) : undefined,
        alt: node.attrs?.alt ? [{ type: 'text', value: String(node.attrs.alt) }] : [],
      }]
    case 'mathInline':
      // `display` IS READ, not assumed false. An inline node can be display maths — `$$…$$`
      // written mid-paragraph — and `MathNode.tsx` has carried the attribute for that since the
      // feature shipped. Hardcoding `false` here wrote `$M \times V = P \times Q$` back over a
      // `$$…$$` the author had written, which is a smaller formula on the page and a diff in
      // their file with no author behind it.
      return [{
        type: 'math',
        value: String(node.attrs?.tex ?? ''),
        display: node.attrs?.display === true,
        delim: mathDelimOf(node),
      }]
    case 'video':
      // A video is a paragraph holding its URL in the source; the editor shows an embed.
      return [{ type: 'text', value: String(node.attrs?.src ?? '') }]
    default:
      return []
  }
}

/**
 * A run of inline pieces, grouped by the marks they share.
 *
 * ⚠️ THE WIDEST MARK GOES OUTSIDE, and it has to be measured rather than looked up. The first
 * version nested by a fixed table with the pen above links, and a stroke drawn across a link
 * came back as three strokes:
 *
 *     ==chữ **in đậm**, một [liên kết](/x) và cả thế==#orange
 *     ==chữ **in đậm**, một ==#orange[==liên kết==#orange](/x)== và cả thế==#orange
 *
 * because the link covered one piece, the ink covered eleven, and whichever the table put on
 * top cut the other into fragments at its edges. Marks are RANGES: the one that runs furthest
 * is the one that can contain the rest. `MARK_ORDER` still decides when two cover exactly the
 * same words, which is the only case where both spellings are the same document.
 *
 * Recursive on the remaining marks: the widest becomes a node, and the stretch it covers is
 * re-grouped with that mark taken out. Pieces with nothing left are leaves.
 */
function group(pieces: Piece[]): Inline[] {
  const out: Inline[] = []
  let i = 0
  while (i < pieces.length) {
    const marks = pieces[i]!.marks
    if (marks.length === 0) {
      out.push(...leaf(pieces[i]!.node))
      i += 1
      continue
    }
    // Widest run wins; equal runs fall back to the table. Compared by name AND attributes,
    // because two highlights in different colours are two marks and merging them loses one.
    let best = marks[0]!
    let bestRun = runOf(pieces, i, best)
    for (const mark of marks.slice(1)) {
      const run = runOf(pieces, i, mark)
      if (run > bestRun || (run === bestRun && rank(mark.name) < rank(best.name))) {
        best = mark
        bestRun = run
      }
    }
    const inner = pieces.slice(i, i + bestRun).map((p) => ({
      node: p.node,
      marks: p.marks.filter((m) => m !== best && !(m.name === best.name && JSON.stringify(m.attrs) === JSON.stringify(best.attrs))),
    }))
    out.push(wrap(best, group(inner)))
    i += bestRun
  }
  return out
}

function wrap(mark: { name: string; attrs: Record<string, unknown> }, children: Inline[]): Inline {
  switch (mark.name) {
    case 'bold':
    case 'strong':
      return { type: 'strong', children }
    case 'italic':
    case 'em':
      return { type: 'emph', children }
    case 'strike':
      return { type: 'strike', children }
    case 'code':
      // A code mark carries no children in the tree: its content is literal text.
      return { type: 'code', value: plain(children) }
    case 'link':
      return {
        type: 'link',
        url: String(mark.attrs.href ?? ''),
        title: mark.attrs.title ? String(mark.attrs.title) : undefined,
        children,
      }
    case 'ink':
      return { type: 'ink', ink: mark.attrs.ink ? String(mark.attrs.ink) : undefined, raw: '', children }
    case 'underline':
      return { type: 'underline', ink: mark.attrs.ink ? String(mark.attrs.ink) : undefined, raw: '', children }
    case 'ring':
      return { type: 'ring', ink: mark.attrs.ink ? String(mark.attrs.ink) : undefined, raw: '', children }
    default:
      // An unknown mark contributes its content and nothing else: losing the formatting is
      // survivable, losing the words is not.
      return children.length === 1 ? children[0]! : { type: 'emph', children }
  }
}

function plain(nodes: Inline[]): string {
  return nodes.map((n) => (n.type === 'text' ? n.value : 'children' in n ? plain(n.children) : '')).join('')
}

/** Every inline child of a textblock, as tree inlines. */
function inlinesOf(node: PMNode): Inline[] {
  const pieces: Piece[] = []
  node.forEach((child) => pieces.push({ node: child, marks: marksOf(child) }))
  return group(pieces)
}

function blocksOf(node: PMNode): Block[] {
  const out: Block[] = []
  node.forEach((child) => {
    const block = oneBlock(child)
    if (!block) return
    // A RUN MARKED `joined` GOES BACK ONTO THE LIST ABOVE IT: the parse split one Markdown list
    // into a plain run and a task run because the schema has two list nodes. Only when that
    // list is the block directly above — anything written in between made them two lists.
    const above = out[out.length - 1]
    if (child.attrs?.joined && block.type === 'list' && above?.type === 'list') {
      above.items.push(...block.items)
      above.tight = above.tight && block.tight
      // An ordered list with a box in it split into an ordered run and a task run; the one
      // list it came from was ordered, and it started where its first numbered run says.
      if (block.ordered && !above.ordered) { above.ordered = true; above.start = block.start }
      return
    }
    out.push(block)
  })
  return out
}

function oneBlock(node: PMNode): Block | null {
  const name = node.type.name
  switch (name) {
    case 'paragraph': {
      const children = inlinesOf(node)
      return children.length === 0 ? null : { type: 'paragraph', children }
    }
    case 'heading':
      return {
        type: 'heading',
        level: Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1))) as 1 | 2 | 3 | 4 | 5 | 6,
        children: inlinesOf(node),
      }
    case 'horizontalRule':
      return { type: 'thematicBreak' }
    case 'codeBlock':
      return {
        type: 'codeBlock',
        info: String(node.attrs?.language ?? ''),
        // An EMPTY block stays empty. `"\n"` is a block holding one blank line, and writing that
        // for an empty one added a line of code to every empty fence on its first save.
        value: textOf(node) === '' ? '' : `${textOf(node)}\n`,
      }
    case 'mathBlock':
      return { type: 'mathBlock', value: String(node.attrs?.tex ?? ''), delim: mathDelimOf(node) }
    case 'blockquote':
      return { type: 'blockquote', children: blocksOf(node) }
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return listOf(node, name === 'orderedList')
    case 'table':
      return tableOf(node)
    case 'image': {
      // A block image is a paragraph of one image in Markdown, which is what a figure is.
      const [only] = leaf(node)
      return only ? { type: 'paragraph', children: [only] } : null
    }
    default: {
      // An unknown block still yields its content rather than disappearing.
      const inner = blocksOf(node)
      return inner.length === 1 ? inner[0]! : inner.length > 1 ? { type: 'blockquote', children: inner } : null
    }
  }
}

function listOf(node: PMNode, ordered: boolean): Block {
  const items: ListItem[] = []
  node.forEach((item) => {
    items.push({
      children: blocksOf(item),
      checked: item.type.name === 'taskItem' ? Boolean(item.attrs?.checked) : null,
    })
  })
  // TIGHT UNLESS AN ITEM HOLDS SOMETHING OTHER THAN PROSE AND SUB-LISTS.
  //
  // ProseMirror does not record whether a list was tight, so it has to be inferred, and the
  // two obvious rules are both wrong. "One block per item" makes every list with a sub-list
  // loose — `- [x] done` with a nested item under it came back as `<li><p>done</p>`, which is
  // not what was written. "One paragraph per item" makes a list holding a code block tight,
  // and `golden/corpus/list-with-code.md` is loose in the source.
  //
  // What separates them: a sub-list does not make its parent loose, and anything else in an
  // item — a code block, a quote, a table, a second paragraph — means blank lines were
  // written around it. Checked against both fixtures, which disagree with each other.
  //
  // ⚠️ AND THE INFERENCE COMES SECOND. It cannot see blank lines between one-paragraph items,
  // which is the commonest loose list there is; a list opened from Markdown carries `loose`
  // from the parse (`md/to-editor.ts`), and only one built in the editor is left to the guess.
  const tight = !node.attrs?.loose && items.every((item) => {
    const prose = item.children.filter((b) => b.type === 'paragraph').length
    const other = item.children.filter((b) => b.type !== 'paragraph' && b.type !== 'list').length
    return prose <= 1 && other === 0
  })
  return { type: 'list', ordered, start: Number(node.attrs?.start ?? 1), tight, items }
}

function tableOf(node: PMNode): Block {
  const rows: { children: Inline[] }[][] = []
  // THE ALIGNMENT LIVES ON THE HEADER CELLS, and dropping it is a bug this repository has
  // already had once: `TableMarkdown.ts` exists because the library's serializer wrote a flat
  // `| --- | --- |`, so every centred and right-aligned column in every table quietly went
  // left on the first save and stayed there. Numbers in a right-aligned column are the reason
  // anybody sets it.
  let align: (('left' | 'center' | 'right') | null)[] = []
  node.forEach((row, _offset, index) => {
    const cells: { children: Inline[] }[] = []
    const rowAlign: (('left' | 'center' | 'right') | null)[] = []
    row.forEach((cell) => {
      // A CELL HOLDING TWO BLOCKS JOINS WITH A SPACE. A Markdown table holds one line per row,
      // so the blocks are flattened — and flattening them with nothing between runs the last
      // word of one into the first of the next: `một` above `thêm` came out `mộtthêm`.
      const parts: Inline[][] = []
      cell.forEach((block) => parts.push(inlinesOf(block)))
      const inline: Inline[] = []
      parts.filter((p) => p.length > 0).forEach((p, i) => {
        if (i > 0) inline.push({ type: 'text', value: ' ' })
        inline.push(...p)
      })
      cells.push({ children: inline })
      const a = String(cell.attrs?.align ?? '')
      rowAlign.push(a === 'center' || a === 'right' || a === 'left' ? a : null)
      // A MERGED CELL WRITES ONCE AND LEAVES THE COLUMNS IT COVERS EMPTY. ProseMirror can hold
      // a table Markdown cannot express, and the repair `TableMarkdown.ts` chose — keep the
      // words, square the shape — is kept here: the columns a `colspan` spans exist in GFM,
      // they are simply blank. Without it the row is short and every column after the merge
      // shifts one to the left.
      for (let extra = Math.max(1, Number(cell.attrs?.colspan ?? 1)); extra > 1; extra--) {
        cells.push({ children: [] })
        rowAlign.push(null)
      }
    })
    if (index === 0) align = rowAlign
    rows.push(cells)
  })
  // A `rowspan` leaves the rows below it SHORT rather than wide, so the same rule covers it:
  // every row is padded out to the widest one, and a ragged table comes out square.
  const width = rows.reduce((n, row) => Math.max(n, row.length), 0)
  for (const row of rows) while (row.length < width) row.push({ children: [] })
  while (align.length < width) align.push(null)
  const [head = [], ...body] = rows
  return { type: 'table', align, head, rows: body }
}

function textOf(node: PMNode): string {
  let out = ''
  node.forEach((child) => { out += child.text ?? textOf(child) })
  return out
}

/** The editor's document, as a tree the rest of this engine can render. */
export function fromEditor(doc: PMNode): Document {
  return { type: 'document', children: blocksOf(doc) }
}
