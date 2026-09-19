// THE BRACKETS INSIDE A LINK LABEL, which are a different problem from the brackets in prose.
//
// `to-markdown.ts` escapes an opening bracket everywhere and a closing one nowhere, and that is
// the right rule in a paragraph: `\[ … \]` is display maths here (ADR 0020), so escaping both
// turns `[a word]` into a formula on the second save. Inside a LABEL the same rule destroyed
// the link, because there the closing bracket is the terminator:
//
//     [a [b] c](http://e.com)  →  [a \[b] c](…)  →  \[a \[b] c](…)  →  not a link at all
//
// What CommonMark actually says is that a label may hold brackets bare so long as they PAIR. So
// pairs are left alone — which is also what the author typed — and only a bracket with no
// partner is escaped. The maths shape cannot form out of that: an unpartnered `[` is one that
// no later `]` closes, and an unpartnered `]` is one that no earlier `[` opened, so the second
// can never follow the first.
import type { Inline } from './ast'
import { inlineChildren } from './ast'

/**
 * The label's OWN text, in the order the serializer will write it.
 *
 * An image inside a link carries a label of its own and is paired separately, so the walk stops
 * there. A code span is verbatim and never reaches the escaper, so it is not counted either.
 */
export function labelText(nodes: readonly Inline[]): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'text') out += node.value
    else if (node.type !== 'image') out += labelText(inlineChildren(node))
  }
  return out
}

/** The brackets with no partner, numbered among the label's brackets in the order they appear. */
export function loneBrackets(text: string): Set<number> {
  const lone = new Set<number>()
  const open: number[] = []
  let n = 0
  for (const ch of text) {
    if (ch === '[') open.push(n++)
    else if (ch === ']') {
      if (open.length > 0) {
        open.pop()
        n++
      } else lone.add(n++)
    }
  }
  for (const i of open) lone.add(i)
  return lone
}
