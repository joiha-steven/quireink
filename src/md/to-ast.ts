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

export function toAst(root: Node): Document {
  return { type: 'document', children: blocksOf(root) }
}

function blocksOf(parent: Node): Block[] {
  const out: Block[] = []
  for (const child of parent.children) {
    const block = oneBlock(child)
    if (block) out.push(block)
  }
  return out
}

function oneBlock(n: Node): Block | null {
  switch (n.kind) {
    case 'paragraph': {
      const text = n.lines.join('\n').replace(/^[ \t]+|[ \t]+$/g, '')
      if (text === '') return null
      return { type: 'paragraph', children: parseInline(text) }
    }

    case 'heading':
      return {
        type: 'heading',
        level: (n.level ?? 1) as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(n.lines.join('\n').trim()),
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
      return { type: 'blockquote', children: blocksOf(n) }

    case 'list': {
      const tight = !decideLoose(n)
      const items: ListItem[] = n.children.map((item) => ({
        children: blocksOf(item),
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

    case 'item':
      // Reached only through its list, which builds the items itself.
      return null

    default:
      return null
  }
}
