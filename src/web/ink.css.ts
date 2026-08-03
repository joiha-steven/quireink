// The highlighter pen's ink. `render/ink.ts` decides WHAT is highlighted; this decides what
// the stroke looks like, and the two are separate on purpose: rendered bodies are cached
// under a hash of their Markdown, so a stroke baked into the HTML could not be restyled
// without evicting every body on the site.
//
// THE PIGMENTS ARE HARDCODED HEX, AND THAT IS A DELIBERATE EXCEPTION to "public UI colours
// come only from theme tokens" (CLAUDE.md). A highlighter is not UI. It is a physical object
// that was dragged across the paper, and its pigment is the same fluorescent yellow whether
// the page around it is mono, sepia, ocean or forest — a highlight that restyled itself per
// palette would read as a coloured box, which is the one thing it must not look like. ADR
// 0018 records the trade. The five values are MEASURED off a photograph of a real pen box,
// not chosen: `docs/decisions/0018-highlighter-pen.md` has the numbers.

// One stroke, in one colour, as a background-image.
//
// IT CANNOT BE A MASK, and the obvious build is the one that fails. Solid ink plus an SVG
// mask with a hand-drawn edge clips the TEXT as well: `mask` applies to the whole element, so
// the tops of the letters and every Vietnamese diacritic get cut off along with the ink. That
// is measured, not predicted — the first pass rendered "mang dấu vết" as "mang uau vet". So
// the shape carries its own colour and rides in as an image, one per pigment.
//
// Two paths per stroke: a full sweep at 80% opacity and a denser lower band at 55%, which is
// the second pass a real pen leaves. The ends are cut on a slant (a chisel tip), the top and
// bottom edges drift, and `preserveAspectRatio=none` stretches the whole thing to the length
// of the phrase — so no two highlights on a page are the same shape.
const pen = (hex: string) =>
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 200 34\''
  + ' preserveAspectRatio=\'none\'%3E%3Cpath d=\'M6,6 C40,2.5 70,7.5 104,4.2 C138,1.6 168,6.8'
  + ' 196,3.6 L200,29.5 C170,32.6 140,27.2 106,30.4 C72,33.2 40,28.2 0,30.8 Z\' fill=\'%23'
  + hex + '\' opacity=\'.8\'/%3E%3Cpath d=\'M2,17 C40,14.5 70,19.5 104,16.4 C138,13.6 168,18.8'
  + ' 199,15.6 L200,29.5 C170,32.6 140,27.2 106,30.4 C72,33.2 40,28.2 0,30.8 Z\' fill=\'%23'
  + hex + '\' opacity=\'.55\'/%3E%3C/svg%3E")'

// LIGHT: the raw pigment. It multiplies onto the paper, so the page shows through it and two
// overlapping strokes darken on their own, exactly as wet ink does.
const LIGHT = { yellow: 'd5f856', green: 'aaef83', pink: 'faaad9', blue: '8ed6f9', orange: 'fac881' }

// DARK: the same five pens seen under a reading lamp, pre-mixed into the page.
//
// Two separate faults were fixed here and both are easy to reintroduce.
//
// 1. NOT `opacity` on the mark, and not `multiply`. Multiply on a near-black page turns every
//    ink to mud; opacity fades the TEXT along with the ink, so the highlighted words came out
//    DIMMER than the words around them — the one thing a highlight must never do. The alpha
//    therefore lives in the pigment, which is why dark mode carries its own five values.
// 2. The first mix (55%) put body text on the densest part of the stroke at 3.74:1 yellow,
//    4.10:1 green, 4.49:1 orange — under the 4.5:1 this repo has already audited itself
//    against. 45% is the brightest mix at which all five clear 5.0:1. Measured across the
//    whole stroke, not at one point: the two paths overlap at ~91% alpha and the thinnest
//    part is ~80%, so each ink spans a range and the WORST end of it is what was checked.
//
// Yellow is deliberately not the same hue as its light twin. The real pen is chartreuse
// (hue 73) and light mode keeps that, but at dark-mode luminance chartreuse and the green
// (hue 98) are 25° apart and both read as the same olive. Dark yellow is warmed to hue 50,
// which opens the gap to 48° and still measures 5.07:1.
const DARK = { yellow: '7e7028', green: '547343', pink: '785469', blue: '486878', orange: '786242' }

const inks = (set: Record<string, string>, prefix: string) =>
  Object.entries(set)
    // Yellow is what a bare `<mark>` means, so it is the element's own rule rather than an
    // attribute selector — `render/ink.ts` emits no `data-ink` for the default.
    .map(([name, hex]) => `${prefix} ${name === 'yellow' ? 'mark' : `mark[data-ink=${name}]`}`
      + `{--ink-stroke:${pen(hex)}}`)
    .join('\n')

export const INK_CSS = `
/* A highlight is a stroke of ink UNDER the words, never a box around them. The browser's
   default mark is a solid yellow rectangle with its own text colour; both go. */
.prose mark{color:inherit;background-color:transparent;background-repeat:no-repeat;
  padding:0 .16em;margin:0 -.12em;
  -webkit-box-decoration-break:clone;box-decoration-break:clone;
  mix-blend-mode:multiply;
  /* Geometry, in one place, because the three stroke styles ARE these four numbers. The
     site setting overrides --ink-h0/--ink-y0 (and adds a second layer for the double pass)
     from layout.ts; the defaults here are the full marker sweep, so a site that never opens
     the setting costs no bytes. Tall enough to clear Vietnamese stacked diacritics: at .5em
     down and 1.05em tall the stroke starts above the hat on an "ế" and still finishes under
     the baseline. */
  --ink-h:var(--ink-h0,1.05em);
  --ink-y:var(--ink-y0,.5em);
  /* Always two layers. The second is zero-height unless the double-pass stroke is chosen,
     and a zero-height background paints nothing — which keeps all three styles inside ONE
     rule instead of three variants that have to be kept in step. */
  background-image:var(--ink-stroke),var(--ink-stroke);
  background-size:100% var(--ink-h),100% var(--ink-h2,0);
  background-position:0 var(--ink-y),0 var(--ink-y2,0)}
/* Jitter, so no two strokes on a page are stamped from the same die. Deterministic and free:
   stretching the SVG already varies the wobble with the length of the phrase, and this varies
   the weight and how the stroke sits. Expressed against --ink-h0 rather than as fixed sizes
   so it survives whichever of the three styles the site is set to. */
.prose mark:nth-of-type(3n+2){--ink-h:calc(var(--ink-h0,1.05em) * .92);
  --ink-y:calc(var(--ink-y0,.5em) + .08em)}
.prose mark:nth-of-type(3n+3){--ink-h:calc(var(--ink-h0,1.05em) * 1.05);
  --ink-y:calc(var(--ink-y0,.5em) - .04em)}
/* A highlight that runs past the end of a line breaks into one stroke per line, each with its
   own start and finish — a pen lifted at the margin and put down again on the next line. That
   is box-decoration-break above; without it the whole span gets one box wrapped around both
   lines, which is the tell that gives away every CSS highlight on the web. */
${inks(LIGHT, '.prose')}
.dark .prose mark{mix-blend-mode:normal;color:var(--c-heading)}
${inks(DARK, '.dark .prose')}
`.trim()
