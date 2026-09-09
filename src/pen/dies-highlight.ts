// The highlighter's hand: every sweep shape, grown from one seed.
//
// The first pen had ONE die stretched across every highlight — same edge wobble, same chisel
// at both ends — and once a reader saw it twice the pen stopped being a pen. Ten grown dies
// fixed the repetition (ADR 0025). What they could not fix was the EVENNESS: every one of
// them laid its ink at one density from end to end, with edges a vector tool would draw,
// and two passes that ran perfectly parallel. Against photographs of real highlighting the
// tell is no longer the shape. It is that a felt tip never inks evenly.
//
// So a die now carries its physics as well as its shape (`Fx` in `dies-kit.ts`), and the
// stamp applies them inside the data-URI:
//
//   fibres    a fractal-noise alpha mask, stretched along the stroke and fine across it —
//             the streaks a felt tip leaves, and the dry lanes where a fibre had nothing
//             left to give;
//   wet→dry   a gradient of opacity along the stroke: darkest where the pen landed, paler
//             where it lifted, in a direction dealt per die;
//   tremor    a displacement of the outline, so the edge is a hand's and not a spline's;
//   a ghost   a faint unfiltered copy under it all, because paper soaks: where the felt
//             skipped, the paper is tinted, never bare.
//
// And the hand knows the LENGTH of what it is marking. A word gets a quick, tilted flick
// that overshoots; a sentence gets a slower, flatter pass that drifts and bows. The dies
// come in two sets for that reason, and `grammar.ts` deals a variant from the right half
// by the text's own length.
//
// ⚠️ DETERMINISTIC ON PURPOSE, twice over. The PRNG is seeded with a constant, so every
// build emits byte-identical CSS and the public sheet's hash holds still. And which die a
// highlight wears is a hash of its own text, so a phrase keeps its stroke across reloads — a
// page that reshuffled its ink every visit would feel haunted, not hand-made.
//
// The ceiling every die respects is the dark-mode contrast audit in `pigments.ts`: composite
// alpha nowhere exceeds ~.91. Ghost, sweep and band compound to at most .905 — the band's
// ink is solved for that, not chosen — and every pool is placed clear of the band.

import { type Die, type DiePath, e2, mulberry, o2, r1, spanOf, wavy } from '@/pen/dies-kit'
import { PEN_SHORT_FROM, PEN_VARIANT_COUNT } from '@/pen/dies-kit'

