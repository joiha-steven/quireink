// THE TWENTY-ONE NODES, written out (ADR 0054 step 7).
//
// ⚠️ THE NAMES AND THE ATTRIBUTE NAMES ARE A CONTRACT, not this file's to choose.
// `md/to-editor.ts` builds ProseMirror JSON straight from parsed Markdown and `md/from-editor.ts`
// reads the tree back, and both speak in these exact strings: `bulletList`, `taskItem`,
// `mathInline`, `delim`, `checked`, `align`. That is what made this swap survivable — the
// serializer never depended on the wrapper, only on the shape — and it is what makes a rename
// here a silent data change rather than a compile error. Every name below is the one the
// previous schema had, read off a running editor rather than copied from memory.
import type { NodeSpec } from 'prosemirror-model'
import { attrs } from './schema-marks'

const doc: NodeSpec = { content: 'block+' }

const paragraph: NodeSpec = {
  group: 'block',
  content: 'inline*',
  parseDOM: [{ tag: 'p' }],
  toDOM: () => ['p', 0],
}

const text: NodeSpec = { group: 'inline' }

const heading: NodeSpec = {
  group: 'block',
  content: 'inline*',
  // `defining`, so a paste into an empty heading keeps the heading rather than replacing it
  // with whatever block the clipboard was holding.
  defining: true,
  attrs: { level: { default: 1 } },
  parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, attrs: { level } })),
  toDOM: (node) => [`h${node.attrs.level as number}`, 0],
}

const blockquote: NodeSpec = {
  group: 'block',
  content: 'block+',
  defining: true,
  parseDOM: [{ tag: 'blockquote' }],
  toDOM: () => ['blockquote', 0],
}

/**
 * ⚠️ `marks: ''` IS WHAT MAKES A FENCE A FENCE. Without it a bold run pasted into a code block
 * survives as a mark the serializer then has to write `**` for, inside a fence, where `**` is
 * two asterisks. The empty string means no mark may apply here at all.
 */
const codeBlock: NodeSpec = {
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  attrs: { language: { default: null } },
  parseDOM: [{
    tag: 'pre',
    preserveWhitespace: 'full',
    getAttrs: (dom) => {
      const child = (dom as HTMLElement).firstElementChild
      const cls = child?.getAttribute('class') ?? ''
      const named = /language-(\S+)/.exec(cls)
      return { language: named?.[1] ?? null }
    },
  }],
  toDOM: (node) => ['pre', ['code', attrs({
    class: node.attrs.language ? `language-${node.attrs.language as string}` : null,
  }), 0]],
}

const horizontalRule: NodeSpec = {
  group: 'block',
  parseDOM: [{ tag: 'hr' }],
  toDOM: () => ['hr'],
}

const hardBreak: NodeSpec = {
  group: 'inline',
  inline: true,
  selectable: false,
  parseDOM: [{ tag: 'br' }],
  toDOM: () => ['br'],
}

// `block list` and not just `block`: the list keymap and the two toggle commands ask "is the
// thing I am in a list" by group, so a fourth list kind would join them by saying so here.
const bulletList: NodeSpec = {
  group: 'block list',
  content: 'listItem+',
  parseDOM: [{ tag: 'ul' }],
  toDOM: () => ['ul', 0],
}

const orderedList: NodeSpec = {
  group: 'block list',
  content: 'listItem+',
  attrs: { start: { default: 1 }, type: { default: null } },
  parseDOM: [{
    tag: 'ol',
    getAttrs: (dom) => {
      const el = dom as HTMLElement
      const start = el.getAttribute('start')
      return { start: start ? Number(start) : 1, type: el.getAttribute('type') }
    },
  }],
  toDOM: (node) => ['ol', attrs({
    start: node.attrs.start === 1 ? null : String(node.attrs.start),
    type: node.attrs.type as string | null,
  }), 0],
}

// `paragraph block*` and not `block+`: the first child of a list item must be a paragraph, which
// is what makes Enter inside one split into another item rather than into a bare block.
const listItem: NodeSpec = {
  content: 'paragraph block*',
  defining: true,
  parseDOM: [{ tag: 'li' }],
  toDOM: () => ['li', 0],
}

