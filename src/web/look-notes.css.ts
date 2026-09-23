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
/* THE CHROME STANDS ON THE DESK, AND THE QUIET INK WAS MEASURED AGAINST THE PAGE. The desk
   is the page darkened, so every line that does not sit on the sheet -- the tagline, the
   pager count, the footer, the dates down the rail -- loses part of the difference it was
   given: #6d6c6c on the mono desk measures 4.47:1 where AA asks 4.5 at this size, and every
   palette loses the same slice. Stepped down on the BODY, where --c-meta still resolves to
   whatever :root inherited, so this is a nudge away from the palette's own choice rather
   than a second colour to keep in sync. 94% lands mono at 4.60:1; the sheet keeps the ink it
   had, being lighter than the desk and already clear of the line. */
/* AND THROUGH A SECOND NAME, because a custom property that names itself is a cycle, not
   a reference to its parent: a --c-meta mixed from var(--c-meta) on the body made --c-meta
   INVALID for everything under it, and every quiet line on the site - the rail, the dates,
   the panel - fell back to the full text ink. Shipped that way from 2026-09-14 to 09-23;
   measured, the rail's links were rgb(48,48,47) where the palette asks #6d6c6c. The mix is
   taken on the root, where --c-meta is the palette's own, and handed down under a new name. */
html[data-look=notes]{--c-meta-desk:color-mix(in srgb,var(--c-meta) 94%,var(--c-text))}
html[data-look=notes] body{--c-meta:var(--c-meta-desk)}

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
  box-shadow:0 1px 2px color-mix(in srgb,var(--c-text) 14%,transparent),
    0 8px 24px color-mix(in srgb,var(--c-text) 9%,transparent)}
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

/* --- THE PAPER IS DOT GRID -------------------------------------------------
   A dot every 22px across the whole sheet, the paper a bullet journal is kept in. It
   replaced a rule drawn under every line of every paragraph (2026-09-23): that ruling was
   drawn per paragraph so it could not drift, and the price was a sheet that read as a
   spreadsheet or a form - every excerpt on the front page underlined line by line, a rule
   crossing between a date and its headline. A grid of dots has no line for the text to sit
   on or miss, so there is nothing to drift, and it is the quietest pattern that still says
   "paper you write on" from across a room.

   The dot is the meta ink thinned into the page, so it follows the palette and the night:
   derived, never typed. At 1.1px it is visible on a laptop at arm's length and gone under
   a word, which is the whole brief for a pattern behind text. */
html[data-look=notes] main > article,
html[data-look=notes] main > .front,
html[data-look=notes] main > #comments,
html[data-look=notes] .post-list{
  --dot:color-mix(in srgb,var(--c-meta) 32%,var(--c-bg));
  background-image:radial-gradient(circle,var(--dot) 0 1.1px,transparent 1.5px);
  background-size:22px 22px;background-position:11px 11px}

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

/* EVERY LINK IN THE TEXT IS MARKED WITH A HIGHLIGHTER, not printed in link blue: a band
   of the accent thinned into the page across the lower half of the words, the way a pen
   marks a line to come back to. Ink stays the heading's, so the words read as written and
   the band says "this goes somewhere". box-decoration-break so a link that wraps is marked
   on both lines rather than once across the break. A jump inside the page (a footnote, a
   heading's own anchor) is not marked: it is apparatus, not a thing to follow.
   It REPLACES the base sheet's drawn underline, which is a background too (an SVG stroke
   tiled along the baseline, .prose a in prose.css.ts): size, position and repeat are all
   reset here, or the band is cut into that underline's 4.6em by 0.3em tiles.
   NOT ON A CARD: a link card and a file card are links too, and this selector outranks the
   base rule that takes the underline off them (pen/ink.css.ts), so the band was painted
   across the lower third of every card. */
html[data-look=notes] .prose a:not([href^="#"],.link-card,.file-card){color:var(--c-heading);text-decoration:none;
  background-image:linear-gradient(transparent 55%,
    color-mix(in srgb,var(--c-accent) 26%,transparent) 55% 92%,transparent 92%);
  background-size:100% 100%;background-position:0 0;background-repeat:no-repeat;
  padding-bottom:0;-webkit-box-decoration-break:clone;box-decoration-break:clone}
html[data-look=notes] .prose a:not([href^="#"],.link-card,.file-card):hover{background-image:linear-gradient(
  transparent 20%,color-mix(in srgb,var(--c-accent) 34%,transparent) 20% 92%,transparent 92%)}

/* RAGGED RIGHT, whatever the book-typography switch says. Justified lines are a compositor's
   habit; a hand ends a line where the word ends, and a notebook set flush on both sides
   reads as a printed page with a desk drawn round it. The one change this look makes to
   the reading column's setting, and the reason it may (docs/conventions/looks.md). */
html[data-look=notes] .prose :is(p,li){text-align:left;hyphens:manual}

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
/* An index card is square, lies on the desk by its shadow the way the sheet does, and has
   its first line printed in the second ink - the accent, thinned, standing in for the red
   head rule every ruled card carries. It was a rounded bordered panel, which is an app's
   component and not something that lies on a desk. */
html[data-look=notes] .post-info{border:0;border-radius:0;padding:.85rem 1rem;
  border-top:2px solid color-mix(in srgb,var(--c-accent) 55%,var(--c-bg));
  background:var(--c-bg);
  box-shadow:0 1px 2px color-mix(in srgb,var(--c-text) 12%,transparent),
    0 4px 12px color-mix(in srgb,var(--c-text) 6%,transparent)}
html[data-look=notes] .info-updated{color:var(--c-heading)}

/* WHAT ELSE POINTS HERE: arrows rather than bullets, the way a note lists its neighbours. */
html[data-look=notes] .related ul{list-style:none;padding-left:0}
html[data-look=notes] .related li{position:relative;padding-left:1.5rem}
html[data-look=notes] .related li::before{content:"\\2192";position:absolute;left:0;top:0;
  color:var(--c-meta)}
`.trim()
