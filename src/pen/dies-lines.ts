// The pen's line gestures: the underline and the ring. Grown from a seed of their own.
//
// The reference is a stack of photographs of a law student's textbook: whole sentences
// underlined in pen under the highlighter, and single words ("cease") ringed in ballpoint.
// What makes those read as a hand is not roughness. The first underline dies here had
// plenty of that — gaps, fades, a wander — and were reviewed as sloppy rather than
// handwritten, and as a pen running out of ink. A person underlining a line they care about
// draws one confident stroke: steady ink from end to end, a little heavier where the hand
// pressed, a little thinner where it eased, a slight bow from the wrist. VARIETY IN THE
// SHAPE, NEVER IN THE DENSITY: only the highlighter, whose felt genuinely runs dry, is
// allowed to fade, and this file has no fade in it.

import { type Die, type DiePath, e2, mulberry, o2, r1, spanOf, wavy } from '@/pen/dies-kit'
import { PEN_SHORT_FROM, PEN_VARIANT_COUNT } from '@/pen/dies-kit'

const rand = mulberry(0x11_4e_5a_02)

/* ------------------------------------------------------------------------------------- *
 * The underline: one pressure ribbon in a 200×20 box.
 * ------------------------------------------------------------------------------------- */

/**
 * The ribbon's thickness follows a pressure envelope — a broad peak where the hand bore
 * down, a lighter landing, a lift at the tail — and the edges carry only the faintest
 * tremor: the wobble must stay well under the ribbon's thickness, because a
 * self-intersecting ribbon fills as slivers and paints nothing.
 */
function makeUnderDie(r: () => number, seed: number): Die {
  const lerp = spanOf(r)
  const tilt = lerp(-1.8, 1.8)
  const y0 = lerp(6.2, 8)
  // A hand pivots from the wrist, so the line bows — and sometimes droops in the last
  // stretch, where the arm has run out of comfortable reach. The box is 20 tall and the
  // grips paint it at ~.38em, so 3 units of bow is about 1px of visible sag at reading size.
  const bow = lerp(-1.2, 3)
  const droop = lerp(-0.5, 2.5)
  const xl = lerp(1, 3), xr = 200 - lerp(1, 3.5)
  const y = (x: number) => y0 + tilt * (x - 100) / 200
    + bow * 4 * (x - xl) * (xr - x) / ((xr - xl) ** 2)
    + droop * Math.max(0, (x - 140) / 60)
  const peak = lerp(0.3, 0.7)
  const base = lerp(2.0, 2.5), press = lerp(1.0, 1.7), lift = lerp(0.3, 0.7)
  const th = (x: number) => {
    const t = (x - xl) / (xr - xl)
    return base + press * Math.exp(-((t - peak) ** 2) / 0.11) - lift * Math.max(0, t - 0.85) * 6
  }
  const N = 16
  const top: string[] = [], bot: string[] = []
  for (let i = 0; i <= N; i++) {
    const x = xl + (xr - xl) * i / N
    const j = (r() - 0.5) * 0.5
    top.push(`${r1(x)},${r1(y(x) - th(x) / 2 + j)}`)
    bot.unshift(`${r1(x)},${r1(y(x) + th(x) / 2 + j)}`)
  }
  const d = `M${top[0]} L${top.slice(1).join(' L')} L${bot.join(' L')} Z`
  const paths: DiePath[] = [[d, o2(lerp(0.88, 0.94)), 'f']]
  // Every third pen or so goes back over part of the line — a shorter second pass, as
  // firm as the first, offset by a hair. Shape, not density.
  if (r() < 0.35) {
    const a = lerp(8, 55), b = lerp(115, 192)
    const off = lerp(-1.6, 2.2), t2 = lerp(1.6, 2.2)
    const yy = (x: number) => y(x) + off
    paths.push([`M${r1(a)},${r1(yy(a))}${wavy(a, b, yy, 0.4, 2, r)}`
      + ` L${r1(b - 0.5)},${r1(yy(b) + t2)}${wavy(b, a, (x) => yy(x) + t2, 0.4, 2, r)} Z`,
    o2(lerp(0.7, 0.85)), 'f'])
  }
  return { paths, fx: { seed, tremor: [r1(lerp(0.04, 0.06) * 100) / 100, r1(lerp(0.7, 1.1) * 10) / 10] } }
}