const taskList: NodeSpec = {
  group: 'block list',
  content: 'taskItem+',
  parseDOM: [{ tag: 'ul[data-type="taskList"]', priority: 60 }],
  toDOM: () => ['ul', { 'data-type': 'taskList' }, 0],
}

/**
 * A GFM checkbox item. The `<label>` wrapper and the `<div>` around the content are the shape
 * `admin.css` styles.
 *
 * ⚠️ THIS `toDOM` IS NOT WHAT THE WRITER CLICKS ON. A task item has a node view
 * (`editor/views/task-item.ts`), and that is where the checkbox becomes a working control —
 * `contenteditable="false"` on it, and a listener that writes the new state into the document.
 * What is here is the CLIPBOARD's copy and the one a paste parses back, so it stays exactly as
 * it was rather than gaining an attribute nothing on this path reads.
 */
const taskItem: NodeSpec = {
  content: 'paragraph block*',
  defining: true,
  attrs: { checked: { default: false } },
  parseDOM: [{
    tag: 'li[data-type="taskItem"]',
    priority: 60,
    getAttrs: (dom) => ({ checked: (dom as HTMLElement).getAttribute('data-checked') === 'true' }),
  }],
  toDOM: (node) => [
    'li',
    { 'data-type': 'taskItem', 'data-checked': String(Boolean(node.attrs.checked)) },
    ['label', ['input', attrs({
      type: 'checkbox',
      checked: node.attrs.checked ? 'checked' : null,
    })], ['span']],
    ['div', 0],
  ],
}

/**
 * A picture. Five attributes and no more: the frame, the size, the alignment and the grid ride
 * in the URL's fragment (`image-frag.ts`), which is what lets the same `![](…#wide)` mean the
 * same thing to the reader's renderer and to this editor without a second vocabulary.
 */
const image: NodeSpec = {
  group: 'block',
  inline: false,
  draggable: true,
  attrs: {
    src: { default: null }, alt: { default: null }, title: { default: null },
    width: { default: null }, height: { default: null },
  },
  // `:not([src^="data:"])`, which the previous schema also carried: a base64 picture pasted
  // from a screenshot tool would otherwise be written into the post's Markdown as a megabyte
  // of characters. Uploading is how a picture gets into a piece.
  parseDOM: [{
    tag: 'img[src]:not([src^="data:"])',
    getAttrs: (dom) => {
      const el = dom as HTMLElement
      return {
        src: el.getAttribute('src'), alt: el.getAttribute('alt'), title: el.getAttribute('title'),
        width: el.getAttribute('width'), height: el.getAttribute('height'),
      }
    },
  }],
  toDOM: (node) => ['img', attrs({
    src: node.attrs.src as string | null, alt: node.attrs.alt as string | null,
    title: node.attrs.title as string | null,
    width: node.attrs.width as string | null, height: node.attrs.height as string | null,
  })],
}

const video: NodeSpec = {
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  attrs: { src: { default: '' } },
  parseDOM: [{
    tag: 'div[data-video]',
    getAttrs: (dom) => ({ src: (dom as HTMLElement).getAttribute('data-src') || '' }),
  }],
  toDOM: (node) => ['div', { 'data-video': '', 'data-src': node.attrs.src as string }],
}

/** `delim` remembers whether the author wrote `$…$` or `\(…\)`, so a save gives it back. */
const mathAttrs = (display: boolean) => ({
  tex: { default: '' }, display: { default: display }, delim: { default: 'dollar' },
})
const mathParse = (tag: string) => [{
  tag,
  getAttrs: (dom: globalThis.Node | string) => {
    const el = dom as HTMLElement
    return {
      tex: el.getAttribute('data-tex') ?? '',
      display: el.getAttribute('data-math') === 'block',
      delim: el.getAttribute('data-delim') ?? 'dollar',
    }
  },
}]

const mathInline: NodeSpec = {
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  attrs: mathAttrs(false),
  parseDOM: mathParse('span[data-math]'),
  toDOM: (node) => ['span', {
    'data-math': 'inline', 'data-tex': node.attrs.tex as string, 'data-delim': node.attrs.delim as string,
  }],
}

