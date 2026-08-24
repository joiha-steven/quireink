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
import { penStroke as pen } from '@/render/pen'
import {
  PEN_AUX_DARK, PEN_AUX_LIGHT, penDash, penRing, penSolidRule, penUnder,
} from '@/render/pen'
import {
  PEN_DIE_COUNT, PEN_GRIPS, RING_DIE_COUNT, RING_GRIPS, UNDER_DIE_COUNT, UNDER_GRIPS,
} from '@/render/pen-dies'
// The palette this sheet is drawn in — the built-ins unless the owner has chosen otherwise.
import { BUILT_IN_INKS, type InkPalette } from '@/render/ink-palette'

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

/* ------------------------------------------------------------------------------------- *
 * The sheet ships in TWO halves, because the pen is heavy and most pages never uncap it.
 * The highlighter half serves `<mark>` (rings included — a ring rides the mark element and
 * leans on its base rule); the lines half serves `<u>` and the ring's own loop. `web/assets.ts`
 * hashes each half into its own immutable file and `web/layout.ts` links one only when the
 * page's HTML actually contains its element — ADR 0027. The admin editor still takes both
 * at once (`INK_CSS` below): the writing surface must show every gesture before the owner
 * has decided which ones a post will use.
 * ------------------------------------------------------------------------------------- */

/**
 * The highlighter half, in whichever inks this site writes with.
 *
 * A FUNCTION since 2026-08-24, when the owner asked for the pen's colours to be his to
 * choose. It still defaults to the measured pigments, and an install that has changed
 * nothing gets a byte-identical sheet under the same hash — which is the property that
 * matters, because the sheet is served immutable under a hash of its own content.
 */
export function inkHighlightCss(p: InkPalette = BUILT_IN_INKS): string {
  return `
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
${inks(p.light, '.prose')}
${dies(p.light, '.prose')}
.dark .prose mark{mix-blend-mode:normal;color:var(--c-heading)}
${inks(p.dark, '.dark .prose')}
${dies(p.dark, '.dark .prose')}
`.trim()
}

/** The lines half: the underline and the ring, in this site's inks. */
export function inkLinesCss(p: InkPalette = BUILT_IN_INKS): string {
  return `
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
${underInks(p.lineLight, p.auxLight, '.prose')}
${underDies(p.lineLight, p.auxLight, '.prose')}
.dark .prose u{mix-blend-mode:normal}
${underInks(p.lineDark, p.auxDark, '.dark .prose')}
${underDies(p.lineDark, p.auxDark, '.dark .prose')}
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
${ringInks(p.lineLight, p.auxLight, '.prose')}
${ringDies(p.lineLight, p.auxLight, '.prose')}
${ringInks(p.lineDark, p.auxDark, '.dark .prose')}
${ringDies(p.lineDark, p.auxDark, '.dark .prose')}
`.trim()
}

/** The built-in sheets, for every caller that has no opinion about ink. */
export const INK_HIGHLIGHT_CSS = inkHighlightCss()
export const INK_LINES_CSS = inkLinesCss()

/* ------------------------------------------------------------------------------------- *
 * The link's dashes. NOT part of either half above, and that is the point: the two pen
 * sheets only board pages whose HTML carries a mark or an underline (ADR 0027), while a
 * link is on nearly every page ever rendered. So this rides in `prose.css.ts`, with the
 * rest of the always-loaded article typography.
 *
 * It costs two data-URIs per mode rather than the pen's 280: one ink, one die, tiled.
 * ------------------------------------------------------------------------------------- */
export const LINK_INK_CSS = `
/* The word keeps the palette's colour; the mark under it is the pen's graphite, because a
   hex baked into an SVG cannot read a CSS variable and this is the trade ADR 0018 already
   made for the pigments. Measured across all six palettes in both modes: 4.97:1 to 7.01:1
   against the paper, where the hairline it replaces sat at 1.16-1.33:1.
   
   repeat-x, and a size in em: the dashes are a physical thing the hand made, so a long link
   gets MORE of them rather than longer ones. box-decoration-break makes a link that wraps
   start its run again on the next line, exactly as the pen does for a highlight.
   
   The bottom padding is load-bearing for the same reason it is on the u element: an inline background
   clips at the font's descent, and this line lives just under the baseline. */
.prose a{color:var(--c-link);text-decoration:none;
  background-repeat:repeat-x;background-size:4.6em .3em;background-position:0 1.22em;
  -webkit-box-decoration-break:clone;box-decoration-break:clone;
  padding-bottom:.42em;
  background-image:${penDash(PEN_AUX_LIGHT.graphite)}}
/* Under the cursor the hand presses down and the run closes up. Same ink, same box, so the
   line does not move by a pixel between the two states. */
.prose a:hover,.prose a:focus-visible{background-image:${penSolidRule(PEN_AUX_LIGHT.graphite)}}
.dark .prose a{background-image:${penDash(PEN_AUX_DARK.graphite)}}
.dark .prose a:hover,.dark .prose a:focus-visible{background-image:${penSolidRule(PEN_AUX_DARK.graphite)}}
/* A footnote marker and a heading anchor are not prose links and must not be underlined:
   the first is a superscript numeral, the second is the heading itself. */
.prose a.fn-ref,.prose sup a,.prose h1 a,.prose h2 a,.prose h3 a,.prose h4 a,.prose h5 a{
  background-image:none;padding-bottom:0}
`.trim()

/** The whole pen, for the one surface that always needs all of it: the admin editor. */
export const INK_CSS = `${INK_HIGHLIGHT_CSS}\n${INK_LINES_CSS}`
