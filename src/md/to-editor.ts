// The tree, as the editor's document. The fifth direction, and the last.
//
// STRAIGHT TO PROSEMIRROR JSON, not to HTML for Tiptap to re-parse. `tiptap-markdown` goes the
// long way — markdown-it produces HTML, `setContent` parses that HTML back into nodes through
// every extension's `parseHTML` — and the trip costs more than time: whatever the HTML cannot
// say is lost at the join. A maths node has to be spelled as a `<span>` with attributes that
// `MathNode.tsx` will recognise, a table's alignment has to survive as an attribute on a `<td>`,
// and every one of those spellings is a second contract to keep in step with the first.
//
// The JSON is the schema itself, so there is nothing to spell and nothing to re-parse. The
// node and mark names below are the ones `editorExtensions.ts` mounts, and a name that drifts
// makes the editor refuse the document loudly rather than silently drop a node.
//
// ⚠️ WHAT IS DELIBERATELY FLATTENED. The editor has no node for a footnote definition, a
// callout or a link reference definition: all three live in the document as ordinary text and
// are given meaning by the renderer (`render/post-content.ts`) or by the block parser on the
// way back in. They are written here the way an author types them, which is what keeps them
// editable — and what keeps a save from inventing syntax the writer never saw.

import type { Block, Document, Inline, ListItem } from './ast'
import { toMarkdown } from './to-markdown'

/** A ProseMirror document, as `setContent` takes it. */
export type EditorNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: EditorNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

type Mark = { type: string; attrs?: Record<string, unknown> }

/** Inline nodes, with the marks that apply to them pushed down onto the text they cover. */
function inlineNodes(nodes: Inline[], marks: Mark[]): EditorNode[] {
  const out: EditorNode[] = []
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        if (node.value !== '') out.push({ type: 'text', text: node.value, ...(marks.length ? { marks } : {}) })
        break
      case 'softbreak':
        // THE NEWLINE ITSELF, kept. ProseMirror has no node for a soft break, but a text node
        // may hold a newline — and that is the difference between a round trip and a rewrite:
        // turning it into a space means `> [!NOTE]\n> Body` saves back as one line, and a
        // callout marker only counts on a line of its own. Inventing a hard break instead
        // would add a line the author never typed.
        out.push({ type: 'text', text: '\n', ...(marks.length ? { marks } : {}) })
        break
      case 'hardbreak':
        out.push({ type: 'hardBreak' })
        break
      case 'code':
        out.push({ type: 'text', text: node.value, marks: [...marks, { type: 'code' }] })
        break
      case 'html':
        // Raw HTML is text in this editor (`Markdown.configure({ html: false })`), and showing
        // it as the characters somebody typed is the honest rendering of that decision.
        out.push({ type: 'text', text: node.value, ...(marks.length ? { marks } : {}) })
        break
      case 'emph':
        out.push(...inlineNodes(node.children, [...marks, { type: 'italic' }]))
        break
      case 'strong':
        out.push(...inlineNodes(node.children, [...marks, { type: 'bold' }]))
        break
      case 'strike':
        out.push(...inlineNodes(node.children, [...marks, { type: 'strike' }]))
        break
      case 'link':
        out.push(...inlineNodes(node.children, [
          ...marks,
          { type: 'link', attrs: { href: node.url, ...(node.title ? { title: node.title } : {}) } },
        ]))
        break
      case 'ink':
        out.push(...inlineNodes(node.children, [...marks, { type: 'ink', attrs: { ink: node.ink ?? 'yellow' } }]))
        break
      case 'underline':
        out.push(...inlineNodes(node.children, [
          ...marks, { type: 'underline', ...(node.ink ? { attrs: { ink: node.ink } } : {}) },
        ]))
        break
      case 'ring':
        out.push(...inlineNodes(node.children, [
          ...marks, { type: 'ring', ...(node.ink ? { attrs: { ink: node.ink } } : {}) },
        ]))
        break
      case 'image':
        out.push({
          type: 'image',
          attrs: {
            src: node.url,
            alt: plainAlt(node.alt),
            ...(node.title ? { title: node.title } : {}),
          },
        })
        break
      case 'math':
        out.push({ type: node.display ? 'mathBlock' : 'mathInline', attrs: { tex: node.value } })
        break
      case 'footnoteRef':
        // No node for it. The author typed `[^1]`; that is what they get back to edit.
        out.push({ type: 'text', text: `[^${node.label}]`, ...(marks.length ? { marks } : {}) })
        break
    }
  }
  return out
}

