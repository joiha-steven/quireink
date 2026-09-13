// Phase one: the document's block structure, one line at a time.
//
// The algorithm is CommonMark's own and the shape is worth stating once, because every
// tempting simplification of it is wrong. A line is not matched against a list of patterns.
// It is walked DOWN the stack of blocks that are currently open — document, then blockquote,
// then list item, then the paragraph inside it — and each one is asked whether this line
// still belongs to it. Only when that walk stops does the line get to open something new.
//
// That order is what makes `> - foo` one line opening three blocks, and what makes a line
// four spaces in mean code in one place and a paragraph in another. A parser that pattern-
// matches lines gets the easy 80% and then cannot be repaired.
//
// The one exception is LAZY CONTINUATION: a paragraph inside a blockquote continues even
// when the line carries no `>`, because that is how people actually write them. It is the
// reason `continues()` returning "no" is not the end of the story.

import { Line, toLines } from './line'
import {
  acceptsLines, canContain, decideLoose, isContainer, lastChild, node, sameList, type Kind, type Node,
} from './block-tree'
import {
  atxHeading, blockquoteMarker, codeFence, htmlBlockEnds, htmlBlockStart,
  listMarker, setextUnderline, tableCells, tableDelimiterRow, taskMarker, thematicBreak,
} from './block-scan'
import { CONSUMED, NOT_MATCHED, continuesBlock } from './block-continue'
import { resolveEntities } from './entity'
import { stripDefinitions, type LinkDefs } from './link-ref'

export class BlockParser {
  doc: Node = node('document', null)
  /**
   * The link reference definitions, collected AS THE BLOCKS ARE BUILT.
   *
   * They used to be peeled off afterwards, and two examples showed why that cannot work: a
   * setext underline has to know whether the paragraph above it has anything left once its
   * definitions are taken out. `[foo]: /url` with `===` under it is not a heading — the
   * paragraph is empty — and `[foo]: /url\nbar` with `===` under it is a heading reading
   * `bar`. Neither answer is available to a pass that runs later.
   */
  defs: LinkDefs = new Map()
  private tip: Node = this.doc
  private lastMatched: Node = this.doc
  private line = new Line('')
  private blank = false
  /** Whether this line opened anything — read by lazy continuation, set all over `openNew`. */
  private opened = false
  /**
   * Whether the block that just opened swallowed the whole line.
   *
   * A heading, a thematic break and a fence's OPENING line are spent where they are
   * recognised: the heading's text came off the line, and a fence's info string is not the
   * first line of its code. Without this the same line was offered twice — `# hi` came out as
   * a heading and then a paragraph reading `# hi`, and ```` ```js ```` put `js` inside the
   * code block.
   */
  private lineSpent = false

  parse(source: string): Node {
    for (const text of toLines(source)) this.incorporate(text)
    // Close the whole stack, from the deepest open block up to the document. Walking by
    // `parent` rather than by `tip` because `finalize` moves `tip`, and a loop that reads the
    // thing it is changing never ends — which is exactly what the first draft did.
    for (let n: Node | null = this.tip; n; n = n.parent) this.finalize(n)
    return this.doc
  }

  // ----- the walk ------------------------------------------------------------------------

  private incorporate(text: string): void {
    this.line = new Line(text)
    let container = this.doc
    let allMatched = true

    let child = lastChild(container)
    while (child && child.open) {
      container = child
      this.blank = this.line.blank()
      const verdict = continuesBlock(container, this.line, this.blank)
      if (verdict === CONSUMED) {
        this.finalize(container)
        return
      }
      if (verdict === NOT_MATCHED) {
        container = container.parent!
        allMatched = false
        break
      }
      child = lastChild(container)
    }
    this.blank = this.line.blank()
    this.lastMatched = container

    // A paragraph that did not match its container still gets the line, as long as the line
    // opens nothing of its own. That is lazy continuation, and it is checked below rather
    // than here because "opens nothing" is only known after trying.
    const wasLazy = !allMatched && !this.blank && this.tip.kind === 'paragraph'

    this.opened = false
    this.lineSpent = false
    // A PARAGRAPH DOES NOT STOP THE SEARCH. Almost everything may interrupt one — a heading,
    // a fence, a list, a rule, and above all a setext underline, which turns the paragraph
    // above it into a heading and therefore can only be found while that paragraph is open.
    // Skipping `openNew` whenever the block could hold lines cost all 17 setext examples.
    // Only the three blocks that hold RAW text are exempt: inside them a `#` is a `#`.
    const raw = container.kind === 'codeIndented' || container.kind === 'codeFenced' || container.kind === 'html'
    const target = raw ? container : this.openNew(container, wasLazy)

    if (wasLazy && !this.opened) {
      this.addLine(this.tip)
      return
    }

    // Only when nothing opened. `openNew` closes what it has to before it builds, so calling
    // this after it would close the block it just built — two lists where one was meant.
    if (!this.opened) this.closeUnmatched()
    this.acceptLine(target)
  }

