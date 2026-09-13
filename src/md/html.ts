// The tree, as the reader's page.
//
// One of five renderers over `ast.ts`, and the first because it is the one the spec measures:
// every example in `spec/` is a pair of Markdown and the HTML it must produce, so this file
// is where the engine's answer becomes checkable.
//
// IT MATCHES THE SPEC'S OUTPUT EXACTLY, whitespace included — `<li>\n<p>` rather than
// `<li><p>` where CommonMark says so. That looks like pedantry and is the opposite: a
// renderer allowed to be "equivalent" needs a human to judge every difference, and 676
// judgements is not a test. Byte equality is a test.

import type { Block, Document, Inline, ListItem } from './ast'
import { resolveEntities } from './entity'

/** The five characters that cannot appear raw in HTML text, escaped the way the spec does. */
export function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * A URL in an `href` or `src`.
 *
 * Percent-encoding is the spec's, not `encodeURI`'s: CommonMark leaves an already-encoded
 * triplet alone and encodes the rest, which `encodeURI` does not do — it would turn `%41`
 * into `%2541` and silently break every link that carries an encoded character.
 */
export function escapeUrl(url: string): string {
  let out = ''
  for (let i = 0; i < url.length; i++) {
    const ch = url[i]!
    if (ch === '%' && /^[0-9a-fA-F]{2}/.test(url.slice(i + 1, i + 3))) {
      out += url.slice(i, i + 3)
      i += 2
      continue
    }
    // `[` and `]` are NOT in this set. They are legal in a URL only inside a host literal,
    // and CommonMark percent-encodes them everywhere else — `example.com/\[` becomes `%5B`.
    if (/[a-zA-Z0-9\-_.~!*'();:@&=+$,/?#]/.test(ch)) {
      out += ch === '&' ? '&amp;' : ch
      continue
    }
    out += [...new TextEncoder().encode(ch)].map((b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join('')
  }
  return out
}

/**
 * The tags GFM refuses to pass through, whatever the source says.
 *
 * Not a formatting rule — a safety one. `<title>` and `<style>` rewrite the page around them,
 * `<script>` and `<iframe>` run code, and `<textarea>` and `<xmp>` swallow everything after
 * them as text. A blog that renders other people's Markdown lets none of them through, so the
 * `<` is escaped and the tag arrives as the words somebody typed.
 */
const DISALLOWED = /<(\/?)(title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(?=[\s/>])/gi

/**
 * WHETHER TO FILTER IS A SETTING, and the two specs are why.
 *
 * GFM escapes these tags; CommonMark passes them through, and six of its examples check that
 * it does. Both are right about their own document, so the engine does both and the caller
 * says which — `spec.test.ts` measures each spec under its own rule, and the product runs with
 * the filter ON, because a blog that renders imported Markdown is exactly the case GFM wrote
 * the rule for.
 */
let filtering = true

export function setHtmlFiltering(on: boolean): void {
  filtering = on
}

function filterHtml(value: string): string {
  if (!filtering) return value
  return value.replace(DISALLOWED, (_m, slash: string, tag: string) => `&lt;${slash}${tag}`)
}

function attr(name: string, value: string | undefined): string {
  return value === undefined ? '' : ` ${name}="${escapeText(value)}"`
}

// ----- inline ---------------------------------------------------------------------------

export function inlineToHtml(nodes: Inline[]): string {
  let out = ''
  for (const node of nodes) out += oneInline(node)
  return out
}

function oneInline(node: Inline): string {
  switch (node.type) {
    case 'text':
      return escapeText(node.value)
    case 'softbreak':
      return '\n'
    case 'hardbreak':
      return '<br />\n'
    case 'code':
      return `<code>${escapeText(node.value)}</code>`
    case 'html':
      return filterHtml(node.value)
    case 'emph':
      return `<em>${inlineToHtml(node.children)}</em>`
    case 'strong':
      return `<strong>${inlineToHtml(node.children)}</strong>`
    case 'strike':
      return `<del>${inlineToHtml(node.children)}</del>`
    case 'link':
      return `<a href="${escapeUrl(node.url)}"${attr('title', node.title)}>${inlineToHtml(node.children)}</a>`
    case 'image':
      // The alt text is the tree's inlines FLATTENED to their words: an `alt` attribute holds
      // text, so `![a *b*](x)` is `alt="a b"`, which is what the spec's examples show.
      return `<img src="${escapeUrl(node.url)}" alt="${escapeText(plainOf(node.alt))}"${attr('title', node.title)} />`
    case 'ink':
      return node.ink && node.ink !== 'yellow'
        ? `<mark data-ink="${escapeText(node.ink)}">${inlineToHtml(node.children)}</mark>`
        : `<mark>${inlineToHtml(node.children)}</mark>`
    case 'underline':
      return `<u>${inlineToHtml(node.children)}</u>`
    case 'ring':
      return `<mark data-form="o">${inlineToHtml(node.children)}</mark>`
    case 'math':
      // Left for `src/render/math.ts`, which owns the TeX-to-MathML step and its cache.
      return `<span class="math-inline">${escapeText(node.value)}</span>`
    case 'footnoteRef':
      return `<sup class="footnote-ref"><a href="#fn-${escapeText(node.label)}">${escapeText(node.label)}</a></sup>`
  }
}

/** Inlines as their words alone, for an `alt` attribute and for the plain-text renderer. */
export function plainOf(nodes: Inline[]): string {
  let out = ''
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
      case 'code':
      case 'math':
        out += node.value
        break
      case 'softbreak':
      case 'hardbreak':
        out += '\n'
        break
      case 'html':
        break
      case 'image':
        out += plainOf(node.alt)
        break
      case 'footnoteRef':
        break
      default:
        out += plainOf(node.children)
    }
  }
  return out
}

// ----- blocks ---------------------------------------------------------------------------

export function toHtml(doc: Document): string {
  return blocksToHtml(doc.children)
}

export function blocksToHtml(blocks: Block[]): string {
  let out = ''
  for (const block of blocks) out += oneBlock(block)
  return out
}

function oneBlock(node: Block): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${inlineToHtml(node.children)}</p>\n`
    case 'heading':
      return `<h${node.level}>${inlineToHtml(node.children)}</h${node.level}>\n`
    case 'thematicBreak':
      return '<hr />\n'
    case 'codeBlock': {
      // The info string's FIRST WORD is the language, and only that word reaches the class.
      const lang = node.info.split(/\s+/)[0] ?? ''
      const cls = lang ? ` class="language-${escapeText(unescapeInfo(lang))}"` : ''
      return `<pre><code${cls}>${escapeText(node.value)}</code></pre>\n`
    }
    case 'htmlBlock':
      return `${filterHtml(node.value)}\n`
    case 'blockquote':
      return `<blockquote>\n${blocksToHtml(node.children)}</blockquote>\n`
    case 'list':
      return listToHtml(node)
    case 'mathBlock':
      return `<div class="math-block">${escapeText(node.value)}</div>\n`
    case 'table':
      return tableToHtml(node)
    case 'footnoteDef':
      return `<section class="footnote" id="fn-${escapeText(node.label)}">\n${blocksToHtml(node.children)}</section>\n`
    case 'callout':
      return `<blockquote class="callout callout-${escapeText(node.kind.toLowerCase())}">\n${blocksToHtml(node.children)}</blockquote>\n`
  }
}

/** An info string is source text: its escapes AND its entities resolve before it names a class. */
function unescapeInfo(info: string): string {
  return resolveEntities(info.replace(/\\([!-/:-@[-`{-~])/g, '$1'))
}

