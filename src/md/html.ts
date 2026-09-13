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
import { type PageRules, SPEC, safeHref } from './html-rules'
import { DEFAULT_INK, penSeed } from '@/pen/grammar'

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
 * THE HOST'S RULES, held for the duration of one render.
 *
 * A module-level value rather than an argument threaded through twenty recursive functions,
 * and safe because rendering is wholly synchronous: `toHtml` sets it, walks the tree and puts
 * it back before anything else can run. `index.ts` is the only caller that sets it.
 *
 * ⚠️ PUT BACK WHAT WAS THERE, not the default. Restoring `SPEC` unconditionally is correct for
 * exactly one caller at a time and wrong the moment a render happens INSIDE a render — the
 * inner call's `finally` would hand the outer one `SPEC`, and the rest of the outer page would
 * be rendered under rules its caller never asked for, silently. Nothing in this repository
 * nests today; a library published for other people to embed cannot assume that, and the cost
 * of not assuming it is one saved value.
 */
let rules: PageRules = SPEC

export function setPageRules(next: PageRules): void {
  rules = next
}

/** The rules in force, so a caller can put back exactly what it displaced. */
export function getPageRules(): PageRules {
  return rules
}

function filterHtml(value: string): string {
  if (rules.rawHtml === 'pass') return value
  // NONE OF IT IS HTML. Not the disallowed tags escaped and the rest let through — every
  // character, as typed. `&` first, or the escaping eats its own output.
  if (rules.rawHtml === 'escape') {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  return value.replace(DISALLOWED, (_m, slash: string, tag: string) => `&lt;${slash}${tag}`)
}

function attr(name: string, value: string | undefined): string {
  return value === undefined ? '' : ` ${name}="${escapeText(value)}"`
}

/**
 * A formula as the host renders it, or as its author wrote it.
 *
 * The fallback is the SOURCE, escaped and marked — not a blank and not an error. A host that
 * has not wired a renderer still publishes the writer's TeX, which is readable and correctable
 * on the page it is wrong on; `render/math.ts` makes the same bargain when Temml throws.
 */
function renderFormula(tex: string, display: boolean): string {
  if (rules.math) return rules.math(tex, display)
  const tag = display ? 'div' : 'span'
  return `<${tag} class="math">${escapeText(tex.trim())}</${tag}>`
}

/**
 * A link's destination under the host's rules.
 *
 * Only `<a href>`, deliberately. An `<img src>` with a `javascript:` scheme does not execute
 * in any current browser, and `data:` in an image source is ordinary and useful — narrowing
 * the control to the one place a scheme actually runs is what keeps it from being turned off
 * later for getting in the way.
 */
function href(url: string): string {
  return rules.safeLinks ? safeHref(url) : url
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
      // A newline under the spec, a line break under this blog's rule. The newline after the
      // tag is the shape every hard break in the spec's own examples has, and it costs
      // nothing: whitespace at the start of a line is dropped before anything is painted.
      return rules.softBreak === 'br' ? '<br />\n' : '\n'
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
      // The scheme is judged BEFORE the URL is escaped, because escaping is what would hide
      // it: `escapeUrl` leaves every character of `javascript:alert(1)` alone, so a check
      // afterwards is looking at a string the browser will happily run.
      return `<a href="${escapeUrl(href(node.url))}"${attr('title', node.title)}>${inlineToHtml(node.children)}</a>`
    case 'image':
      // The alt text is the tree's inlines FLATTENED to their words: an `alt` attribute holds
      // text, so `![a *b*](x)` is `alt="a b"`, which is what the spec's examples show.
      return `<img src="${escapeUrl(node.url)}" alt="${escapeText(plainOf(node.alt))}"${attr('title', node.title)} />`
    case 'ink': {
      // No attribute for the default. Yellow is what a bare `==` means, so spelling it out
      // would put a colour nobody chose into every cached body.
      const ink = node.ink && node.ink !== DEFAULT_INK ? ` data-ink="${escapeText(node.ink)}"` : ''
      return `<mark${ink} data-pen="${penSeed(node.raw)}">${inlineToHtml(node.children)}</mark>`
    }
    case 'underline': {
      // Unlike the highlighter, a NAMED default is still a choice here: the underline's own
      // default is graphite, so `#yellow` on one is never elided.
      const ink = node.ink ? ` data-ink="${escapeText(node.ink)}"` : ''
      return `<u${ink} data-pen="${penSeed(node.raw)}">${inlineToHtml(node.children)}</u>`
    }
    case 'ring': {
      const ink = node.ink ? ` data-ink="${escapeText(node.ink)}"` : ''
      return `<mark data-form="o"${ink} data-pen="${penSeed(node.raw)}">${inlineToHtml(node.children)}</mark>`
    }
    case 'math':
      // The HOST owns the TeX-to-markup step (`PageRules.math`): one formula renderer,
      // whichever parser found the formula, and none at all in an engine nobody gave one to.
      return renderFormula(node.value, node.display)
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
      return headingToHtml(node)
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
      // The wrapper is what scrolls: a long derivation is wider than the measure and takes
      // its own scrollbar rather than widening the page.
      return `<div class="math-block">${renderFormula(node.value, true)}</div>\n`
    case 'table':
      return tableToHtml(node)
    case 'footnoteDef':
      return `<section class="footnote" id="fn-${escapeText(node.label)}">\n${blocksToHtml(node.children)}</section>\n`
    case 'callout':
      return `<blockquote class="callout callout-${escapeText(node.kind.toLowerCase())}">\n${blocksToHtml(node.children)}</blockquote>\n`
  }
}

