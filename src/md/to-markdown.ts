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
 * Escape what would otherwise be read as syntax on the way back in.
 *
 * POSITIONAL, not blanket. A `#` is a heading only at the start of a line; a `-` is a bullet
 * only there too; `.` after digits opens an ordered list only there. Escaping them everywhere
 * is what fills a paragraph with backslashes — and the characters that ARE syntax anywhere
 * (`*`, `_`, `[`, `` ` ``, `<`, `&`) are the short list below.
 */
function escapeText(value: string, atLineStart: boolean): string {
  // ⚠️ THE CLOSING BRACKET IS NOT ESCAPED, and that is a rule about THIS blog rather than
  // about Markdown. `\[ … \]` is display maths here (ADR 0020), so a serializer that escapes
  // both brackets turns any `[word]` in ordinary prose into a formula on the SECOND save:
  //
  //     [two][missing]   →   \[two\]\[missing\]   →   $$two$$$$missing$$
  //
  // Caught by the round trip on `golden/corpus/reference-links.md`, which is exactly what a
  // round trip is for — the first save looked fine.
  //
  // Escaping only the opening bracket is enough and is safe: `\[two]` reads back as the text
  // `[two]`, it cannot open a link, and it is not a formula because a formula needs `\]`.
  // `>` is likewise left alone here and handled at the start of a line below, where it is the
  // only place it means anything.
  let out = value.replace(/([\\`*_[<&])/g, '\\$1')
  // `==`, `++` and `@@` are this blog's own, and a pair of them in ordinary prose would come
  // back as a pen stroke. One is harmless; the grammar needs two.
  out = out.replace(/(==|\+\+|@@)/g, (m) => `\\${m[0]}${m[1]}`)
  if (atLineStart) {
    out = out.replace(/^(\s*)([#>+-])/, '$1\\$2')
    out = out.replace(/^(\s*)(\d+)([.)])/, '$1$2\\$3')
  }
  // ⚠️ TWO SHAPES COME BACK OUT, and leaving them escaped is the exact bug that cost 19 of 45
  // golden fixtures in August. A footnote reference `[^1]` and a callout's `[!NOTE]` live in
  // the document as plain text — neither has a node — so the bracket escaping above turns them
  // into `\[^1\]` and `\[!NOTE\]` on save. Worse than literal text: `\[…\]` is LaTeX display
  // maths, which this renderer supports, so a footnote reference published as a line break and
  // an EMPTY FORMULA in the middle of a sentence, and `[!NOTE]` came out as MathML spelling
  // the letters. The repair is `ReaderSyntax.ts`'s, and it is the smallest one that is true:
  // un-escape the two COMPLETE shapes the renderer treats as syntax. A lone `\[`, a half
  // written `\[^` — still escaped.
  return out.replace(/\\\[\^([^\][\\]+)\]/g, '[^$1]').replace(/\\\[!([^\][\\]+)\]/g, '[!$1]')
}

function inlineToMarkdown(nodes: Inline[], atLineStart = true): string {
  let out = ''
  let first = atLineStart
  for (const node of nodes) {
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
      return `*${inlineToMarkdown(node.children, false)}*`
    case 'strong':
      return `**${inlineToMarkdown(node.children, false)}**`
    case 'strike':
      return `~~${inlineToMarkdown(node.children, false)}~~`
    case 'link':
      return `[${inlineToMarkdown(node.children, false)}](${url(node.url)}${title(node.title)})`
    case 'image':
      return `![${inlineToMarkdown(node.alt, false)}](${url(node.url)}${title(node.title)})`
    case 'ink':
      return `==${inlineToMarkdown(node.children, false)}==${node.ink && node.ink !== 'yellow' ? `#${node.ink}` : ''}`
    case 'underline':
      return `++${inlineToMarkdown(node.children, false)}++${node.ink ? `#${node.ink}` : ''}`
    case 'ring':
      return `@@${inlineToMarkdown(node.children, false)}@@${node.ink ? `#${node.ink}` : ''}`
    case 'math':
      return node.display ? `$$${node.value}$$` : `$${node.value}$`
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
  for (const block of blocks) parts.push(oneBlock(block, ctx))
  // A tight list's items are one line each; everything else is separated by a blank line.
  return parts.join(ctx.tight ? '\n' : '\n\n')
}

function oneBlock(node: Block, ctx: Context): string {
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
      return listToMarkdown(node, ctx)
    case 'mathBlock':
      return `$$${node.value}$$`
    case 'table':
      return tableToMarkdown(node)
    case 'footnoteDef':
      return `[^${node.label}]: ${blocksToMarkdown(node.children, { ...ctx, tight: true }).replace(/\n/g, '\n    ')}`
  }
}

function listToMarkdown(node: Extract<Block, { type: 'list' }>, ctx: Context): string {
  const items = node.items.map((item, i) => itemToMarkdown(item, node, i, ctx))
  return items.join(node.tight ? '\n' : '\n\n')
}

function itemToMarkdown(
  item: ListItem,
  list: Extract<Block, { type: 'list' }>,
  index: number,
  ctx: Context,
): string {
  const marker = list.ordered ? `${list.start + index}. ` : '- '
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
