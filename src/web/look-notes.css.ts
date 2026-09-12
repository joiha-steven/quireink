// The notebook dialect (settings.look = 'notes'). Its own sheet, linked only when this look
// is on (`web/assets.ts`).
//
// The argument: a page of a working notebook lying on a desk. Everything below is either a
// surface, a rule printed on that surface, or a mark a hand would have made.
//
// NO BACKTICKS anywhere below: this is one template literal and a backtick ends it.
// `check:css-literal` enforces that, and this file is IN its list.

export const LOOK_NOTES_CSS = `
/* --- THE CHROME IS THE NEUTRAL FACE -----------------------------------------
   Three dialects, three faces: the source-code one keeps the monospace, the paper one takes
   the reading face, this one takes the sans. On body and never on --font-sans, for the
   reason look-code.css.ts gives. */
html[data-look=notes] body{font-family:'Inter','Inter Fallback',system-ui,-apple-system,
  'Segoe UI',sans-serif}

/* --- THE DESK, AND THE PAGE ON IT -------------------------------------------
   The desk is a TONE darker than the page and nothing else. A dotted desk was drawn first
   and dropped once the page itself was ruled: two patterns on one screen is a texture
   competition, and what makes a sheet look like a sheet is simply that the thing under it
   is not the same colour. */
html[data-look=notes]{--desk:color-mix(in srgb,var(--c-text) 4%,var(--c-bg));--sheet-inset:20px}
html[data-look=notes] body{background-color:var(--desk)}

/* ONE INSET ON ALL FOUR SIDES, and the sheet grows OUTWARD by exactly what it pads, so the
   first line of the piece stays on the line the shelf and the card start on and not one
   word of the column moves when the dialect is switched. The extra pixel on the top margin
   is the border: without it the headline sat one pixel below the shelf's first line.

   Twenty rather than thirty: the gutter between the shelf and the column is 41px, and a
   30px sheet left 10px of desk between the shelf's longest word and the paper's edge, which
   reads as a collision rather than as a margin. At 20 there is 20px of desk on each side.

   main > article, NOT article: a listing's rows are <article> elements too, so the bare
   selector drew a bordered card round every entry on the front page and printed a hairline
   above and below each one. The piece is the direct child of main; the rows never are. */
@media (max-width:46rem){html[data-look=notes]{--sheet-inset:12px}}
html[data-look=notes] main > article,
html[data-look=notes] .post-list{background:var(--c-bg);
  padding:var(--sheet-inset);
  margin:calc(-1px - var(--sheet-inset)) calc(-1 * var(--sheet-inset)) 0;
  box-shadow:0 1px 2px color-mix(in srgb,var(--c-text) 12%,transparent),
    0 6px 18px color-mix(in srgb,var(--c-text) 6%,transparent)}
/* A 1px rule with a radius is the language of an app panel; a page lying on a desk is told
   by its shadow. The border was drawn first and rejected for exactly that. */

/* Below 46rem the only side space is the page's own padding, 25px, and a 20px sheet left
   FOUR pixels of desk showing at each edge, which is not a margin, it is a near miss. */

/* THE FEED'S YEAR MARKER and its per-row tick carry a --c-bg mask so the spine breaks
   around them rather than running through. On a desk that is no longer the page's colour,
   that mask printed as a white card floating beside the feed. */
html[data-look=notes] .tl-year-tag,html[data-look=notes] .tl-mark{background:var(--desk)}

/* ONE LINE, NOT TWO. The rail and the panel each hang a hairline in the gutter beside the
   column; with the page drawn as a sheet those hairlines run 20px outside the sheet's own
   edge, and a gutter with two parallel rules in it reads as a mistake. The sheet's edge is
   what separates the shelf from the page now, so the hairlines go - and the two dots that
   hung ON them go with them: a node on a line is a node, a node on nothing is a speck. */
html[data-look=notes] .rail::after,html[data-look=notes] .post-info::after,
html[data-look=notes] .post-info::before,
html[data-look=notes] .post-info .info-action::after{display:none}

/* --- THE PAGE IS RULED ------------------------------------------------------
   Drawn per paragraph so each rule sits on that paragraph's own leading and cannot drift.
   Book typography already runs paragraphs together with no gap between them, so a run of
   prose comes out as continuous ruling, and a heading or a picture interrupts it the way
   pasting something into a notebook interrupts it.

   RULING THE WHOLE SHEET WAS TRIED AND REJECTED: one background on the page has one fixed
   step, and the text under it cannot follow the lines the way a hand does - a picture is not
   a whole number of lines tall, so the rules drift and start cutting through the middle of
   the text. Per paragraph is the only drift-free version there is.

   THE RULES RUN THE WIDTH OF THE PAGE, not the width of the words: drawn at the column's
   width they read as underlined text. The paragraph grows outward by the sheet's inset and
   pads it straight back, so not one line rewraps. */
html[data-look=notes] .prose > p,
html[data-look=notes] .prose > :is(ul,ol) > li{
  --step:calc(var(--lh-body,1.7) * 1em);
  margin-inline:calc(-1 * var(--sheet-inset));padding-inline:var(--sheet-inset);
  background-image:linear-gradient(to bottom,transparent calc(var(--step) - 1px),
    color-mix(in srgb,var(--c-rule) 38%,transparent) calc(var(--step) - 1px));
  background-size:100% var(--step)}

/* THE MARGIN RULE an exercise book is printed with, in the blog's own accent. */
html[data-look=notes] .prose{position:relative}
html[data-look=notes] .prose::before{content:"";position:absolute;top:0;bottom:0;
  left:-1.1rem;border-left:1px solid color-mix(in srgb,var(--c-accent) 40%,transparent)}

/* --- THE MARKS A HAND WOULD MAKE --------------------------------------------
   A section opens with a tick in the margin above it. Above the heading rather than beside
   it: the reading column has 26px of air to its left at this width, which is not room for a
   mark. The shelf's headings take the same tick, inline, since those rows are ranged right
   against the page. */
html[data-look=notes] .prose h2::before{content:"";display:block;width:1.75rem;
  border-top:2px solid var(--c-meta);margin-bottom:.55rem}
html[data-look=notes] .rail h2::before{content:"";display:inline-block;width:1rem;
  border-top:2px solid var(--c-meta);vertical-align:.32em;margin-right:.45em}

/* A LINK THAT STAYS IN THIS NOTEBOOK is written the way a notebook writes one. The site's
   own drawn underline stays under both kinds; what separates them is the brackets.
   AND NO MARK ON THE LINK THAT LEAVES. A north-east arrow was tried and dropped twice over:
   U+2197 is outside both bundled subsets, so it fell back to a system face and printed a
   stray tick a third the size of its line; drawn instead as a rotated U+2191 it was its own
   inline box, and at 390px it broke onto the next line by itself, under a link whose words
   had ended on the line above. */
html[data-look=notes] .prose a[href^="/"]::before{content:"[[";color:var(--c-meta)}
html[data-look=notes] .prose a[href^="/"]::after{content:"]]";color:var(--c-meta)}

/* THE STANDFIRST IS A NOTE TO SELF, not a subtitle. */
html[data-look=notes] .deck{font-style:italic;border-left:2px solid var(--c-rule);
  padding-left:1rem}

/* TAGS ARE HASHES, and ONLY tags: keyed on the path, because the same run of terms in the
   rail also carries categories, series and archive years, and "#2026" is not a tag. */
html[data-look=notes] .term-list a[href^="/tag/"]::before,
html[data-look=notes] .rail-tags a[href^="/tag/"]::before{content:"#";color:var(--c-meta)}

/* THE PANEL IS AN INDEX CARD lying on the same desk, and the date that matters in a
   notebook is the last one. */
html[data-look=notes] .post-info{border:1px solid var(--c-rule);
  border-radius:var(--radius,.5rem);padding:.85rem 1rem;
  background:color-mix(in srgb,var(--c-text) 3%,var(--c-bg))}
html[data-look=notes] .info-updated{color:var(--c-heading)}

/* WHAT ELSE POINTS HERE: arrows rather than bullets, the way a note lists its neighbours. */
html[data-look=notes] .related ul{list-style:none;padding-left:0}
html[data-look=notes] .related li{position:relative;padding-left:1.5rem}
html[data-look=notes] .related li::before{content:"\\2192";position:absolute;left:0;top:0;
  color:var(--c-meta)}
`.trim()
