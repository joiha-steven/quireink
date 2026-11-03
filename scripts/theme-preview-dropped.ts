// The declarations in a theme's sheet that the browser drops. `theme:check` reads a sheet for what
// it may reach and what it may say, not for whether CSS knows each word: `colour: #333`,
// `display: gird`, `border-radius: 999` and a missing `;` all pass it, and then do nothing on the
// page, with no message anywhere. The browser is the only judge of that, so `theme:preview` asks
// the one it has open.
//
// Three halves, so what counts can be read and tested without a browser:
//   sourceDeclarations(css)       every declaration as written, with its line and column
//   PROBE / FIX_PROBE             run in the page: which the engine's own CSSOM keeps
//   droppedFindings(...)          what of that is a finding, and what to write instead
//
// A declaration counts as kept when setting it on an element's style leaves the style non-empty:
// the CSSOM parse a sheet goes through, shorthands included. A value holding `var()` is kept by
// any property the engine knows, because it is only checked once the variable is known: a wrong
// property name is still found there, a wrong value is not. Not judged: custom properties (`--t-*`
// hold anything), and a name or value with another engine's prefix (`-moz-`, `-ms-`, `-o-`),
// written for that engine and dropped by this one on purpose.
import { asciiLower, tokenizeCss } from '@/theme/css-tokens'
import { buildTree, isToken, meaningful, parseDeclarations, parseRules, type CssNode, type CssRule } from '@/theme/css-tree'
import { lineLocator } from '@/theme/line-locator'

export type SourceDeclaration = {
  /** As written, without `!important`; `''` for a run with no colon (`color red`). */
  property: string
  value: string
  line: number
  col: number
  /** The declaration as the author wrote it, whitespace folded, for the report line. */
  text: string
  /**
   * When the value holds `name:` at its top level, which no property's value can: the `;` before
   * `name` is missing, and `before` is the value up to there. Found from the tokens, so it is found
   * where the browser keeps the run (`color: var(--x) font-weight: 700` is kept, as any var() is).
   */
  runOn?: { next: string; before: string }
}

const FOREIGN_PREFIX = /(^|[\s,(])-(moz|ms|o)-/i

const fold = (s: string): string => s.replace(/\s+/g, ' ').trim()

/** Every declaration in the sheet, in order: style rules at the top and inside `@media`, `@supports`, `@container` and `@keyframes`. */
export function sourceDeclarations(css: string): SourceDeclaration[] {
  const { nodes } = buildTree(tokenizeCss(css).tokens)
  const at = lineLocator(css)
  const out: SourceDeclaration[] = []
  const walk = (rules: readonly CssRule[]) => {
    for (const r of rules) {
      if (r.block === null) continue
      if (r.kind === 'at') {
        if (['media', 'supports', 'container', 'keyframes'].includes(asciiLower(r.name))) walk(parseRules(r.block.children, false))
        continue
      }
      for (const item of parseDeclarations(r.block.children as CssNode[])) {
        if (item.kind === 'nested') continue
        if (item.kind === 'invalid') {
          const text = fold(css.slice(item.start, item.end))
          const { line, col } = at(item.start)
          out.push({ property: '', value: text, line, col, text })
          continue
        }
        const { decl } = item
        const value = css.slice(decl.valueStart, decl.end).replace(/\s*!\s*important\s*$/i, '').trim()
        const { line, col } = at(decl.start)
        const parts = meaningful(decl.value)
        const colon = parts.findIndex((n) => isToken(n, 'colon'))
        const name = colon > 0 ? parts[colon - 1]! : null
        const runOn = !decl.name.startsWith('--') && name?.kind === 'token' && name.token.type === 'ident'
          ? { next: name.token.value, before: css.slice(decl.valueStart, name.start).trim() } : null
        out.push({ property: decl.name, value, line, col, text: fold(css.slice(decl.start, decl.end)), ...(runOn ? { runOn } : {}) })
      }
    }
  }
  walk(parseRules(nodes, true))
  return out
}

/** Whether the browser can be asked about this one at all (see the head of this file). */
export function judged(d: SourceDeclaration): boolean {
  if (d.property === '') return true
  if (d.property.startsWith('--')) return false
  return !FOREIGN_PREFIX.test(d.property) && !FOREIGN_PREFIX.test(d.value)
}

/**
 * Runs in the page with `[[property, value], ...]`. Answers, per pair, 'kept', 'value' (the
 * property is known, the value is not) or 'property' (no such property), and the names of every
 * property this engine knows, for the nearest-name guess.
 */
export const PROBE = (pairs: readonly (readonly [string, string])[]): string => `((pairs) => {
  const kept = (p, v) => { const s = document.createElement('div').style; s.setProperty(p, v); return s.length > 0; };
  const known = new Set();
  for (const k in document.documentElement.style) {
    const name = k.includes('-') ? k : k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()).replace(/^webkit-/, '-webkit-');
    if (CSS.supports(name, 'inherit')) known.add(name);
  }
  return { answers: pairs.map(([p, v]) => kept(p, v) ? 'kept' : CSS.supports(p, 'inherit') ? 'value' : 'property'), known: [...known].sort() };
})(${JSON.stringify(pairs)})`

/** Runs in the page with `[[property, value], ...]`: true for each pair the engine keeps. */
export const FIX_PROBE = (pairs: readonly (readonly [string, string])[]): string => `((pairs) => pairs.map(([p, v]) => {
  const s = document.createElement('div').style; s.setProperty(p, v); return s.length > 0;
}))(${JSON.stringify(pairs)})`

export type Answer = 'kept' | 'value' | 'property'

/**
 * What went wrong with one declaration; the sentence it gets is chosen by `kind`. `unknown` is a
 * name this browser does not know and no name it knows is spelled close to: most often a property
 * another engine has (`hanging-punctuation` is Safari's), so it is listed, and is not a finding.
 */
export type DroppedKind = 'property' | 'unknown' | 'value' | 'empty' | 'semicolon' | 'colon'

export type DroppedFinding = {
  line: number
  col: number
  text: string
  kind: DroppedKind
  property: string
  value: string
  /** The property after which a `;` is missing, for `semicolon`. */
  next?: string
  /** What to write instead, when a guess the browser keeps was found. */
  fix?: string
}

/** Optimal string alignment distance: a swap of two neighbours (`gird`, `grid`) counts as one. */
export function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0]![j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1)
      d[i]![j] = v
    }
  }
  return d[a.length]![b.length]!
}

