// The hand behind the pen: every stroke shape, grown from one seed.
//
// The first pen had ONE die, and every highlight on a page was that die stretched — the
// same edge wobble, the same chisel at both ends — and once a reader saw it twice the pen
// stopped being a pen. Three hand-drawn dies were tried next and were better, but still
// countable: a page with a dozen highlights dealt each die four times. Compared against
// photographs of real highlighting (a notebook, two textbooks), what a machine stroke lacks
// is not roughness but VARIETY — real strokes differ in tilt, in weight, in how the pen
// lands and lifts, in how much ink the felt had left — and variety is a quantity problem,
// which hand-drawing cannot solve under a byte budget somebody has to keep re-earning.
//
// So the dies are GROWN, not drawn: a seeded generator varies, per die —
//   · tilt (a hand is never level), and where the stroke sits against the words
//   · weight: how tall the sweep is, and how much ink it lays (a light pass vs a pressed one)
//   · the wobble of both edges, in count and in amplitude
//   · the second pass: full, or broken in two where the felt ran dry
//   · the ends: chisel slant, and an occasional taper where the pen was already lifting
//   · pooled ink: a sliver along the top edge, and a darker spot where the pen was set down
//
// DETERMINISTIC ON PURPOSE, twice over. The PRNG is seeded with a constant, so every build
// emits byte-identical CSS and the public sheet's content hash holds still. And which die a
// given highlight wears is decided by a hash of its own text (`render/ink.ts`), so a phrase
// keeps its stroke across reloads and re-renders — a page that reshuffled its ink on every
// visit would feel haunted, not hand-made.
//
// The ceiling every die respects is the dark-mode contrast audit in `render/pen.ts`
// (PEN_DARK): composite alpha nowhere exceeds the ~.91 the 45% mix was measured at. The
// sweep and the band compound to at most .905, and every pool or blob is placed clear of
// the band, so it compounds with the sweep alone and tops out under .87.

/** One printable die: SVG path data plus the opacity it is inked at. */
export type DiePath = readonly [d: string, opacity: string]
export type Die = ReadonlyArray<DiePath>

/* mulberry32. Not for anything but repeatable scribble; seeded below with a constant so the
   sheet is byte-stable across builds (`Date.now`/`Math.random` are banned here anyway). */
function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10
const o2 = (n: number) => String(Math.round(n * 100) / 100).replace(/^0/, '')

/**
 * A wavy run of cubics from x0 to x1 along the line `y(x)`, anchors alternating across it.
 * The amplitude is per-segment random, which is what keeps a long stretched stroke from
 * reading as a tidy sine wave.
 */
function wavy(x0: number, x1: number, y: (x: number) => number, amp: number, segs: number,
  r: () => number): string {
  const dx = (x1 - x0) / segs
  let out = ''
  for (let i = 0; i < segs; i++) {
    const a = x0 + dx * i, b = a + dx, s = i % 2 ? 1 : -1
    out += ` C${r1(a + dx / 3)},${r1(y(a + dx / 3) + s * amp * (0.4 + r()))}`
      + ` ${r1(b - dx / 3)},${r1(y(b - dx / 3) - s * amp * (0.4 + r()))}`
      + ` ${r1(b)},${r1(y(b) + (r() - 0.5) * amp * 0.8)}`
  }
  return out
}

/** One band of the second pass: a low quad with lightly wobbled edges. */
function band(x0: number, x1: number, yt: (x: number) => number, h: number, r: () => number,
  o: number): DiePath {
  const yb = (x: number) => yt(x) + h
  const segs = x1 - x0 > 90 ? 3 : 2
  const d = `M${r1(x0)},${r1(yt(x0))}${wavy(x0, x1, yt, 1.4, segs, r)}`
    + ` L${r1(x1 - 0.6)},${r1(yb(x1))}${wavy(x1, x0, yb, 1.4, segs, r)} Z`
  return [d, o2(o)]
}

