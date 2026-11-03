// The stylesheet half of the theme checker (ADR 0072, rules in the private THEMES.md section 3).
//
// Reads `theme.css` as a browser does (`css-tokens.ts`, `css-tree.ts`) and refuses what the
// standard refuses. The order of the passes matters only for what gets reported; any one
// finding refuses the theme.
//
//   1. Size (A5) before anything, so an oversized upload is not tokenized at all.
//   2. Syntax a browser would repair or drop (X1).
//   3. Rules that hold wherever a token sits, preludes included: URLs (A2), `!important` (P1),
//      `var()` names (V1), `expression()` (A1).
//   4. Rule structure: at-rules (A1), selectors (S1, S2), declarations (`check-values.ts`).
//
// The input is a STRING, and a browser reads BYTES. This is a gate only for a string that came
// from `decodeThemeText` (`file-content.ts`): a UTF-16 byte order mark, for one, makes the
// browser read rules that a lenient UTF-8 decode turned into a harmless comment here.

import { asciiLower, tokenizeCss } from '@/theme/css-tokens'
import { ALLOWED_AT_RULES } from '@/theme/css-names'
import {
  buildTree, type CssBlockNode, type CssNode, type CssRule, isToken, meaningful,
  parseDeclarations, parseRules, varName,
} from '@/theme/css-tree'
import { checkDeclaration } from '@/theme/check-values'
import { Findings } from '@/theme/findings'
import { isSafePackagePath } from '@/theme/package-path'
import { THEME_LIMITS, type ThemeContract, type ThemeSurface, type Violation } from '@/theme/types'

const FILE = 'theme.css'

type Ctx = {
  f: Findings
  contract: ThemeContract
  packageFiles: ReadonlySet<string>
  surfaces: Set<ThemeSurface>
}

export function checkThemeCss(css: string, contract: ThemeContract, packageFiles: ReadonlySet<string>): Violation[] {
  const bytes = new TextEncoder().encode(css).length
  if (bytes > THEME_LIMITS.cssBytes) return [{ rule: 'A5', file: FILE, line: 0, col: 0, subject: String(bytes) }]

  const f = new Findings(css, FILE)
  const { tokens, errors } = tokenizeCss(css)
  for (const e of errors) f.add('X1', e.offset, css.length)
  for (const t of tokens) if (t.type === 'bad-string' || t.type === 'bad-url') f.add('X1', t.start, t.end)

  const { nodes, problems } = buildTree(tokens)
  for (const p of problems) f.add('X1', p.offset, p.end)
  if (problems.some((p) => p.kind === 'too-deep')) return f.list()

  const ctx: Ctx = { f, contract, packageFiles, surfaces: new Set() }
  checkEverywhere(nodes, ctx)
  checkRuleList(parseRules(nodes, true), 'top', ctx)
  for (const surface of ['blog', 'front'] as const) {
    if (!ctx.surfaces.has(surface)) f.addUnplaced('S2', surface)
  }
  return f.list()
}

// Rules that hold wherever a token sits ───────────────────────────────────────

