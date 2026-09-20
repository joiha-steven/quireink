// The tree, back as Markdown. The dangerous direction.
//
// Every other renderer here produces something a reader looks at once. This one produces the
// FILE — what a save writes over the author's words — and a bug in it does not show up as a
// broken page. It shows up as a sentence that is not there any more, on a post somebody
// published months ago, discovered by nobody.
//
// That is not hypothetical. `editor-corpus.test.ts` records it: 19 of 45 golden fixtures
// published differently after a single pass through the editor, because the serializer
// escaped `[^1]` into `\[^1\]` — which the renderer then read as LaTeX display maths, so a
// footnote reference became an empty formula in the middle of a sentence. And the quadratic
// stall that started this whole engine was in the same library, doing the same job.
//
// THE LAW THIS FILE IS WRITTEN TO: parse(serialize(tree)) must equal tree. Not "looks the
// same" — the same tree. A round trip is the only test that can catch a serializer dropping
// something, because the dropped thing is invisible in the output by definition. The suite
// runs it over the golden corpus and over this blog's real posts.
//
// Escaping is the other half. A serializer that escapes too little corrupts on the next read;
// one that escapes too much fills the source with backslashes nobody typed, and an author who
// opens their own post and finds `\*` where they wrote `*` stops trusting the editor. The
// rule here is: escape a character only where it could START something on the way back in.

import type { Block, Document, Inline, ListItem } from './ast'
import { mergeText } from './ast'
import { mathToMarkdown } from './math-syntax'
// The escaping half (2026-09-21). See that file's header for the seam.
import { closeLabel, escapeText, openLabel } from './to-markdown-escape'
import { isBareAutolink } from './gfm-autolink'

/**
 * A link's label or an image's alt text, with only its unpartnered brackets escaped.
 *
 * Held and restored rather than cleared, because a label can hold an image whose alt is a label
 * of its own: the inner one must give the outer its count back, not a fresh one. The bookkeeping
 * is `to-markdown-escape.ts`; rendering the label is here, because that is structure.
 */
function labelToMarkdown(nodes: Inline[]): string {
  const held = openLabel(nodes)
  try {
    return inlineToMarkdown(nodes, false)
  } finally {
    closeLabel(held)
  }
}

/** What a nested render needs to know: how deep the list is, and what prefixes each line. */
type Context = {
  /** Prepended to every line — `> ` inside a quote, spaces inside a list item. */
  prefix: string
  /** True inside a tight list, where a paragraph writes no blank line after itself. */
  tight: boolean
}

const ROOT: Context = { prefix: '', tight: false }

// ----- inline -------------------------------------------------------------------------


/**
 * A span inside its delimiters, with any whitespace at the EDGES pushed outside them.
 *
 * ⚠️ EVERY ONE OF THESE GRAMMARS REFUSES A SPACE NEXT TO ITS DELIMITER — CommonMark's rule for
 * `*` and `**`, GFM's for `~~`, and `pen/grammar.ts`'s for the pen's three. So a stroke written
 * `==chữ và cả ==` is not a stroke at all on the way back in: the mark is simply GONE, and the
 * `==` shows up in the published sentence as two characters the author never typed.
 *
 * It is reachable from an ordinary document. A stroke drawn across an inline code span loses
 * its grip on the code (the schema's `code` excludes every other mark), so what the serializer
 * is handed ends on the space before it. `prosemirror-markdown` had the same repair, and it is
 * where the quadratic stall that started this engine lived — it re-read the whole buffer for
 * every mark. Reading the two ends of one string does the same job.
 */
function delimited(open: string, close: string, inner: string): string {
  const lead = /^\s+/.exec(inner)?.[0] ?? ''
  const tail = /\s+$/.exec(inner)?.[0] ?? ''
  const core = inner.slice(lead.length, inner.length - tail.length)
  // Nothing but whitespace: a pair of delimiters round it would be read as text anyway, and
  // the words are what matter.
  return core === '' ? inner : `${lead}${open}${core}${close}${tail}`
}

function inlineToMarkdown(nodes: Inline[], atLineStart = true): string {
  let out = ''
  let first = atLineStart
  // Merged first: the repairs in `escapeText` match a complete shape, and the parser can hand
  // one run of text over in pieces. See `mergeText`.
  for (const node of mergeText(nodes)) {
    out += oneInline(node, first)
    first = false
  }
  return out
}

