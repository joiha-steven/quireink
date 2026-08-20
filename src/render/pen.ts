// The highlighter pen itself: five measured pigments, and the shape of one stroke.
//
// This file exists because the pen was written down THREE times and had already drifted.
// `web/ink.css.ts` drew it for the reader, `render/og-card.ts` drew it on the share card and
// `admin/components/EditorMenus.tsx` painted the five swatches in the toolbar — each with its
// own copy of `d5f856`, and two of them with their own copy of the path. The card's second
// path was four numbers different from the page's, so the stroke under a shared headline was
// not the stroke under a highlighted sentence, and nothing anywhere said so. The card's
// comment claimed a test pinned the two together; there was no such test.
//
// So the pen is data now, in one import-free module, and the three readers ask for it. Same
// arrangement `render/ink.ts` and `render/math.ts` already use for their grammars, and for
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
import { DIES, RING_DIES, UNDER_DIES } from '@/render/pen-dies'
export {
  PEN_DIE_COUNT, PEN_VARIANT_COUNT, PEN_GRIPS,
  UNDER_DIE_COUNT, UNDER_GRIPS, RING_DIE_COUNT, RING_GRIPS,
} from '@/render/pen-dies'

/**
 * One stroke, in one colour, stamped from one die, as a `url()` an element can carry as a
 * background-image. Die 0 is the default and the only one the share card uses: satori reads
 * the same `backgroundImage` grammar a browser does, so the card and the page want identical
 * strings — which is the whole point of this returning a finished value.
 *
 * IT CANNOT BE A MASK, and the obvious build is the one that fails. Solid ink plus an SVG
 * mask with a hand-drawn edge clips the TEXT as well: `mask` applies to the whole element, so
 * the tops of the letters and every Vietnamese diacritic get cut off along with the ink. That
 * is measured, not predicted — the first pass rendered "mang dấu vết" as "mang uau vet". So
 * the shape carries its own colour and rides in as an image, one per pigment per die.
 *
 * `preserveAspectRatio=none` stretches the die to the length of the phrase, so on top of the
 * dies the wobble frequency itself varies with how much text sits under the stroke.
 */
export function penStroke(hex: string, die = 0): string {
  return penUrl(DIES[die]!, hex, 34)
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

function penUrl(die: readonly (readonly [string, string])[], hex: string, boxH: number,
  extra = '', boxW = 200): string {
  const paths = die
    .map(([d, o]) => `%3Cpath d='${d}' fill='%23${hex}' opacity='${o}'${extra}/%3E`)
    .join('')
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${boxW} ${boxH}'`
    + ` preserveAspectRatio='none'%3E${paths}%3C/svg%3E")`
}