function makeDie(r: () => number): Die {
  const lerp = (a: number, b: number) => a + (b - a) * r()
  // The hand: tilt, weight, and how much ink the pass laid down.
  const tilt = lerp(-2.4, 2.4)
  const top = lerp(3.4, 6.6)
  const bot = lerp(28.2, 31.6)
  const sweepInk = lerp(0.66, 0.8)
  const yT = (x: number) => top + tilt * (x - 100) / 200
  const yB = (x: number) => bot + tilt * (x - 100) / 200
  // The ends: where the pen landed and lifted, and an occasional taper on the way out.
  const xl = lerp(2.4, 5), xr = 200 - lerp(2.4, 5)
  const taperR = r() < 0.35 ? lerp(2, 5) : 0
  const taperL = taperR === 0 && r() < 0.25 ? lerp(2, 4) : 0
  // Fine wobble, not billow: a marker's edge is straight-ish with a light tremor, so many
  // short segments at low amplitude. The first cut of this used 3 segments at up to 3 units
  // and the strokes came out looking like jelly bars, not ink.
  const segs = 4 + Math.floor(r() * 4)
  const amp = lerp(0.7, 1.9)

  // The ends are a chisel tip: nearly flat cuts, slanted by however the corner offsets land,
  // with barely any horizontal bulge — bowed caps read as sausage ends.
  const sweep = `M${r1(xl)},${r1(yT(xl) + taperL * 0.6)}`
    + wavy(xl, xr, (x) => yT(x) + (taperR ? taperR * 0.6 * (x - xl) / (xr - xl) : 0), amp, segs, r)
    + ` C${r1(xr + 1.5)},${r1(yT(xr) + lerp(3, 6))} ${r1(xr + 1.6)},${r1(yB(xr) - lerp(4, 8))}`
    + ` ${r1(xr - lerp(0.5, 4.5))},${r1(yB(xr) - taperR * 0.5)}`
    + wavy(xr, xl, (x) => yB(x) - (taperL ? taperL * 0.5 * (xr - x) / (xr - xl) : 0), amp, segs, r)
    + ` C${r1(xl - 1.4)},${r1(yB(xl) - lerp(4, 8))} ${r1(xl - 1.3)},${r1(yT(xl) + lerp(3, 6))}`
    + ` ${r1(xl + lerp(0, 2.5))},${r1(yT(xl) + taperL * 0.6)} Z`

  const paths: DiePath[] = [[sweep, o2(sweepInk)]]

  // The second pass. Its ink is clamped so sweep+band never compounds past .905 — the
  // dark-mode audit's ceiling — and it breaks in two where the felt ran dry, half the time.
  const bandTop = lerp(12.6, 16.4)
  const bandH = Math.min(lerp(9.5, 12.5), bot - 2 - bandTop)
  const bandInk = Math.min(lerp(0.45, 0.56), (0.905 - sweepInk) / (1 - sweepInk))
  const ybt = (x: number) => bandTop + tilt * (x - 100) / 200
  if (r() < 0.5) {
    const gx = lerp(60, 140), gw = lerp(10, 26)
    paths.push(band(xl + lerp(1, 4), gx - gw / 2, ybt, bandH, r, bandInk))
    paths.push(band(gx + gw / 2, xr - lerp(0.5, 3), (x) => ybt(x) - lerp(0, 1.6), bandH, r, bandInk))
  } else {
    paths.push(band(xl + lerp(1, 4), xr - lerp(0.5, 3), ybt, bandH, r, bandInk))
  }

  // Pooled ink along the top edge — the darker rim a felt tip leaves where the ink settles.
  if (r() < 0.7) {
    const p0 = lerp(18, 60), p1 = lerp(115, 175)
    const py = (x: number) => yT(x) + 0.4
    paths.push([`M${r1(p0)},${r1(py(p0))}${wavy(p0, p1, py, 0.7, 2, r)}`
      + ` L${r1(p1 - 0.4)},${r1(py(p1) + 2.2)}${wavy(p1, p0, (x) => py(x) + 2.2, 0.7, 2, r)} Z`,
    o2(lerp(0.16, 0.26))])
  }

  // The landing: a darker spot where the pen was set down. On the right instead when the
  // stroke tapers out on the left.
  if (r() < 0.6) {
    const atRight = taperL > 0
    const bx = atRight ? xr - lerp(10, 15) : xl + 1
    const bw = lerp(9, 14)
    const by = yT(atRight ? xr - 6 : xl + 6) + 1
    const bh = Math.min(lerp(4.5, 6.5), bandTop - by - 1.5)
    paths.push([`M${r1(bx)},${r1(by)} C${r1(bx + bw * 0.35)},${r1(by - 0.7)}`
      + ` ${r1(bx + bw * 0.7)},${r1(by - 0.5)} ${r1(bx + bw)},${r1(by + 0.4)}`
      + ` L${r1(bx + bw - 1)},${r1(by + bh)} C${r1(bx + bw * 0.6)},${r1(by + bh - 0.7)}`
      + ` ${r1(bx + bw * 0.25)},${r1(by + bh - 0.6)} ${r1(bx + 0.3)},${r1(by + bh + 0.3)} Z`,
    o2(lerp(0.2, 0.3))])
  }

  return paths
}

