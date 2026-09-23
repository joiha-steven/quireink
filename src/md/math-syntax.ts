// The maths GRAMMAR, and nothing that can render it.
//
// THE GRAMMAR LIVES HERE AND NOWHERE ELSE. Four readers of it exist — `marked` on the server,
// markdown-it in the editor, the editor's input rules, and `toPlainText` for excerpts. The ink
// syntax drifted across those readers within an hour of being written in two places and put
// the word "green" into every excerpt on the site. So every reader builds from these strings.
//
// IT LIVES IN THE ENGINE since 2026-09-14, and that is where it belongs: the four delimiters
// are notation the parser reads, and everything that RENDERS a formula is a dependency the
// engine must not have. `render/math.ts` re-exports all of it, so the two callers outside
// (`@/utils` for excerpts, `admin/MathNode.tsx` for the editor) did not have to move.
//
// ⚠️ THIS FILE MAY NEVER IMPORT A RENDERER, and that is the whole rule. `@/utils` needs three
// things from here so `toPlainText` can drop a formula out of an excerpt; it used to take them
// from `math.ts`, and an ESM import is not a menu — three regex helpers took the whole module,
// and `math.ts` imports Temml at its top. Fifteen admin files import `@/utils`, so EVERY admin
// screen downloaded a LaTeX engine: 212 KB unpacked, 63 KB over the wire, measured on the
// Comments screen, which has neither an editor nor a formula on it. `math.ts` re-exports all
// of this, so a parser that DOES render still asks one module for both halves.

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
 * The body of a multi-character formula: anything, lazily, but never across another OPENER.
 *
 * ⚠️ THE LOOKAHEAD IS A PERFORMANCE FIX, and it is the same family as the ReDoS note above.
 * A plain `[\s\S]+?` scans from every opener to the END OF THE TEXT when there is no closer,
 * so a document with N unmatched openers costs N times its own length.
 *
 * That is the ORDINARY shape here, not a contrived one. `to-markdown.ts` escapes `[` and
 * deliberately does not escape `]` — there is a paragraph there explaining why, and a golden
 * fixture behind it — so one pass through the editor turns every citation like `[1]` into
 * `\[1]`: an opener with no closer. Measured on a 90 KB post of ordinary prose carrying 2,800
 * citations: `toPlainText` went from 3 ms as typed to 990 ms after one save, and that function
 * feeds the excerpt, the meta description, the OG card and the RSS summary, so it runs on every
 * listing rather than once per post.
 *
 * With the lookahead a failed scan stops at the next opener instead of at the end, which makes
 * the whole sweep linear. It is also more correct: a display formula containing another display
 * opener is not something LaTeX has.
 *
 * ⚠️ AN OPENER AFTER A BACKSLASH IS NOT AN OPENER. `\\[2pt]` is LaTeX's line break with extra
 * space, and it CONTAINS `\[`: without the lookbehind the formula round it failed to match,
 * rendered as text, and one save wrote its closer escaped - the formula gone for good (found in
 * the release review of 2026-09-23). `\\(` inside an inline formula is the same case. The sweep
 * stays linear: a real opener still stops it.
 */
const until = (opener: string): string => `((?:(?!(?<!\\\\)${opener})[\\s\\S])+?)`

/**
 * `\(…\)` — the unambiguous inline form, and the one to prefer in new writing.
 *
 * It carries no guards because it needs none: nobody types `\(` by accident. It is offered
 * because it is what LaTeX itself uses and what most tools emit, and because a writer who
 * has been bitten once by the dollar rules above wants a form with no rules at all.
 */
const PAREN_OPEN = '\\\\\\('
const INLINE_PAREN = `(?<!\\\\)${PAREN_OPEN}${until(PAREN_OPEN)}\\\\\\)`

/** `$$…$$` and `\[…\]`, the display forms. Both may span lines; a formula on its own line is
 *  the common case and is why the block tokenizer exists at all. */
const DOLLAR_OPEN = '\\$\\$'
const DISPLAY_DOLLAR = `${DOLLAR_OPEN}${until(DOLLAR_OPEN)}${DOLLAR_OPEN}`
const BRACKET_OPEN = '\\\\\\['
const DISPLAY_BRACKET = `(?<!\\\\)${BRACKET_OPEN}${until(BRACKET_OPEN)}\\\\\\]`

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
// THE SAME PATTERN, STUCK TO A POSITION. Built from the same source string rather than written
// out again — this file's one rule is that the pattern is never spelled twice — and with `y`
// instead of `^`, because the two cannot be combined: without `m` a `^` only ever matches index
// zero, and `y` is what makes "match exactly here" mean a position other than the start.
const STICKY = new RegExp(`(?:${MATH_SYNTAX_SOURCE})`, 'y')
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
  return fromMatch(ANCHORED.exec(src))
}

/**
 * The same answer, at a position, WITHOUT CUTTING THE STRING FIRST.
 *
 * ⚠️ `matchMathAt(text.slice(pos))` IS QUADRATIC and it was 99% of the engine's time on one
 * shape. The inline parser asks at every candidate character, and a slice copies everything
 * from there to the end of the paragraph: a run of 20,000 backslashes is 20 KB and took 1.77
 * seconds, quadrupling on every doubling. MEASURED with `bun --cpu-prof`, 2026-09-14.
 *
 * The sticky flag asks the same question of the same pattern without the copy: 20,000 comes
 * back in single milliseconds and the growth is linear.
 */
export function matchMathAtPos(src: string, pos: number): MathMatch | null {
  STICKY.lastIndex = pos
  return fromMatch(STICKY.exec(src))
}

function fromMatch(m: RegExpExecArray | null): MathMatch | null {
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