export const UNDER_DIE_COUNT = 6

export const UNDER_DIES: readonly Die[] = Array.from({ length: UNDER_DIE_COUNT },
  (_, i) => makeUnderDie(rand, 41 + i * 5))

/** The underline's grip per variant: band height, where it sits, and overshoot. */
export type UnderGrip = {
  die: number
  h: string, y: string
  padl: string, padr: string, marl: string, marr: string
}

export const UNDER_GRIPS: readonly UnderGrip[] = Array.from({ length: PEN_VARIANT_COUNT },
  (_, i) => {
    const short = i >= PEN_SHORT_FROM
    const padl = (short ? 0.04 : 0.02) + rand() * 0.08
    const padr = (short ? 0.05 : 0.02) + rand() * 0.1
    return {
      die: i % UNDER_DIE_COUNT,
      h: e2(0.36 + rand() * 0.06),
      // AGAINST the letters. Literata's ascent is 1.16em (canvas fontBoundingBoxAscent on the
      // rendered page), so the baseline sits 1.16em below the top of an inline background
      // box; the ribbon's centre rides ~.36 of the way down its own box. A box top at
      // 1.0–1.04em puts the ink on the baseline, touching the feet of the letters and
      // crossing the descenders, which is where a person draws it. The first pens sat it
      // .1em lower and the review said so.
      y: e2(1.0 + rand() * 0.04),
      padl: e2(padl), padr: e2(padr),
      marl: e2(-(padl - 0.02)), marr: e2(-(padr - 0.02)),
    }
  })

/* ------------------------------------------------------------------------------------- *
 * The ring — in THREE pieces, because a stretched loop is not a hand-drawn loop.
 *
 * The first two ring builds drew one closed shape and stretched it to the word, and
 * around a long word the end curves stretched flat and the loop read as a capsule pill. A
 * person circles a word the other way round: the two END CURVES keep their round,
 * hand-sized curvature no matter how long the word is, and the stretch all happens in the
 * near-straight run over and under the letters. So the die is a left cap, a middle, and a
 * right cap; the caps ride at a FIXED em width (`ink.css.ts` sizes them; only the middle
 * stretches).
 *
 * Three things the third build changed, all from looking at the second next to the
 * photographs. The loop is an OVAL, not a stadium: the middle's two lines bow outward,
 * and the caps' arcs meet them at the seam. The pen CROSSES ITS OWN START: one cap
 * carries the tail, a curved ribbon that comes from inside the loop, runs over the arc
 * and out past it. And the pressure varies: the ribbon is heaviest on the far side of
 * each cap, where the hand swung round, and the tail is a lighter, faster stroke.
 * ------------------------------------------------------------------------------------- */

export type RingDie = { l: Die, m: Die, r: Die }

/** Where the arcs meet the middle: the loop's half-height, per die. */
type RingShape = { cy: number; ry: number }

/** An arc ribbon for one cap, in the 40×48 cap box. `side` -1 = left cap, 1 = right. */
function capRibbon(side: -1 | 1, s: RingShape, r: () => number): string {
  const lerp = spanOf(r)
  // The cap's centre sits ON the seam edge, so the arc reaches the box edge to meet the
  // middle's lines; the open side faces the word.
  const cx = side < 0 ? 40 : 0, cy = s.cy
  const rx = lerp(30, 35), ry = s.ry
  const N = 14
  const out: string[] = [], back: string[] = []
  for (let i = 0; i <= N; i++) {
    // From the top seam, around the outside, to the bottom seam.
    const a = -Math.PI / 2 + side * (i / N) * Math.PI
    const t = lerp(1.3, 1.9) + Math.sin((i / N) * Math.PI) * lerp(0.7, 1.2)
    const jx = (r() - 0.5) * 1.4, jy = (r() - 0.5) * 1.4
    const ca = Math.cos(a), sa = Math.sin(a)
    out.push(`${r1(cx + (rx + t) * ca + jx)},${r1(cy + (ry + t) * sa + jy)}`)
    back.unshift(`${r1(cx + (rx - t) * ca + jx * 0.6)},${r1(cy + (ry - t) * sa + jy * 0.6)}`)
  }
  return `M${out[0]} L${out.slice(1).join(' L')} L${back.join(' L')} Z`
}

