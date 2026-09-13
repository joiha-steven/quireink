// The tree every part of this blog reads the same document from.
//
// FOUR ENGINES READ MARKDOWN HERE before this one existed, and none of them knew about the
// others: `marked` for the reader's page, `markdown-it` for opening a post in the editor,
// `prosemirror-markdown` for saving it again, and a run of regular expressions in
// `toPlainText` for the excerpt, the meta description, the OG card and the RSS summary. Every
// one of them had to be taught this blog's own notation — the pen's `==ink==#green`,
// `++underline++` and `@@ring@@`, the maths, the footnotes, the callouts — and 2,075 lines
// existed to do the teaching. They drifted, which is what four answers to one question do:
// the word "green" once reached every excerpt on the site, and 19 of 45 golden fixtures
// published differently after a single pass through the editor.
//
// This file is the fix stated as a shape. ONE syntax tree, produced once, rendered into
// whatever a caller needs — HTML for the reader, a ProseMirror document for the writer,
// Markdown on the way back, plain text for the deck. A question asked of the notation is
// answered in the parser, and every output agrees by construction rather than by three
// people keeping three parsers in step.
//
// The node set is CommonMark's, plus GFM's four, plus this blog's own. It is deliberately
// FLAT — a discriminated union with a `type` string rather than a class hierarchy — because
// the renderers are switch statements and a switch over a union is exhaustively checked by
// the compiler. Adding a node type makes every renderer fail to compile until it says what
// it does with it, which is the property that keeps the outputs in step.

/** Where a node came from, in the source. Line and column are 1-based, as every editor is. */
import type { MathDelim } from '@/render/math-syntax'

export type Pos = { line: number; col: number; offset: number }

export type Span = { start: Pos; end: Pos }

// ----- inline ------------------------------------------------------------------------

export type Inline =
  | { type: 'text'; value: string; span?: Span }
  /** A newline inside a paragraph that the reader sees as a space. */
  | { type: 'softbreak' }
  /** Two trailing spaces or a trailing backslash: a line the reader sees broken. */
  | { type: 'hardbreak' }
  | { type: 'code'; value: string }
  /** Raw HTML the source wrote inline. Kept verbatim; what is ALLOWED is the renderer's call. */
  | { type: 'html'; value: string }
  | { type: 'emph'; children: Inline[] }
  | { type: 'strong'; children: Inline[] }
  /** GFM `~~struck~~`. */
  | { type: 'strike'; children: Inline[] }
  | { type: 'link'; url: string; title?: string; children: Inline[] }
  | { type: 'image'; url: string; title?: string; alt: Inline[] }
  /**
   * The pen's three gestures: `==highlight==`, `++underline++`, `@@ring@@`, each with an
   * optional `#colour`.
   *
   * `raw` IS LOAD-BEARING and not debugging residue. Every stroke wears one of the pen's
   * variants, chosen by hashing the gesture's own source (`pen/grammar.ts`, `penSeed`) — so a
   * phrase keeps the same stroke across re-renders and cached bodies stay deterministic. The
   * hash needs the source text, fences and colour suffix included, and this is the only place
   * it survives the parse.
   */
  | { type: 'ink'; ink?: string; raw: string; children: Inline[] }
  | { type: 'underline'; ink?: string; raw: string; children: Inline[] }
  | { type: 'ring'; ink?: string; raw: string; children: Inline[] }
  /**
   * A formula. The value is TeX, UNTOUCHED — no inline parsing happens inside it, or
   * `x_1 + y_2` would come back as `x<em>1 + y</em>2`. `src/render/math.ts` turns it into
   * MathML; the parser's only job is to find where it starts and stops.
   *
   * ⚠️ `delim` IS THE AUTHOR'S CHOICE AND IS CARRIED, not derived. Four spellings mean maths
   * here — `$…$`, `\\(…\\)`, `$$…$$`, `\\[…\\]` — and a serializer that normalises them
   * rewrites a file its author never asked it to touch. `render/math-syntax.ts` says the same
   * thing about the same field and has since the feature shipped; the engine dropped it on the
   * way through, and sixteen editor tests said so the moment the editor was wired to it.
   */
  | { type: 'math'; value: string; display: boolean; delim: MathDelim }
  /** `[^label]` in the prose. The definition is a block. */
  | { type: 'footnoteRef'; label: string }

// ----- blocks ------------------------------------------------------------------------

export type Block =
  | { type: 'paragraph'; children: Inline[]; span?: Span }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[]; span?: Span }
  | { type: 'thematicBreak' }
  /** A fence or an indented block. `info` is the fence's info string, empty for indented. */
  | { type: 'codeBlock'; info: string; value: string; span?: Span }
  /** Raw HTML the source wrote as a block. */
  | { type: 'htmlBlock'; value: string }
  | { type: 'blockquote'; children: Block[] }
  | { type: 'list'; ordered: boolean; start: number; tight: boolean; items: ListItem[] }
  /** `$$…$$` on its own. TeX, untouched. */
  | { type: 'mathBlock'; value: string; delim: MathDelim }
  | { type: 'table'; align: (Align | null)[]; head: TableCell[]; rows: TableCell[][] }
  /** `[^label]: …`, collected out of the flow and rendered at the foot of the piece. */
  | { type: 'footnoteDef'; label: string; children: Block[] }
  /** A blockquote opening `[!NOTE]`, `[!WARNING]` and the rest. */
  | { type: 'callout'; kind: string; children: Block[] }

export type Align = 'left' | 'center' | 'right'

export type TableCell = { children: Inline[] }

export type ListItem = {
  children: Block[]
  /** GFM task list: null when the item carries no checkbox. */
  checked: boolean | null
}

/** A whole document, and the link definitions its inlines were resolved against. */
export type Document = {
  type: 'document'
  children: Block[]
}

// ----- walking -------------------------------------------------------------------------

/** The children of a block, for the callers that walk the tree without knowing the shape. */
export function blockChildren(node: Block): Block[] {
  switch (node.type) {
    case 'blockquote':
    case 'callout':
    case 'footnoteDef':
      return node.children
    case 'list':
      return node.items.flatMap((item) => item.children)
    default:
      return []
  }
}

/** The inlines a block holds directly. Empty for blocks made only of other blocks. */
export function blockInlines(node: Block): Inline[] {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return node.children
    case 'table':
      return [...node.head, ...node.rows.flat()].flatMap((cell) => cell.children)
    default:
      return []
  }
}

/** The children of an inline. Images hold their alt text, which is inline and searchable. */
export function inlineChildren(node: Inline): Inline[] {
  switch (node.type) {
    case 'emph':
    case 'strong':
    case 'strike':
    case 'link':
    case 'ink':
    case 'underline':
    case 'ring':
      return node.children
    case 'image':
      return node.alt
    default:
      return []
  }
}
