// Mathematics: LaTeX in the Markdown, MathML on the page.
//
// The whole feature is server-side. Temml turns the TeX into MathML at render time and the
// reader downloads NOTHING extra for it — no script, no stylesheet, no font file. That is
// the only reason this could be added at all: the resource-loading law (`docs/performance.md`)
// budgets a reader's JavaScript in single kilobytes, and both of the usual answers spend far
// more than the whole budget. KaTeX ships ~23 KB of CSS plus a family of WOFF2 faces before
// it draws a glyph; MathJax is an order of magnitude worse and runs in the reader's browser.
// MathML is drawn by the browser's own layout engine using its own maths face, so the cost
// on the page is the markup and nothing else.
//
// WHY TEMML AND NOT KATEX. KaTeX can emit MathML (`output: 'mathml'`), so it looked like the
// same trade with a better-known name. It is not: KaTeX's MathML was built as an accessibility
// track running ALONGSIDE its HTML output, which is the thing actually drawn, and standalone
// it renders visibly worse. Temml was written by a KaTeX contributor for exactly this job —
// MathML as the only output — and that is the job here.
//
// THE GRAMMAR LIVES HERE AND NOWHERE ELSE. Four readers of it exist, the same four `ink.ts`
// warns about: `marked` on the server (below), markdown-it in the editor
// (`admin/components/MathNode.ts`), the editor's input rules, and `toPlainText` for excerpts.
// The ink syntax drifted across those readers within an hour of being written in two places,
// and put the word "green" into every excerpt on the site. So every reader below builds from
// the same exported strings.
import type { Tokens, TokenizerAndRendererExtension } from 'marked'
import temml from 'temml'

/**
 * The fallback's escaper, written out here rather than imported from `@/utils`.
 *
 * `utils` imports THIS file (for `toPlainText`), so importing it back would close a cycle,
 * and `render/ink.ts` keeps itself import-free for the same reason. Four characters is a
 * cheap price for a module that every other reader of the grammar can load without dragging
 * the utility surface behind it.
 */
const escapeMathText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * `$…$` IS THE DANGEROUS ONE, and on this blog in particular.
 *
 * A dollar sign is money far more often than it is mathematics, and the first post that
 * needed this feature was about the quantity theory of money — a page where "$5" and "$10"
 * sit in the same paragraph as `$M \times V$`. A naive `\$(.+?)\$` reads "5 và " as a
 * formula and silently eats the prose between two prices.
 *
 * So the three guards are Pandoc's, which have had two decades of running into this:
 *
 *  - The opening `$` must be followed by a non-space. `$ x$` is not maths.
 *  - The closing `$` must be preceded by a non-space. This is what rejects `$5 và $10`:
 *    the only candidate span ends on the space after "và".
 *  - The closing `$` must not be followed by a digit. This is what rejects `$5-$10`, whose
 *    span ends on "-" and would otherwise pass the second guard.
 *
 * Content cannot cross a newline: a paragraph break is never inside one formula, and letting
 * it run makes a single unbalanced `$` swallow the rest of the document.
 */
const INLINE_DOLLAR = '\\$(?![\\s$])((?:\\\\.|[^$\\n])+?)(?<!\\s)\\$(?!\\d)'

/**
 * `\(…\)` — the unambiguous inline form, and the one to prefer in new writing.
 *
 * It carries no guards because it needs none: nobody types `\(` by accident. It is offered
 * because it is what LaTeX itself uses and what most tools emit, and because a writer who
 * has been bitten once by the dollar rules above wants a form with no rules at all.
 */
const INLINE_PAREN = '\\\\\\(([\\s\\S]+?)\\\\\\)'

/** `$$…$$` and `\[…\]`, the display forms. Both may span lines; a formula on its own line is
 *  the common case and is why the block tokenizer below exists at all. */