/**
 * The crossing tail: the pen came round the loop, ran over the place it started, and
 * carried on. A curved ribbon from inside the loop, over the arc near the top seam, out to
 * the box edge — thinner than the arc, because the hand was already lifting.
 */
function capTail(side: -1 | 1, s: RingShape, r: () => number): string {
  const lerp = spanOf(r)
  const x1 = side < 0 ? 40 : 0                       // the seam edge
  const x0 = x1 + side * lerp(22, 30)                // starts inside, across the arc
  const yIn = s.cy - s.ry + lerp(7, 12)              // inside the loop
  const yOut = Math.max(0.8, s.cy - s.ry - lerp(3.5, 5.5)) // clear of the arc, outside
  const th = lerp(2.2, 2.8)
  const cxp = x1 + side * lerp(4, 9)
  return `M${r1(x0)},${r1(yIn)} Q${r1(cxp)},${r1(yIn - 2)} ${r1(x1)},${r1(yOut)}`
    + ` L${r1(x1)},${r1(yOut + th)} Q${r1(cxp - side * 0.6)},${r1(yIn - 2 + th)} ${r1(x0 + side * 1.2)},${r1(yIn + th)} Z`
}

/** One line of the middle piece, in the 100×48 middle box, bowing OUTWARD from the word. */
function midLine(yEdge: number, outward: -1 | 1, r: () => number): string {
  const lerp = spanOf(r)
  const bow = lerp(3, 6) * outward, tiltm = lerp(-1.2, 1.2), th = lerp(2.2, 3.0)
  const y = (x: number) => yEdge + tiltm * (x - 50) / 100 + bow * 4 * x * (100 - x) / 10000
  return `M0,${r1(y(0))}${wavy(0, 100, y, 0.9, 3, r)}`
    + ` L100,${r1(y(100) + th)}${wavy(100, 0, (x) => y(x) + th, 0.9, 3, r)} Z`
}

function makeRingDie(r: () => number, seed: number): RingDie {
  const lerp = spanOf(r)
  const shape: RingShape = { cy: lerp(24.5, 26), ry: lerp(16.5, 18.5) }
  const ink = () => o2(lerp(0.7, 0.82))
  const tailOnLeft = r() < 0.5
  const fx = (k: number) => ({ seed: seed + k, tremor: [0.045, 1.4] as const })
  const l: DiePath[] = [[capRibbon(-1, shape, r), ink(), 'f']]
  const rr: DiePath[] = [[capRibbon(1, shape, r), ink(), 'f']]
  ;(tailOnLeft ? l : rr).push([capTail(tailOnLeft ? -1 : 1, shape, r), o2(lerp(0.55, 0.68)), 'f'])
  const m: DiePath[] = [
    [midLine(shape.cy - shape.ry - 1.1, -1, r), ink(), 'f'],
    [midLine(shape.cy + shape.ry - 1.1, 1, r), ink(), 'f'],
  ]
  return { l: { paths: l, fx: fx(0) }, m: { paths: m, fx: fx(1) }, r: { paths: rr, fx: fx(2) } }
}

export const RING_DIE_COUNT = 3

export const RING_DIES: readonly RingDie[] = Array.from({ length: RING_DIE_COUNT },
  (_, i) => makeRingDie(rand, 71 + i * 9))

/** The ring's grip: how far the loop clears the word — WELL past it, both ways. The
 *  padding is what the loop paints over; the margin gives most of it back to the layout,
 *  so the ring visibly overhangs its neighbours the way ballpoint overhangs print. */
export type RingGrip = { die: number, padx: string, pady: string, marx: string }

export const RING_GRIPS: readonly RingGrip[] = Array.from({ length: PEN_VARIANT_COUNT },
  (_, i) => {
    const padx = 0.38 + rand() * 0.22
    return {
      die: i % RING_DIE_COUNT,
      padx: e2(padx), pady: e2(0.16 + rand() * 0.12),
      marx: e2(-(padx - 0.2)),
    }
  })
