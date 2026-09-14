// Somebody else's HTML, as this blog's own syntax tree.
//
// The other half of retiring `turndown`, and the half that is better rather than merely ours.
// That library converts HTML to generic Markdown and stops there. This builds the SAME tree
// `src/md` parses into, so `to-markdown.ts` writes it out in the dialect the editor and the
// reader already speak, with one serialiser instead of two opinions about how a table or a
// nested list is spelled.
//
// WHAT THE OLD PIPE LOST, and this keeps:
//
//   <mark>  a highlight, which turndown had no rule for, so the tag was dropped and the
//           sentence came in flat. It is the pen: `==text==`.
//   <u>     the same story, and the same answer: `++text++`.
//   <del>   turndown needed the GFM plugin for this one. It is in the tree already.
//
// WHITESPACE IS THE FIDDLY PART. HTML collapses runs of it and Markdown does not, so every
// inline run is collapsed to single spaces and then trimmed at the edges of its block. Inside
// `<pre>` nothing is touched, because there the whitespace is the content.
import type { Align, Block, Inline, ListItem } from '@/md/ast'
import { type HtmlNode, textOf } from './html-parse'

/** An `HtmlNode` that is known to be an element. The helpers below are only ever given one. */
type Element = Extract<HtmlNode, { type: 'element' }>

const HEADING: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6,
}

/** Wrappers that carry no meaning of their own: their children become the parent's. */
const TRANSPARENT = new Set([
  'div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'body', 'html',
  'form', 'fieldset', 'details', 'summary', 'center', 'font', 'span', 'tbody', 'thead',
  'tfoot', 'colgroup', 'picture', 'ins', 'small', 'abbr', 'time', 'label', 'legend',
])

const collapse = (text: string): string => text.replace(/\s+/g, ' ')

/** Drops the space either end of a run, which HTML had and Markdown would make literal. */
function trimEdges(nodes: Inline[]): Inline[] {
  const out = [...nodes]
  for (const end of ['start', 'end'] as const) {
    for (;;) {
      const at = end === 'start' ? 0 : out.length - 1
      const node = out[at]
      if (!node) break
      if (node.type === 'text') {
        const value = end === 'start' ? node.value.replace(/^ +/, '') : node.value.replace(/ +$/, '')
        if (value === '') { out.splice(at, 1); continue }
        out[at] = { ...node, value }
      }
      break
    }
  }
  return out
}

/** `text-align` from either spelling a platform uses, or nothing. */
function alignOf(node: HtmlNode): Align | null {
  if (node.type !== 'element') return null
  const stated = node.attrs.align ?? /text-align:\s*(left|center|right)/i.exec(node.attrs.style ?? '')?.[1]
  const word = stated?.toLowerCase()
  return word === 'left' || word === 'center' || word === 'right' ? word : null
}

const childrenOf = (node: HtmlNode): HtmlNode[] => (node.type === 'element' ? node.children : [])

const find = (nodes: readonly HtmlNode[], tag: string): HtmlNode | undefined => {
  for (const node of nodes) {
    if (node.type !== 'element') continue
    if (node.tag === tag) return node
    const deeper = find(node.children, tag)
    if (deeper) return deeper
  }
  return undefined
}

const every = (nodes: readonly HtmlNode[], tag: string): HtmlNode[] =>
  nodes.flatMap((node) =>
    node.type !== 'element' ? [] : node.tag === tag ? [node] : every(node.children, tag),
  )

// ----- inline ---------------------------------------------------------------------------