/**
 * How many dies the pen can stamp, and how many ways a stroke can sit on the words. 10 × 40
 * is not "10 appearances repeated": a variant owns its die AND its own geometry, and the
 * stroke also stretches with the phrase under it, so two highlights match only when their
 * variant, their length and their line breaks all coincide.
 */
export const PEN_DIE_COUNT = 10
export const PEN_VARIANT_COUNT = 40

/**
 * The seed is the design. Bumping it reshuffles every stroke on every site at the next
 * deploy — legal, cache-safe, and rude; do it only on purpose, and look at the result
 * (`bun scripts/pen-sheet.ts`) before shipping it.
 */
const rand = mulberry(0x51_1e_a5)

export const DIES: readonly Die[] = Array.from({ length: PEN_DIE_COUNT }, () => makeDie(rand))

/**
 * How each of the 40 variants HOLDS the pen, as CSS lengths: the stroke's height and
 * vertical drift (weight and register), and asymmetric overshoot past the words (a hand
 * runs long where it lifts). Same PRNG stream as the dies, so one seed governs everything.
 */
export type PenGrip = {
  die: number
  /** stroke height, em */ h: string
  /** stroke top offset, em */ y: string
  /** left/right overshoot beyond the words, em (CSS padding) */ padl: string, padr: string
  /** what the layout gets back of that overshoot (CSS margin); .04em of spill stays */
  marl: string, marr: string
}

const e2 = (n: number) => `${Math.round(n * 100) / 100}em`.replace(/^(-?)0/, '$1')

export const PEN_GRIPS: readonly PenGrip[] = Array.from({ length: PEN_VARIANT_COUNT },
  (_, i) => {
    const padl = 0.08 + rand() * 0.18, padr = 0.08 + rand() * 0.18
    return {
      die: i % PEN_DIE_COUNT,
      // Tall enough at the low end to clear Vietnamese stacked diacritics: at .44em down and
      // .95em tall the stroke still starts above the hat on an "ế" and finishes under the
      // baseline (the fixed values before this were 1.05em/.5em).
      h: e2(0.95 + rand() * 0.2),
      y: e2(0.42 + rand() * 0.14),
      padl: e2(padl), padr: e2(padr),
      marl: e2(-(padl - 0.04)), marr: e2(-(padr - 0.04)),
    }
  })

/* ------------------------------------------------------------------------------------- *
 * The pen's other two gestures: the underline and the ring. Same seed, same argument —
 * and APPENDED to the PRNG stream on purpose: everything above draws exactly what it drew
 * before these existed, so adding a gesture never reshuffles the highlighter.
 *
 * The reference is the same stack of photographs: a law student's textbook where whole
 * sentences are underlined in pen under the highlighter, and single words ("cease") are
 * ringed. What makes those read as a hand is the same quantity problem as the sweep —
 * lines that drift, thin out where the pen eased off, get re-stroked where they mattered,
 * and rings that are never a geometric ellipse.
 * ------------------------------------------------------------------------------------- */

/**
 * One underline die, in a 200×14 box: a thin ribbon that drifts, thins toward the tail,
 * and — every third pen or so — carries a shorter second pass where the reader went back
 * over it.
 */
