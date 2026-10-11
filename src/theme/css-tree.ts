// Tokens to component values to rules, CSS Syntax Level 3 section 5, as far as the theme
// checker needs it.
//
// Two passes. `buildTree` groups tokens into blocks and functions exactly as the spec's
// "consume a component value" does, and reports what a forgiving browser would silently
// repair: a block left open at end of input, a closer with nothing to close. `parseRules` and
// `parseDeclarations` then read rule structure off those values.
//
// The grouping pass is iterative with a depth ceiling, not recursive: a stranger's sheet of
// 60,000 `(` would otherwise overflow the stack of the process doing the checking. Past the
// ceiling the tree is not built at all and the caller refuses the sheet.

import type { CssToken } from '@/theme/css-tokens'

export type CssBlockOpen = '{' | '(' | '['

export type CssNode =
  | { kind: 'token'; token: CssToken; start: number; end: number }
  | { kind: 'block'; open: CssBlockOpen; start: number; end: number; children: CssNode[] }
  | { kind: 'function'; name: string; start: number; end: number; children: CssNode[] }

export type CssBlockNode = Extract<CssNode, { kind: 'block' }>
export type CssFunctionNode = Extract<CssNode, { kind: 'function' }>

export type TreeProblem = { kind: 'unclosed' | 'stray' | 'too-deep'; offset: number; end: number }

/** Deeper than any real stylesheet nests: `:is(:not(:has(...)))` inside two at-rules is about 8. */
export const MAX_DEPTH = 64

const CLOSER: Record<CssBlockOpen | 'function', CssToken['type']> = { '{': '}', '(': ')', '[': ']', function: ')' }

export function buildTree(tokens: readonly CssToken[]): { nodes: CssNode[]; problems: TreeProblem[] } {
  type Frame = { node: CssBlockNode | CssFunctionNode; closer: CssToken['type'] }
  const root: CssNode[] = []
  const problems: TreeProblem[] = []
  const stack: Frame[] = []
  const current = () => (stack.length > 0 ? stack[stack.length - 1]!.node.children : root)

  for (const token of tokens) {
    const top = stack[stack.length - 1]
    if (top && token.type === top.closer) {
      top.node.end = token.end
      stack.pop()
      continue
    }
    if (token.type === '{' || token.type === '(' || token.type === '[' || token.type === 'function') {
      if (stack.length >= MAX_DEPTH) {
        problems.push({ kind: 'too-deep', offset: token.start, end: token.end })
        return { nodes: [], problems }
      }
      const node: CssBlockNode | CssFunctionNode =
        token.type === 'function'
          ? { kind: 'function', name: token.value, start: token.start, end: token.end, children: [] }
          : { kind: 'block', open: token.type, start: token.start, end: token.end, children: [] }
      current().push(node)
      stack.push({ node, closer: CLOSER[token.type === 'function' ? 'function' : token.type] })
      continue
    }
    if (token.type === '}' || token.type === ')' || token.type === ']') {
      problems.push({ kind: 'stray', offset: token.start, end: token.end })
    }
    current().push({ kind: 'token', token, start: token.start, end: token.end })
  }
  // Blocks the input never closed. A browser closes them for you; a gate says so.
  const last = tokens[tokens.length - 1]
  for (const frame of stack) {
    frame.node.end = last ? last.end : frame.node.end
    problems.push({ kind: 'unclosed', offset: frame.node.start, end: frame.node.start + 1 })
  }
  return { nodes: root, problems }
}

export const isToken = (n: CssNode | undefined, type: CssToken['type']): boolean =>
  n !== undefined && n.kind === 'token' && n.token.type === type

export const isWhitespace = (n: CssNode | undefined) => isToken(n, 'whitespace')

/** The nodes that carry meaning: whitespace dropped. */
export const meaningful = (nodes: readonly CssNode[]): CssNode[] => nodes.filter((n) => !isWhitespace(n))

/** The name a `var()` reads, or null when its first argument is not a custom property name. */
export function varName(fn: CssFunctionNode): string | null {
  const first = meaningful(splitOnCommas(fn.children)[0]!)
  const n = first[0]
  if (first.length !== 1 || n === undefined || n.kind !== 'token' || n.token.type !== 'ident') return null
  return n.token.value.startsWith('--') ? n.token.value : null
}

/** Splits a list on its top-level commas. */
export function splitOnCommas(nodes: readonly CssNode[]): CssNode[][] {
  const out: CssNode[][] = [[]]
  for (const n of nodes) {
    if (isToken(n, 'comma')) out.push([])
    else out[out.length - 1]!.push(n)
  }
  return out
}

export type CssRule =
  | { kind: 'at'; name: string; start: number; preludeEnd: number; prelude: CssNode[]; block: CssBlockNode | null }
  | { kind: 'qualified'; start: number; preludeEnd: number; prelude: CssNode[]; block: CssBlockNode | null }

const isCurlyBlock = (n: CssNode | undefined): n is CssBlockNode =>
  n !== undefined && n.kind === 'block' && n.open === '{'

/** Reads an at-rule starting at `nodes[i]`; returns the rule and the index after it. */
function readAtRule(nodes: readonly CssNode[], i: number): { rule: Extract<CssRule, { kind: 'at' }>; next: number } {
  const head = nodes[i]!
  const name = head.kind === 'token' ? head.token.value : ''
  const prelude: CssNode[] = []
  let k = i + 1
  for (; k < nodes.length; k++) {
    const n = nodes[k]!
    if (isToken(n, 'semicolon')) {
      return { rule: { kind: 'at', name, start: head.start, preludeEnd: n.start, prelude, block: null }, next: k + 1 }
    }
    if (isCurlyBlock(n)) {
      return { rule: { kind: 'at', name, start: head.start, preludeEnd: n.start, prelude, block: n }, next: k + 1 }
    }
    prelude.push(n)
  }
  const end = prelude.length > 0 ? prelude[prelude.length - 1]!.end : head.end
  return { rule: { kind: 'at', name, start: head.start, preludeEnd: end, prelude, block: null }, next: k }
}

