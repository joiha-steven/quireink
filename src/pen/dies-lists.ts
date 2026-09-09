// The pen's marks at the head of a list item: an ink dot, and a short dash for the level
// beneath it. Grown from a seed of their own, like every other gesture.
//
// The browser's disc is a machine's mark — a perfect circle, identical on every line — and
// on a page where the highlighter, the underline and the ring are all a hand's, it is the
// one thing left that is not. What replaces it was reviewed in two rounds, and the second
// corrected the first: a dot with a tail, rotated a little each line, read as careless
// rather than handwritten. A person setting down a bullet makes a FIRM dot — slightly oval,
// never quite round, the same weight each time — and a nested item gets a short level dash.
// Variety in the shape, never in the density; no rotation, no tails.
//
// These are MASKS, not pigments: the mark is painted in `currentColor`, so it is in the ink
// of the words beside it on every palette in both modes, and one shape serves all twelve
// palette-and-mode pairs. (The highlighter cannot do this — a mask on an element clips its
// text, ADR 0018 — but a `::before` has no text to clip.)

import { mulberry, r1, spanOf } from '@/pen/dies-kit'

const rand = mulberry(0x1d_07_5a_02)

/** A firm ink dot in a 12×12 box: ten points round an oval, each pulled a little. */
function makeDot(r: () => number): string {
  const lerp = spanOf(r)
  const N = 10, cx = 6, cy = 6
  const rr = lerp(2.6, 3.0), squash = lerp(0.86, 1)
  const rot = lerp(0, Math.PI)
  const pts: string[] = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const k = rr * (1 + (r() - 0.5) * 0.14)
    const x = k * Math.cos(a), y = k * squash * Math.sin(a)
    pts.push(`${r1(cx + x * Math.cos(rot) - y * Math.sin(rot))},${r1(cy + x * Math.sin(rot) + y * Math.cos(rot))}`)
  }
  return `M${pts[0]} L${pts.slice(1).join(' L')} Z`
}

/** A short level dash in a 14×12 box: one quick stroke, barely bowed, barely tilted. */
function makeDash(r: () => number): { d: string; w: string } {
  const lerp = spanOf(r)
  const y = 6, bow = lerp(-0.6, 0.6), tilt = lerp(-0.4, 0.4)
  return {
    d: `M1.5,${r1(y - tilt)} Q7,${r1(y + bow)} 12.5,${r1(y + tilt)}`,
    w: r1(lerp(1.7, 2.1)).toString(),
  }
}

export const DOT_COUNT = 6
export const DASH_COUNT = 4

/** The dots, as data-URIs of a black shape — the colour comes from the mask's fill. */
export const DOT_MASKS: readonly string[] = Array.from({ length: DOT_COUNT }, () => {
  const d = makeDot(rand)
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E`
    + `%3Cpath d='${d}' stroke='%23000' stroke-width='.9' stroke-linejoin='round'/%3E%3C/svg%3E")`
})

export const DASH_MASKS: readonly string[] = Array.from({ length: DASH_COUNT }, () => {
  const { d, w } = makeDash(rand)
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 12'%3E`
    + `%3Cpath d='${d}' stroke='%23000' stroke-width='${w}' stroke-linecap='round' fill='none'/%3E%3C/svg%3E")`
})

/**
 * How each of eight consecutive numbers sits: a small lean and a nudge, so a column of
 * hand-written numerals is not a column of stamps. Degrees and pixels, tiny on purpose —
 * the review's verdict on the bullets holds here too.
 */
export const NUMERAL_LEANS: readonly { rot: string; dx: string; dy: string }[] =
  Array.from({ length: 8 }, () => {
    const lerp = spanOf(rand)
    return { rot: r1(lerp(-3.5, 3.5)).toString(), dx: r1(lerp(-0.6, 0.6)).toString(), dy: r1(lerp(-0.8, 0.8)).toString() }
  })