const DISPLAY_DOLLAR = '\\$\\$([\\s\\S]+?)\\$\\$'
const DISPLAY_BRACKET = '\\\\\\[([\\s\\S]+?)\\\\\\]'

/**
 * Every form at once, for the readers that only need to FIND maths rather than parse it
 * (`toPlainText`). Display forms come first so `$$x$$` is never read as an empty `$…$`.
 *
 * The capture groups are 1-4 in source order, and exactly one of them is set per match —
 * which is what `mathOf` below exists to unpick.
 */
export const MATH_SYNTAX_SOURCE =
  `${DISPLAY_DOLLAR}|${DISPLAY_BRACKET}|${INLINE_PAREN}|${INLINE_DOLLAR}`

export const MATH_SYNTAX_GLOBAL = new RegExp(MATH_SYNTAX_SOURCE, 'g')

/**
 * The TeX out of a `MATH_SYNTAX_SOURCE` match, whichever of the four forms matched.
 *
 * It takes a bare group list rather than a `RegExpMatchArray` so that the two shapes a
 * caller can have — `exec` results and the rest-args of a `String.replace` callback — both
 * land here instead of each restating which group number means what.
 */
export const mathOf = (groups: readonly (string | undefined)[]): string =>
  groups[1] ?? groups[2] ?? groups[3] ?? groups[4] ?? ''

/**
 * True when the match used a display form. Same contract as `mathOf` and the same reason:
 * `toPlainText` has to tell a standalone equation from one sitting inside a sentence, and it
 * must not learn the group numbering to do it.
 */
export const isDisplayMatch = (groups: readonly (string | undefined)[]): boolean =>
  groups[1] !== undefined || groups[2] !== undefined

/**
 * Which delimiter a formula was written with, carried so a round-trip is a FIXED POINT.
 *
 * The editor rewrites a post's Markdown wholesale on every save. Normalising `\[…\]` to
 * `$$…$$` on the way through would be one attribute cheaper and would mean that opening a
 * post and closing it again silently edits the author's source — the exact class of quiet
 * rewrite `admin/ink-mark.test.ts` exists to catch for the pen.
 */
export type MathDelim = 'dollar' | 'bracket' | 'paren'

/** One formula, however it was written. The only shape any reader of this module needs. */
export type MathMatch = { raw: string; tex: string; display: boolean; delim: MathDelim }

const ANCHORED = new RegExp(`^(?:${MATH_SYNTAX_SOURCE})`)
// A display formula standing as its own block, and the trailing newlines it owns. Without
// consuming them marked opens an empty paragraph after every formula.
const ANCHORED_BLOCK = new RegExp(`^(?:${DISPLAY_DOLLAR}|${DISPLAY_BRACKET})[ \\t]*(?:\\n+|$)`)

/**
 * A formula at the START of `src`, or null.
 *
 * THIS is what every parser calls — marked's tokenizer below, and markdown-it's rule in the
 * editor. Neither of them sees a capture group, which is the whole point: group numbering is
 * the one detail that cannot survive being written down twice, and there are four readers.
 */
export function matchMathAt(src: string): MathMatch | null {
  const m = ANCHORED.exec(src)
  if (!m) return null
  const display = m[1] !== undefined || m[2] !== undefined
  const delim: MathDelim =
    m[2] !== undefined ? 'bracket' : m[3] !== undefined ? 'paren' : 'dollar'
  return { raw: m[0], tex: mathOf(m), display, delim }
}

/** A display formula standing alone as a block, with the blank line after it. */
export function matchDisplayBlockAt(src: string): MathMatch | null {
  const m = ANCHORED_BLOCK.exec(src)
  if (!m) return null
  return {
    raw: m[0],
    tex: m[1] ?? m[2] ?? '',
    display: true,
    delim: m[2] !== undefined ? 'bracket' : 'dollar',
  }
}

