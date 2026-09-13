// Whether an open block still owns the line being read.
//
// One question, asked of every block on the stack from the document down, and the answers are
// what give Markdown its shape: a blockquote wants its `>`, an item wants its indent, a
// paragraph wants any non-blank line at all, and a fence wants everything until its match.
//
// Split out of the loop in `block.ts` at the 400-line ceiling, and the seam is a real one:
// nothing here touches the tree. It reads a block and a line, consumes the marker when there
// is one, and answers. The loop decides what to do about it.

import type { Line } from './line'
import type { Node } from './block-tree'
import { blockquoteMarker, closesFence } from './block-scan'

/** What a block says when asked whether a line is still its own. */
export const MATCHED = 0
export const NOT_MATCHED = 1
/** The block consumed the line itself and should be closed — a fence's closing line. */
export const CONSUMED = 2

export function continuesBlock(block: Node, line: Line, blank: boolean): number {
    switch (block.kind) {
      case 'document':
        return MATCHED

      case 'blockquote': {
        if (!blockquoteMarker(line)) return NOT_MATCHED
        line.advanceWhitespace(line.indent())
        line.advance() // the '>'
        // One optional space after the marker, and a tab counts as that space.
        if (line.peek() === ' ' || line.peek() === '\t') line.advanceWhitespace(1)
        return MATCHED
      }

      case 'item': {
        const indent = block.itemIndent ?? 2
        if (blank) {
          // An item that has nothing in it yet cannot be continued by a blank line: `-` on
          // its own followed by a blank line is an empty item, not the start of something.
          if (block.children.length === 0) return NOT_MATCHED
          line.advanceWhitespace(Math.min(indent, line.indent()))
          return MATCHED
        }
        if (line.indent() >= indent) {
          line.advanceWhitespace(indent)
          return MATCHED
        }
        return NOT_MATCHED
      }

      case 'list':
        return MATCHED

      case 'paragraph':
        return blank ? NOT_MATCHED : MATCHED

      case 'codeIndented': {
        if (line.indent() >= 4) {
          line.advanceWhitespace(4)
          return MATCHED
        }
        if (blank) {
          line.advanceWhitespace(line.indent())
          return MATCHED
        }
        return NOT_MATCHED
      }

      case 'codeFenced': {
        if (closesFence(line, block.fenceChar!, block.fenceLength!)) return CONSUMED
        // The opening fence's own indentation comes off every line inside it, but only as
        // much of it as the line actually has.
        line.advanceWhitespace(Math.min(block.fenceIndent ?? 0, line.indent()))
        return MATCHED
      }

      case 'html': {
        const kind = block.htmlKind ?? 6
        if (kind >= 6) return blank ? NOT_MATCHED : MATCHED
        return MATCHED
      }

      case 'table':
        return blank ? NOT_MATCHED : MATCHED

      default:
        // A heading or a thematic break is one line and finished.
        return NOT_MATCHED
    }
}