  // ----- opening ------------------------------------------------------------------------

  /**
   * Open as many new blocks as this line starts, and answer with the innermost one.
   *
   * The RETURN VALUE is what the line is then offered to, and that is the whole reason it is
   * a node rather than a boolean. A heading consumes its line here; handing the caller a
   * "yes, something opened" and letting it look at `tip` gave the same line to the heading
   * AND to a paragraph after it — `# hi` came out as a heading followed by a paragraph
   * reading `# hi`.
   */
  private openNew(from: Node, lazy: boolean): Node {
    let container = from

    for (;;) {
      const indent = this.line.indent()

      // Indented code, but never where a paragraph is running: four spaces under a paragraph
      // is a continuation line, not a code block.
      if (indent >= 4 && container.kind !== 'paragraph' && !lazy) {
        this.line.advanceWhitespace(4)
        if (!this.blank) {
          container = this.addChild('codeIndented', container)
          this.opened = true
        }
        break
      }

      if (blockquoteMarker(this.line)) {
        this.line.advanceWhitespace(indent)
        this.line.advance()
        if (this.line.peek() === ' ' || this.line.peek() === '\t') this.line.advanceWhitespace(1)
        if (!this.opened) this.closeUnmatchedFrom(container)
        container = this.addChild('blockquote', container)
        this.opened = true
        continue
      }

      const heading = atxHeading(this.line)
      if (heading) {
        if (!this.opened) this.closeUnmatchedFrom(container)
        const created = this.addChild('heading', container)
        created.level = heading.level as 1 | 2 | 3 | 4 | 5 | 6
        created.lines.push(heading.text)
        this.finalize(created)
        this.opened = true
        this.lineSpent = true
        return created
      }

      const fence = codeFence(this.line)
      if (fence) {
        if (!this.opened) this.closeUnmatchedFrom(container)
        const created = this.addChild('codeFenced', container)
        created.fenceChar = fence.char
        created.fenceLength = fence.length
        created.fenceIndent = fence.indent
        created.info = fence.info
        this.line.advanceWhitespace(indent)
        for (let i = 0; i < fence.length; i++) this.line.advance()
        this.opened = true
        this.lineSpent = true
        return created
      }

      const html = htmlBlockStart(this.line, container.kind === 'paragraph')
      if (html !== null) {
        if (!this.opened) this.closeUnmatchedFrom(container)
        const created = this.addChild('html', container)
        created.htmlKind = html
        container = created
        this.opened = true
        break
      }

      // A GFM table: the line above was its header, this one declares the alignment. Checked
      // before the setext underline, because `---` under one word is a heading and `---` under
      // `a | b` is a table, and the difference is only the cell count matching.
      if (container.kind === 'paragraph' && container.lines.length === 1 && !lazy) {
        const align = tableDelimiterRow(this.line.rest())
        if (align && align.length === tableCells(container.lines[0]!).length) {
          container.kind = 'table'
          container.tableAlign = align
          container.tableHead = container.lines[0]
          container.tableRows = []
          container.lines = []
          this.opened = true
          this.lineSpent = true
          return container
        }
      }

      // A setext underline turns the paragraph above it into a heading — only when that
      // paragraph is the block this line would have continued.
      const setext = setextUnderline(this.line)
      if (setext && container.kind === 'paragraph' && !lazy) {
        const para = container
        // Definitions come out first, and what is left decides whether this is a heading at
        // all. An underline over nothing but definitions is a paragraph of its own.
        this.takeDefinitions(para)
        if (para.lines.length === 0) break
        para.kind = 'heading'
        para.level = setext
        this.finalize(para)
        this.opened = true
        this.lineSpent = true
        return para
      }

      if (thematicBreak(this.line)) {
        if (!this.opened) this.closeUnmatchedFrom(container)
        const created = this.addChild('thematicBreak', container)
        this.finalize(created)
        this.opened = true
        this.lineSpent = true
        return created
      }

      const marker = listMarker(this.line, container.kind === 'paragraph')
      if (marker) {
        if (!this.opened) this.closeUnmatchedFrom(container)
        // The item's continuation indent: everything up to where its content begins.
        const contentIndent = indent + marker.width + marker.padding
        if (container.kind !== 'list' || !sameList(container, marker.ordered, marker.delim)) {
          const list = this.addChild('list', container)
          list.ordered = marker.ordered
          list.listDelim = marker.delim
          list.listStart = marker.start
          container = list
        }
        const item = this.addChild('item', container)
        item.itemIndent = contentIndent
        item.checked = null
        // Three steps, and they are three because they cross three different things: the
        // indent before the marker is whitespace, the marker itself is NOT — `advanceWhitespace`
        // stops dead at `-` — and the padding after it is whitespace again. Folding the first
        // two together left the cursor on the marker, which matched again on the next turn of
        // this loop, forever.
        this.line.advanceWhitespace(indent)
        for (let i = 0; i < marker.width; i++) this.line.advance()
        this.line.advanceWhitespace(marker.padding)
        container = item
        this.opened = true
        continue
      }

      break
    }

    return container
  }

