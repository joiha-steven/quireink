// Which punctuation rides with an inline formula (`html.ts` prints the result).

import type { Inline } from './ast'

/**
 * Punctuation that must not be left at the end of a line while the formula it opens starts the
 * next, and its mirror. An inline formula is one atomic box and the browser may break on either
 * side of it, so `(<math>` and `</math>)` came apart at the line end: measured in a justified
 * paragraph at 768 and 1440 px, "(" ended a line and "r = 1.333)" began the next.
 *
 * Only a RUN THAT TOUCHES the formula (no space between), and only an inline formula: display
 * maths is a block and has no line to break. The straight quotes sit in both sets because they
 * are both, and a straight one is taken after the formula only when no letter or digit follows it:
 * `'$x$'s` is an apostrophe, and curling it (`render/curly-quotes.ts`) reads the character after the
 * quote, which a tag between them would hide. Letters are never glued; `word(` may still break before the bracket.
 */
const MATH_OPENERS = /[(\[{\u201C\u2018\u00AB"']+$/
const MATH_CLOSERS = /^(?:[)\]}\u201D\u2019\u00BB,.;:!?\u2026]|["'](?![\p{L}\p{N}]))+/u

/**
 * For each inline formula among `nodes`, the opening run taken off the end of the text before it
 * and the closing run taken off the start of the text after it. `text` is the sibling text
 * nodes with those runs removed (a run is claimed once: `$a$)($b$` gives `)` to the first and
 * `(` to the second). Null when there is no inline formula, which is nearly every paragraph.
 */
export function glueMath(nodes: Inline[]): { text: string[]; open: string[]; close: string[] } | null {
  if (!nodes.some((n) => n.type === 'math' && !n.display)) return null
  const text = nodes.map((n) => (n.type === 'text' ? n.value : ''))
  const open: string[] = nodes.map(() => '')
  const close: string[] = nodes.map(() => '')
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    if (node.type !== 'math' || node.display) continue
    if (nodes[i - 1]?.type === 'text') {
      const run = MATH_OPENERS.exec(text[i - 1]!)?.[0] ?? ''
      open[i] = run
      text[i - 1] = text[i - 1]!.slice(0, text[i - 1]!.length - run.length)
    }
    if (nodes[i + 1]?.type === 'text') {
      const run = MATH_CLOSERS.exec(text[i + 1]!)?.[0] ?? ''
      close[i] = run
      text[i + 1] = text[i + 1]!.slice(run.length)
    }
  }
  return { text, open, close }
}
