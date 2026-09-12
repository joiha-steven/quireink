// The notebook dialect (settings.look = 'notes'). Its own sheet, linked only when this look
// is on (`web/assets.ts`).
//
// The argument: a page of a working notebook lying on a desk. Everything below is either a
// surface, a rule printed on that surface, or a mark a hand would have made.
//
// NONE OF IT IS A COLOUR. This sheet declared cream paper, a pale blue rule and blue-black
// ink for one release, on the argument that a notebook is a material. The owner settled it
// the other way on 2026-09-13: THE PALETTE IS THE ONLY SOURCE OF COLOUR ON THIS SITE, and a
// look that brings its own makes four of the six rows in the palette menu dead controls —
// measured, with this dialect on, choosing Mono or Forest changed not one pixel, because
// `html[data-look=notes]` outranks `[data-palette=x]`. The paper, the rule and the ink are
// whatever the reader's palette says they are; what this file still owns is the SHAPE.
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
/* THE NAME ON THE COVER IS THE ONE THING WRITTEN, so it takes the reading face - the
   closest thing this product has to the owner's own hand - while everything else in the
   chrome stays the neutral sans. It carried --font-sans, which on a blog whose chrome font
   is a monospace set the notebook's own name in code.
   AND NO SECOND FACE IS DOWNLOADED FOR IT. The newspaper earns one because a paper really
   does cut its headlines from a second serif; a notebook has exactly one hand in it. The
   face that would say "notebook" is a handwriting face, and every one of them in reach
   carries no Vietnamese - on a blog in this product's own first language it would fall back
   to a system face on every accented word, which is worse than not trying. */
html[data-look=notes] .site-bar > .title{font-family:var(--font-reading)}

/* --- THE DESK, AND THE PAGE ON IT -------------------------------------------
   The desk is a TONE darker than the page and nothing else. A dotted desk was drawn first
   and dropped once the page itself was ruled: two patterns on one screen is a texture
   competition, and what makes a sheet look like a sheet is simply that the thing under it
   is not the same colour. */
/* The desk is DERIVED rather than typed, and that is not shyness about one more hex: --desk
   is this dialect's own name, not one of the seven a palette declares, so a literal here
   would be a colour the reader's light/dark switch cannot move. Seven percent rather than
   four: against cream the old four read as the same cream, and the sheet stopped being a
   sheet. */
html[data-look=notes]{--desk:color-mix(in srgb,var(--c-text) 7%,var(--c-bg));--sheet-inset:20px}
/* THE DESK IS THE PAGE, DARKENED - and mixing the ink into the paper only does that in
   daylight. At night the ink is the pale one, so the same mix lifted the desk ABOVE the
   page and the sheet read as a hole cut in the board rather than as paper lying on it.
   Measured before: page rgb(27,32,39) on a desk of rgb(40,45,52).

   Relative colour takes the page's own lightness down instead, which is one formula for
   both halves of the day and stays tied to whatever the palette says the paper is. Behind
   @supports because a custom property accepts a value it cannot use and only fails later,
   when the body would be left with no background at all; the mix above is what any engine
   that cannot read this keeps. */
@supports (color:oklch(from red l c h)){
  html[data-look=notes]{--desk:oklch(from var(--c-bg) calc(l * .955) c h)}
  html[data-look=notes].dark{--desk:oklch(from var(--c-bg) calc(l * .72) c h)}
  @media (prefers-color-scheme:dark){
    html[data-look=notes]:not([data-scheme=light]){--desk:oklch(from var(--c-bg) calc(l * .72) c h)}
  }
}
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
/* AND div.front, which is the composed front page's own container. It is neither the piece
   nor a feed, so it matched neither name, and the one layout a visitor is most likely to
   arrive on had no page under it at all: three sections and a row of pictures lying
   straight on the desk. */
/* AND THE COMMENTS, which are a sibling of the piece and not part of it. Everything else
   under an article - the author box, what to read next, the related list - sits INSIDE it
   and was on the paper already; the conversation is the one block that is not, so it lay
   straight on the desk with nothing under it and read as though it had come loose. It gets
   its own sheet rather than a share of the piece's: they cannot be one box without moving
   markup, and two sheets is the truer answer anyway - what other people wrote is a second
   page, not the foot of the first. */
html[data-look=notes] main > article,
html[data-look=notes] main > .front,
html[data-look=notes] main > #comments,
html[data-look=notes] .post-list{background:var(--c-bg);
  padding:var(--sheet-inset);
  margin:calc(-1px - var(--sheet-inset)) calc(-1 * var(--sheet-inset)) 0;
  box-shadow:0 1px 2px color-mix(in srgb,var(--c-text) 12%,transparent),
    0 6px 18px color-mix(in srgb,var(--c-text) 6%,transparent)}
/* A 1px rule with a radius is the language of an app panel; a page lying on a desk is told
   by its shadow. The border was drawn first and rejected for exactly that. */
