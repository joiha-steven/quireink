// The highlighter pen itself: five measured pigments, and the shape of one stroke.
//
// This file exists because the pen was written down THREE times and had already drifted.
// `pen/ink.css.ts` drew it for the reader, `render/og-card.ts` drew it on the share card and
// `admin/components/EditorMenus.tsx` painted the five swatches in the toolbar — each with its
// own copy of `d5f856`, and two of them with their own copy of the path. The card's second
// path was four numbers different from the page's, so the stroke under a shared headline was
// not the stroke under a highlighted sentence, and nothing anywhere said so. The card's
// comment claimed a test pinned the two together; there was no such test.
//
// So the pen is data now, in one import-free module, and the three readers ask for it. Same
// arrangement `pen/grammar.ts` and `render/math.ts` already use for their grammars, and for
// the same reason: a fact restated in three places is a fact that will disagree with itself.
//
// THE PIGMENTS ARE HARDCODED HEX, AND THAT IS A DELIBERATE EXCEPTION to "public UI colours
// come only from theme tokens" (CLAUDE.md). A highlighter is not UI. It is a physical object
// dragged across the paper, and its pigment is the same fluorescent yellow whether the page
// around it is mono, sepia, ocean or forest. ADR 0018 records the trade and holds the
// numbers: they are MEASURED off a photograph of a real pen box, not chosen.

/** The ink names, in the order the toolbar offers them. */
export type PenInk = 'yellow' | 'green' | 'pink' | 'blue' | 'orange'

/**
 * LIGHT: the raw pigment. It multiplies onto the paper, so the page shows through it and two
 * overlapping strokes darken on their own, exactly as wet ink does.
 */
export const PEN_LIGHT: Record<PenInk, string> = {
  yellow: 'd5f856', green: 'aaef83', pink: 'faaad9', blue: '8ed6f9', orange: 'fac881',
}

/**
 * DARK: the same five pens seen under a reading lamp, pre-mixed into the page.
 *
 * Two separate faults were fixed here and both are easy to reintroduce.
 *
 * 1. NOT `opacity` on the mark, and not `multiply`. Multiply on a near-black page turns every
 *    ink to mud; opacity fades the TEXT along with the ink, so the highlighted words came out
 *    DIMMER than the words around them — the one thing a highlight must never do. The alpha
 *    therefore lives in the pigment, which is why dark mode carries its own five values.
 * 2. The first mix (55%) put body text on the densest part of the stroke at 3.74:1 yellow,
 *    4.10:1 green, 4.49:1 orange — under the 4.5:1 this repo has already audited itself
 *    against. 45% is the brightest mix at which all five clear 5.0:1. Measured across the
 *    whole stroke, not at one point: the two paths overlap at ~91% alpha and the thinnest
 *    part is ~80%, so each ink spans a range and the WORST end of it is what was checked.
 *
 * Yellow is deliberately not the same hue as its light twin. The real pen is chartreuse
 * (hue 73) and light mode keeps that, but at dark-mode luminance chartreuse and the green
 * (hue 98) are 25° apart and both read as the same olive. Dark yellow is warmed to hue 50,
 * which opens the gap to 48° and still measures 5.07:1.
 */
export const PEN_DARK: Record<PenInk, string> = {
  yellow: '7e7028', green: '547343', pink: '785469', blue: '486878', orange: '786242',
}

/**
 * The desk's other two pens: the graphite pencil an underline defaults to, and the red
 * ballpoint a ring defaults to. CHOSEN, not measured — unlike the five highlighter pigments
 * there is no reference box to photograph, so these are picked by eye against the light and
 * dark pages and reviewed on the proof sheet. Both gestures also take the five highlighter
 * inks through the same `#colour` suffix.
 *
 * The dark values are brighter than the highlighter's dark mixes on purpose: a line does
 * not sit UNDER the words the way a sweep does, so it owes the page visibility, not a
 * text-contrast ceiling.
 */
export const PEN_AUX_LIGHT = { graphite: '5b574f', red: 'c23b2b' } as const
export const PEN_AUX_DARK = { graphite: '8f8a80', red: 'a3524a' } as const

