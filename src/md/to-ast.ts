// The parser's tree becomes the one the renderers read.
//
// The step exists because the two trees answer different questions. `block-tree.ts` holds
// what the line loop needed — which fence opened this, how far in an item's content sits,
// whether a blank line went past — and none of that means anything to a renderer. What comes
// out here is `ast.ts`: blocks, their inlines, and nothing about how they were recognised.
//
// It is also where phase two runs. A leaf's collected lines are joined and handed to the
// inline parser HERE rather than during the block loop, because emphasis may cross a line
// break inside a paragraph and a parser that ran per line could not see it.

import type { Block, Document, ListItem } from './ast'
import { decideLoose, type Node } from './block-tree'
import { parseInline } from './inline'
import { tableCells } from './block-scan'
import type { LinkDefs } from './link-ref'

/**
 * The block tree becomes the AST, with the definitions the block parse already collected.
 *
 * THE ORDER IS THE POINT. A link may point at a definition written further down the document —
 * `[see later][x]` in the first paragraph and `[x]: /url` in the last — so the whole map has to
 * exist before any inline is parsed. `BlockParser` builds it as it closes each paragraph, which
 * is also the only moment a setext underline can ask whether the paragraph above it has
 * anything left.
 */
export function toAst(root: Node, defs: LinkDefs): Document {
  return { type: 'document', children: blocksOf(root, defs) }
}

function blocksOf(parent: Node, defs: LinkDefs): Block[] {
  const out: Block[] = []
  for (const child of parent.children) {
    const block = oneBlock(child, defs)
    if (block) out.push(block)
  }
  return out
}

function oneBlock(n: Node, defs: LinkDefs): Block | null {
  switch (n.kind) {
    case 'paragraph': {
      const text = n.lines.join('\n').replace(/^[ \t]+|[ \t]+$/g, '')
      if (text === '') return null
      return { type: 'paragraph', children: parseInline(text, defs) }
    }

    case 'heading':
      return {
        type: 'heading',
        level: (n.level ?? 1) as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(n.lines.join('\n').trim(), defs),
      }

    case 'thematicBreak':
      return { type: 'thematicBreak' }

    case 'codeIndented': {
      // Blank lines at the end of an indented block are not part of the code: they are the
      // lines that ended it.
      const lines = [...n.lines]
      while (lines.length > 0 && /^[ \t]*$/.test(lines[lines.length - 1]!)) lines.pop()
      return { type: 'codeBlock', info: '', value: lines.length ? `${lines.join('\n')}\n` : '' }
    }

    case 'codeFenced':
      return {
        type: 'codeBlock',
        info: n.info ?? '',
        value: n.lines.length ? `${n.lines.join('\n')}\n` : '',
      }

    case 'html':
      return { type: 'htmlBlock', value: n.lines.join('\n').replace(/\n+$/, '') }

    case 'blockquote':
      return { type: 'blockquote', children: blocksOf(n, defs) }

    case 'list': {
      const tight = !decideLoose(n)
      const items: ListItem[] = n.children.map((item) => ({
        children: blocksOf(item, defs),
        checked: item.checked ?? null,
      }))
      return {
        type: 'list',
        ordered: n.ordered ?? false,
        start: n.listStart ?? 1,
        tight,
        items,
      }
    }

    case 'table': {
      const align = n.tableAlign ?? []
      // A row with fewer cells than the header is padded and one with more is cut: GFM says
      // the header decides the width, and a ragged row is not an error worth refusing a table
      // over. Somebody wrote the table; drawing it is more useful than complaining.
      const row = (text: string) => {
        const cells = tableCells(text)
        return align.map((_, i) => ({ children: parseInline(cells[i] ?? '', defs) }))
      }
      return {
        type: 'table',
        align,
        head: row(n.tableHead ?? ''),
        rows: (n.tableRows ?? []).map(row),
      }
    }

    case 'item':
      // Reached only through its list, which builds the items itself.
      return null

    default:
      return null
  }
}
