// The highlighter pen's ink. `render/ink.ts` decides WHAT is highlighted (and stamps each
// highlight's `data-pen` identity); this decides what the stroke looks like, and the two are
// separate on purpose: rendered bodies are cached under a hash of their Markdown, so a
// stroke baked into the HTML could not be restyled without evicting every body on the site.
//
// THE PIGMENTS ARE HARDCODED HEX, AND THAT IS A DELIBERATE EXCEPTION to "public UI colours
// come only from theme tokens" (CLAUDE.md). A highlighter is not UI. It is a physical object
// that was dragged across the paper, and its pigment is the same fluorescent yellow whether
// the page around it is mono, sepia, ocean or forest — a highlight that restyled itself per
// palette would read as a coloured box, which is the one thing it must not look like. ADR
// 0018 records the trade. The five values are MEASURED off a photograph of a real pen box,
// not chosen: `docs/decisions/0018-highlighter-pen.md` has the numbers.
//
// ONE STROKE STYLE, MANY HANDS. There used to be a three-way site setting here (marker /
// swipe / double) driving `--ink-h0`-family variables from `layout.ts`. It went when the
// pen learned to vary ITSELF: `render/pen-dies.ts` grows the dies and the forty grips, each
// highlight is dealt one by the `data-pen` hash of its own text, and a picker choosing
// between three uniformities had nothing left to offer.

// The pen's pigments and its stroke are DATA, and they live in `render/pen.ts`. They were
// written out here, again on the share card and a third time in the editor's swatches, and
// the card's copy of the path had already drifted four numbers from this one.
import { PEN_DARK, PEN_LIGHT, penStroke as pen } from '@/render/pen'
import {
  PEN_AUX_DARK, PEN_AUX_LIGHT, PEN_LINE_DARK, PEN_LINE_LIGHT, penRing, penUnder,
} from '@/render/pen'
import {
  PEN_DIE_COUNT, PEN_GRIPS, RING_DIE_COUNT, RING_GRIPS, UNDER_DIE_COUNT, UNDER_GRIPS,
} from '@/render/pen-dies'

const inks = (set: Record<string, string>, prefix: string) =>
  Object.entries(set)
    // Yellow is what a bare `<mark>` means, so it is the element's own rule rather than an
    // attribute selector — `render/ink.ts` emits no `data-ink` for the default.
    .map(([name, hex]) => `${prefix} ${name === 'yellow' ? 'mark' : `mark[data-ink=${name}]`}`
      + `{--ink-stroke:${pen(hex)}}`)
    .join('\n')

/* Deal the non-default dies to the pen variants that own them. One data-URI per pigment per
   die — the grouped selector is what keeps forty variants from costing forty images.
   Yellow's rules carry `:not([data-ink])` where its base rule is bare `mark` — not for
   meaning (a coloured mark never wanted yellow ink) but for SPECIFICITY: a bare
   `mark[data-pen="7"]` would tie with `mark[data-ink=green]` and, sitting later in the
   sheet, would win — a green mark stamped in yellow. */
const dies = (set: Record<string, string>, prefix: string) => {
  const out: string[] = []
  for (let d = 1; d < PEN_DIE_COUNT; d++) {
    const pens = PEN_GRIPS.flatMap((g, i) => (g.die === d ? [i] : []))
    for (const [name, hex] of Object.entries(set)) {
      const mark = name === 'yellow' ? 'mark:not([data-ink])' : `mark[data-ink=${name}]`
      out.push(pens.map((p) => `${prefix} ${mark}[data-pen="${p}"]`).join(',')
        + `{--ink-stroke:${pen(hex, d)}}`)
    }
  }
  return out.join('\n')
}

/* How each variant holds the pen: weight, register, and asymmetric overshoot past the
   words. Colour-blind rules — they never touch `--ink-stroke`, so they cannot fight the
   pigment rules whatever the order. */
const grips = () =>
  PEN_GRIPS.map((g, i) => `.prose mark[data-pen="${i}"]{--ink-h:${g.h};--ink-y:${g.y};`
    + `padding:0 ${g.padr} 0 ${g.padl};margin:0 ${g.marr} 0 ${g.marl}}`).join('\n')

/* ------------------------------------------------------------------------------------- *
 * The underline (`++text++` → `<u data-pen>`), drawn in graphite unless `data-ink` names
 * one of the five inks — and unlike the highlighter, a named yellow IS an attribute here,
 * because the default it departs from is the pencil. Same deal, same hash, its own dies.
 * ------------------------------------------------------------------------------------- */

const uSel = (name: string) => (name === 'graphite' ? 'u:not([data-ink])' : `u[data-ink=${name}]`)

const underInks = (set: Record<string, string>, aux: Record<string, string>, prefix: string) =>
  Object.entries({ graphite: aux['graphite']!, ...set })
    .map(([name, hex]) => `${prefix} ${name === 'graphite' ? 'u' : `u[data-ink=${name}]`}`
      + `{--u-stroke:${penUnder(hex)}}`)
    .join('\n')

const underDies = (set: Record<string, string>, aux: Record<string, string>, prefix: string) => {
  const out: string[] = []
  for (let d = 1; d < UNDER_DIE_COUNT; d++) {
    const pens = UNDER_GRIPS.flatMap((g, i) => (g.die === d ? [i] : []))
    for (const [name, hex] of Object.entries({ graphite: aux['graphite']!, ...set })) {
      out.push(pens.map((p) => `${prefix} ${uSel(name)}[data-pen="${p}"]`).join(',')
        + `{--u-stroke:${penUnder(hex, d)}}`)
    }
  }
  return out.join('\n')
}