function oneInline(node: Inline, atLineStart: boolean): string {
  switch (node.type) {
    case 'text':
      return escapeText(node.value, atLineStart)
    case 'softbreak':
      return '\n'
    case 'hardbreak':
      // Backslash rather than two trailing spaces: invisible whitespace is destroyed by every
      // editor that trims lines, and the author cannot see it to know it is there.
      return '\\\n'
    case 'code': {
      // A fence long enough not to be closed by the content itself.
      const longest = (node.value.match(/`+/g) ?? []).reduce((n, r) => Math.max(n, r.length), 0)
      const fence = '`'.repeat(longest + 1)
      const pad = node.value.startsWith('`') || node.value.endsWith('`') || /^\s|\s$/.test(node.value) ? ' ' : ''
      return `${fence}${pad}${node.value}${pad}${fence}`
    }
    case 'html':
      return node.value
    case 'emph':
      return delimited('*', '*', inlineToMarkdown(node.children, false))
    case 'strong':
      return delimited('**', '**', inlineToMarkdown(node.children, false))
    case 'strike':
      return delimited('~~', '~~', inlineToMarkdown(node.children, false))
    case 'link': {
      // ⚠️ A LINK THAT IS ITS OWN URL GOES BACK AS THE BARE URL. GFM turns a URL standing in
      // prose into a link on its own, so writing it out as `[https://…](https://…)` is the
      // serializer adding notation the author never typed — and on a line holding nothing else
      // it is worse than noise: `render/post-content.ts` turns a lone video URL into a player,
      // and the expanded form carries an escaped `\_` in its LABEL where the author's line had
      // none. Measured on this blog: one post per bare URL, every save.
      const label = labelToMarkdown(node.children)
      const plainLabel = node.children.length === 1 && node.children[0]!.type === 'text'
        ? node.children[0]!.value
        : null
      if (node.title === undefined && plainLabel !== null && plainLabel === node.url && isBareAutolink(node.url)) {
        return node.url
      }
      return `[${label}](${url(node.url)}${title(node.title)})`
    }
    case 'image':
      return `![${labelToMarkdown(node.alt)}](${url(node.url)}${title(node.title)})`
    case 'ink':
      return delimited('==', `==${node.ink && node.ink !== 'yellow' ? `#${node.ink}` : ''}`, inlineToMarkdown(node.children, false))
    case 'underline':
      return delimited('++', `++${node.ink ? `#${node.ink}` : ''}`, inlineToMarkdown(node.children, false))
    case 'ring':
      return delimited('@@', `@@${node.ink ? `#${node.ink}` : ''}`, inlineToMarkdown(node.children, false))
    case 'math':
      // THE DELIMITER THE AUTHOR CHOSE, never a normalised one. Four spellings mean maths on
      // this blog and a save that picks its favourite rewrites a file nobody asked it to
      // touch — `\(a\)` coming back as `$a$` is a diff in the author's source with no author
      // behind it. `md/math-syntax.ts` owns the four; this asks rather than restating two.
      return mathToMarkdown(node.value, node.display, node.delim)
    case 'footnoteRef':
      return `[^${node.label}]`
  }
}

/** A destination, in angle brackets when it holds anything that would end it early. */
function url(value: string): string {
  return /[\s()<>]/.test(value) ? `<${value.replace(/([<>\\])/g, '\\$1')}>` : value
}

function title(value: string | undefined): string {
  return value === undefined ? '' : ` "${value.replace(/(["\\])/g, '\\$1')}"`
}

// ----- blocks -------------------------------------------------------------------------

/** Put the context's prefix on every line, including the empty ones inside a quote. */
function indent(text: string, prefix: string): string {
  if (prefix === '') return text
  return text
    .split('\n')
    .map((line) => (line === '' ? prefix.trimEnd() : prefix + line))
    .join('\n')
}

function blocksToMarkdown(blocks: Block[], ctx: Context): string {
  const parts: string[] = []
  // ⚠️ TWO LISTS IN A ROW NEED TWO DIFFERENT MARKERS, because Markdown has no other way to say
  // where one ends and the next begins: same marker, blank line between, and what comes back is
  // ONE list — and a loose one, since the blank line is now between items rather than lists.
  //
  //     - a        ->   - a        ->   - a        three lists became one, and the second
  //     * b             - b             - b        list's numbering went with them:
  //     + c             - c             - c
  //     1. a / 1) b  ->  1. a / 1. b  ->  1. a / 2. b
  //
  // Reachable from the editor, which is where it was measured: both settle on a different
  // document than the author's, and neither is even a fixed point on the way there.
  let apart = false
  for (const [i, block] of blocks.entries()) {
    const before = blocks[i - 1]
    apart = block.type === 'list' && before?.type === 'list' && before.ordered === block.ordered && !apart
    parts.push(oneBlock(block, ctx, apart))
  }
  // A tight list's items are one line each; everything else is separated by a blank line.
  return parts.join(ctx.tight ? '\n' : '\n\n')
}

/** `apart` asks for the ALTERNATE list marker, so this list does not merge with the one above. */
function oneBlock(node: Block, ctx: Context, apart = false): string {
  switch (node.type) {
    case 'paragraph':
      return inlineToMarkdown(node.children)
    case 'heading':
      return `${'#'.repeat(node.level)} ${inlineToMarkdown(node.children, false)}`
    case 'thematicBreak':
      return '---'
    case 'codeBlock': {
      // The fence must outlast any run of backticks inside the code.
      const longest = (node.value.match(/^`{3,}/gm) ?? []).reduce((n, r) => Math.max(n, r.length), 2)
      const fence = '`'.repeat(Math.max(3, longest + 1))
      return `${fence}${node.info}\n${node.value.replace(/\n$/, '')}\n${fence}`
    }
    case 'htmlBlock':
      return node.value
    case 'blockquote':
      return indent(blocksToMarkdown(node.children, { ...ctx, tight: false }), '> ')
    case 'callout':
      return indent(`[!${node.kind}]\n${blocksToMarkdown(node.children, { ...ctx, tight: false })}`, '> ')
    case 'list':
      return listToMarkdown(node, ctx, apart)
    case 'mathBlock':
      return mathToMarkdown(node.value, true, node.delim)
    case 'table':
      return tableToMarkdown(node)
    case 'footnoteDef':
      return `[^${node.label}]: ${blocksToMarkdown(node.children, { ...ctx, tight: true }).replace(/\n/g, '\n    ')}`
  }
}

function listToMarkdown(node: Extract<Block, { type: 'list' }>, ctx: Context, apart: boolean): string {
  const items = node.items.map((item, i) => itemToMarkdown(item, node, i, ctx, apart))
  return items.join(node.tight ? '\n' : '\n\n')
}

function itemToMarkdown(
  item: ListItem,
  list: Extract<Block, { type: 'list' }>,
  index: number,
  ctx: Context,
  apart: boolean,
): string {
  // `*` and `)` are the second spelling of each marker, used only to keep this list off the
  // back of the one above it. Both are CommonMark; neither changes what the reader sees.
  const marker = list.ordered ? `${list.start + index}${apart ? ')' : '.'} ` : apart ? '* ' : '- '
  const check = item.checked === null ? '' : item.checked ? '[x] ' : '[ ] '
  const body = blocksToMarkdown(item.children, { prefix: '', tight: list.tight })
  // Continuation lines line up under the content, not under the marker: that is what keeps a
  // second paragraph inside the item instead of ending the list.
  const pad = ' '.repeat(marker.length)
  const lines = body.split('\n')
  const head = `${marker}${check}${lines[0] ?? ''}`
  const rest = lines.slice(1).map((line) => (line === '' ? '' : pad + line))
  void ctx
  return [head, ...rest].join('\n')
}

/**
 * A row's cells, with the one character that would re-cut the row escaped.
 *
 * ⚠️ THE PIPE IS ESCAPED AND THE BACKSLASH IS NOT, and that asymmetry is the design rather
 * than an oversight. The string this works on is ALREADY Markdown: `escapeText` has put a
 * backslash in front of every literal one, so escaping them again would double what an author
 * typed. What it has not touched are the verbatim spans — a code span and a formula are
 * emitted as written — and there a backslash beside a pipe is the author's own, which is why
 * CodeQL files this as an incomplete escape (js/incomplete-sanitization, alert 28).
 *
 * It reads back correctly, and `round-trip.test.ts` measures it on all three shapes: prose, a
 * code span, and TeX, where the double bar is written `\|` and belongs in a table as much as
 * anywhere. Each survives a save and a reopen as two cells with the same page.
 *
 * GFM cannot do better, and that is the real answer: inside a table row `\|` MEANS a pipe, so
 * a literal backslash-then-pipe has no spelling there at all. The information is lost by the
 * format, not by this line — and what this engine writes, this engine reads.
 */
function tableToMarkdown(node: Extract<Block, { type: 'table' }>): string {
  const cell = (children: Inline[]) => inlineToMarkdown(children, false).replace(/\|/g, '\\|')
  const row = (cells: { children: Inline[] }[]) => `| ${cells.map((c) => cell(c.children)).join(' | ')} |`
  const rule = node.align
    .map((a) => (a === 'center' ? ':---:' : a === 'right' ? '---:' : a === 'left' ? ':---' : '---'))
    .join(' | ')
  return [row(node.head), `| ${rule} |`, ...node.rows.map(row)].join('\n')
}

/** A whole document, ending in exactly one newline. */
export function toMarkdown(doc: Document): string {
  const out = blocksToMarkdown(doc.children, ROOT)
  return out === '' ? '' : `${out}\n`
}