function listToHtml(node: Extract<Block, { type: 'list' }>): string {
  const open = node.ordered
    ? `<ol${node.start !== 1 ? ` start="${node.start}"` : ''}>`
    : '<ul>'
  const close = node.ordered ? '</ol>' : '</ul>'
  let out = `${open}\n`
  for (const item of node.items) out += itemToHtml(item, node.tight)
  return `${out}${close}\n`
}

/**
 * A list item, and the one place the tight/loose distinction shows.
 *
 * In a TIGHT list a paragraph loses its `<p>` — the list reads as one run of short things —
 * and in a loose list it keeps it. The decision belongs to the list, not the item, which is
 * why `tight` is passed down rather than stored on each item.
 */
function itemToHtml(item: ListItem, tight: boolean): string {
  // The attribute order is GFM's, not ours: `checked`, then `disabled`, then `type`, and no
  // self-closing slash. Byte equality against the spec is the test, so the shape is copied.
  const check = item.checked === null
    ? ''
    : `<input ${item.checked ? 'checked="" ' : ''}disabled="" type="checkbox"> `

  if (tight) {
    let inner = ''
    item.children.forEach((block, i) => {
      if (block.type === 'paragraph') {
        inner += inlineToHtml(block.children)
        // A paragraph that has a block after it still needs the line break it lost with its
        // `<p>`, or the list that follows starts on the same line as the words above it.
        if (i < item.children.length - 1) inner += '\n'
      } else {
        inner += oneBlock(block)
      }
    })
    // `<li>` is followed by a newline unless the item opens with words. `<li>foo` but
    // `<li>\n<pre>` — the spec draws that distinction and five examples turn on it.
    // An EMPTY item is `<li></li>`, not `<li>\n</li>`. Four examples, and the missing case was
    // `children[0]` being undefined falling through to the newline branch.
    const lead = item.children.length === 0 || item.children[0]?.type === 'paragraph' ? '' : '\n'
    return `<li>${check}${lead}${inner}</li>\n`
  }
  if (item.children.length === 0) return '<li></li>\n'
  return `<li>\n${check}${blocksToHtml(item.children)}</li>\n`
}

function tableToHtml(node: Extract<Block, { type: 'table' }>): string {
  const cell = (tag: string, content: string, align: string | null): string =>
    `<${tag}${align ? ` align="${align}"` : ''}>${content}</${tag}>`
  let out = '<table>\n<thead>\n<tr>\n'
  node.head.forEach((c, i) => { out += cell('th', inlineToHtml(c.children), node.align[i] ?? null) + '\n' })
  out += '</tr>\n</thead>\n'
  if (node.rows.length > 0) {
    out += '<tbody>\n'
    for (const row of node.rows) {
      out += '<tr>\n'
      row.forEach((c, i) => { out += cell('td', inlineToHtml(c.children), node.align[i] ?? null) + '\n' })
      out += '</tr>\n'
    }
    out += '</tbody>\n'
  }
  return `${out}</table>\n`
}
