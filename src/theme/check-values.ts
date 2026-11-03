// The declaration-level rules: what a theme may WRITE as a value (C1, T1, F1, and the
// property half of V1 and A1; S3 is in `check-text.ts`). The rules that hold anywhere in the
// sheet, URLs, `!important`, `var()` names, live in `check-css.ts`.
//
// Known limits, accepted on purpose. Each lets an author make their own theme look worse;
// none fetches anything, runs anything or reads anything outside the contract.
//   - A relative colour channel can cancel its keyword: `calc(l * 0 + .6)` passes C1 and is a
//     fixed lightness. Telling that apart needs algebra over calc(), and the colour is still
//     written from a palette variable.
//   - `filter`, `transform` and `scale` can shift, invert or enlarge what the palette and type
//     settings produce. They are layout and effect tools too; refusing them takes away more
//     than it protects.
//   - `contrast-color()` and `light-dark()` are not refused; the colours inside them are.

import { asciiLower } from '@/theme/css-tokens'
import {
  CODE_PROPERTIES, COLOUR_FUNCTIONS, FONT_FAMILY_VARS, MATH_FUNCTIONS, NAMED_COLOURS,
  NAME_PROPERTIES, SIZE_PROPERTIES, SYSTEM_COLOURS, TEXT_PROPERTIES,
} from '@/theme/css-names'
import {
  type CssDeclaration, type CssFunctionNode, type CssNode, isToken, meaningful, splitOnCommas, varName,
} from '@/theme/css-tree'
import { checkAttr, checkText } from '@/theme/check-text'
import type { Findings } from '@/theme/findings'

const tokenValue = (n: CssNode | undefined): string =>
  n !== undefined && n.kind === 'token' ? n.token.value : ''
const isIdent = (n: CssNode | undefined, lower?: string): boolean =>
  isToken(n, 'ident') && (lower === undefined || asciiLower(tokenValue(n)) === lower)
/** The lowercase function name, or '' when `n` is not a function. */
const fnName = (n: CssNode | undefined): string => (n !== undefined && n.kind === 'function' ? asciiLower(n.name) : '')
const isDelim = (n: CssNode | undefined, c: string) => isToken(n, 'delim') && tokenValue(n) === c

/** The value without a trailing `! important`, which P1 reports on its own. */
function withoutImportant(nodes: readonly CssNode[]): CssNode[] {
  const idx = nodes.map((n, k) => ({ n, k })).filter(({ n }) => !isToken(n, 'whitespace'))
  const last = idx[idx.length - 1]
  const bang = idx[idx.length - 2]
  if (last && bang && isIdent(last.n, 'important') && isDelim(bang.n, '!')) return nodes.slice(0, bang.k)
  return [...nodes]
}

export function checkDeclaration(decl: CssDeclaration, f: Findings): void {
  const custom = decl.name.startsWith('--')
  // Custom property names are case-sensitive; every other property name is ASCII-insensitive
  // and is read without any vendor prefix, so `-webkit-hyphenate-character` meets the same
  // rules as `hyphenate-character`. Any prefix, not a list: Chrome still honours `-epub-`.
  const prop = custom ? decl.name : asciiLower(decl.name).replace(/^-[a-z0-9]+-/, '')
  const value = withoutImportant(decl.value)

  if (custom && !decl.name.startsWith('--t-')) f.add('V1', decl.start, decl.nameEnd)
  if (CODE_PROPERTIES.has(prop)) f.add('A1', decl.start, decl.nameEnd)

  checkColours(value, !custom && NAME_PROPERTIES.has(prop), f)

  if (prop === 'font-size') checkFontSize(value, decl, f)
  // Each scales text past the owner's size settings with no font-size involved.
  if (SIZE_PROPERTIES.has(prop)) f.add('T1', decl.start, decl.end)
  if (prop === 'font') {
    const m = meaningful(value)
    if (!(m.length === 1 && isIdent(m[0], 'inherit'))) f.add('T1', decl.start, decl.end)
  }
  if (prop === 'font-family') checkFontFamily(value, decl, f)

  if (prop === 'content') checkText(value, f, 'content')
  // A custom property's string can reach a reader through `var()` in any text property, so it
  // is held to the same rule where it is written.
  else if (custom) checkText(value, f, 'custom')
  else if (TEXT_PROPERTIES.has(prop)) checkText(value, f, prop)
  else checkAttr(value, f)
}

// C1 ──────────────────────────────────────────────────────────────────────────