/**
 * The five inks AS LINES. A thin line drawn in the highlighter's pastel pigment all but
 * vanishes — pale ink over a wide sweep reads because of its area, and a 2px underline has
 * none — so the line gestures get ballpoint-strength versions of the same five hues.
 * Chosen like the AUX pair above, and brighter in dark mode for the same reason.
 */
export const PEN_LINE_LIGHT: Record<PenInk, string> = {
  yellow: 'a38c15', green: '3f7d2c', pink: 'c2418f', blue: '2f6fae', orange:'c76b1d',
}
export const PEN_LINE_DARK: Record<PenInk, string> = {
  yellow: 'b6a13c', green: '7fae62', pink: 'd587b8', blue: '77a8d4', orange: 'd09055',
}

// The die shapes are GROWN from a seeded generator rather than drawn — `pen-dies.ts` holds
// the hand and the argument for it. This module stays the single place a pigment exists.
import { DIES, RING_DIES, UNDER_DIES, type Die } from '@/pen/dies'
import { LINK_DASH_DIE, LINK_SOLID_DIE } from '@/pen/dies-link'
export {
  PEN_DIE_COUNT, PEN_VARIANT_COUNT, PEN_GRIPS,
  UNDER_DIE_COUNT, UNDER_GRIPS, RING_DIE_COUNT, RING_GRIPS,
} from '@/pen/dies'

/**
 * One stroke, in one colour, stamped from one die, as a `url()` an element can carry as a
 * background-image. Die 0 is the default and the only one the share card uses: satori reads
 * the same `backgroundImage` grammar a browser does, so the card and the page want identical
 * strings — which is the whole point of this returning a finished value.
 *
 * IT CANNOT BE A MASK, and the obvious build is the one that fails. Solid ink plus an SVG
 * mask with a hand-drawn edge clips the TEXT as well: `mask` applies to the whole element, so
 * the tops of the letters and every Vietnamese diacritic get cut off along with the ink. That
 * is measured, not predicted — the first pass sheared the tops off a line of accented text. So
 * the shape carries its own colour and rides in as an image, one per pigment per die.
 *
 * `preserveAspectRatio=none` stretches the die to the length of the phrase, so on top of the
 * dies the wobble frequency itself varies with how much text sits under the stroke.
 */
export function penStroke(hex: string, die = 0): string {
  return penUrl(DIES[die]!, hex, 34)
}

/**
 * The same stroke with no physics — the paths alone, inked flat. For the share card:
 * satori hands the SVG to a rasteriser that draws neither the filter nor the gradient, so
 * the card would get the ghost pass alone and a title sitting on a barely-tinted box. At
 * card size the fibres would not read anyway.
 */
export function penStrokeFlat(hex: string): string {
  // One printing of each outline, plain. The ghost and the wet sweep share an outline and
  // the rasteriser behind the card draws neither a `<use>` nor a gradient, so the sweep is
  // printed once, at the density a wet felt lays down (.8 — the top of the sweep's range,
  // and the value the first pen inked every stroke at). Nothing else changes.
  const byOutline = new Map<string, string>()
  for (const [d, o, mode] of DIES[0]!.paths) {
    if (mode === 'w') byOutline.set(d, '.8')
    else if (!byOutline.has(d)) byOutline.set(d, o)
  }
  const paths = [...byOutline].map(([d, o]) => [d, o] as const)
  return penUrl({ paths }, hex, 34)
}

/** An underline stroke: the same contract as `penStroke`, in the underline's 200×20 box. */
export function penUnder(hex: string, die = 0): string {
  return penUrl(UNDER_DIES[die]!, hex, 20)
}

/**
 * One PIECE of a ring around a word: the left cap, the stretchable middle, or the right
 * cap. Three images instead of one because a stretched loop is not a hand-drawn loop — the
 * caps ride at a fixed em width so their curvature never depends on how long the word is
 * (`pen-dies.ts` has the full argument). The caps live in a 40-unit box, the middle in a
 * 100-unit one.
 */
export function penRing(hex: string, die = 0, part: 'l' | 'm' | 'r' = 'm'): string {
  const d = RING_DIES[die]!
  return penUrl(d[part], hex, 48, undefined, part === 'm' ? 100 : 40)
}