/** An image's alt text is an attribute, so its inlines flatten to their words. */
function plainAlt(nodes: Inline[]): string {
  return nodes
    .map((n) => (n.type === 'text' ? n.value : 'children' in n ? plainAlt(n.children) : ''))
    .join('')
}

function blockNodes(blocks: Block[]): EditorNode[] {
  const out: EditorNode[] = []
  for (const block of blocks) out.push(...oneBlock(block))
  return out
}

function oneBlock(node: Block): EditorNode[] {
  switch (node.type) {
    case 'paragraph':
      return [{ type: 'paragraph', content: inlineNodes(node.children, []) }]
    case 'heading':
      return [{ type: 'heading', attrs: { level: node.level }, content: inlineNodes(node.children, []) }]
    case 'thematicBreak':
      return [{ type: 'horizontalRule' }]
    case 'codeBlock':
      return [{
        type: 'codeBlock',
        attrs: { language: node.info.split(/\s+/)[0] || null },
        content: node.value === '' ? [] : [{ type: 'text', text: node.value.replace(/\n$/, '') }],
      }]
    case 'htmlBlock':
      return [{ type: 'paragraph', content: [{ type: 'text', text: node.value }] }]
    case 'mathBlock':
      return [{ type: 'mathBlock', attrs: { tex: node.value } }]
    case 'blockquote':
      return [{ type: 'blockquote', content: blockNodes(node.children) }]
    case 'callout':
      // No callout node. It is a blockquote whose first line names the kind, which is exactly
      // what the author wrote and what the renderer looks for.
      return [{
        type: 'blockquote',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: `[!${node.kind}]` }] },
          ...blockNodes(node.children),
        ],
      }]
    case 'list':
      return [listNode(node)]
    case 'table':
      return [tableNode(node)]
    case 'footnoteDef':
      // Written back as the author typed it, on one paragraph, so it stays editable text.
      return [{
        type: 'paragraph',
        content: [{ type: 'text', text: `[^${node.label}]: ${footnoteText(node.children)}` }],
      }]
  }
}

/** A footnote definition's body as source text: it is text in the editor, not structure. */
function footnoteText(blocks: Block[]): string {
  return toMarkdown({ type: 'document', children: blocks }).trim().replace(/\n+/g, ' ')
}

function listNode(node: Extract<Block, { type: 'list' }>): EditorNode {
  const task = node.items.some((item) => item.checked !== null)
  return {
    type: task ? 'taskList' : node.ordered ? 'orderedList' : 'bulletList',
    ...(node.ordered && !task ? { attrs: { start: node.start } } : {}),
    content: node.items.map((item) => itemNode(item, task)),
  }
}

function itemNode(item: ListItem, task: boolean): EditorNode {
  const content = blockNodes(item.children)
  return {
    type: task ? 'taskItem' : 'listItem',
    ...(task ? { attrs: { checked: item.checked === true } } : {}),
    // An empty item still needs a paragraph: ProseMirror's schema requires the content, and a
    // list item with nothing in it is how a writer starts the next line.
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  }
}

function tableNode(node: Extract<Block, { type: 'table' }>): EditorNode {
  const cell = (kind: 'tableHeader' | 'tableCell', children: Inline[], align: string | null): EditorNode => ({
    type: kind,
    attrs: { colspan: 1, rowspan: 1, colwidth: null, ...(align ? { align } : {}) },
    content: [{ type: 'paragraph', content: inlineNodes(children, []) }],
  })
  const rows: EditorNode[] = [{
    type: 'tableRow',
    content: node.head.map((c, i) => cell('tableHeader', c.children, node.align[i] ?? null)),
  }]
  for (const row of node.rows) {
    rows.push({
      type: 'tableRow',
      content: row.map((c, i) => cell('tableCell', c.children, node.align[i] ?? null)),
    })
  }
  return { type: 'table', content: rows }
}

/** A whole document, as `editor.commands.setContent` takes it. */
export function toEditor(doc: Document): EditorNode {
  const content = blockNodes(doc.children)
  // A document may not be empty in this schema, and an editor opened on a new post is exactly
  // that case.
  return { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] }
}
