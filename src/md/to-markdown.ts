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
import { mathToMarkdown } from '@/render/math-syntax'
import { INK_SYNTAX_GLOBAL, RING_SYNTAX_GLOBAL, UNDER_SYNTAX_GLOBAL } from '@/pen/grammar'
import { entityStarts } from './entity'
import { isBareAutolink } from './gfm-autolink'

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
 * Where a pen stroke WOULD be found on the way back in — the only places worth a backslash.
 *
 * ⚠️ IT ASKS THE GRAMMAR RATHER THAN RESTATING IT, which is the rule `pen/grammar.ts` states
 * about itself and the one this function got wrong twice. A first version escaped every `==`,
 * so `x == y and z == w` came back as `x \== y and z \== w` — an author opening their own post
 * to find backslashes they never typed. A second version escaped a pair followed by a
 * non-space, which is the OPENING guard, and that escaped `++i` in `C++ và ++i` where no
 * closing pair exists anywhere and no stroke could ever form.
 *
 * A pair is only dangerous when the whole shape is there. Running the three real patterns says
 * so exactly, and it stays true the day the grammar changes: over-escaping corrupts what the
 * writer sees, under-escaping corrupts what the next read produces, and only the grammar knows
 * where the line is.
 */
function penOpeners(text: string): Set<number> {
  const at = new Set<number>()
  for (const re of [INK_SYNTAX_GLOBAL, UNDER_SYNTAX_GLOBAL, RING_SYNTAX_GLOBAL]) {
    re.lastIndex = 0
    for (let m = re.exec(text); m !== null; m = re.exec(text)) at.add(m.index)
  }
  return at
}

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
  //
  // The pen's three pairs come first and are computed on the RAW text, because they are found
  // by position and every escape inserted before them would move the positions.
  const strokes = penOpeners(value)
  // `&` IS ESCAPED ONLY WHERE IT OPENS AN ENTITY, for the reason on `entityStarts`: a bare
  // ampersand means nothing in Markdown, and `M&A` coming back as `M\&A` is a backslash the
  // author never typed, in 44 of this blog's 92 posts.
  const entities = entityStarts(value)
  let out = ''
  for (let i = 0; i < value.length; i++) {
    if (strokes.has(i) || entities.has(i)) out += '\\'
    const ch = value[i]!
    out += /[\\`*_[<]/.test(ch) ? `\\${ch}` : ch
  }
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
      const label = inlineToMarkdown(node.children, false)
      const plainLabel = node.children.length === 1 && node.children[0]!.type === 'text'
        ? node.children[0]!.value
        : null
      if (node.title === undefined && plainLabel !== null && plainLabel === node.url && isBareAutolink(node.url)) {
        return node.url
      }
      return `[${label}](${url(node.url)}${title(node.title)})`
    }
    case 'image':
      return `![${inlineToMarkdown(node.alt, false)}](${url(node.url)}${title(node.title)})`
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
      // behind it. `render/math-syntax.ts` owns the four; this asks rather than restating two.
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
      return mathToMarkdown(node.value, true, node.delim)
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
