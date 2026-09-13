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
        // ⚠️ A CODE SPAN CARRIES NOTHING ELSE, and that is the schema's rule rather than a
        // choice here: StarterKit's `code` mark is `excludes: '_'`, so it excludes every other
        // mark, and `InkMark.ts` records the consequence as an accepted limit — a stroke drawn
        // across `mã` ends where the code begins.
        //
        // Building the document with both anyway is worse than the limit. `nodeFromJSON` does
        // not enforce exclusions, so the marks would survive being loaded and then be stripped
        // by the first edit that touched the paragraph — which makes what a SAVE writes depend
        // on whether the writer happened to click there. A limit is a limit; a document the
        // editor cannot hold is a file that changes on its own.
        if (node.value !== '') out.push({ type: 'text', text: node.value, marks: [{ type: 'code' }] })
        break
      case 'html':
        // Raw HTML is text in this editor (`Markdown.configure({ html: false })`), and showing
        // it as the characters somebody typed is the honest rendering of that decision.
        if (node.value !== '') out.push({ type: 'text', text: node.value, ...(marks.length ? { marks } : {}) })
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
      // ⚠️ AN INLINE NODE CARRIES THE MARKS TOO. Dropping them here is not a formatting wobble:
      // `[$x^2$](https://a.test)` is a link whose whole label is a formula, and a maths node
      // built without the link mark arrives in the editor as a formula with NO LINK — the URL
      // is gone from the document before the writer has touched anything, and the next save
      // writes it out of the file. The marks are already computed; they just have to be given.
      case 'image':
        out.push({
          type: 'image',
          attrs: {
            src: node.url,
            alt: plainAlt(node.alt),
            ...(node.title ? { title: node.title } : {}),
          },
          ...(marks.length ? { marks } : {}),
        })
        break
      case 'math':
        // ⚠️ ALWAYS `mathInline` HERE, WHATEVER `display` SAYS, and reading `display` instead
        // deleted a formula. `$$…$$` written in the MIDDLE of a paragraph is display maths in an
        // inline position — this blog has one, wrapped in bidi control characters that stop the
        // block parser claiming the line — and `mathBlock` is `group: 'block'`, so ProseMirror
        // refused it inside the paragraph and dropped the node. The whole equation was gone from
        // the document before the writer saw it, and the next save wrote it out of the file.
        //
        // `display` rides on the attribute, which is what it is for: `MathNode.tsx` renders an
        // inline node as display maths when the attribute says so. `oneBlock` builds the block
        // node for a formula that stood on its own line.
        //
        // `delim` rides along for the same reason — it is the only record of which of the four
        // spellings the author typed, and without it a save rewrites `\(a\)` as `$a$`.
        out.push({
          type: 'mathInline',
          attrs: { tex: node.value, display: node.display, delim: node.delim },
          ...(marks.length ? { marks } : {}),
        })
        break
      case 'footnoteRef':
        // No node for it. The author typed `[^1]`; that is what they get back to edit.
        out.push({ type: 'text', text: `[^${node.label}]`, ...(marks.length ? { marks } : {}) })
        break
    }
  }
  return out
}

/**
 * A text node, or nothing — because ProseMirror forbids an EMPTY one.
 *
 * Not defensiveness: `""` is a document ProseMirror refuses to build, so a single empty string
 * anywhere costs the whole post, not the node it was in. Every place that puts raw text into
 * the document goes through this.
 */