  // ----- accepting the line --------------------------------------------------------------

  private acceptLine(container: Node): void {
    if (this.lineSpent) return
    // BLANK IS RE-READ HERE, and it has to be. `this.blank` was measured before `openNew` ate
    // the markers, so `-` on its own looked non-blank — the marker was still on the line — and
    // the item got a paragraph containing the empty remainder. That empty first line then made
    // `-\n  foo` render as `<li>\nfoo</li>`, and made an item that should have closed on the
    // next blank line look like it had content.
    this.blank = this.line.blank()

    if (container.kind === 'table') {
      // A line that is not a row ends the table; the caller has already decided it belongs to
      // this block, so anything arriving here is one.
      container.tableRows!.push(this.line.rest())
      return
    }

    if (acceptsLines(container)) {
      this.addLine(container)
      if (container.kind === 'html' && htmlBlockEnds(container.htmlKind ?? 6, this.line.text)) {
        this.finalize(container)
      }
      return
    }

    if (this.blank) {
      // Remember a blank line on the block that just ended, so a list can work out whether it
      // is loose when it closes — EXCEPT on an item that opened on this very line and holds
      // nothing yet. `-` alone followed by its content on the next line is one item written
      // over two lines, not an item with a blank line in it, and counting it made every such
      // list loose: `<li>\nfoo</li>` where the spec says `<li>foo</li>`.
      const emptyFreshItem = container.kind === 'item' && container.children.length === 0
      if (!emptyFreshItem) {
        const last = lastChild(this.lastMatched)
        if (last) last.endsWithBlank = true
        else this.lastMatched.endsWithBlank = true
      }
      return
    }

    if (isContainer(container) || container.kind === 'document') {
      const para = this.addChild('paragraph', container)
      this.addLine(para)
    }
  }

  private addLine(target: Node): void {
    target.lines.push(this.line.rest())
  }

  // ----- the stack ------------------------------------------------------------------------

  private addChild(kind: Kind, parent: Node): Node {
    let target = parent
    while (!canContain(target.kind, kind)) {
      this.finalize(target)
      target = target.parent!
    }
    const created = node(kind, target)
    this.tip = created
    return created
  }

  private closeUnmatched(): void {
    this.closeUnmatchedFrom(this.lastMatched)
  }

  private closeUnmatchedFrom(keep: Node): void {
    while (this.tip !== keep && this.tip !== this.doc) {
      const parent = this.tip.parent!
      this.finalize(this.tip)
      this.tip = parent
    }
  }

  /** Peel every definition off the front of a paragraph, leaving what the reader sees. */
  private takeDefinitions(para: Node): void {
    if (para.lines.length === 0) return
    const text = para.lines.join('\n').replace(/^[ \t]+|[ \t]+$/g, '')
    const rest = stripDefinitions(text, this.defs, resolveEntities)
    para.lines = rest === '' ? [] : [rest]
  }

  /** Close a block: it stops accepting lines, and a list decides whether it is loose. */
  private finalize(block: Node): void {
    if (!block.open) return
    block.open = false
    if (block.kind === 'paragraph') this.takeDefinitions(block)
    if (block.kind === 'list') block.loose = decideLoose(block)
    if (block.kind === 'item') {
      const first = block.children[0]
      if (first && first.kind === 'paragraph' && first.lines.length > 0) {
        const task = taskMarker(first.lines[0]!)
        if (task) {
          block.checked = task.checked
          first.lines[0] = task.rest
        }
      }
    }
    // Only the block being closed moves the cursor, and only when it IS the cursor.
    if (this.tip === block) this.tip = block.parent ?? this.doc
  }
}

export function parseBlocks(source: string): Node {
  return new BlockParser().parse(source)
}
