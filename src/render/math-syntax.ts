// The maths GRAMMAR, and nothing that can render it.
//
// THE GRAMMAR LIVES HERE AND NOWHERE ELSE. Four readers of it exist, the same four `ink.ts`
// warns about: `marked` on the server (`render/math.ts`), markdown-it in the editor
// (`admin/components/MathNode.tsx`), the editor's input rules, and `toPlainText` for
// excerpts. The ink syntax drifted across those readers within an hour of being written in
// two places, and put the word "green" into every excerpt on the site. So every reader
// builds from the same exported strings.
//
// WHY THIS IS A SEPARATE FILE FROM `math.ts`, which is the half that owns Temml.
//
// `@/utils` needs three things from here — `MATH_SYNTAX_GLOBAL`, `mathOf`, `isDisplayMatch`,
// all so `toPlainText` can drop a formula out of an excerpt. It got them from `math.ts`, and
// an ESM import is not a menu: taking three regex helpers took the whole module, and
// `math.ts` imports Temml at its top. Fifteen admin files import `@/utils`, so the bundler
// put Temml in the chunk they all share and EVERY admin screen downloaded a LaTeX engine —
// 212 KB unpacked, 63 KB over the wire, measured on the Comments screen, which has neither
// an editor nor a formula on it. Nothing was wrong with the code; the file simply held two
// things and only one of them was wanted.
//
// So this file may never import a renderer, and that is the whole rule. It is import-free
// for the same reason `render/ink.ts` is: anything it reaches for, every one of its readers
// pays for. `math.ts` re-exports all of it, so the parsers that DO render can keep asking
// one module for both halves.

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
 *
 * THE CONTENT GROUP MUST STAY UNAMBIGUOUS. It reads `escape pair OR any char that is not a
 * backslash`, and excluding the backslash from the char class is load-bearing, not style: with
 * `[^$\n]` there instead, a backslash could be consumed by either alternative, and on an
 * unclosed formula the engine tries every partition of every `\x` run before giving up —
 * exponential, measured at 128ms for `$` + 20 escapes and two seconds for 24 (CodeQL js/redos,
 * alert #22). One pasted 100-character "formula" would freeze the process, which serves every
 * page. With the backslash excluded, each position parses exactly one way and the same input
 * fails in microseconds. `math-syntax.test.ts` holds the clock on this.
 */
const INLINE_DOLLAR = '\\$(?![\\s$])((?:\\\\[^\\n]|[^\\\\$\\n])+?)(?<!\\s)\\$(?!\\d)'

/**
 * `\(…\)` — the unambiguous inline form, and the one to prefer in new writing.
 *
 * It carries no guards because it needs none: nobody types `\(` by accident. It is offered
 * because it is what LaTeX itself uses and what most tools emit, and because a writer who
 * has been bitten once by the dollar rules above wants a form with no rules at all.
 */
const INLINE_PAREN = '\\\\\\(([\\s\\S]+?)\\\\\\)'

/** `$$…$$` and `\[…\]`, the display forms. Both may span lines; a formula on its own line is
 *  the common case and is why the block tokenizer exists at all. */
const DISPLAY_DOLLAR = '\\$\\$([\\s\\S]+?)\\$\\$'
const DISPLAY_BRACKET = '\\\\\\[([\\s\\S]+?)\\\\\\]'

/**
 * The three forms that are safe to fire a TYPING rule on, exported one at a time.
 *
 * The editor's input rules need them separately because each one produces a different
 * `delim`, and because `$…$` is deliberately not among them — see `addInputRules` in
 * `admin/components/MathNode.tsx` for why a price would otherwise convert mid-word. Each has
 * exactly one capture group: the TeX.
 */
export const INLINE_PAREN_SOURCE = INLINE_PAREN
export const DISPLAY_DOLLAR_SOURCE = DISPLAY_DOLLAR
export const DISPLAY_BRACKET_SOURCE = DISPLAY_BRACKET

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
 * THIS is what every parser calls — marked's tokenizer in `math.ts`, and markdown-it's rule
 * in the editor. Neither of them sees a capture group, which is the whole point: group
 * numbering is the one detail that cannot survive being written down twice, and there are
 * four readers.
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
