// Take the `!important` declarations out of a minified sheet, keeping where each one stood.
//
// WHY: the base sheet is served inside `@layer base` (`web/css-layers.ts`), and `!important`
// runs the layers backwards: an important declaration in a layer beats an important one outside
// every layer. So wrapped whole, the base sheet's own `!important`s started beating the owner's:
// `.prose pre.shiki{background:…!important}` in Custom CSS, which won before the layers, lost to
// the base's `.prose pre.shiki{background:var(--c-code-panel)!important}`. Served OUTSIDE the
// layer, under the same selector and inside the same `@media`/`@supports`, each one weighs what
// it weighed before: against the owner's `!important` by specificity, then order, and against
// every normal declaration it still wins. A theme has no `!important` to meet (the checker
// refuses it), so nothing else is touched.
//
// It reads the MINIFIED sheet (`css-min.ts`: no comments, so a brace is a brace), aware of
// strings and of parentheses, so a `;` or a brace inside `url(…)` or a quoted string is text.
// What it does not understand it refuses rather than guesses: a style rule nested inside a style
// rule (CSS nesting), which would need the parent's selector carried along.

/** At-rules whose block holds rules: walked, and kept around whatever is taken out of them. */
const GROUPING = /^@(media|supports|container|layer|scope|starting-style|document)\b/i

/** An `!important` at the end of a declaration, as a tokenizer reads it (`! important` too). */
const IMPORTANT = /!\s*important\s*$/i

type Block = { prelude: string; body: string; end: number }

/** The index just past the string that opens at `i` (on its quote). */
function skipString(css: string, i: number): number {
  const quote = css[i]
  let j = i + 1
  while (j < css.length && css[j] !== quote) j += css[j] === '\\' ? 2 : 1
  return j + 1
}

/**
 * From `i`, the prelude up to the first top-level `{` or `;`, and for a `{` the body up to its
 * matching `}`. `body` is null for a statement (`@layer a,b;`).
 */
function nextBlock(css: string, i: number): (Block & { statement: false }) | { prelude: string; end: number; statement: true } {
  let j = i
  let parens = 0
  while (j < css.length) {
    const c = css[j]!
    if (c === '"' || c === "'") { j = skipString(css, j); continue }
    if (c === '(') parens++
    else if (c === ')') parens--
    else if (parens === 0 && c === ';') return { prelude: css.slice(i, j), end: j + 1, statement: true }
    else if (parens === 0 && c === '{') break
    j++
  }
  if (j >= css.length) throw new Error(`splitImportant: no block after ${JSON.stringify(css.slice(i, i + 60))}`)
  const open = j
  let depth = 0
  parens = 0
  for (; j < css.length; j++) {
    const c = css[j]!
    if (c === '"' || c === "'") { j = skipString(css, j) - 1; continue }
    if (c === '(') parens++
    else if (c === ')') parens--
    else if (parens === 0 && c === '{') depth++
    else if (parens === 0 && c === '}' && --depth === 0) break
  }
  if (depth !== 0) throw new Error(`splitImportant: unclosed block at ${JSON.stringify(css.slice(i, i + 60))}`)
  return { prelude: css.slice(i, open), body: css.slice(open + 1, j), end: j + 1, statement: false }
}

/** A declaration list split on its top-level semicolons. */
function declarations(body: string): string[] {
  const out: string[] = []
  let start = 0
  let parens = 0
  for (let j = 0; j < body.length; j++) {
    const c = body[j]!
    if (c === '"' || c === "'") { j = skipString(body, j) - 1; continue }
    if (c === '(') parens++
    else if (c === ')') parens--
    else if (c === '{' && parens === 0) {
      throw new Error(`splitImportant: a rule nested inside a style rule is not understood: ${JSON.stringify(body.slice(0, 80))}`)
    } else if (c === ';' && parens === 0) { out.push(body.slice(start, j)); start = j + 1 }
  }
  out.push(body.slice(start))
  return out.map((d) => d.trim()).filter(Boolean)
}

/**
 * `css` as two sheets: `normal`, everything but the `!important` declarations, and `important`,
 * those declarations alone, each under its own selector and inside the same grouping at-rules,
 * in the order they stood. Rules and groups left empty are dropped from either side. Other
 * at-rules with a block (`@font-face`, `@keyframes`, `@page`, …) and statements stay in `normal`
 * untouched: an `!important` inside a keyframe is ignored by the browser anyway.
 */
export function splitImportant(css: string): { normal: string; important: string } {
  let normal = ''
  let important = ''
  let i = 0
  while (i < css.length) {
    if (/\s/.test(css[i]!)) { i++; continue }
    const block = nextBlock(css, i)
    i = block.end
    const prelude = block.prelude.trim()
    if (block.statement) { normal += `${prelude};`; continue }
    if (prelude.startsWith('@')) {
      if (GROUPING.test(prelude)) {
        const inner = splitImportant(block.body)
        if (inner.normal) normal += `${prelude}{${inner.normal}}`
        if (inner.important) important += `${prelude}{${inner.important}}`
      } else {
        normal += `${prelude}{${block.body}}`
      }
      continue
    }
    const decls = declarations(block.body)
    const kept = decls.filter((d) => !IMPORTANT.test(d))
    const taken = decls.filter((d) => IMPORTANT.test(d))
    if (kept.length || !taken.length) normal += `${prelude}{${kept.join(';')}}`
    if (taken.length) important += `${prelude}{${taken.join(';')}}`
  }
  return { normal, important }
}