const isColourKeyword = (lower: string) => NAMED_COLOURS.has(lower) || SYSTEM_COLOURS.has(lower)

/** The channel keywords relative colour syntax defines, per function and per color() space. */
const CHANNELS: Record<string, readonly string[]> = {
  rgb: ['r', 'g', 'b'], rgba: ['r', 'g', 'b'], hsl: ['h', 's', 'l'], hsla: ['h', 's', 'l'],
  hwb: ['h', 'w', 'b'], lab: ['l', 'a', 'b'], oklab: ['l', 'a', 'b'], lch: ['l', 'c', 'h'],
  oklch: ['l', 'c', 'h'],
}
const RGB_SPACES = ['srgb', 'srgb-linear', 'display-p3', 'a98-rgb', 'prophoto-rgb', 'rec2020']
const XYZ_SPACES = ['xyz', 'xyz-d50', 'xyz-d65']

/** True when `nodes` name one of `keywords` somewhere, looking through math and brackets. */
/** var() or env() anywhere below: either can hold a constant, which is a hardcoded colour again. */
function readsVariable(nodes: readonly CssNode[]): boolean {
  return nodes.some((n) => {
    if (n.kind === 'token') return false
    if (n.kind === 'function' && (fnName(n) === 'var' || fnName(n) === 'env')) return true
    return readsVariable(n.children)
  })
}

function mentionsChannel(nodes: readonly CssNode[], keywords: readonly string[]): boolean {
  return nodes.some((n) => {
    if (n.kind === 'token') return n.token.type === 'ident' && keywords.includes(asciiLower(n.token.value))
    if (n.kind === 'block') return n.open === '(' && mentionsChannel(n.children, keywords)
    return MATH_FUNCTIONS.has(fnName(n)) && mentionsChannel(n.children, keywords)
  })
}

/**
 * `oklch(from var(--c-bg) calc(l * .72) c h)`: relative colour from a variable, where every
 * channel before `/` is derived. A channel is a channel keyword, or calc(), min(), max() or
 * clamp() that uses a channel keyword. Without that last condition
 * `oklch(from var(--c-bg) .5 .2 30)` would be accepted and is a hardcoded colour: the origin is
 * read and then ignored. Bare numbers stay legal in the alpha after `/`.
 */
function isDerivedColour(fn: CssFunctionNode): boolean {
  const lower = asciiLower(fn.name)
  const m = meaningful(fn.children)
  if (!isIdent(m[0], 'from') || fnName(m[1]) !== 'var') return false
  let rest = m.slice(2)
  let keywords: readonly string[] | undefined = CHANNELS[lower]
  if (lower === 'color') {
    const space = rest[0]?.kind === 'token' && rest[0].token.type === 'ident' ? asciiLower(rest[0].token.value) : ''
    keywords = RGB_SPACES.includes(space) ? ['r', 'g', 'b'] : XYZ_SPACES.includes(space) ? ['x', 'y', 'z'] : undefined
    rest = rest.slice(1)
  }
  if (keywords === undefined) return false
  const slash = rest.findIndex((n) => isDelim(n, '/'))
  const channels = slash < 0 ? rest : rest.slice(0, slash)
  if (channels.length !== 3) return false
  // `alpha` is not a colour channel here: a palette colour is opaque, so `calc(alpha * 255)` is
  // the constant 255. It stays legal after `/`, which this does not read.
  return channels.every((c) => {
    if (c.kind === 'token') return c.token.type === 'ident' && keywords.includes(asciiLower(c.token.value))
    return MATH_FUNCTIONS.has(fnName(c)) && mentionsChannel(c.children, keywords) && !readsVariable(c.children)
  })
}

/** Every colour inside `color-mix()` must be a variable, derived, transparent or currentcolor. */
function checkColorMix(fn: CssFunctionNode, f: Findings): void {
  const args = splitOnCommas(fn.children)
  const first = meaningful(args[0] ?? [])
  const colourArgs = isIdent(first[0], 'in') ? args.slice(1) : args
  for (const arg of colourArgs) {
    const parts = meaningful(arg).filter(
      (n) =>
        !isToken(n, 'percentage') && !isToken(n, 'number') && !isToken(n, 'dimension') &&
        !(n.kind === 'function' && MATH_FUNCTIONS.has(asciiLower(n.name))),
    )
    if (parts.length !== 1) {
      const span = meaningful(arg)
      if (span.length > 0) f.add('C1', span[0]!.start, span[span.length - 1]!.end)
      else f.add('C1', fn.start, fn.end)
      continue
    }
    const p = parts[0]!
    const name = fnName(p)
    const ok = name === 'var' || name === 'color-mix' || COLOUR_FUNCTIONS.has(name) ||
      isIdent(p, 'transparent') || isIdent(p, 'currentcolor')
    if (!ok) f.add('C1', p.start, p.end)
  }
}