/** One sweep die in a 200×34 box, for the long hand or the short one. */
function makeDie(r: () => number, seed: number, short: boolean): Die {
  const lerp = spanOf(r)
  // The hand: tilt, bow, weight, and how much ink the pass laid down. A short flick tilts
  // hard and has no time to bow; a long pass barely tilts but sags or rises mid-way as the
  // wrist pivots.
  const tilt = short ? lerp(-4.5, 4.5) : lerp(-1.6, 1.6)
  const bow = short ? 0 : lerp(-1.6, 2.2)
  const top = lerp(3.4, 6.4)
  const bot = lerp(28.2, 31.6)
  const sweepInk = lerp(0.68, 0.8)
  const xl = lerp(2.4, 5), xr = 200 - lerp(2.4, 5.5)
  const arc = (x: number) => tilt * (x - 100) / 200 + bow * 4 * (x - xl) * (xr - x) / ((xr - xl) ** 2)
  const yT = (x: number) => top + arc(x)
  const yB = (x: number) => bot + arc(x)
  // The ends: where the pen landed and lifted, and a taper on the way out — likelier on a
  // flick, which lifts before it has quite finished.
  const taperR = r() < (short ? 0.5 : 0.3) ? lerp(2, 5) : 0
  const taperL = taperR === 0 && r() < 0.25 ? lerp(2, 4) : 0
  // Fine wobble, not billow: a marker's edge is straight-ish with a light tremor, so many
  // short segments at low amplitude. A long pass gets more, finer segments than a flick.
  const segs = short ? 4 + Math.floor(r() * 3) : 6 + Math.floor(r() * 4)
  const amp = short ? lerp(0.9, 2.2) : lerp(0.6, 1.6)

  // The ends are a chisel tip: nearly flat cuts, slanted by however the corner offsets land,
  // with barely any horizontal bulge — bowed caps read as sausage ends.
  const sweep = `M${r1(xl)},${r1(yT(xl) + taperL * 0.6)}`
    + wavy(xl, xr, (x) => yT(x) + (taperR ? taperR * 0.6 * (x - xl) / (xr - xl) : 0), amp, segs, r)
    + ` C${r1(xr + 1.5)},${r1(yT(xr) + lerp(3, 6))} ${r1(xr + 1.6)},${r1(yB(xr) - lerp(4, 8))}`
    + ` ${r1(xr - lerp(0.5, 4.5))},${r1(yB(xr) - taperR * 0.5)}`
    + wavy(xr, xl, (x) => yB(x) - (taperL ? taperL * 0.5 * (xr - x) / (xr - xl) : 0), amp, segs, r)
    + ` C${r1(xl - 1.4)},${r1(yB(xl) - lerp(4, 8))} ${r1(xl - 1.3)},${r1(yT(xl) + lerp(3, 6))}`
    + ` ${r1(xl + lerp(0, 2.5))},${r1(yT(xl) + taperL * 0.6)} Z`

  // The ghost: the paper's tint under everything, unfiltered, so a dry lane is never bare.
  const ghost = lerp(0.26, 0.34)
  const paths: DiePath[] = [[sweep, o2(ghost), 'p'], [sweep, o2(sweepInk), 'w']]

  // The second pass. Not parallel to the first — its own small tilt against the sweep's —
  // and its ink is SOLVED so ghost + sweep + band never compound past .905, the dark-mode
  // audit's ceiling. It breaks in two where the felt ran dry, half the time.
  const bandTop = lerp(12.6, 16.4)
  const bandH = Math.min(lerp(9.5, 12.5), bot - 2 - bandTop)
  const bandInk = Math.min(lerp(0.42, 0.54), 1 - 0.095 / ((1 - ghost) * (1 - sweepInk)))
  const skew = lerp(-1.2, 1.2)
  const ybt = (x: number) => bandTop + arc(x) + skew * (x - 100) / 200
  const band = (x0: number, x1: number, yt: (x: number) => number): DiePath => {
    const s = x1 - x0 > 90 ? 3 : 2
    const d = `M${r1(x0)},${r1(yt(x0))}${wavy(x0, x1, yt, 1.4, s, r)}`
      + ` L${r1(x1 - 0.6)},${r1(yt(x1) + bandH)}${wavy(x1, x0, (x) => yt(x) + bandH, 1.4, s, r)} Z`
    return [d, o2(bandInk), 'f']
  }
  if (r() < 0.5) {
    const gx = lerp(60, 140), gw = lerp(10, 26)
    paths.push(band(xl + lerp(1, 4), gx - gw / 2, ybt))
    paths.push(band(gx + gw / 2, xr - lerp(0.5, 3), (x) => ybt(x) - lerp(0, 1.6)))
  } else {
    paths.push(band(xl + lerp(1, 4), xr - lerp(0.5, 3), ybt))
  }

  // Pooled ink along the top edge — the darker rim a felt tip leaves where the ink settles.
  if (r() < 0.7) {
    const p0 = lerp(18, 60), p1 = lerp(115, 175)
    const py = (x: number) => yT(x) + 0.4
    paths.push([`M${r1(p0)},${r1(py(p0))}${wavy(p0, p1, py, 0.7, 2, r)}`
      + ` L${r1(p1 - 0.4)},${r1(py(p1) + 2.2)}${wavy(p1, p0, (x) => py(x) + 2.2, 0.7, 2, r)} Z`,
    o2(lerp(0.14, 0.24)), 'f'])
  }

  // The physics. Grain runs long along the stroke and fine across it; the wet end is dealt,
  // and a flick dries faster than a pass.
  const dir = r() < 0.5 ? 0 : 1
  const from = short ? lerp(0.35, 0.6) : lerp(0.5, 0.75)
  const dry = short ? lerp(0.62, 0.78) : lerp(0.7, 0.88)
  return {
    paths,
    fx: {
      seed,
      grain: [r1(lerp(0.006, 0.011) * 1000) / 1000, r1(lerp(0.14, 0.26) * 100) / 100,
        r1(lerp(1.8, 2.4) * 10) / 10, r1(lerp(-0.2, -0.05) * 100) / 100],
      tremor: [r1(lerp(0.025, 0.04) * 1000) / 1000, r1(lerp(1.6, 2.6) * 10) / 10],
      wet: [dir, r1(from * 100) / 100, 1, 0.92, Number(o2(dry))],
    },
  }
}

/**
 * Twelve dies: six for the long hand (0–5, and die 0 is what a mark with no variant wears —
 * the editor's, the share card's), six for the short (6–11).
 */
export const PEN_DIE_COUNT = 12
const LONG_DIES = 6

/**
 * The seed is the design. Bumping it reshuffles every stroke on every site at the next
 * deploy — legal, cache-safe, and rude; do it only on purpose, and look at the result
 * (`bun scripts/pen-sheet.ts`) before shipping it.
 */
const rand = mulberry(0x51_1e_a5_02)

export const DIES: readonly Die[] = Array.from({ length: PEN_DIE_COUNT },
  (_, i) => makeDie(rand, 11 + i * 7, i >= LONG_DIES))

/**
 * How each of the 80 variants HOLDS the pen, as CSS lengths: the stroke's height and
 * vertical drift (weight and register), and asymmetric overshoot past the words (a hand
 * runs long where it lifts — and a flick runs a good deal longer than a pass).
 */
export type PenGrip = {
  die: number
  /** stroke height, em */ h: string
  /** stroke top offset, em */ y: string
  /** left/right overshoot beyond the words, em (CSS padding) */ padl: string, padr: string
  /** what the layout gets back of that overshoot (CSS margin); .04em of spill stays */
  marl: string, marr: string
}

export const PEN_GRIPS: readonly PenGrip[] = Array.from({ length: PEN_VARIANT_COUNT },
  (_, i) => {
    const short = i >= PEN_SHORT_FROM
    const padl = short ? 0.12 + rand() * 0.2 : 0.07 + rand() * 0.12
    const padr = short ? 0.12 + rand() * 0.24 : 0.07 + rand() * 0.14
    return {
      die: short ? LONG_DIES + (i % LONG_DIES) : i % LONG_DIES,
      // Tall enough at the low end to clear Vietnamese stacked diacritics: at .44em down and
      // .95em tall the stroke still starts above the hat on an "ế" and finishes under the
      // baseline.
      h: e2(short ? 0.98 + rand() * 0.22 : 0.95 + rand() * 0.16),
      y: e2(short ? 0.38 + rand() * 0.16 : 0.42 + rand() * 0.13),
      padl: e2(padl), padr: e2(padr),
      marl: e2(-(padl - 0.04)), marr: e2(-(padr - 0.04)),
    }
  })