/**
 * A list of rules: the stylesheet itself, or the inside of `@media`, `@supports`, `@container`
 * and `@keyframes`. CDO and CDC are skipped only at the top, as the spec skips them.
 */
export function parseRules(nodes: readonly CssNode[], topLevel: boolean): CssRule[] {
  const rules: CssRule[] = []
  let i = 0
  while (i < nodes.length) {
    const n = nodes[i]!
    if (isWhitespace(n) || (topLevel && (isToken(n, 'CDO') || isToken(n, 'CDC')))) {
      i += 1
      continue
    }
    if (isToken(n, 'at-keyword')) {
      const { rule, next } = readAtRule(nodes, i)
      rules.push(rule)
      i = next
      continue
    }
    const prelude: CssNode[] = []
    let k = i
    while (k < nodes.length && !isCurlyBlock(nodes[k])) prelude.push(nodes[k++]!)
    const block = k < nodes.length ? (nodes[k] as CssBlockNode) : null
    const preludeEnd = block ? block.start : prelude[prelude.length - 1]!.end
    rules.push({ kind: 'qualified', start: n.start, preludeEnd, prelude, block })
    i = k + 1
  }
  return rules
}

export type CssDeclaration = {
  /** Decoded property name as written; compare non-custom names with `asciiLower`. */
  name: string
  start: number
  nameEnd: number
  end: number
  valueStart: number
  value: CssNode[]
}

export type DeclarationListItem =
  | { kind: 'declaration'; decl: CssDeclaration }
  /** A rule where a declaration belongs: CSS nesting, which theme api 1 does not accept. */
  | { kind: 'nested'; start: number; end: number; atName: string | null }
  /** Text a browser would drop: an ident with no colon after it. */
  | { kind: 'invalid'; start: number; end: number }

/**
 * The inside of a style rule or keyframe, read the way a browser that supports CSS nesting
 * reads it. A nested rule is recognised the way the current spec recognises it: anything that
 * does not start with an ident, or an ident whose run up to `;` holds a `{}` block (unless it
 * is a custom property, whose value may hold blocks).
 */
export function parseDeclarations(nodes: readonly CssNode[]): DeclarationListItem[] {
  const items: DeclarationListItem[] = []
  let i = 0
  while (i < nodes.length) {
    const n = nodes[i]!
    if (isWhitespace(n) || isToken(n, 'semicolon')) {
      i += 1
      continue
    }
    if (isToken(n, 'at-keyword')) {
      const { rule, next } = readAtRule(nodes, i)
      const end = rule.block ? rule.block.end : rule.preludeEnd
      items.push({ kind: 'nested', start: n.start, end, atName: rule.name })
      i = next
      continue
    }
    if (isToken(n, 'ident')) {
      const name = n.kind === 'token' ? n.token.value : ''
      const custom = name.startsWith('--')
      let k = i
      let nestedAt = -1
      while (k < nodes.length && !isToken(nodes[k], 'semicolon')) {
        if (isCurlyBlock(nodes[k]) && nestedAt < 0) {
          nestedAt = k
          if (!custom) break
        }
        k += 1
      }
      // A custom property may hold a `{}` block only as its whole value. Anything else around
      // the block makes the declaration invalid, and a browser then re-reads the same text as
      // a nested rule: `--t-x: is(*), body {font-size: 40px}` styles body, unchecked.
      if (custom && nestedAt >= 0 && isWholeValue(nodes.slice(i, k), nodes[nestedAt]!)) nestedAt = -1
      if (nestedAt >= 0) {
        items.push({ kind: 'nested', start: n.start, end: nodes[nestedAt]!.end, atName: null })
        i = nestedAt + 1
        continue
      }
      items.push(readDeclaration(nodes.slice(i, k), name))
      i = k + 1
      continue
    }
    let k = i
    while (k < nodes.length && !isToken(nodes[k], 'semicolon') && !isCurlyBlock(nodes[k])) k += 1
    const end = k < nodes.length ? nodes[k]!.end : nodes[k - 1]!.end
    items.push({ kind: 'nested', start: n.start, end, atName: null })
    i = k + 1
  }
  return items
}

/** True when `block` is the only thing after the colon in a declaration's run. */
function isWholeValue(run: readonly CssNode[], block: CssNode): boolean {
  const colon = run.findIndex((n) => isToken(n, 'colon'))
  const value = meaningful(run.slice(colon + 1))
  return colon > 0 && value.length === 1 && value[0] === block
}

function readDeclaration(run: readonly CssNode[], name: string): DeclarationListItem {
  const head = run[0]!
  const end = run[run.length - 1]!.end
  let k = 1
  while (isWhitespace(run[k])) k += 1
  if (!isToken(run[k], 'colon')) return { kind: 'invalid', start: head.start, end }
  k += 1
  while (isWhitespace(run[k])) k += 1
  let last = run.length
  while (last > k && isWhitespace(run[last - 1])) last -= 1
  const value = run.slice(k, last)
  const valueStart = value.length > 0 ? value[0]!.start : end
  return { kind: 'declaration', decl: { name, start: head.start, nameEnd: head.end, end, valueStart, value } }
}