/* The second sheet keeps the outward growth but not the negative TOP margin: that one exists
   so the piece's first line lands on the line the shelf starts on, and on a sheet that
   follows another it would only close the gap between the two to 19px. A desk with two
   pages on it shows some desk between them. */
html[data-look=notes] main > #comments{margin-top:calc(var(--sheet-inset) * 1.75)}

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
   pads it straight back, so not one line rewraps.

   AT THE FULL WEIGHT OF --c-rule, which is the lightest line this design has. It was drawn
   at 38% of that for one deploy, on the reasoning that ruling should be faint: 38% of
   #ebebeb on #fcfcfc is not faint, it is absent, and the look shipped as a blank sheet.
   Faint means the quietest line on the page, not a line nobody can see.

   AND ON A LISTING TOO. The rules used to reach .prose alone, which exists on a piece and
   nowhere else — so anyone who met this look on the front page met an unruled sheet. */
html[data-look=notes] .prose > p,
html[data-look=notes] .prose > :is(ul,ol) > li,
html[data-look=notes] .post-list article > p,
/* The composed front page writes its lead out in full, and those paragraphs are the only
   prose on that layout. Unruled, the page a visitor most often lands on was the one page in
   the notebook nobody had ruled. */
html[data-look=notes] .fc-deck,
html[data-look=notes] .fc-intro,
/* And what other people wrote. Its sheet is ruled because the piece's is: an unruled second
   page beside a ruled first one reads as a different paper rather than as the next page. A
   comment body is a bare div holding a text node, so it takes the rules directly; a reply's
   own indent mark then sits ON the ruling, which is what a mark on paper does. */
html[data-look=notes] #comments .comment-body{
  --step:calc(var(--lh-body,1.7) * 1em);
  margin-inline:calc(-1 * var(--sheet-inset));padding-inline:var(--sheet-inset);
  background-image:linear-gradient(to bottom,transparent calc(var(--step) - 1px),
    var(--c-rule) calc(var(--step) - 1px));
  background-size:100% var(--step)}

/* --- THE MARKS A HAND WOULD MAKE --------------------------------------------
   A section opens with a tick in the margin above it. Above the heading rather than beside
   it: the reading column has 26px of air to its left at this width, which is not room for a
   mark. The shelf's headings take the same tick, inline, since those rows are ranged right
   against the page. */
html[data-look=notes] .prose h2::before{content:"";display:block;width:1.75rem;
  border-top:2px solid var(--c-meta);margin-bottom:.55rem}
html[data-look=notes] .rail h2::before{content:"";display:inline-block;width:1rem;
  border-top:2px solid var(--c-meta);vertical-align:.32em;margin-right:.45em}

/* AND THE HEADING IS UNDERLINED, which is what a hand does to one. The rule has to stop
   where the words stop or it is a border and not an underline, so the heading is shrunk to
   its content with fit-content - a heading that wraps then underlines to its widest line,
   which is also what a hand does. In the ink rather than in the printed blue: the ruling is
   on the paper before anybody writes, this is not.

   ONE PIXEL, NOT TWO. At two the stroke carried as much weight as the letters above it and
   the pair read as a box lid rather than as a mark on a word. Thinner and NOT paler: fading
   the ink instead was tried at 30% and 45% and both stop looking like a pen - a grey band
   under black letters is a highlighter's smudge, or a printed rule, and the one thing this
   mark has to say is that a hand made it. A hand lightens its underline by pressing less,
   which makes the stroke finer and leaves the colour where it was. */
html[data-look=notes] .prose :is(h2,h3){width:fit-content;max-width:100%;
  padding-bottom:.12em;border-bottom:1px solid var(--c-heading)}
html[data-look=notes] .prose h3{border-bottom-color:var(--c-meta)}

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

/* --- THE LIST OF PARTS IS BOXED BY HAND -------------------------------------
   A rounded card with a hairline round it is an app panel. Somebody keeping a notebook who
   wants a list to stand apart from the page draws a box round it, in the pen they are
   already holding: square corners, ink weight, and the head ticked the way a section head
   is. The radius goes with it - nothing on this page has one except the index card, which
   is meant to be a different object lying on the desk. */
html[data-look=notes] aside.series{border:2px solid var(--c-meta);border-radius:0;
  padding:1rem 1.1rem}
html[data-look=notes] aside.series .series-head{display:flex;align-items:baseline;
  gap:.5em;margin-bottom:.7rem;color:var(--c-heading)}
html[data-look=notes] aside.series .series-head::before{content:"";flex:none;width:1rem;
  border-top:2px solid var(--c-meta);transform:translateY(-.32em)}
html[data-look=notes] aside.series ol{border-top:1px solid var(--c-rule);padding-top:.8rem}
/* The part being read is ticked in ink, not barred in the accent: the accent here is the
   link colour, and a blue bar beside black type says the line is a link. */
html[data-look=notes] aside.series li[aria-current]::after{background:var(--c-heading)}

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
