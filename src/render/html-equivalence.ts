// Two article bodies that are not the same bytes, and the question of whether they are the
// same PAGE.
//
// A byte gate is the right instrument for a port, which is why `golden.test.ts` has held one
// since 2.0: the promise was that nothing moved, and a byte answer needs no judgement. It is
// the wrong instrument for a REPLACEMENT. The engine in `src/md/` is written to CommonMark and
// `marked` was not, so the two write `<br>` and `<br />`, and put a newline between two block
// tags where the other does not. Those differences are real bytes and no reader can see any of
// them — and a gate that cannot tell them apart from a difference a reader WOULD see is a gate
// that gets switched off.
//
// So: a ladder of rewrites, each one a change that cannot alter what a browser draws. Two
// bodies that become equal at some rung differ by that rung's name and nothing worse. Whatever
// survives every rung is a real difference and is printed in full.
//
// THE LADDER IS THE ARGUMENT, not the conclusion. Each rung is written so it can be disagreed
// with on its own, and the reasoning behind every one of them was checked against a real
// browser before it was written down: `scripts/md-paint-diff.ts` lays both bodies out in
// Chrome and compares `innerText` and the bounding box of every element. It said 45/45 for the
// corpus and 89/92 for this blog's real posts, and each of the three was then read by hand.

import { resolveEntities } from '@/md/entity'

/** Tags whose box edge swallows the whitespace beside it, so a newline there is never painted. */
const BLOCK = 'ul|ol|li|p|div|table|thead|tbody|tfoot|tr|td|th|blockquote|pre|h[1-6]|hr|section|figure|figcaption'

/** Each rung: a name, and a rewrite that provably cannot change the rendered page. */
export const LADDER: { name: string; apply: (html: string) => string }[] = [
  {
    name: 'a void tag written with a slash (<br /> vs <br>)',
    apply: (h) => h.replace(/<(br|hr|img|input|meta|link)([^>]*?)\s*\/>/g, '<$1$2>'),
  },
  {
    // A line break ends a line, and a collapsible space at the start of a line is removed
    // before anything is painted. So the newline CommonMark writes after `<br />` is nothing.
    name: 'a newline after a line break',
    apply: (h) => h.replace(/<br\s*\/?>\s*\n\s*/g, '<br>'),
  },
  {
    name: 'a newline between two tags',
    apply: (h) => h.replace(/>\s*\n\s*</g, '><'),
  },
  {
    // ⚠️ THE NARROWEST RUNG, and it has to be. Whitespace against the edge of a BLOCK box is
    // not painted — `done\n<ul>` and `done<ul>` put the list in the same place — but the same
    // newline before an INLINE tag is a gap a reader sees: `a\n<em>b</em>` reads "a b" and
    // `a<em>b</em>` reads "ab". So the tags are listed rather than matched by a wildcard.
    name: 'a newline between text and a block tag',
    apply: (h) => h.replace(new RegExp(`\\s*\\n\\s*<(/?)(${BLOCK})\\b`, 'g'), '<$1$2'),
  },
  {
    name: 'trailing space before a closing tag',
    apply: (h) => h.replace(/[ \t]+<\//g, '</'),
  },
  {
    // `&#65;` and `A` are the same letter on the page. CommonMark resolves the entity and
    // `marked` passes it through, and a browser shows the same character either way.
    name: 'an entity resolved to its character (&copy; vs ©)',
    apply: (h) => resolveEntities(h),
  },
]

/**
 * The name of the rung that dissolves the difference between two bodies.
 *
 * `null` when they are already identical; `'REAL'` when nothing on the ladder reaches it, which
 * means a reader would see it and somebody has to decide about it.
 */
export function classify(a: string, b: string): string | null | 'REAL' {
  let left = a
  let right = b
  for (const rung of LADDER) {
    if (left === right) return null
    const nextLeft = rung.apply(left)
    const nextRight = rung.apply(right)
    if (nextLeft === nextRight && left !== right) return rung.name
    left = nextLeft
    right = nextRight
  }
  return left === right ? null : 'REAL'
}

/** The first place two strings stop agreeing, with a little either side, for a failure message. */
export function firstDifference(a: string, b: string): string {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const from = Math.max(0, i - 60)
  return `  1.x: ${JSON.stringify(a.slice(from, i + 80))}\n  now: ${JSON.stringify(b.slice(from, i + 80))}`
}
