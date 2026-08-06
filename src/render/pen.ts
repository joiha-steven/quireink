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
 * One stroke, in one colour, as a `url()` an element can carry as a background-image.
 *
 * IT CANNOT BE A MASK, and the obvious build is the one that fails. Solid ink plus an SVG
 * mask with a hand-drawn edge clips the TEXT as well: `mask` applies to the whole element, so
 * the tops of the letters and every Vietnamese diacritic get cut off along with the ink. That
 * is measured, not predicted — the first pass rendered "mang dấu vết" as "mang uau vet". So
 * the shape carries its own colour and rides in as an image, one per pigment.
 *
 * Two paths per stroke: a full sweep at 80% opacity and a denser lower band at 55%, which is
 * the second pass a real pen leaves. The ends are cut on a slant (a chisel tip), the top and
 * bottom edges drift, and `preserveAspectRatio=none` stretches the whole thing to the length
 * of the phrase — so no two highlights on a page are the same shape.
 *
 * The `url(...)` wrapper is shared rather than added by each caller: satori reads the same
 * `backgroundImage` grammar a browser does, so the card and the page want the identical
 * string. That is the whole point of this returning a finished value.
 */
export function penStroke(hex: string): string {
  return 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 200 34\''
    + ' preserveAspectRatio=\'none\'%3E%3Cpath d=\'M6,6 C40,2.5 70,7.5 104,4.2 C138,1.6 168,6.8'
    + ' 196,3.6 L200,29.5 C170,32.6 140,27.2 106,30.4 C72,33.2 40,28.2 0,30.8 Z\' fill=\'%23'
    + hex + '\' opacity=\'.8\'/%3E%3Cpath d=\'M2,17 C40,14.5 70,19.5 104,16.4 C138,13.6 168,18.8'
    + ' 199,15.6 L200,29.5 C170,32.6 140,27.2 106,30.4 C72,33.2 40,28.2 0,30.8 Z\' fill=\'%23'
    + hex + '\' opacity=\'.55\'/%3E%3C/svg%3E")'
}
