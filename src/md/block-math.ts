// A display formula standing as its own block. This blog's syntax, kept out of the loop.
//
// `block.ts` is CommonMark's algorithm and nothing else, and display maths is not in CommonMark
// — `$$…$$` is Pandoc's and `\[…\]` is LaTeX's, and this blog reads both (ADR 0020). Keeping the
// whole decision here is the same separation `html-rules.ts` makes on the other side: the spec
// in one file, what one site wants in another.
//
// WHY IT IS A BLOCK AT ALL, when the inline parser already knows both delimiters: because a
// standalone equation gets a wrapper that SCROLLS. A derivation is routinely wider than the
// reading measure, and without a box of its own it widens the article instead.
//
// ⚠️ TWO RULES HERE WERE EACH LEARNED BY BREAKING SOMETHING, and both are about greed.
//
//  1. A FORMULA OPENS ONLY IF IT CLOSES. The first version opened on any line starting with a
//     delimiter and went looking for the closer afterwards. CommonMark example 14 is nine lines
//     of escaped punctuation, one of them `\[not a link](/foo)`; there is no `\]` below it, and
//     the block swallowed everything to the end of the document.
//
//  2. NOTHING MAY FOLLOW THE CLOSER on its line. `\[js\](url)` is what the old editor made of
//     `[js](url)` on save — an escaped bracket, not a formula — and a block that closed at `\]`
//     and stopped looking threw `(url)` away. `marked` never did either of these, because its
//     matcher takes the whole formula or nothing; a line-driven parser has to be told.

import type { Line } from './line'

export type MathDelim = 'dollar' | 'bracket'

const CLOSER: Record<MathDelim, string> = { dollar: '$$', bracket: '\\]' }

/**
 * The TeX before a display formula's closer, when that closer ENDS the line. Otherwise `null`.
 *
 * The TEX IS RETURNED rather than the line being discarded, which is what separates this from a
 * code fence's `closesFence`: a fence's closing line holds nothing, and `$$x = 1$$` holds the
 * whole formula.
 */
export function closerIn(text: string, delim: MathDelim): string | null {
  const closer = CLOSER[delim]
  const at = text.indexOf(closer)
  if (at === -1) return null
  return text.slice(at + closer.length).trim() === '' ? text.slice(0, at) : null
}

/** `closerIn`, for the line a parser is holding. */
export function closesMath(line: Line, delim: MathDelim): string | null {
  return closerIn(line.rest(), delim)
}

/** The delimiter a line opens with, if it opens with one at all. */
function opensWith(line: Line): { delim: MathDelim; rest: string } | null {
  if (line.indent() >= 4) return null
  const rest = line.clone()
  rest.skipWhitespace()
  const text = rest.rest()
  if (text.startsWith('$$')) return { delim: 'dollar', rest: text.slice(2) }
  if (text.startsWith('\\[')) return { delim: 'bracket', rest: text.slice(2) }
  return null
}

/**
 * Whether the formula opened on `lines[at]` is ever closed.
 *
 * ⚠️ A BLANK LINE ENDS THE SEARCH, which is stricter than `marked`, whose matcher crosses one.
 * That is deliberate: a display formula does not contain a paragraph break, and the difference
 * between the two answers is whether an unclosed `$$` in a long post turns every paragraph
 * below it into one enormous formula, or leaves them as prose. Being wrong in the second
 * direction leaves a stray `$$` on the page; being wrong in the first eats the article.
 */
function everCloses(lines: string[], at: number, rest: string, delim: MathDelim): boolean {
  if (closerIn(rest, delim) !== null) return true
  for (let i = at + 1; i < lines.length; i++) {
    const text = lines[i]!
    if (text.trim() === '') return false
    if (closerIn(text, delim) !== null) return true
  }
  return false
}

/** What a line opens, for the parser to build — or `null` when it opens no formula at all. */
export type MathBlockStart = {
  delim: MathDelim
  /** The formula's first line of TeX, or `null` when the delimiter stood alone. */
  first: string | null
  /** True when the formula also ENDED on this line, which is how nearly all of them are written. */
  closed: boolean
}

/** The display formula this line opens, if it opens one that closes. */
export function mathBlockAt(line: Line, lines: string[], at: number): MathBlockStart | null {
  const open = opensWith(line)
  if (!open || !everCloses(lines, at, open.rest, open.delim)) return null
  const here = closerIn(open.rest, open.delim)
  const text = here ?? open.rest
  return { delim: open.delim, first: text.trim() === '' ? null : text, closed: here !== null }
}
