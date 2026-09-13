// This blog's own notation, as two matchers: the pen's three gestures and the four maths
// delimiters.
//
// Neither grammar is written here. `pen/grammar.ts` and `render/math-syntax.ts` own them and
// every parser in this repository reads them from there — which is the whole reason those
// files exist. Four parsers once spelled `==text==` out separately and two of them drifted
// within the hour, putting the word "green" into every excerpt on the site.
//
// Split from `inline.ts` at the 400-line ceiling. The seam is a fair one: everything here is
// notation this blog invented, and everything left there is Markdown.

import { INK_SYNTAX_SOURCE, RING_SYNTAX_SOURCE, UNDER_SYNTAX_SOURCE } from '@/pen/grammar'
import { matchMathAtPos, type MathDelim } from '@/render/math-syntax'

const PEN = {
  ink: new RegExp(`^${INK_SYNTAX_SOURCE}`),
  underline: new RegExp(`^${UNDER_SYNTAX_SOURCE}`),
  ring: new RegExp(`^${RING_SYNTAX_SOURCE}`),
} as const

export type PenKind = 'ink' | 'underline' | 'ring'

/** A gesture at `pos`: what it is, the colour it names, its source, and the words inside. */
export function penAt(
  kind: PenKind, text: string, pos: number,
): { ink?: string; raw: string; inner: string; length: number } | null {
  const m = PEN[kind].exec(text.slice(pos))
  if (!m) return null
  return { ink: m[2], raw: m[0], inner: m[1] ?? '', length: m[0].length }
}

/**
 * A formula at `pos`, in any of the four delimiters.
 *
 * ⚠️ A PRICE IS NOT A FORMULA, and the dollar form needs one guard more than the shared
 * matcher gives it. `math-syntax.ts` carries Pandoc's three rules — no space after the opening
 * `$`, none before the closing one, no digit after it — and they are enough for `$5 và $10`.
 * They were not enough for this, found on a real post on 2026-09-13:
 *
 *     có giá **200-300$** sẽ vẫn tăng trưởng … là set **300$** và hiện giờ
 *
 * Both dollars pass all three guards, so the span from the first to the second swallowed the
 * sentence between them and rendered it as maths. `marked` never had the problem because it
 * resolves `**` into a token first and parses the inner run on its own; this parser keeps
 * emphasis on a stack until the end, so the text is still one piece when the dollar is met.
 *
 * The guard is the observation that makes it safe: `**` and `__` are Markdown emphasis and TeX
 * has no use for either — it writes powers with `^`. A span carrying one is a sentence with
 * prices in it. The shared matcher is deliberately NOT changed: `marked` and the editor read it
 * too, and neither has this bug.
 */
export function mathAt(text: string, pos: number): { value: string; display: boolean; delim: MathDelim; length: number } | null {
  const m = matchMathAtPos(text, pos)
  if (!m) return null
  if (m.delim === 'dollar' && !m.display && /\*\*|__/.test(m.tex)) return null
  return { value: m.tex, display: m.display, delim: m.delim, length: m.raw.length }
}