/**
 * A link's underline: a tiled run of hand-drawn dashes, or the solid run it becomes under
 * the cursor. 240x16, and it TILES rather than stretching — see `pen-dies.ts` for why.
 */
export function penDash(hex: string): string {
  return penUrl(LINK_DASH_DIE, hex, 16, undefined, 240)
}
export function penSolidRule(hex: string): string {
  return penUrl(LINK_SOLID_DIE, hex, 16, undefined, 240)
}

/**
 * The stamp. A die's paths in one pigment, as a `url()` an element can carry — and, when the
 * die asks for it, the physics inside the same data-URI: a `<filter>` for fibre grain and
 * edge tremor, a `<linearGradient>` for wet-to-dry. Both must live INSIDE the image, because
 * an SVG used as a background can reference nothing outside itself.
 *
 * `%23` for every `#`: a data-URI in a CSS `url("…")` reads a bare `#` as a fragment and the
 * image ends there. Quotes, spaces and `=` are left as they are — every browser this site
 * supports accepts them, and encoding them would double the sheet.
 */
function penUrl(die: Die, hex: string, boxH: number, extra = '', boxW = 200): string {
  const fx = die.fx
  let defs = ''
  const fxSteps: string[] = []
  if (fx?.grain) {
    const [gx, gy, gain, bias] = fx.grain
    fxSteps.push(`%3CfeTurbulence type='fractalNoise' baseFrequency='${gx} ${gy}' numOctaves='3' seed='${fx.seed}' result='n'/%3E`
      + `%3CfeColorMatrix in='n' type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${gain} ${bias}' result='a'/%3E`)
  }
  if (fx?.tremor) {
    const [tf, ts] = fx.tremor
    fxSteps.push(`%3CfeTurbulence type='turbulence' baseFrequency='${tf}' numOctaves='1' seed='${fx ? fx.seed + 3 : 0}' result='d'/%3E`
      + `%3CfeDisplacementMap in='SourceGraphic' in2='d' scale='${ts}' xChannelSelector='R' yChannelSelector='G' result='s'/%3E`)
  }
  if (fxSteps.length > 0) {
    const src = fx?.tremor ? 's' : 'SourceGraphic'
    if (fx?.grain) fxSteps.push(`%3CfeComposite in='${src}' in2='a' operator='in'/%3E`)
    // The default filter region (-10%..120%) already covers a displaced edge; naming one
    // costs ~60 bytes a stroke for nothing.
    defs += `%3Cfilter id='f'%3E${fxSteps.join('')}%3C/filter%3E`
  }
  if (fx?.wet) {
    const [dir, from, o0, o1, o2] = fx.wet
    defs += `%3ClinearGradient id='g' x1='${dir}' x2='${1 - dir}'%3E`
      + `%3Cstop offset='0' stop-color='%23${hex}' stop-opacity='${o0}'/%3E`
      + `%3Cstop offset='${from}' stop-color='%23${hex}' stop-opacity='${o1}'/%3E`
      + `%3Cstop offset='1' stop-color='%23${hex}' stop-opacity='${o2}'/%3E%3C/linearGradient%3E`
  }
  // A die may print the same outline twice (the highlighter's ghost under its wet sweep);
  // the second printing references the first rather than restating the path data.
  const seen = new Map<string, number>()
  const paths = die.paths
    .map(([d, o, mode = 'p'], i) => {
      const filtered = mode !== 'p' && fxSteps.length > 0 ? ` filter='url(%23f)'` : ''
      const fill = mode === 'w' && fx?.wet ? `url(%23g)` : `%23${hex}`
      // A wet path's gradient runs 1 → .92 → dry, and the path's own opacity scales it: the
      // sweep is never inked past the value the dark-mode audit was run at.
      const attrs = ` fill='${fill}' opacity='${o}'${filtered}${extra}`
      const first = seen.get(d)
      if (first !== undefined) return `%3Cuse href='%23p${first}'${attrs}/%3E`
      seen.set(d, i)
      return `%3Cpath id='p${i}' d='${d}'${attrs}/%3E`
    })
    .join('')
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${boxW} ${boxH}'`
    + ` preserveAspectRatio='none'%3E${defs ? `%3Cdefs%3E${defs}%3C/defs%3E` : ''}${paths}%3C/svg%3E")`
}