function checkEverywhere(nodes: readonly CssNode[], ctx: Ctx): void {
  const { f } = ctx
  for (let k = 0; k < nodes.length; k++) {
    const n = nodes[k]!
    if (n.kind === 'token') {
      if (n.token.type === 'url') checkTarget(n.token.value, n, ctx)
      if (n.token.type === 'delim' && n.token.value === '!') {
        let j = k + 1
        while (isToken(nodes[j], 'whitespace')) j += 1
        const next = nodes[j]
        if (next && next.kind === 'token' && next.token.type === 'ident' && asciiLower(next.token.value) === 'important') {
          f.add('P1', n.start, next.end)
        }
      }
      continue
    }
    if (n.kind === 'function') {
      const lower = asciiLower(n.name)
      if (lower === 'url' || lower === 'src') {
        // The quoted form. The URL must be the literal string: `src(var(--x))` would let a
        // custom property, checked nowhere as a URL, choose what the browser fetches.
        const first = meaningful(n.children)[0]
        if (first && first.kind === 'token' && first.token.type === 'string') checkTarget(first.token.value, n, ctx)
        else f.add('A2', n.start, n.end)
        if (containsVar(n.children)) f.add('A2', n.start, n.end)
      }
      if (lower === 'image-set' || lower === '-webkit-image-set' || lower === 'image') {
        // A bare string in these is a URL, and a var() could hand them one.
        for (const c of n.children) {
          if (c.kind === 'token' && c.token.type === 'string') checkTarget(c.token.value, c, ctx)
          if (c.kind === 'function' && asciiLower(c.name) === 'var') f.add('A2', c.start, c.end)
        }
      }
      if (lower === 'expression') f.add('A1', n.start, n.end)
      // inherit(--x) reads a variable from the parent and if(style(--x: ...)) tests one: both
      // reach variables by name without var(), so past the V1 list.
      if (lower === 'inherit' || lower === 'if') f.add('V1', n.start, n.end)
      if (lower === 'var') {
        const name = varName(n)
        const ok = name !== null && (name.startsWith('--t-') || name.startsWith('--l-') || ctx.contract.vars.has(name))
        if (!ok) f.add('V1', n.start, n.end)
      }
    }
    checkEverywhere(n.children, ctx)
  }
}

function containsVar(nodes: readonly CssNode[]): boolean {
  return nodes.some((n) => n.kind !== 'token' && ((n.kind === 'function' && asciiLower(n.name) === 'var') || containsVar(n.children)))
}

/** A2: a URL is a file in this package, named exactly as the package names it. */
function checkTarget(target: string, node: CssNode, ctx: Ctx): void {
  if (!(isSafePackagePath(target) && ctx.packageFiles.has(target))) ctx.f.add('A2', node.start, node.end)
}

// Rule structure ──────────────────────────────────────────────────────────────

type Where = 'top' | 'group' | 'keyframes'

function checkRuleList(rules: readonly CssRule[], where: Where, ctx: Ctx): void {
  const { f } = ctx
  for (const r of rules) {
    if (r.kind === 'at') {
      const lower = asciiLower(r.name)
      if (!ALLOWED_AT_RULES.has(lower)) {
        f.add('A1', r.start, r.preludeEnd)
        continue
      }
      if (where === 'keyframes' || r.block === null) {
        f.add('X1', r.start, r.preludeEnd)
        continue
      }
      checkRuleList(parseRules(r.block.children, false), lower === 'keyframes' ? 'keyframes' : 'group', ctx)
      continue
    }
    if (r.block === null || meaningful(r.prelude).length === 0) {
      f.add('X1', r.start, r.block ? r.block.end : r.preludeEnd)
      if (r.block === null) continue
    }
    if (where === 'keyframes') {
      // `from`, `to`, percentages and timeline ranges; a class here is a rule the browser drops.
      const bad = meaningful(r.prelude).find((n) => !isKeyframeSelectorPart(n))
      if (bad) f.add('X1', bad.start, r.preludeEnd)
    } else {
      // A `;` here means the rule before it was left unclosed and has swallowed this selector;
      // `<!--` or `-->` inside a group is part of a selector no browser matches.
      const junk = r.prelude.find((n) => isToken(n, 'semicolon') || isToken(n, 'CDO') || isToken(n, 'CDC'))
      if (junk) f.add('X1', junk.start, r.preludeEnd)
      checkSelector(r.prelude, ctx)
    }
    checkDeclarationList(r.block, ctx)
  }
}

const KEYFRAME_WORDS: ReadonlySet<string> = new Set([
  'from', 'to', 'cover', 'contain', 'entry', 'exit', 'entry-crossing', 'exit-crossing',
])
const isKeyframeSelectorPart = (n: CssNode) =>
  n.kind === 'token' && (n.token.type === 'percentage' || n.token.type === 'comma' ||
    (n.token.type === 'ident' && KEYFRAME_WORDS.has(asciiLower(n.token.value))))