/** The closest of `words` to `word`, if one is close enough to be the word meant: 1 edit in 4 letters, at most 2. */
export function nearest(word: string, words: readonly string[]): string | null {
  const limit = Math.min(2, Math.max(1, Math.floor(word.length / 4)))
  let best: string | null = null
  let bestD = limit + 1
  for (const w of words) {
    if (Math.abs(w.length - word.length) > limit) continue
    const dd = distance(word, w)
    if (dd < bestD) { best = w; bestD = dd }
  }
  return best
}

/**
 * Keywords a value is most often reaching for, the ones a typo lands next to. Not a list of CSS:
 * a guess is only offered when the browser keeps it, so a word here that some property does not
 * take costs nothing.
 */
export const KEYWORDS: readonly string[] = [
  'absolute', 'auto', 'balance', 'baseline', 'block', 'bold', 'bolder', 'border-box', 'both', 'bottom', 'break-word',
  'capitalize', 'center', 'collapse', 'column', 'column-reverse', 'contain', 'content-box', 'contents', 'cover',
  'currentcolor', 'dashed', 'dotted', 'double', 'ease', 'ease-in', 'ease-in-out', 'ease-out', 'ellipsis', 'end',
  'fill', 'fixed', 'flex', 'flex-end', 'flex-start', 'grid', 'hidden', 'horizontal', 'inherit', 'initial', 'inline',
  'inline-block', 'inline-flex', 'inline-grid', 'inset', 'italic', 'justify', 'large', 'larger', 'left', 'lighter',
  'linear', 'lowercase', 'manual', 'max-content', 'medium', 'middle', 'min-content', 'no-repeat', 'none', 'normal',
  'nowrap', 'oblique', 'outset', 'overline', 'pointer', 'pre', 'pre-line', 'pre-wrap', 'pretty', 'relative',
  'repeat', 'repeat-x', 'repeat-y', 'ridge', 'right', 'round', 'row', 'row-reverse', 'scroll', 'small', 'smaller',
  'solid', 'space', 'space-around', 'space-between', 'space-evenly', 'start', 'static', 'sticky', 'stretch',
  'table', 'thick', 'thin', 'top', 'transparent', 'underline', 'unset', 'uppercase', 'vertical', 'visible', 'wrap',
  'wrap-reverse', 'x-large', 'x-small', 'xx-large',
]

/**
 * What a dropped declaration might have meant, best first. Each is a `[property, value]` the
 * browser is asked about; the first it keeps is the fix offered.
 */