function inlines(nodes: readonly HtmlNode[]): Inline[] {
  const out: Inline[] = []
  for (const node of nodes) {
    if (node.type === 'text') {
      const value = collapse(node.value)
      if (value !== '') out.push({ type: 'text', value })
      continue
    }
    const kids = node.children
    switch (node.tag) {
      case 'br':
        out.push({ type: 'hardbreak' })
        break
      case 'em':
      case 'i':
      case 'cite':
      case 'var':
        out.push({ type: 'emph', children: inlines(kids) })
        break
      case 'strong':
      case 'b':
        out.push({ type: 'strong', children: inlines(kids) })
        break
      case 'del':
      case 's':
      case 'strike':
        out.push({ type: 'strike', children: inlines(kids) })
        break
      // `raw` is what the parser fills in from the source it read, and the serialiser never
      // looks at it. A tree that is only written out has nothing to put there.
      case 'mark':
        out.push({ type: 'ink', raw: '', children: inlines(kids) })
        break
      case 'u':
        out.push({ type: 'underline', raw: '', children: inlines(kids) })
        break
      case 'code':
      case 'kbd':
      case 'samp':
        out.push({ type: 'code', value: collapse(textOf(kids)).trim() })
        break
      case 'a': {
        const url = node.attrs.href ?? ''
        const children = trimEdges(inlines(kids))
        // An anchor with no destination is not a link, it is a name tag a plugin left behind.
        if (!url || url.startsWith('#')) out.push(...children)
        else out.push({ type: 'link', url, ...(node.attrs.title ? { title: node.attrs.title } : {}), children })
        break
      }
      case 'img': {
        // `data-src` as well: every lazy-loading plugin moves the real URL there and leaves a
        // placeholder in `src`, and importing the placeholder imports a grey square.
        const url = node.attrs.src ?? node.attrs['data-src'] ?? ''
        const title = node.attrs.title
        if (url) {
          out.push({ type: 'image', url, ...(title ? { title } : {}), alt: altOf(node.attrs.alt ?? '') })
        }
        break
      }
      case 'sub':
      case 'sup':
        // No Markdown for these, and the text still says what it said.
        out.push(...inlines(kids))
        break
      default:
        out.push(...inlines(kids))
    }
  }
  return out
}

const altOf = (alt: string): Inline[] => {
  const value = collapse(alt).replace(/[[\]]/g, '').trim()
  return value ? [{ type: 'text', value }] : []
}

// ----- blocks ---------------------------------------------------------------------------

/** True when this element is one that starts a block, rather than text inside one. */
function isBlock(node: HtmlNode): boolean {
  if (node.type !== 'element') return false
  if (TRANSPARENT.has(node.tag)) return node.children.some(isBlock)
  return node.tag in HEADING || BLOCK_TAGS.has(node.tag)
}

const BLOCK_TAGS = new Set([
  'p', 'ul', 'ol', 'blockquote', 'pre', 'hr', 'table', 'figure', 'dl', 'li',
])

/**
 * A run of nodes as blocks.
 *
 * Anything that is not a block becomes one paragraph with whatever sits beside it, which is how
 * a bare sentence between two `<div>`s survives.
 */
function blocks(nodes: readonly HtmlNode[]): Block[] {
  const out: Block[] = []
  let loose: HtmlNode[] = []
  const flush = (): void => {
    const children = trimEdges(inlines(loose))
    loose = []
    if (children.length) out.push({ type: 'paragraph', children })
  }

  for (const node of nodes) {
    if (!isBlock(node)) {
      loose.push(node)
      continue
    }
    flush()
    out.push(...oneBlock(node))
  }
  flush()
  return out
}

function oneBlock(node: HtmlNode): Block[] {
  if (node.type !== 'element') return []
  const kids = node.children
  if (TRANSPARENT.has(node.tag)) return blocks(kids)

  const level = HEADING[node.tag]
  if (level) {
    const children = trimEdges(inlines(kids))
    return children.length ? [{ type: 'heading', level, children }] : []
  }

  switch (node.tag) {
    case 'p':
    case 'li':
    case 'dd':
    case 'dt': {
      const children = trimEdges(inlines(kids))
      return children.length ? [{ type: 'paragraph', children }] : []
    }
    case 'hr':
      return [{ type: 'thematicBreak' }]
    case 'blockquote':
      return [{ type: 'blockquote', children: blocks(kids) }]
    case 'pre':
      return [codeBlock(node)]
    case 'ul':
    case 'ol':
      return [list(node)]
    case 'dl':
      return blocks(kids)
    case 'table':
      return [table(node)]
    case 'figure':
      return figure(node)
    default:
      return blocks(kids)
  }
}