function checkColours(nodes: readonly CssNode[], namesAreNotColours: boolean, f: Findings): void {
  const walk = (list: readonly CssNode[], refuseNames: boolean) => {
    for (const n of list) {
      if (n.kind === 'token') {
        if (n.token.type === 'hash') f.add('C1', n.start, n.end)
        else if (refuseNames && n.token.type === 'ident' && isColourKeyword(asciiLower(n.token.value))) {
          f.add('C1', n.start, n.end)
        }
        continue
      }
      if (n.kind === 'block') {
        walk(n.children, refuseNames)
        continue
      }
      const lower = asciiLower(n.name)
      if (COLOUR_FUNCTIONS.has(lower) && !isDerivedColour(n)) f.add('C1', n.start, n.end)
      if (lower === 'color-mix') checkColorMix(n, f)
      // Inside counter() the idents are a counter's name and a counter style, not colours.
      walk(n.children, refuseNames && lower !== 'counter' && lower !== 'counters')
    }
  }
  walk(nodes, !namesAreNotColours)
}

// T1 and F1 ──────────────────────────────────────────────────────────────────

/** `var(--fs-*)`, with any fallback held to the same arithmetic. */
function isFontSizeVar(fn: CssFunctionNode): boolean {
  const name = varName(fn)
  if (name === null || !name.startsWith('--fs-')) return false
  const comma = fn.children.findIndex((n) => isToken(n, 'comma'))
  if (comma < 0) return true
  const fallback = fn.children.slice(comma + 1)
  return meaningful(fallback).length > 0 && isFontSizeArithmetic(fallback)
}

function isFontSizeArithmetic(nodes: readonly CssNode[]): boolean {
  return nodes.every((n) => {
    if (n.kind === 'token') {
      const t = n.token
      if (t.type === 'whitespace' || t.type === 'number' || t.type === 'percentage' || t.type === 'comma') return true
      if (t.type === 'dimension') return asciiLower(t.value) === 'em'
      return t.type === 'delim' && '+-*/'.includes(t.value)
    }
    if (n.kind === 'block') return n.open === '(' && isFontSizeArithmetic(n.children)
    const lower = asciiLower(n.name)
    if (lower === 'var') return isFontSizeVar(n)
    return MATH_FUNCTIONS.has(lower) && isFontSizeArithmetic(n.children)
  })
}

function containsFontSizeVar(nodes: readonly CssNode[]): boolean {
  return nodes.some((n) => {
    if (n.kind === 'token') return false
    if (n.kind === 'function' && asciiLower(n.name) === 'var') return isFontSizeVar(n)
    return containsFontSizeVar(n.children)
  })
}

function checkFontSize(value: readonly CssNode[], decl: CssDeclaration, f: Findings): void {
  const m = meaningful(value)
  if (m.length !== 1) {
    f.add('T1', decl.valueStart, decl.end)
    return
  }
  const p = m[0]!
  const ok =
    isIdent(p, 'inherit') || isIdent(p, 'initial') || isIdent(p, 'unset') ||
    (p.kind === 'token' && p.token.type === 'dimension' && asciiLower(p.token.value) === 'em') ||
    isToken(p, 'percentage') ||
    (p.kind === 'function' && fnName(p) === 'var' && isFontSizeVar(p)) ||
    (p.kind === 'function' && MATH_FUNCTIONS.has(fnName(p)) &&
      containsFontSizeVar(p.children) && isFontSizeArithmetic(p.children))
  if (!ok) f.add('T1', p.start, p.end)
}

function checkFontFamily(value: readonly CssNode[], decl: CssDeclaration, f: Findings): void {
  const m = meaningful(value)
  const p = m[0]
  const ok =
    m.length === 1 &&
    (isIdent(p, 'inherit') ||
      (p?.kind === 'function' && fnName(p) === 'var' && meaningful(p.children).length === 1 &&
        FONT_FAMILY_VARS.has(varName(p) ?? '')))
  if (!ok) f.add('F1', decl.valueStart, decl.end)
}