function checkDeclarationList(block: CssBlockNode, ctx: Ctx): void {
  for (const item of parseDeclarations(block.children)) {
    if (item.kind === 'declaration') {
      checkDeclaration(item.decl, ctx.f)
      continue
    }
    // CSS nesting (a rule inside a rule) is not part of theme api 1; an ident with no colon is
    // dropped by every browser. Both refuse, so an author is never left wondering which half of
    // a sheet a browser actually applied.
    ctx.f.add('X1', item.start, item.end)
    if (item.kind === 'nested' && item.atName !== null && !ALLOWED_AT_RULES.has(asciiLower(item.atName))) {
      ctx.f.add('A1', item.start, item.end)
    }
  }
}

// S1, S2 ──────────────────────────────────────────────────────────────────────

function noteSurface(key: string, ctx: Ctx): void {
  const surface = ctx.contract.surfaceOf.get(key)
  if (surface) ctx.surfaces.add(surface)
}

/**
 * Every class, id and `data-*` attribute in a selector, at any depth: inside `:is()`, `:where()`,
 * `:not()`, `:has()`, `:nth-child(... of ...)` and every other functional pseudo-class.
 */
function checkSelector(nodes: readonly CssNode[], ctx: Ctx): void {
  const { f, contract } = ctx
  for (let k = 0; k < nodes.length; k++) {
    const n = nodes[k]!
    if (n.kind === 'token') {
      const next = nodes[k + 1]
      if (n.token.type === 'delim' && n.token.value === '.' && next?.kind === 'token' && next.token.type === 'ident') {
        const name = next.token.value
        if (!contract.classes.has(name)) f.add('S1', n.start, next.end)
        noteSurface(`.${name}`, ctx)
        k += 1
      } else if (n.token.type === 'hash') {
        if (!contract.ids.has(n.token.value)) f.add('S1', n.start, n.end)
        noteSurface(`#${n.token.value}`, ctx)
      }
      continue
    }
    if (n.kind === 'block' && n.open === '[') checkAttributeSelector(n, ctx)
    else checkSelector(n.children, ctx)
  }
}

const delimOf = (n: CssNode | undefined) => (n?.kind === 'token' && n.token.type === 'delim' ? n.token.value : '')

/**
 * `[data-x]` must be a contract attribute. `[class~=x]` and `[id=x]` are a class and an id
 * spelled differently, so they are held to the same lists; a substring match on either
 * (`[class*=post]`) reaches names nobody promised to keep, and is refused.
 */
function checkAttributeSelector(block: CssBlockNode, ctx: Ctx): void {
  const { f, contract } = ctx
  const m = meaningful(block.children)
  let k = 0
  const isIdentAt = (j: number) => m[j]?.kind === 'token' && (m[j] as Extract<CssNode, { kind: 'token' }>).token.type === 'ident'
  if (delimOf(m[0]) === '|') k = 1
  else if ((isIdentAt(0) || delimOf(m[0]) === '*') && delimOf(m[1]) === '|' && isIdentAt(2)) k = 2
  const nameNode = m[k]
  // Anything else is not an attribute selector at all; the browser drops the whole rule.
  if (!nameNode || nameNode.kind !== 'token' || nameNode.token.type !== 'ident') return
  const name = asciiLower(nameNode.token.value)
  k += 1
  let op = ''
  if (delimOf(m[k]) === '=') {
    op = '='
    k += 1
  } else if ('~|^$*'.includes(delimOf(m[k]) || '?') && delimOf(m[k + 1]) === '=') {
    op = `${delimOf(m[k])}=`
    k += 2
  }
  const valueNode = m[k]
  const value = valueNode?.kind === 'token' ? valueNode.token.value : ''

  if (name.startsWith('data-') && !contract.attributes.has(name)) f.add('S1', block.start, block.end)
  if (name !== 'class' && name !== 'id') return
  if (op === '') return
  if (op !== '=' && op !== '~=') {
    f.add('S1', block.start, block.end)
    return
  }
  const allowed = name === 'class' ? contract.classes : contract.ids
  const words = value.split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.some((w) => !allowed.has(w))) f.add('S1', block.start, block.end)
  for (const w of words) noteSurface(`${name === 'class' ? '.' : '#'}${w}`, ctx)
}