/** `<pre>`, with the language read off the `<code>` inside it when a platform wrote one. */
function codeBlock(node: Element): Block {
  const code = find(node.children, 'code')
  const classes = code?.type === 'element' ? (code.attrs.class ?? '') : ''
  const info = /(?:language|lang|brush:)[-\s]?([a-z0-9+#]+)/i.exec(classes)?.[1] ?? ''
  const body = textOf(code ? childrenOf(code) : node.children)
  return { type: 'codeBlock', info: info.toLowerCase(), value: body.replace(/\n+$/, '') }
}

function list(node: Element): Block {
  const ordered = node.tag === 'ol'
  const start = Number(node.attrs.start ?? '1') || 1
  const items: ListItem[] = []
  for (const child of node.children) {
    if (child.type !== 'element' || child.tag !== 'li') continue
    const box = find(child.children, 'input')
    const checked =
      box?.type === 'element' && (box.attrs.type ?? '').toLowerCase() === 'checkbox'
        ? 'checked' in box.attrs
        : null
    items.push({ children: blocks(child.children), checked })
  }
  // THE SAME RULE AS `md/from-editor.ts`, deliberately, because it is the same question asked
  // of a different tree and the two answers must not drift. A sub-list does not make its parent
  // loose; anything else in an item — a second paragraph, a code block, a quote — means blank
  // lines were written around it. That file carries the two fixtures that disagree.
  const tight = items.every((item) => {
    const prose = item.children.filter((b) => b.type === 'paragraph').length
    const other = item.children.filter((b) => b.type !== 'paragraph' && b.type !== 'list').length
    return prose <= 1 && other === 0
  })
  return { type: 'list', ordered, start, tight, items }
}

function table(node: Element): Block {
  const rows = every(node.children, 'tr')
  const cells = (row: HtmlNode): HtmlNode[] =>
    childrenOf(row).filter((c) => c.type === 'element' && (c.tag === 'td' || c.tag === 'th'))
  const asCells = (row: HtmlNode) => cells(row).map((c) => ({ children: trimEdges(inlines(childrenOf(c))) }))

  // The first row is the header when it holds any `<th>`, and otherwise the table has none and
  // its first row has to become one: GFM has no headerless table.
  const first = rows[0]
  const head = first ? asCells(first) : []
  const align = first ? cells(first).map(alignOf) : []
  return { type: 'table', align, head, rows: rows.slice(1).map(asCells) }
}

/**
 * `<figure>`, which every platform uses and none of them the same way.
 *
 * A gallery is a figure of figures. Reading the FIRST `<img>` out of one and calling that the
 * picture is what the old rule did, and one imported page lost 139 of its 169 photographs; the
 * images are tagged `#grid` instead, which is how this product regroups a run of them.
 */
function figure(node: Element): Block[] {
  const gallery =
    (node.attrs.class ?? '').includes('gallery') || every(node.children, 'img').length > 1
  if (gallery) {
    const images = every(node.children, 'img').flatMap((img) =>
      img.type === 'element' && (img.attrs.src ?? img.attrs['data-src'])
        ? [
            {
              type: 'image' as const,
              url: `${img.attrs.src ?? img.attrs['data-src']}#grid`,
              alt: altOf(img.attrs.alt ?? ''),
            },
          ]
        : [],
    )
    return images.length ? [{ type: 'paragraph', children: images }] : blocks(node.children)
  }

  const img = find(node.children, 'img')
  if (!img || img.type !== 'element') return blocks(node.children)
  const url = img.attrs.src ?? img.attrs['data-src'] ?? ''
  if (!url) return blocks(node.children)
  // The caption folds INTO the alt, because a figure caption here is rendered from the alt.
  // Left alone it became a separate italic paragraph under the picture.
  const caption = find(node.children, 'figcaption')
  const text = caption ? textOf(childrenOf(caption)) : (img.attrs.alt ?? '')
  return [{ type: 'paragraph', children: [{ type: 'image', url, alt: altOf(text) }] }]
}

/** An exported post's HTML, as the tree `to-markdown.ts` writes out. */
export function fromHtml(nodes: readonly HtmlNode[]): Block[] {
  return blocks(nodes)
}