const underGrips = () =>
  UNDER_GRIPS.map((g, i) => `.prose u[data-pen="${i}"]{--u-h:${g.h};--u-y:${g.y};`
    // The .35em of bottom padding is LOAD-BEARING: an inline background clips at the
    // font's descent, and a line drawn under the baseline lives exactly in the strip that
    // gets clipped. Vertical padding on an inline paints without moving any line.
    + `padding:0 ${g.padr} .4em ${g.padl};margin:0 ${g.marr} 0 ${g.marl}}`).join('\n')

/* ------------------------------------------------------------------------------------- *
 * The ring (`@@word@@` → `<mark data-form=o data-pen>`), drawn in red ballpoint unless
 * `data-ink` says otherwise. It rides the mark element — ringing a word IS marking it, and
 * a CSS-less feed reader degrades it to a visible mark — so every ring rule outranks the
 * highlight rules by carrying [data-form=o], and sits after them in the sheet.
 * ------------------------------------------------------------------------------------- */

const oSel = (name: string) =>
  `mark[data-form=o]${name === 'red' ? ':not([data-ink])' : `[data-ink=${name}]`}`

/* Three images per ring — the fixed-width caps and the stretching middle — declared as one
   value so a pigment or die change swaps the whole loop atomically. */
const ringSet = (hex: string, d: number) =>
  `--o-set:${penRing(hex, d, 'l')},${penRing(hex, d, 'm')},${penRing(hex, d, 'r')}`

const ringInks = (set: Record<string, string>, aux: Record<string, string>, prefix: string) =>
  Object.entries({ red: aux['red']!, ...set })
    .map(([name, hex]) => `${prefix} ${name === 'red' ? 'mark[data-form=o]' : oSel(name)}`
      + `{${ringSet(hex, 0)}}`)
    .join('\n')

const ringDies = (set: Record<string, string>, aux: Record<string, string>, prefix: string) => {
  const out: string[] = []
  for (let d = 1; d < RING_DIE_COUNT; d++) {
    const pens = RING_GRIPS.flatMap((g, i) => (g.die === d ? [i] : []))
    for (const [name, hex] of Object.entries({ red: aux['red']!, ...set })) {
      out.push(pens.map((p) => `${prefix} ${oSel(name)}[data-pen="${p}"]`).join(',')
        + `{${ringSet(hex, d)}}`)
    }
  }
  return out.join('\n')
}

const ringGrips = () =>
  RING_GRIPS.map((g, i) => `.prose mark[data-form=o][data-pen="${i}"]`
    + `{padding:${g.pady} ${g.padx};margin:0 ${g.marx}}`).join('\n')

export const INK_CSS = `
/* A highlight is a stroke of ink UNDER the words, never a box around them. The browser's
   default mark is a solid yellow rectangle with its own text colour; both go. */
.prose mark{color:inherit;background-color:transparent;background-repeat:no-repeat;
  padding:0 .16em;margin:0 -.12em;
  -webkit-box-decoration-break:clone;box-decoration-break:clone;
  mix-blend-mode:multiply;
  background-image:var(--ink-stroke);
  background-size:100% var(--ink-h,1.05em);
  background-position:0 var(--ink-y,.5em)}
/* A highlight that runs past the end of a line breaks into one stroke per line, each with
   its own start and finish — a pen lifted at the margin and put down again on the next
   line. That is box-decoration-break above; without it the whole span gets one box wrapped
   around both lines, which is the tell that gives away every CSS highlight on the web. */
${grips()}
${inks(PEN_LIGHT, '.prose')}
${dies(PEN_LIGHT, '.prose')}
.dark .prose mark{mix-blend-mode:normal;color:var(--c-heading)}
${inks(PEN_DARK, '.dark .prose')}
${dies(PEN_DARK, '.dark .prose')}
/* The underline: a pen line under the words, never the browser's text-decoration — that is
   a perfectly straight rule at 1px, which is the same tell as the box. Descenders cross it,
   exactly as they do on paper. */
.prose u{text-decoration:none;background-color:transparent;background-repeat:no-repeat;
  -webkit-box-decoration-break:clone;box-decoration-break:clone;
  mix-blend-mode:multiply;
  padding-bottom:.4em;
  background-image:var(--u-stroke);
  background-size:100% var(--u-h,.42em);
  background-position:0 var(--u-y,.94em)}
${underGrips()}
${underInks(PEN_LINE_LIGHT, PEN_AUX_LIGHT, '.prose')}
${underDies(PEN_LINE_LIGHT, PEN_AUX_LIGHT, '.prose')}
.dark .prose u{mix-blend-mode:normal}
${underInks(PEN_LINE_DARK, PEN_AUX_DARK, '.dark .prose')}
${underDies(PEN_LINE_DARK, PEN_AUX_DARK, '.dark .prose')}
/* The ring. Everything below outranks every highlight rule above (the extra
   [data-form=o]) and replaces the sweep with the loop's three pieces: two caps at a FIXED
   em width, so their curvature never stretches with the word, and a middle that does all
   the stretching. The pieces overlap .14em at each seam; each carries alpha, so the joins
   darken like re-inked paper. Vertical padding paints without moving any line. */
.prose mark[data-form=o]{padding:.18em .45em;margin:0 -.25em;
  background-image:var(--o-set);
  background-size:.62em 100%,calc(100% - .96em) 100%,.62em 100%;
  background-position:0 50%,50% 50%,100% 50%}
${ringGrips()}
${ringInks(PEN_LINE_LIGHT, PEN_AUX_LIGHT, '.prose')}
${ringDies(PEN_LINE_LIGHT, PEN_AUX_LIGHT, '.prose')}
${ringInks(PEN_LINE_DARK, PEN_AUX_DARK, '.dark .prose')}
${ringDies(PEN_LINE_DARK, PEN_AUX_DARK, '.dark .prose')}
`.trim()
