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

// The pen's pigments and its stroke are DATA, and they live in `render/pen.ts`. They were
// written out here, again on the share card and a third time in the editor's swatches, and
// the card's copy of the path had already drifted four numbers from this one.
import { PEN_DARK, PEN_LIGHT, penStroke as pen } from '@/render/pen'

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
${inks(PEN_LIGHT, '.prose')}
.dark .prose mark{mix-blend-mode:normal;color:var(--c-heading)}
${inks(PEN_DARK, '.dark .prose')}
`.trim()