function text(value: string): EditorNode[] {
  return value === '' ? [] : [{ type: 'text', text: value }]
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

/**
 * A picture that IS the paragraph, lifted out of it.
 *
 * ⚠️ THE IMAGE IS A BLOCK NODE HERE. `CaptionedImage` extends Tiptap's `Image`, which is
 * `group: 'block'`, while Markdown has only one shape for a picture and it is inline. Left
 * inside the paragraph, ProseMirror draws `<p>` around a block `<div>` and then has to keep a
 * text position alive beside it — a `ProseMirror-separator` image and a trailing `<br>`. Both
 * are real layout: a blank line under every picture, in the writing pane only.
 *
 * MEASURED IN CHROME on this blog's own post, same post and same database on both builds
 * (2026-09-14): the image at top level is a 542px node, the same image inside a paragraph is a
 * 588px one. Forty-six pixels under every picture in the piece.
 *
 * The bridge this replaced never met it: it went through HTML, and ProseMirror's DOM parser
 * lifts a block node out of a paragraph on the way in. Building the JSON directly means doing
 * the lift here.
 *
 * ⚠️ ONLY WHEN THE IMAGE IS THE WHOLE PARAGRAPH, and the narrowness is the point. A picture
 * written mid-sentence — `text ![a](b) text` — is ONE paragraph on the reader's page, and
 * splitting it into three blocks changes that page. `golden/corpus/reference-links.md` says so
 * in two suites: the save law is that a page may not change, and it outranks the layout of the
 * writing pane. So that rarer shape keeps the blank line, and keeps the page. None of this
 * blog's 92 posts writes one; every picture in all of them stands on its own line.
 */
function liftLoneImage(inline: EditorNode[]): EditorNode[] {
  if (inline.length === 1 && inline[0].type === 'image') return [inline[0]]
  return [{ type: 'paragraph', content: inline }]
}

function oneBlock(node: Block): EditorNode[] {
  switch (node.type) {
    case 'paragraph':
      return liftLoneImage(inlineNodes(node.children, []))
    case 'heading':
      return [{ type: 'heading', attrs: { level: node.level }, content: inlineNodes(node.children, []) }]
    case 'thematicBreak':
      return [{ type: 'horizontalRule' }]
    case 'codeBlock':
      return [{
        type: 'codeBlock',
        attrs: { language: node.info.split(/\s+/)[0] || null },
        // ⚠️ THE EMPTINESS IS TESTED AFTER THE TRAILING NEWLINE COMES OFF, and testing it
        // before was a way to lose a block. A fence holding one blank line has `value` of
        // `"\n"` — not empty — so the old test took the other branch and built a text node
        // holding `""`. ProseMirror forbids an empty text node outright, so the document was
        // refused and ```` ```bash ```` with nothing in it opened as no code block at all.
        content: text(node.value.replace(/\n$/, '')),
      }]
    case 'htmlBlock':
      // ⚠️ THE INDENTATION COMES OFF HERE, ON PURPOSE, and it is the choice between losing it
      // once and losing it later. Raw HTML is text in this editor, so the block arrives as a
      // PARAGRAPH — and a paragraph cannot carry leading spaces on its continuation lines;
      // every Markdown parser strips them. Left in, they survive the first save and vanish on
      // the second, so `golden/corpus/raw-html-block.md` published one thing, then another,
      // then held. A file that changes on its own is the failure this engine was built against.
      //
      // Nothing a reader sees moves: the page shows this as text, and HTML collapses a run of
      // whitespace to one space whether or not it is there.
      return [{
        type: 'paragraph',
        content: text(node.value.split('\n').map((l) => l.replace(/^[ \t]+/, '')).join('\n')),
      }]
    case 'mathBlock':
      return [{ type: 'mathBlock', attrs: { tex: node.value, display: true, delim: node.delim } }]
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
      return listNodes(node)
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

/**
 * A list, SPLIT INTO RUNS of one kind, because this schema has two list nodes and Markdown has
 * one.
 *
 * ⚠️ `- một / - hai / - [x] ba` IS ONE LIST IN MARKDOWN and three items of two kinds here: a
 * `taskList` may hold only `taskItem`s and a `bulletList` only `listItem`s. Reading the whole
 * list as tasks because one item has a box turns the two bullets into EMPTY CHECKBOXES — a post
 * gains boxes nobody wrote — and reading it as bullets throws the box away.
 *
 * The old bridge repaired this in the HTML between markdown-it and the schema
 * (`admin/components/MixedList.ts`); there is no HTML in the middle any more, so the split
 * belongs here. Same answer as that file's: a run of boxes becomes a `taskList`, a run of
 * plain items a plain list, in the order written. It is a fixed point — `to-markdown.ts` puts
 * a blank line between two adjacent lists, which is what Markdown needs to keep them apart.
 */
function listNodes(node: Extract<Block, { type: 'list' }>): EditorNode[] {
  const out: EditorNode[] = []
  let i = 0
  let start = node.start
  while (i < node.items.length) {
    const task = node.items[i]!.checked !== null
    let end = i + 1
    while (end < node.items.length && (node.items[end]!.checked !== null) === task) end += 1
    const run = node.items.slice(i, end)
    out.push({
      type: task ? 'taskList' : node.ordered ? 'orderedList' : 'bulletList',
      ...(node.ordered && !task ? { attrs: { start } } : {}),
      content: run.map((item) => itemNode(item, task)),
    })
    // An ordered list split in two keeps counting: items 4 and 5 of one list are still 4 and 5.
    if (!task) start += run.length
    i = end
  }
  return out
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