/** The source text for a formula, in the delimiters it arrived in. The serializer's half. */
export function mathToMarkdown(tex: string, display: boolean, delim: MathDelim): string {
  if (delim === 'bracket') return `\\[${tex}\\]`
  if (delim === 'paren') return `\\(${tex}\\)`
  return display ? `$$${tex}$$` : `$${tex}$`
}

/**
 * TeX -> MathML, and it never throws.
 *
 * `throwOnError` is deliberately ON so the catch below can do the fallback, because Temml's
 * own error rendering paints the offending command in `#b22222` as an inline style. This
 * codebase's rule is that public colours come only from theme tokens (CLAUDE.md), and a
 * hardcoded firebrick baked into a CACHED body could not be restyled by any palette the
 * reader picks — rendered bodies are stored under a hash of their Markdown, so the colour
 * would outlive the setting that was supposed to control it.
 *
 * The fallback shows the writer's own source, escaped, marked with a class the sheet styles.
 * It does not swallow the formula and it does not show a stack trace: a typo in `\frac` must
 * leave something you can read and correct, on the page where you can see it is wrong.
 */
export function renderMath(tex: string, display: boolean): string {
  try {
    return temml.renderToString(tex.trim(), { displayMode: display, throwOnError: true })
  } catch {
    const tag = display ? 'div' : 'span'
    return `<${tag} class="math-error">${escapeMathText(tex.trim())}</${tag}>`
  }
}

/**
 * The inline half. The TeX is NOT handed to marked's inline lexer, and that is the point.
 *
 * Markdown would read `x_1 + y_2` as an emphasis run and hand back `x<em>1 + y</em>2` — the
 * underscore is the single most common character in a subscript and the single most common
 * emphasis delimiter, so a formula parsed as Markdown is not a rendering bug, it is a
 * different formula. Returning the raw text and rendering it ourselves is what keeps the
 * writer's source intact all the way to Temml.
 *
 * Inline code is safe without any work here: marked's own tokenizer claims a code span whole
 * from its opening backtick, so `` `$5` `` never reaches this rule.
 */
export const mathInlineExtension: TokenizerAndRendererExtension = {
  name: 'math',
  level: 'inline',
  // marked uses this to skip ahead to where a match could begin. Any of the four openers.
  start(src: string) {
    const hits = [src.indexOf('$'), src.indexOf('\\('), src.indexOf('\\[')].filter((i) => i >= 0)
    return hits.length ? Math.min(...hits) : -1
  },
  tokenizer(src: string) {
    const m = matchMathAt(src)
    return m ? { type: 'math', raw: m.raw, tex: m.tex, display: m.display } : undefined
  },
  renderer(token) {
    const t = token as Tokens.Generic & { tex: string; display: boolean }
    return renderMath(t.tex, t.display)
  },
}

/**
 * The block half, for a display formula standing alone between two blank lines.
 *
 * Without it the inline rule still renders the formula, but marked has already wrapped the
 * paragraph around it — and a `<math display="block">` inside a `<p>` inherits the
 * paragraph's text-indent and first-line rules, so the formula sits off-centre under book
 * mode's indented prose. As its own block it is laid out as one.
 */
export const mathBlockExtension: TokenizerAndRendererExtension = {
  name: 'mathBlock',
  level: 'block',
  start(src: string) {
    const hits = [src.indexOf('$$'), src.indexOf('\\[')].filter((i) => i >= 0)
    return hits.length ? Math.min(...hits) : -1
  },
  tokenizer(src: string) {
    const m = matchDisplayBlockAt(src)
    return m ? { type: 'mathBlock', raw: m.raw, tex: m.tex } : undefined
  },
  renderer(token) {
    const t = token as Tokens.Generic & { tex: string }
    // The wrapper is what scrolls. A long derivation is wider than the measure and must
    // take its own scrollbar rather than widen the page — the same rule tables follow.
    return `<div class="math-block">${renderMath(t.tex, true)}</div>\n`
  },
}
