// The tree, as plain prose: the excerpt, the meta description, the OG card, the RSS summary.
//
// The fourth reader of Markdown in this repository, and the one that had never been a parser
// at all — `utils.ts`'s `toPlainText` is a ladder of eleven regular expressions over the
// source text. It works until the notation grows, and then it does not: when the pen shipped
// `==text==#green`, that ladder did not know the syntax and put the word "green" into every
// excerpt, every meta description, every OG card and every RSS summary on the site. The fix
// was to teach it the grammar — a fourth copy of the rule to keep in step with three others.
//
// Reading it off the TREE instead is the whole argument for this engine. A node knows what it
// is, so there is nothing to teach and nothing to keep in step: a highlight yields its words
// because that is what a highlight contains, and a node type added tomorrow makes this file
// fail to compile until somebody says what its prose is.
//
// WHAT IT DROPS, and each is a judgement the old ladder also made, kept deliberately:
//
//   - A code block is not prose. Neither is raw HTML.
//   - An image contributes nothing: its alt text describes a picture the reader of a deck
//     cannot see, and reading it as a sentence makes the deck a caption for something absent.
//   - A DISPLAY formula is dropped whole. It is a standalone equation, not part of a
//     sentence: a post opening with `$$M \times V = P \times Q$$` produced the deck
//     "M V = P Q Giải mã phương trình…", which reads as broken prose above the title.
//   - An INLINE formula keeps its operands, because it sits inside a sentence. `**$M$ (Money
//     Supply):**` must not summarise as " (Money Supply):". The control words go, the letters
//     stay — deliberately NOT mapped to their symbols, because a table turning `\times` into
//     × would be a second grammar to keep in step with Temml's.

import type { Block, Inline } from './ast'
import { parse } from './index'

/** A formula's letters without its control words: `M \times V` becomes `M V`. */
function stripTex(tex: string): string {
  return tex.replace(/\\[a-zA-Z]+|\\\\|[{}&]/g, ' ').replace(/\s+/g, ' ').trim()
}

function inlineText(nodes: Inline[]): string {
  let out = ''
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
      case 'code':
        out += node.value
        break
      case 'softbreak':
      case 'hardbreak':
        out += ' '
        break
      case 'math':
        out += node.display ? ' ' : stripTex(node.value)
        break
      case 'html':
      case 'image':
      case 'footnoteRef':
        out += ' '
        break
      default:
        out += inlineText(node.children)
    }
  }
  return out
}

function blockText(blocks: Block[]): string {
  let out = ''
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        out += `${inlineText(block.children)} `
        break
      case 'codeBlock':
      case 'htmlBlock':
      case 'mathBlock':
      case 'thematicBreak':
        out += ' '
        break
      case 'table':
        for (const cell of [...block.head, ...block.rows.flat()]) out += `${inlineText(cell.children)} `
        break
      case 'list':
        for (const item of block.items) out += blockText(item.children)
        break
      case 'blockquote':
      case 'callout':
      case 'footnoteDef':
        out += blockText(block.children)
        break
    }
  }
  return out
}

/** A document's prose, with every run of whitespace collapsed to one space. */
export function toText(source: string): string {
  return blockText(parse(source).children).replace(/\s+/g, ' ').trim()
}
