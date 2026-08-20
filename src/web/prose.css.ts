// The article body's typography, shared by the public sheet and the admin editor.
//
// The frozen tree kept these in `globals.css`, which the admin layout loaded on top of. 2.0
// has no globals.css, and the editor is a `.prose` surface: without these rules the writing
// surface loses its rhythm entirely and every paragraph runs into the next. That is what it
// did, and it is why this is a shared constant rather than a copy in each sheet — two
// copies of a type scale stay in step for about a month.
//
// NO BACKTICKS anywhere below: this is one template literal and a backtick ends it.
// `check:css-literal` enforces that.

import { MATH_CSS } from '@/web/math.css'

export const PROSE_CSS = `
/* The body's rhythm is ONE rule: every sibling gets the same lead, and the headings then
   buy themselves a little more. Margins were bottom-side and fixed in rem here, which does
   not scale with the reader's type size and left headings floating between paragraphs. */
/* The reading face belongs HERE, not in the public sheet, because the editor is a .prose
   surface too and what you type has to be set in the face it will be published in. It lived
   in public.css.ts, so the writing surface fell back to the chrome font and a post drafted
   in JetBrains Mono was published in Literata. */
.prose{font-family:var(--font-reading);
  font-size:var(--fs-body);line-height:var(--lh-body);
  letter-spacing:var(--ls-body);color:var(--c-text)}
.prose > * + *{margin-top:1.4em}
.prose h1,.prose h2,.prose h3,.prose h4,.prose h5{color:var(--c-heading);font-weight:600;
  scroll-margin-top:2rem}
.prose h1{font-size:var(--fs-h1);line-height:var(--lh-h1);
  letter-spacing:var(--ls-h1);margin-top:1.9em}
.prose h2{font-size:var(--fs-h2);line-height:var(--lh-h2);
  letter-spacing:var(--ls-h2);margin-top:1.85em}
.prose h3{font-size:var(--fs-h3);line-height:var(--lh-h3);
  letter-spacing:var(--ls-h3);margin-top:1.8em}
.prose h4{font-size:var(--fs-h4);line-height:var(--lh-h4);
  letter-spacing:var(--ls-h4);margin-top:1.75em}
.prose h5{font-size:var(--fs-h5);line-height:var(--lh-h5);
  letter-spacing:var(--ls-h5);margin-top:1.7em}
/* A heading belongs to what comes AFTER it. Left to the shared 1.4em lead, the space below
   a heading is a fixed 1.4 x the BODY size while the space above is a multiple of the
   HEADING's own size — so the smaller the heading, the closer the two get, and at h5 they
   inverted: 22px above, 25px below. Measured on the specimen page, all four levels:

     h2  44 above / 22 below      h3  32 / 25      h4  28 / 25      h5  22 / 25

   The space below is therefore stated here, in the FOLLOWING element's em (it is that
   paragraph's lead, not the heading's), and graded so every level keeps a clear
   above-beats-below ratio while the absolute space still shrinks with the level. */
.prose > :is(h1,h2) + *{margin-top:.75em}
.prose > :is(h3,h4,h5) + *{margin-top:.6em}
/* Bold is EMPHASIS in the body colour. A book serif's 700 is blacker than the 600 of the
   headings, so a preset can dial it back through --reading-bold. */
.prose strong,.prose b{font-weight:var(--reading-bold, 700)}
/* A body link carries a permanent faint rule that warms to the accent on hover, which is
   the opposite signature to the chrome links (.link-accent) and deliberately so. */
.prose a{color:var(--c-link);text-decoration:underline;text-underline-offset:.18em;
  text-decoration-thickness:1px;text-decoration-color:var(--c-rule)}
.prose a:hover{text-decoration-color:var(--c-accent)}
.prose ul{list-style:disc;padding-left:1.4em}
.prose ol{list-style:decimal;padding-left:1.4em}
.prose li{margin:calc(var(--sp) * .25) 0}
.prose blockquote{border-left:2px solid var(--c-rule);margin-left:0;
  padding-left:var(--sp);color:var(--c-meta)}
/* Code is the ONE role that is not the reading face, and it is one face for both forms.
   It used to be two: inline code inherited the reading font while a fenced block asked for
   var(--font-mono), which nothing ever defined — so the same code role rendered in a book
   serif on one line and the browser's ui-monospace three lines later. --font-mono is now a
   real token (JetBrains Mono, self-hosted, declared in font-faces.ts). The face costs
   nothing on a post with no code: unicode-range means the browser fetches a file only when
   a glyph actually needs it. */
/* Declared on .prose rather than :root so a palette swap on the html element re-derives it
   with no second rule. Read by the block panel below. */
.prose{--c-code-panel:color-mix(in srgb, var(--c-rule) 20%, var(--c-bg))}
.prose code{font-family:var(--font-mono);font-size:var(--fs-code);
  line-height:var(--lh-code);letter-spacing:var(--ls-code)}
.prose :not(pre) > code{background:var(--c-rule);padding:.15em .38em}
/* A CODE BLOCK IS A PANEL, and until 2026-08-15 it was not one on any palette.

   pre carried padding, a radius and an overflow rule -- and no background of its own,
   because Shiki writes one as an INLINE style on every block it highlights. Its light theme
   (vitesse-light) writes #ffffff. This site's paper is #fcfcfc. So a code block was a white
   rectangle on a near-white page: the radius had nothing to round, the padding read as an
   indent, and the block differed from the prose around it only by being monospace. Reported
   as "tu dung thut lui lai thoi chu ko co gi khac biet".

   Two things are wrong with letting Shiki own it, and the colour is the smaller. A hex from
   a third-party theme is baked into HTML that is CACHED under a hash of its Markdown, so it
   outlives any palette the reader picks -- the same trap render/math.ts refuses for its
   error colour, and the rule CLAUDE.md states as public colours coming only from tokens.

   So the panel is derived from the palette: a fifth of the rule colour mixed into the page
   colour, which is a shade off the paper on every one of the six and stays right in dark
   with no second declaration. The hairline is the rule the tables already draw with -- a
   frame rather than a left bar, because the left bar is the blockquote's mark and two things
   sharing one mark is how a reader stops reading it.

   The important flag is not decoration: an inline style beats any selector without it. Only
   the block needs one -- measured across the fixture, Shiki emits no span backgrounds here,
   so a second rule to flatten them would guard nothing. */
.prose pre{padding:var(--sp);border-radius:.5rem;overflow-x:auto;font-size:var(--fs-code);
  line-height:var(--lh-code);letter-spacing:var(--ls-code);
  background:var(--c-code-panel);border:1px solid var(--c-rule)}
.prose pre.shiki{background:var(--c-code-panel)!important}
/* The two marks a block with no language still earns -- see render/plain-code.ts for why
   these two and nothing else.

   WEIGHT FIRST, COLOUR SECOND, and that order was decided by measuring rather than by taste.
   Written as colour alone, both marks came out at rgb(18,18,18) and rgb(22,22,22) against
   body text at rgb(38,38,38) -- invisible, because the DEFAULT palette is monochrome and
   --c-link and --c-accent are near-black in it on purpose. A device that does nothing on the
   palette most installs run is not a device.

   So the mark is weight, which every palette has, and the colour rides along for the ones
   that have a hue to give. Both kinds get the SAME treatment: a quoted literal and a $VAR
   are one category here -- machine values sitting inside human words -- and inventing a
   second distinction between them would be the guessing this whole file refuses. */
.prose pre.plain-code .tk-s,.prose pre.plain-code .tk-v{font-weight:600;color:var(--c-heading)}
.prose pre code{font-size:inherit;line-height:inherit;letter-spacing:inherit}
/* A SECTION BREAK, not a divider. A printed book never rules a line across the text
   block to change subject: it leaves white space, and marks it with something small and
   centred so the reader knows the gap is deliberate rather than a page ending. The
   full-width rule stays for the STRUCTURAL separations, which are a different job: the
   footnote rule, the top of the comment thread, the pager. Those are edges of the
   document; this is a pause inside it.
   Width in em, so it grows with the reader's type and with book mode's 1.15. */
.prose hr:not(.fn-rule){width:6em;margin:2.6em auto;border-top:1px solid var(--c-rule)}
/* A TABLE THAT WILL NOT FIT SCROLLS THE ARTICLE, NEVER THE PAGE.
   Measured at 390px: a five-column table is 484px at its narrowest, and a table cannot be
   squeezed below its own content -- so with visible overflow the DOCUMENT went to 516px and
   every paragraph in the piece panned sideways with it. A pre has carried overflow-x since
   it was written and .math-block was given it on purpose; this was the third case, and the
   only one nothing said out loud.
   The scroll sits on .prose rather than on the table, and that is forced rather than
   preferred: overflow is ignored on a display:table box, and switching the table to
   display:block makes the anonymous table inside it shrink-to-fit -- measured 607px down to
   345px on a laptop, which would quietly restyle every table on every site in order to fix
   a phone bug. :has() keeps the scroll container off the articles that have no table, and a
   browser without :has() is left exactly where it is today. */
.prose:has(table){overflow-x:auto}
.prose table{border-collapse:collapse;width:100%}
.prose th,.prose td{border:1px solid var(--c-rule);
  padding:calc(var(--sp) * .4) calc(var(--sp) * .6);text-align:left}

/* BOOK TYPOGRAPHY (features.bookText). A printed book leads a paragraph with nothing but
   an indent; on screen that reads as a wall, so a small lead stays. A paragraph that OPENS
   something is never indented — the indent says "this continues", and after a heading
   there is nothing to continue from. */
.book-text .prose p{margin-top:.65em;text-indent:1.6em}
.book-text .prose > p:first-child{text-indent:0}
.book-text .prose :is(blockquote,figure,pre,ul,ol,hr,table,.gallery,.video-embed) + p{
  text-indent:0;margin-top:1.4em}
/* A heading keeps the tighter lead the rhythm rules give it: restating 1.4em here would
   undo, in book mode only, the one thing that binds a heading to its own section. */
.book-text .prose :is(h1,h2,h3,h4,h5) + p{text-indent:0}
.book-text .prose li p,.book-text .prose blockquote p{text-indent:0}
@media (min-width:600px){
  .book-text .prose p,.book-text .prose li{text-align:justify;hyphens:auto}
}

/* The highlighter is NOT here any more. It weighed ~21 of the public sheet's 29 KB gzipped
   — 280 SVG data-URIs — and most pages never show a stroke, so ink.css.ts now builds it as
   two standalone halves that web/assets.ts hashes into their own immutable files, linked
   only when a page's HTML contains a mark or an underline (ADR 0027). The editor still
   sees every stroke: build-admin.ts appends the whole pen (INK_CSS) after this constant,
   because a stroke you cannot see while you are writing is a stroke you cannot place. */

/* Maths, here for the third time for the same reason: the editor is a .prose surface, and a
   formula you cannot see while you are writing is a formula you cannot check. */
${MATH_CSS}
`.trim()
