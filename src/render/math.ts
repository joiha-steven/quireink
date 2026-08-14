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
// THE GRAMMAR IS NOT HERE. It moved to `math-syntax.ts`, whole and unedited, and that file
// says why: importing Temml at the top of the module that also owns the regexes meant a
// LaTeX engine rode `@/utils` into every admin screen. Everything it exports is re-exported
// below, so a parser that needs both halves still asks one module for them.
//
// WHAT MAY LIVE IN THIS FILE is anything that RENDERS or TOKENIZES: it already costs Temml
// and `marked`. Anything that only needs to recognise a formula belongs next door.
import type { Tokens, TokenizerAndRendererExtension } from 'marked'
import temml from 'temml'

import { matchMathAt, matchDisplayBlockAt } from '@/render/math-syntax'

export {
  INLINE_PAREN_SOURCE, DISPLAY_DOLLAR_SOURCE, DISPLAY_BRACKET_SOURCE,
  MATH_SYNTAX_SOURCE, MATH_SYNTAX_GLOBAL, mathOf, isDisplayMatch,
  matchMathAt, matchDisplayBlockAt, mathToMarkdown,
} from '@/render/math-syntax'
export type { MathDelim, MathMatch } from '@/render/math-syntax'

/**
 * The fallback's escaper, written out here rather than imported from `@/utils`.
 *
 * `utils` imports the grammar next door, so importing it back would close a cycle, and
 * `render/ink.ts` keeps itself import-free for the same reason. Four characters is a cheap
 * price for a module that every other reader of the grammar can load without dragging the
 * utility surface behind it.
 */
const escapeMathText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')


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
    // take its own scrollbar rather than widen the page. Maths gets a wrapper of its own
    // because it can: a table arrives from `marked` bare, and the byte-identical golden
    // compare means nothing may wrap it — so `prose.css.ts` scrolls the article around it
    // instead. Same law, and two mechanisms, because only one of them was free.
    return `<div class="math-block">${renderMath(t.tex, true)}</div>\n`
  },
}
