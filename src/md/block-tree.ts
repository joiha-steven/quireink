// The shape the block parser builds, and what it does when a block closes.
//
// NOT the AST. This is the parser's own tree: blocks that are still open, the state each one
// needs to decide whether the next line belongs to it, and the raw lines a leaf has collected
// so far. `ast.ts` is what a renderer sees; this is what the loop in `block.ts` works in, and
// keeping them apart is what lets the loop stay about lines while the AST stays about meaning.

export type Kind =
  | 'document'
  | 'blockquote'
  | 'list'
  | 'item'
  | 'paragraph'
  | 'heading'
  | 'codeIndented'
  | 'codeFenced'
  | 'html'
  | 'thematicBreak'
  | 'table'

export type Node = {
  kind: Kind
  parent: Node | null
  children: Node[]
  open: boolean
  /** Raw source lines, for the leaves that hold text. */
  lines: string[]

  // heading
  level?: 1 | 2 | 3 | 4 | 5 | 6

  // fenced code
  fenceChar?: string
  fenceLength?: number
  fenceIndent?: number
  info?: string

  // html block
  htmlKind?: number

  // list
  ordered?: boolean
  listDelim?: string
  listStart?: number
  /** A list is loose when any item is followed by a blank line inside the list. */
  loose?: boolean

  // item
  /** Columns of indentation the item's continuation lines must carry. */
  itemIndent?: number
  /** Set on the item that ends with a blank line, so the list can decide it is loose. */
  endsWithBlank?: boolean
  checked?: boolean | null

  // table
  tableAlign?: (('left' | 'center' | 'right') | null)[]
  tableHead?: string
  tableRows?: string[]
}

export function node(kind: Kind, parent: Node | null): Node {
  const created: Node = { kind, parent, children: [], open: true, lines: [] }
  if (parent) parent.children.push(created)
  return created
}

/** Containers hold other blocks; leaves hold lines. The loop treats the two differently. */
export function isContainer(n: Node): boolean {
  return n.kind === 'document' || n.kind === 'blockquote' || n.kind === 'list' || n.kind === 'item'
}

/**
 * Whether a block of this kind may hold a block of that kind.
 *
 * A LIST HOLDS ONLY ITEMS, and that single rule is what this exists for. Without it a
 * paragraph that followed a list but was not indented enough to continue its item got added
 * to the LIST — where the renderer, reasonably, drew it as an empty `<li>`. Four spec examples
 * showed the same phantom bullet.
 */
export function canContain(parent: Kind, child: Kind): boolean {
  if (parent === 'list') return child === 'item'
  if (parent === 'document' || parent === 'blockquote' || parent === 'item') return child !== 'item'
  return false
}

/** Whether a leaf accepts more lines at all. A heading is one line and done. */
export function acceptsLines(n: Node): boolean {
  return n.kind === 'paragraph' || n.kind === 'codeIndented' || n.kind === 'codeFenced' || n.kind === 'html' || n.kind === 'table'
}

export function lastChild(n: Node): Node | undefined {
  return n.children[n.children.length - 1]
}

/**
 * Whether a list and a marker belong to the same list.
 *
 * The delimiter is the whole test, and it is the spec's: `- a` then `* b` is TWO lists, not
 * one list of two items. Changing the bullet is how a writer ends one list and starts
 * another without a blank line between them.
 */
export function sameList(list: Node, ordered: boolean, delim: string): boolean {
  return list.ordered === ordered && list.listDelim === delim
}

/**
 * A list is TIGHT unless something made it loose, and this is where that is decided.
 *
 * Loose means: a blank line between two items, or a blank line between two blocks inside an
 * item. Either one makes every paragraph in the list keep its `<p>`. The check runs when the
 * list closes, because until then a blank line at the end might just be the line that ends
 * the list — and a list that ends with a blank line is not loose for it.
 */
export function decideLoose(list: Node): boolean {
  if (list.loose) return true
  for (let i = 0; i < list.children.length; i++) {
    const item = list.children[i]!
    // A blank line inside an item, between two of its blocks.
    if (item.endsWithBlank && i !== list.children.length - 1) return true
    for (let j = 0; j < item.children.length - 1; j++) {
      if (item.children[j]!.endsWithBlank) return true
    }
  }
  return false
}
