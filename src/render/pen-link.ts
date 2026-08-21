// The link's dashes: the pen's fourth gesture, and the only one the WRITER never asks for.
//
// SPLIT OUT OF `pen-dies.ts` when that file passed its 400-line ceiling, and the seam is a
// real one rather than a convenient cut. Every die in that file is a mark somebody chose to
// make on a page and is dealt by a hash of the text under it; this one is furniture, applied
// to every link by the stylesheet. They are also delivered differently: the writer's
// gestures ride in the two sheets that only board pages carrying a mark or an underline
// (ADR 0027), while this rides in `prose.css.ts` because a link is on nearly every page.
//
// ITS OWN SEED, and that is the load-bearing part of the split. `pen-dies.ts` draws every
// die from one PRNG stream, in order, and its comments warn that new gestures must be
// APPENDED so the existing ones do not reshuffle. Sharing that stream across two modules
// would make the order depend on ESM evaluation order — a stable-looking arrangement that a
// reordered import could silently redraw every highlight on every site. A separate seed
// cannot do that: nothing here can move a single stroke over there.

import { o2, r1, wavy } from '@/render/pen-dies'
import type { Die, DiePath } from '@/render/pen-dies'

/* mulberry32 again, seeded differently on purpose — see the note above. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}



/**
 * One run of hand-drawn dashes in a 240x16 box, meant to be tiled.
 *
 * THE RANGES ARE WIDE ON PURPOSE, and they were CHOSEN BY LOOKING: four candidate runs were
 * grown and printed at eight times reading size, and the tidy ones lost. A set where every
 * dash is about the same length and sits on the same line reads as a machine's dashed rule
 * no matter how much edge wobble it carries; what makes a run look like a hand is that one
 * stroke runs long, the next is a stub, and they do not agree on where the line is. So the
 * length spans 9 to 30 units against gaps of 11 to 32, each dash drifts up to 1.6 units off
 * the run and leans up to 1.5 on its own, and the whole run tilts as well.
 *
 * The drift is the one number that was pulled BACK from what looked best in isolation:
 * under actual words, a line that wanders too far stops reading as a hand and starts
 * reading as a misaligned rule.
 */
function makeDashDie(r: () => number): Die {
  const lerp = (a: number, b: number) => a + (b - a) * r()
  const paths: DiePath[] = []
  // The whole run leans a little, because a hand does; each dash then leans again on its
  // own. Both are small: a dash that visibly slopes reads as a mistake rather than a hand.
  const runTilt = lerp(-0.9, 0.9)
  let x = lerp(0, 6)
  while (x < 236) {
    const len = lerp(9, 30)
    const end = Math.min(x + len, 238)
    const y0 = 7 + runTilt * (x - 120) / 120 + lerp(-1.6, 1.6)
    const tilt = lerp(-1.5, 1.5)
    // Thinner at one end than the other: a dash is one quick stroke, and the pen is
    // already lifting by the time it stops.
    const t0 = lerp(1.9, 3.4), t1 = lerp(1.4, 2.8)
    const y = (px: number) => y0 + tilt * (px - x) / Math.max(1, end - x)
    const d = 'M' + r1(x) + ',' + r1(y(x))
      + wavy(x, end, y, 0.45, 2, r)
      + ' L' + r1(end) + ',' + r1(y(end) + t1)
      + wavy(end, x, (px) => y(px) + t0 + (t1 - t0) * (px - x) / Math.max(1, end - x), 0.4, 2, r)
      + ' Z'
    paths.push([d, o2(lerp(0.7, 0.95))])
    x = end + lerp(11, 32)
  }
  return paths
}

/** One SOLID run, for hover: the same hand pressing down instead of skipping. */
function makeSolidDie(r: () => number): Die {
  const lerp = (a: number, b: number) => a + (b - a) * r()
  const y0 = 7 + lerp(-0.4, 0.4)
  const t = lerp(2.3, 3.0)
  const y = (px: number) => y0 + lerp(-0.15, 0.15) * 0 + Math.sin(px / 90) * 0.5
  const d = 'M0,' + r1(y(0)) + wavy(0, 240, y, 0.5, 5, r)
    + ' L240,' + r1(y(240) + t)
    + wavy(240, 0, (px) => y(px) + t, 0.5, 5, r) + ' Z'
  return [[d, o2(lerp(0.82, 0.95))]]
}


const rand = mulberry(0x0d_a5_11)

export const LINK_DASH_DIE: Die = makeDashDie(rand)
export const LINK_SOLID_DIE: Die = makeSolidDie(rand)