function makeUnderDie(r: () => number): Die {
  const lerp = (a: number, b: number) => a + (b - a) * r()
  const tilt = lerp(-3.5, 3.5)
  const y0 = lerp(3, 7)
  // A hand pivots from the wrist, so the line bows — and often droops in the last stretch,
  // where the arm has run out of comfortable reach. These ranges are the THIRD attempt:
  // the first was reviewed as "too straight to be a person", and the second was too, for a
  // different reason — the curve was there but the paint box was so short it compressed to
  // under a pixel. The box is 20 tall now and the grips paint it at .34-.5em, so a 6-unit
  // bow is ~2.5px of visible sag at reading size.
  const bow = lerp(-3, 6)
  const droop = lerp(-1.5, 5)
  const xl = lerp(1.5, 4), xr = 200 - lerp(1.5, 4)
  const y = (x: number) => y0 + tilt * (x - 100) / 200
    + bow * 4 * (x - xl) * (xr - x) / ((xr - xl) * (xr - xl))
    + droop * Math.max(0, (x - 130) / 70)
  const segs = 3 + Math.floor(r() * 3)
  // The wobble must stay well under the ribbon's thickness: the first cut let them cross,
  // and a self-intersecting ribbon fills as slivers — two of six dies painted nothing.
  const amp = lerp(0.5, 1.1)
  const t0 = lerp(4.2, 6.2), t1 = lerp(3.2, 5.6)
  const d = `M${r1(xl)},${r1(y(xl))}` + wavy(xl, xr, y, amp, segs, r)
    + ` L${r1(xr + lerp(0, 1.6))},${r1(y(xr) + t1)}`
    + wavy(xr, xl, (x) => y(x) + t0 + (t1 - t0) * (x - xl) / (xr - xl), amp * 0.9, segs, r)
    + ' Z'
  const paths: DiePath[] = [[d, o2(lerp(0.62, 0.85))]]
  if (r() < 0.35) {
    const a = lerp(8, 55), b = lerp(115, 192)
    const off = lerp(-2.6, 3.2), th = lerp(2, 3)
    const yy = (x: number) => y(x) + off
    paths.push([`M${r1(a)},${r1(yy(a))}${wavy(a, b, yy, amp * 0.7, 2, r)}`
      + ` L${r1(b - 0.5)},${r1(yy(b) + th)}${wavy(b, a, (x) => yy(x) + th, amp * 0.7, 2, r)} Z`,
    o2(lerp(0.4, 0.6))])
  }
  return paths
}

/**
 * One ring die — in THREE pieces, because a stretched loop is not a hand-drawn loop.
 *
 * The first two ring builds drew one closed shape and stretched it to the word, and the
 * review verdict was exact: "nó dài quá" — around a long word the end curves stretched
 * flat and the loop read as a capsule pill. A person circles a word the other way round:
 * the two END CURVES keep their round, hand-sized curvature no matter how long the word
 * is, and the stretch all happens in the near-straight run over and under the letters.
 *
 * So the die is a left cap, a middle, and a right cap. The caps ride at a FIXED em width
 * (`web/ink.css.ts` sizes them; only the middle stretches), each cap is a round arc
 * ribbon, the middle is two lightly wavering lines hugging the word, and one cap carries
 * the crossing tail — the overshoot where the pen ran over its own start, which every
 * ringed word in the reference photographs has. The pieces overlap slightly where they
 * meet, and since each piece carries alpha, the joins genuinely darken like re-inked
 * paper instead of needing to be hidden.
 */
export type RingDie = { l: Die, m: Die, r: Die }

/** An arc ribbon for one cap, in the 40×48 cap box. `side` -1 = left cap, 1 = right. */
function capRibbon(side: -1 | 1, r: () => number): string {
  const lerp = (a: number, b: number) => a + (b - a) * r()
  // The cap's centre sits ON the seam edge, so the arc reaches the box edge to meet the
  // middle's lines; the open side faces the word.
  const cx = side < 0 ? 40 : 0, cy = 24
  const rx = lerp(31, 36), ry = lerp(19.5, 21.5)
  const N = 12
  const out: string[] = [], back: string[] = []
  for (let i = 0; i <= N; i++) {
    // From the top seam, around the outside, to the bottom seam.
    const a = -Math.PI / 2 + side * (i / N) * Math.PI
    const t = lerp(1.6, 2.4) + Math.sin((i / N) * Math.PI) * 0.9
    const jx = (r() - 0.5) * 1.6, jy = (r() - 0.5) * 1.6
    const ca = Math.cos(a), sa = Math.sin(a)
    out.push(`${r1(cx + (rx + t) * ca + jx)},${r1(cy + (ry + t) * sa + jy)}`)
    back.unshift(`${r1(cx + (rx - t) * ca + jx * 0.6)},${r1(cy + (ry - t) * sa + jy * 0.6)}`)
  }
  return `M${out[0]} L${out.slice(1).join(' L')} L${back.join(' L')} Z`
}

