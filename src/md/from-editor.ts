// The editor's document, as the tree. The other half of a save.
//
// ProseMirror holds a post while somebody is writing it, in a shape of its own: nodes and
// marks named by the Tiptap extensions in `admin/components/editorExtensions.ts`. This turns
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
 * Outermost first. A link wraps emphasis rather than the other way round, and the pen sits
 * under everything: `==**bold**==` and `**==bold==**` mean the same thing to a reader, so the
 * serializer has to pick one and always pick it.
 */
const MARK_ORDER = ['link', 'ink', 'underline', 'ring', 'strong', 'bold', 'em', 'italic', 'strike', 'code']

const rank = (name: string): number => {
  const i = MARK_ORDER.indexOf(name)
  return i === -1 ? MARK_ORDER.length : i
}

type Piece = { node: PMNode; marks: { name: string; attrs: Record<string, unknown> }[] }

/** One text piece's marks, sorted into the nesting order above. */
function marksOf(node: PMNode): Piece['marks'] {
  return [...(node.marks ?? [])]
    .map((m) => ({ name: m.type.name, attrs: m.attrs ?? {} }))
    .sort((a, b) => rank(a.name) - rank(b.name))
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
      return [{ type: 'math', value: String(node.attrs?.tex ?? ''), display: false }]
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
 * Recursive on DEPTH: the outermost mark common to a stretch of pieces becomes a node, and the
 * stretch is re-grouped inside it with that mark removed. Pieces with no marks left are leaves.
 */
function group(pieces: Piece[], depth: number): Inline[] {
  const out: Inline[] = []
  let i = 0
  while (i < pieces.length) {
    const mark = pieces[i]!.marks[depth]
    if (!mark) {
      out.push(...leaf(pieces[i]!.node))
      i += 1
      continue
    }
    // How far this same mark runs. Compared by name AND attributes: two highlights in
    // different colours are two marks, and merging them would lose one of the colours.
    let end = i + 1
    while (end < pieces.length) {
      const next = pieces[end]!.marks[depth]
      if (!next || next.name !== mark.name) break
      if (JSON.stringify(next.attrs) !== JSON.stringify(mark.attrs)) break
      end += 1
    }
    const children = group(pieces.slice(i, end), depth + 1)
    out.push(wrap(mark, children))
    i = end
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
  return group(pieces, 0)
}

function blocksOf(node: PMNode): Block[] {
  const out: Block[] = []
  node.forEach((child) => {
    const block = oneBlock(child)
    if (block) out.push(block)
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
        value: `${textOf(node)}\n`,
      }
    case 'mathBlock':
      return { type: 'mathBlock', value: String(node.attrs?.tex ?? '') }
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
  const tight = items.every((item) => {
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
      // A cell holds blocks; a Markdown table holds one line, so its blocks are flattened.
      const inline: Inline[] = []
      cell.forEach((block) => inline.push(...inlinesOf(block)))
      cells.push({ children: inline })
      const a = String(cell.attrs?.align ?? '')
      rowAlign.push(a === 'center' || a === 'right' || a === 'left' ? a : null)
    })
    if (index === 0) align = rowAlign
    rows.push(cells)
  })
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