const mathBlock: NodeSpec = {
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  attrs: mathAttrs(true),
  parseDOM: mathParse('div[data-math]'),
  toDOM: (node) => ['div', {
    'data-math': 'block', 'data-tex': node.attrs.tex as string, 'data-delim': node.attrs.delim as string,
  }],
}

/**
 * ⚠️ `tableRole` IS NOT DECORATION. `prosemirror-tables` finds the four node types by that field
 * and by nothing else — its commands, its cell selection and its own keymap all go looking for
 * `tableRole: 'cell'` rather than for a name. The names stay camelCase because
 * `md/from-editor.ts` reads them.
 *
 * `align` is a fifth attribute that `prosemirror-tables` knows nothing about and the serializer
 * depends on: a table written with `| :--- | ---: |` loses every column's alignment on the first
 * save without it.
 *
 * ⚠️ AND IT IS RENDERED, which a first cut of this file got wrong and said so in a comment:
 * "the writing surface has never shown alignment". Measured against the outgoing build,
 * 2026-09-15: it always has — the package's cell carried
 * `renderHTML: attrs.align ? { style: `text-align: …` } : {}`, so a writer with a right-aligned
 * column of numbers saw it right-aligned while writing. Dropping it changed nothing about the
 * file and everything about what the writer looks at, which is the worst shape a regression can
 * have: the save is identical, so no round-trip test could see it.
 */
const cellAttrs = {
  colspan: { default: 1 }, rowspan: { default: 1 },
  colwidth: { default: null }, align: { default: null },
}
const cellParse = (tag: string) => [{
  tag,
  getAttrs: (dom: globalThis.Node | string) => {
    const el = dom as HTMLElement
    const widths = el.getAttribute('data-colwidth')
    const styled = /text-align:\s*(left|center|right)/.exec(el.getAttribute('style') ?? '')
    return {
      colspan: Number(el.getAttribute('colspan') ?? 1),
      rowspan: Number(el.getAttribute('rowspan') ?? 1),
      colwidth: widths && /^\d+(,\d+)*$/.test(widths) ? widths.split(',').map(Number) : null,
      align: el.getAttribute('data-align') ?? styled?.[1] ?? null,
    }
  },
}]
// `colspan` and `rowspan` are written even when they are 1, which is what the previous schema
// did. Both forms are the same table to a browser — 1 is the HTML default — and writing them
// keeps the clipboard's HTML identical to what it was, which is the one place the difference
// could have been observed.
const cellDOM = (tag: string): NodeSpec['toDOM'] => (node) => [tag, attrs({
  colspan: String(node.attrs.colspan),
  rowspan: String(node.attrs.rowspan),
  'data-colwidth': (node.attrs.colwidth as number[] | null)?.join(',') ?? null,
  style: node.attrs.align ? `text-align: ${String(node.attrs.align)}` : null,
}), 0]

const table: NodeSpec = {
  group: 'block',
  content: 'tableRow+',
  tableRole: 'table',
  isolating: true,
  parseDOM: [{ tag: 'table' }],
  toDOM: () => ['table', ['tbody', 0]],
}

const tableRow: NodeSpec = {
  content: '(tableCell | tableHeader)*',
  tableRole: 'row',
  parseDOM: [{ tag: 'tr' }],
  toDOM: () => ['tr', 0],
}

const tableHeader: NodeSpec = {
  content: 'block+',
  tableRole: 'header_cell',
  isolating: true,
  attrs: cellAttrs,
  parseDOM: cellParse('th'),
  toDOM: cellDOM('th'),
}

const tableCell: NodeSpec = {
  content: 'block+',
  tableRole: 'cell',
  isolating: true,
  attrs: cellAttrs,
  parseDOM: cellParse('td'),
  toDOM: cellDOM('td'),
}

/** In the order the previous schema had them. Order decides parse precedence on a tie. */
export const NODES: Record<string, NodeSpec> = {
  paragraph, blockquote, bulletList, codeBlock, doc, hardBreak, heading, horizontalRule,
  listItem, orderedList, text, image, video, mathInline, mathBlock,
  table, tableRow, tableHeader, tableCell, taskList, taskItem,
}