export function guesses(d: SourceDeclaration, answer: Answer, known: readonly string[]): (readonly [string, string])[] {
  const prop = asciiLower(d.property)
  if (prop === '') {
    // `color red`: the name and the value with the colon put back.
    const m = /^(-?[a-z][a-z-]*)\s+(\S[\s\S]*)$/i.exec(d.value)
    return m && known.includes(asciiLower(m[1]!)) ? [[asciiLower(m[1]!), m[2]!]] : []
  }
  if (answer === 'property') {
    const near = nearest(prop, known)
    return near ? [[near, d.value]] : []
  }
  const out: (readonly [string, string])[] = []
  if (d.runOn) return d.runOn.before === '' ? [] : [[prop, d.runOn.before]]
  // A length written without its unit: `999` where `999px` was meant. Zero needs none.
  const unitless = d.value.replace(/(^|[\s(,])(-?(?:\d+\.?\d*|\.\d+))(?=$|[\s),/])/g, (m, pre: string, n: string) => Number(n) === 0 ? m : `${pre}${n}px`)
  if (unitless !== d.value) out.push([prop, unitless])
  // One misspelt keyword at a time.
  for (const m of d.value.matchAll(/(?<![\w#.-])[a-z][a-z-]{2,}(?![\w(-])/gi)) {
    const near = nearest(asciiLower(m[0]), KEYWORDS)
    if (near && near !== asciiLower(m[0])) out.push([prop, d.value.slice(0, m.index) + near + d.value.slice(m.index! + m[0].length)])
  }
  return out
}

/** The findings, from the declarations, the probe's answers and which of the guesses the browser kept. */
export function droppedFindings(
  decls: readonly SourceDeclaration[], answers: readonly Answer[],
  keptGuess: (d: SourceDeclaration) => readonly [string, string] | null,
): DroppedFinding[] {
  const out: DroppedFinding[] = []
  decls.forEach((d, i) => {
    const answer = answers[i]
    if (answer === undefined || (answer === 'kept' && !d.runOn)) return
    const base = { line: d.line, col: d.col, text: d.text, property: d.property, value: d.value }
    const fix = keptGuess(d)
    if (d.property === '') {
      const word = /^-?[a-z][a-z-]*/i.exec(d.value)?.[0] ?? d.value
      out.push({ ...base, kind: 'colon', property: word, ...(fix ? { fix: `${fix[0]}: ${fix[1]}` } : {}) })
      return
    }
    if (d.runOn) {
      out.push({ ...base, kind: 'semicolon', next: d.runOn.next, ...(fix ? { fix: `${fix[0]}: ${fix[1]};` } : {}) })
      return
    }
    const kind: DroppedKind = answer === 'property' ? (fix ? 'property' : 'unknown') : d.value === '' ? 'empty' : 'value'
    out.push({ ...base, kind, ...(fix ? { fix: `${fix[0]}: ${fix[1]}` } : {}) })
  })
  return out
}

/** A mistake for certain: everything but a name no browser near this one might know. */
export const isMistake = (f: DroppedFinding): boolean => f.kind !== 'unknown'

export type DroppedWords = {
  droppedProperty: string
  droppedUnknown: string
  droppedValue: string
  droppedEmpty: string
  droppedSemicolon: string
  droppedColon: string
  droppedInstead: string
  droppedNoGuess: string
}

/** Every judged declaration of `css` asked of the browser behind `evaluate`, and a guess for each it drops. */
export async function droppedIn(css: string, evaluate: (expression: string) => Promise<unknown>): Promise<DroppedFinding[]> {
  const decls = sourceDeclarations(css).filter(judged)
  if (decls.length === 0) return []
  const probed = await evaluate(PROBE(decls.map((d) => [d.property, d.value] as const))) as { answers?: unknown; known?: unknown } | null
  const answers = probed?.answers
  const known = probed?.known
  if (!Array.isArray(answers) || answers.length !== decls.length || !Array.isArray(known)) {
    throw new Error(`the declaration probe came back in an unexpected shape: ${JSON.stringify(probed).slice(0, 200)}`)
  }
  const names = known.filter((k): k is string => typeof k === 'string')
  const asked = decls.map((d, i) => answers[i] === 'kept' && !d.runOn ? [] : guesses(d, answers[i] as Answer, names))
  const flags = await evaluate(FIX_PROBE(asked.flat()))
  if (!Array.isArray(flags)) throw new Error('the guess probe came back in an unexpected shape')
  let k = 0
  const chosen = new Map<SourceDeclaration, readonly [string, string]>()
  asked.forEach((list, i) => {
    for (const pair of list) if (flags[k++] === true && !chosen.has(decls[i]!)) chosen.set(decls[i]!, pair)
  })
  return droppedFindings(decls, answers as Answer[], (d) => chosen.get(d) ?? null)
}

const fill = (s: string, vars: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)

/** The sentence under a finding's line: what the browser did, then what to write instead. */
export function droppedSentence(f: DroppedFinding, w: DroppedWords): string {
  const vars = { property: f.property, value: f.value, next: f.next ?? '', fix: f.fix ?? '' }
  const what = {
    property: w.droppedProperty, unknown: w.droppedUnknown, value: w.droppedValue, empty: w.droppedEmpty,
    semicolon: w.droppedSemicolon, colon: w.droppedColon,
  }[f.kind]
  if (f.kind === 'unknown') return fill(what, vars)
  return `${fill(what, vars)} ${fill(f.fix ? w.droppedInstead : w.droppedNoGuess, vars)}`
}