/**
 * A heading, and the two things a page wants from one that Markdown has no opinion about.
 *
 * DEMOTING is about the outline: the page already prints the post's title as its single
 * `<h1>`, so a body `#` would make a second one and a screen reader would announce two
 * documents. It becomes `<h2>`, and everything below keeps its depth.
 *
 * THE ID is the table of contents. It is computed from the heading's WORDS — `plainOf`, not
 * the source line — which is the difference between `## [Tài liệu](/docs)` anchoring at
 * `tai-lieu` and anchoring at `tai-lieuDocs`. `utils.ts`'s `extractHeadings` walks the same
 * tree for the same reason: two walks that agree because they read one parse, rather than two
 * regular expressions that have to be kept in step by hand.
 */
function headingToHtml(node: Extract<Block, { type: 'heading' }>): string {
  const level = rules.demoteHeadings ? Math.min(6, Math.max(2, node.level)) : node.level
  const slug = rules.headingId?.(plainOf(node.children), level) ?? null
  const id = slug ? ` id="${escapeText(slug)}"` : ''
  return `<h${level}${id}>${inlineToHtml(node.children)}</h${level}>\n`
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
  // A LOOSE ITEM PUTS THE CHECKBOX INSIDE ITS FIRST PARAGRAPH, not in front of it. In a tight
  // item there is no `<p>` to be inside, so the two branches look different and mean the same:
  // the box is the first thing in the item's first line of prose. Writing `<li>\n<input> <p>x</p>`
  // instead put the box in the `<li>` itself, where `markTaskItems` could not find it either —
  // so a loose task list lost both its layout and the `class="task"` the stylesheet needs to
  // keep its bullet off an item that already has a box.
  if (check !== '' && item.children[0]?.type === 'paragraph') {
    const [first, ...rest] = item.children
    const head = `<p>${check}${inlineToHtml((first as Extract<Block, { type: 'paragraph' }>).children)}</p>\n`
    return `<li>\n${head}${blocksToHtml(rest)}</li>\n`
  }
  return `<li>\n${check}${blocksToHtml(item.children)}</li>\n`
}

function tableToHtml(node: Extract<Block, { type: 'table' }>): string {
  const cell = (tag: string, content: string, align: string | null): string =>
    `<${tag}${tag === 'th' && rules.tableScope ? ' scope="col"' : ''}${align ? ` align="${align}"` : ''}>${content}</${tag}>`
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