/** The crossing tail: a short slanted ribbon over the cap's top seam corner. */
function capTail(side: -1 | 1, r: () => number): string {
  const lerp = (a: number, b: number) => a + (b - a) * r()
  const x1 = side < 0 ? 40 : 0                       // the seam edge
  const x0 = x1 + side * lerp(16, 26)                // reaching inward, across the arc
  const yTop = lerp(0.5, 3), drop = lerp(4, 9), th = lerp(2, 3)
  return `M${r1(x0)},${r1(yTop + drop)} L${r1(x1)},${r1(yTop)}`
    + ` L${r1(x1)},${r1(yTop + th)} L${r1(x0 + side * 1.5)},${r1(yTop + drop + th)} Z`
}

/** One nearly-straight wavering line of the middle piece, in the 100×48 middle box. */
function midLine(yc: number, r: () => number): string {
  const lerp = (a: number, b: number) => a + (b - a) * r()
  const bow = lerp(-1.4, 1.4), tiltm = lerp(-1.2, 1.2), th = lerp(2.2, 3.2)
  const y = (x: number) => yc + tiltm * (x - 50) / 100 + bow * 4 * x * (100 - x) / 10000
  return `M0,${r1(y(0))}${wavy(0, 100, y, 0.7, 3, r)}`
    + ` L100,${r1(y(100) + th)}${wavy(100, 0, (x) => y(x) + th, 0.7, 3, r)} Z`
}

function makeRingDie(r: () => number): RingDie {
  const lerp = (a: number, b: number) => a + (b - a) * r()
  const ink = () => o2(lerp(0.58, 0.72))
  const tailOnLeft = r() < 0.5
  const l: DiePath[] = [[capRibbon(-1, r), ink()]]
  const rr: DiePath[] = [[capRibbon(1, r), ink()]]
  ;(tailOnLeft ? l : rr).push([capTail(tailOnLeft ? -1 : 1, r), o2(lerp(0.42, 0.55))])
  const m: DiePath[] = [[midLine(lerp(2.5, 5), r), ink()], [midLine(lerp(41, 44), r), ink()]]
  return { l, m, r: rr }
}

export const UNDER_DIE_COUNT = 6
export const RING_DIE_COUNT = 3

export const UNDER_DIES: readonly Die[] = Array.from({ length: UNDER_DIE_COUNT },
  () => makeUnderDie(rand))
export const RING_DIES: readonly RingDie[] = Array.from({ length: RING_DIE_COUNT },
  () => makeRingDie(rand))

/** The underline's grip per variant: band height, where it sits, and overshoot. */
export type UnderGrip = {
  die: number
  h: string, y: string
  padl: string, padr: string, marl: string, marr: string
}

export const UNDER_GRIPS: readonly UnderGrip[] = Array.from({ length: PEN_VARIANT_COUNT },
  (_, i) => {
    const padl = 0.02 + rand() * 0.1, padr = 0.02 + rand() * 0.12
    return {
      die: i % UNDER_DIE_COUNT,
      h: e2(0.34 + rand() * 0.16),
      // Just under the baseline. MEASURED, third attempt: Literata's ascent is 1.16em
      // (canvas fontBoundingBoxAscent on the rendered page), so the baseline sits 1.16em
      // below the top of an inline background box — the first two value sets were tuned on
      // the proof sheet's Georgia (ascent .92em) and cut straight through the words on the
      // real page. Descenders still cross the line, exactly as on paper.
      y: e2(1.12 + rand() * 0.1),
      padl: e2(padl), padr: e2(padr),
      marl: e2(-(padl - 0.02)), marr: e2(-(padr - 0.02)),
    }
  })

/** The ring's grip: how far the loop clears the word — WELL past it, both ways. The
 *  padding is what the loop paints over; the margin gives most of it back to the layout,
 *  so the ring visibly overhangs its neighbours the way ballpoint overhangs print. */
export type RingGrip = { die: number, padx: string, pady: string, marx: string }

export const RING_GRIPS: readonly RingGrip[] = Array.from({ length: PEN_VARIANT_COUNT },
  (_, i) => {
    const padx = 0.38 + rand() * 0.22
    return {
      die: i % RING_DIE_COUNT,
      padx: e2(padx), pady: e2(0.14 + rand() * 0.12),
      marx: e2(-(padx - 0.2)),
    }
  })
