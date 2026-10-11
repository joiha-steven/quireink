// S3: no words in text a theme generates. Labels come from `--l-*` variables, which the
// engine fills per language; a theme may print digits and symbols, never something a reader
// would read as words. Also `attr()` outside generated text (A1).

import { asciiLower } from '@/theme/css-tokens'
import { COUNTER_STYLES, LIST_STYLE_KEYWORDS, TEXT_FUNCTIONS } from '@/theme/css-names'
import { type CssFunctionNode, type CssNode, meaningful, splitOnCommas, varName } from '@/theme/css-tree'
import type { Findings } from '@/theme/findings'

/**
 * A character that reads as part of a word: any letter, any digit but 0-9, and the blocks of
 * letter-shaped symbols (enclosed alphanumerics U+2460-24FF, enclosed CJK and squared
 * abbreviations U+3200-33FF, mathematical alphanumerics U+1D400-1D7FF, enclosed alphanumeric
 * supplement U+1F100-1F1FF, letterlike symbols U+2100-214F such as ℡ and ℻, and braille
 * U+2800-28FF, which a braille reader reads as letters). Ⓗ and 🅱 are So, not L, and spell just
 * as well.
 */
const WORDLIKE = /[\p{L}℀-⅏⠀-⣿①-⓿㈀-㏿\u{1D400}-\u{1D7FF}\u{1F100}-\u{1F1FF}]|(?![0-9])\p{N}/u

/** `content`, a custom property, or the name of another text property (`quotes`, `list-style`...). */
export type TextContext = 'content' | 'custom' | string

/** The style argument of counter() and counters() must print digits or symbols. */
function counterStyleOk(fn: CssFunctionNode, lower: string): boolean {
  const args = splitOnCommas(fn.children)
  const style = args[lower === 'counter' ? 1 : 2]
  if (style === undefined) return true
  const m = meaningful(style)
  const n = m[0]
  return m.length === 1 && n !== undefined && n.kind === 'token' && n.token.type === 'ident' &&
    COUNTER_STYLES.has(asciiLower(n.token.value))
}

export function checkText(nodes: readonly CssNode[], f: Findings, ctx: TextContext): void {
  const listStyle = ctx === 'list-style' || ctx === 'list-style-type'
  for (const n of nodes) {
    if (n.kind === 'token') {
      if (n.token.type === 'string' && WORDLIKE.test(n.token.value)) f.add('S3', n.start, n.end)
      // `list-style-type: upper-alpha` with `counter-reset: list-item 8` prints H as a marker.
      if (listStyle && n.token.type === 'ident') {
        const v = asciiLower(n.token.value)
        if (!COUNTER_STYLES.has(v) && !LIST_STYLE_KEYWORDS.has(v)) f.add('S3', n.start, n.end)
      }
      continue
    }
    if (n.kind === 'function') {
      const lower = asciiLower(n.name)
      if (TEXT_FUNCTIONS.has(lower)) f.add('S3', n.start, n.end)
      else if (ctx === 'content' && lower === 'var' && !(varName(n) ?? '').startsWith('--l-')) f.add('S3', n.start, n.end)
      // A variable could carry an alphabetic style past the ident rule above.
      else if (listStyle && lower === 'var') f.add('S3', n.start, n.end)
      else if ((lower === 'counter' || lower === 'counters') && !counterStyleOk(n, lower)) f.add('S3', n.start, n.end)
    }
    // Inside a function the list-style ident rule no longer applies (url(), image-set()).
    checkText(n.children, f, listStyle ? 'nested' : ctx)
  }
}

/**
 * `attr()` outside generated text. Typed `attr()` can turn markup into any value, and the
 * markup is where readers' and commenters' text lives, so it is refused with the other
 * constructs that reach outside the stylesheet (A1).
 */
export function checkAttr(nodes: readonly CssNode[], f: Findings): void {
  for (const n of nodes) {
    if (n.kind === 'token') continue
    if (n.kind === 'function' && asciiLower(n.name) === 'attr') f.add('A1', n.start, n.end)
    checkAttr(n.children, f)
  }
}
