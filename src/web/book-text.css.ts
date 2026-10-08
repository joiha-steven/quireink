// How book mode SETS the words: the indent, the justification, and the baseline grid.
//
// Split from `book.css.ts` for the reason that file was split from `islands.css.ts` — it
// reached the 400-line ceiling — and the seam is the one the subject already draws: that
// file is the overlay's CHROME (the panel, the arrows, the spine, the drop cap, the page
// count), this one is the type inside it.
//
// `public.css.ts` interpolates it immediately after `BOOK_CSS`, so nothing below it in the
// cascade changed hands.
//
// NO BACKTICKS anywhere below: this is one template literal and a backtick ends it.
// `check:css-literal` enforces that.

export const BOOK_TEXT_CSS = `
/* THE OVERLAY SETS ITS OWN TEXT, and this is the half that was missing.
   This sheet opens by saying book mode keeps its OWN standard rather than the site's, and
   it kept it for paper, ink, the drop cap, the asterism and the spine. The WORDS were left
   to features.bookText, which is a setting about the scrolling article and is off on a
   fresh install. Measured on a blog that had not turned it on: a spread with a drop cap, a
   centre spine and an asterism, setting its paragraphs ragged, unindented and unhyphenated,
   which is a web page cut into pages. The indent is what tells a reader a paragraph
   CONTINUES when there is no blank line to say so, and on a paged column there is none. */
/* TWO EMS, up from 1.6 on 2026-09-14. A paragraph break on a paged column is the indent
   and nothing else — there is no blank line to add and no room for one on a baseline grid —
   so the indent is the ONLY thing saying a new paragraph has started, and at 1.6em over a
   57-character justified measure it was saying it under its breath. Two ems is the top of
   the range a printed book uses and about four characters here. */
.book-flow.prose p{text-indent:2em}
.book-flow.prose :is(h1,h2,h3,h4,h5,blockquote,figure,pre,ul,ol,hr,table,.table-scroll,.gallery,.video-embed,.callout) + p{text-indent:0}
.book-flow.prose li p,.book-flow.prose blockquote p,.book-flow.prose .callout p{text-indent:0}
@media (min-width:600px){
  /* The viewport, not the column: below this the overlay is one narrow page and justifying
     it opens rivers no hyphen can close. The limits are the article's own, and their
     reasoning is in prose.css.ts. */
  .book-flow.prose p,.book-flow.prose li{text-align:justify;hyphens:auto;
    hyphenate-limit-chars:6 3 3;
    -webkit-hyphenate-limit-before:3;-webkit-hyphenate-limit-after:3}
}

/* A CODE LINE HAS NOWHERE TO SCROLL ON A PAGE, so it wraps instead of being cut off.
   The scrolling article gives a wide block overflow-x:auto and the reader pans it, which is
   fine on a page that already moves under the finger. A paged column does not move: measured
   on 2026-09-12, one block hid 126px of a 690px line at 1440 and 294px at 949, and the only
   thing on screen saying so was a 2px overlay scrollbar in a reading surface where every
   other gesture turns the page. Wrapping shows every character; break-word is for the one
   long unbroken token (a path, a URL) that no space can fold. */
.book-flow.prose pre{white-space:pre-wrap;overflow-wrap:break-word;overflow-x:visible}

/* THE BASELINE GRID, which is the thing a printed book has and a column of HTML does not.
   Two columns of a spread only read as one page if their lines sit at the same heights, and
   that holds only while every gap between blocks is a whole number of lines. Measured at
   1440 before this rule: the line is 31.32px, a paragraph gap was 58px (1.85 lines), and
   heading gaps were 67 and 42 (2.14 and 1.34). So the left column and the right column went
   out of phase at the first paragraph break and drifted from there.

   A paragraph therefore leads with NOTHING but its indent, which is what a book does and
   what leaves the gap at exactly one line. A heading's own line box is set to whole lines of
   the body: a heading whose leading is not a multiple of the text's leading knocks
   everything under it off the grid, however tidy its own margins are.

   ⚠️ THE HEADING'S AIR IS INSIDE ITS LINE BOX, not all in its margins, and that is what
   makes the section breaks stop shouting. It used to be two lines of margin above, a
   one-line box, and one line below: four line-slots, and 81px of white above the words
   against 34px below, on a page whose paragraphs are separated by an indent and nothing
   else. Reported from a published spread, 2026-09-14 — the gaps between sections read as
   the loudest thing on the page.

   One line of margin, then the heading's own box, with the face in the middle of its own
   air: about a line and a half above the words and half a line below, in three slots rather
   than four for a one-line h2. Above still beats below, which is this admin's rule about
   what a heading belongs to, and every gap is still a whole number of lines, which is the
   only thing keeping the two columns of a spread in phase. The box comes in two branches,
   set out below: where the engine has round() it is the role's leading snapped to whole body
   lines with half a line of padding either side; without it, a flat two-line box (h1 always
   took two, because 2em of face does not fit in one). */
.book-flow.prose{--book-line:calc(var(--fs-body) * var(--lh-body))}
.book-flow.prose > p{margin-top:0}
.book-flow.prose > :is(h1,h2,h3,h4,h5){margin-top:var(--book-line)}
/* THE HEADING'S LEADING IS ITS ROLE'S, snapped to whole lines of the body. It was a flat
   two-line box, which is right for a heading that fits on one line and 2x too loose for one
   that wraps: "A ratio, and the honesty to break it" on a 375px phone sat its two lines a
   full 63px apart, three times the leading of the paragraph beside it (measured
   2026-10-08). Now the box is the role's line-height (--lh-hN) rounded to the nearest
   whole body line, never less than one, so a wrapped heading reads as one phrase and the
   grid still holds: the half line of air the old two-line box put above and below the face
   is padding instead, so a one-line h2 still takes the same three line-slots it always did.
   The first declaration is the fallback for an engine without round(). */
.book-overlay .book-flow.prose > :is(h1,h2,h3,h4,h5){line-height:calc(2 * var(--book-line))}
.book-overlay .book-flow.prose > h1{--book-hlh:var(--lh-h1)}
.book-overlay .book-flow.prose > h2{--book-hlh:var(--lh-h2)}
.book-overlay .book-flow.prose > h3{--book-hlh:var(--lh-h3)}
.book-overlay .book-flow.prose > h4{--book-hlh:var(--lh-h4)}
.book-overlay .book-flow.prose > h5{--book-hlh:var(--lh-h5)}
@supports (line-height:round(nearest,1px,1px)){
  .book-overlay .book-flow.prose > :is(h1,h2,h3,h4,h5){
    line-height:max(var(--book-line),round(nearest,calc(1em * var(--book-hlh)),var(--book-line)))}
  .book-overlay .book-flow.prose > :is(h2,h3,h4,h5){
    padding-block:calc(var(--book-line) / 2)}
}
/* On the phone the reader is scrolled, not paged: there are no two columns to keep in phase,
   so a heading takes its role's leading as it is and the half line of air is padding. */
.book-reader .book-flow.prose > :is(h1,h2,h3,h4,h5){padding-block:calc(var(--book-line) / 2)}
.book-flow.prose > :is(h1,h2,h3,h4,h5) + *{margin-top:0}
/* Everything that is not a paragraph or a heading — a list, a quote, a figure, a rule —
   takes one blank line above and one below, so it occupies whole lines too. */
.book-flow.prose > :is(ul,ol,blockquote,pre,table,.table-scroll,hr){
  margin-top:var(--book-line);margin-bottom:0}
.book-flow.prose > :is(ul,ol,blockquote,pre,table,.table-scroll,hr) + *{
  margin-top:var(--book-line)}
/* A PICTURE IS A PLATE, AND ITS CAPTION BELONGS TO IT. The caption sits 8px under the
   picture and the text resumed ONE line after the caption — which, now that a paragraph
   break costs nothing but an indent, is the same distance as the gap between two ordinary
   paragraphs. So the caption glued itself to the words underneath and read as their opening
   line. Two lines each side, so the plate stands clear and still lands on whole lines.
   ⚠️ Its own rule rather than a name in the list above: :is() takes the specificity of its
   most specific argument, so that list carries the CLASS in .table-scroll and outranks a
   plain figure element — which is why two lines here looked like one until it was measured. */
.book-flow.prose > figure{margin-top:calc(2 * var(--book-line));margin-bottom:0}
.book-flow.prose > figure + *{margin-top:calc(2 * var(--book-line))}

/* THE TITLE PAGE (book-scroll.ts): kicker, title, standfirst, a short rule, the byline. The
   first page of the spread, and the body begins on the facing one (the column break below;
   the body's own first-child rules in book.css.ts follow it). Every size is a type ROLE, so
   it follows the owner's scale and the reader's A-/A+, and every colour is a token. The title
   is a real h1 carrying the class the article's own title carries, so it takes whatever the
   look gives a heading - the code look's mono, the paper's regular-weight serif - and only
   its air is set here. Plain divs, never a p: nothing on this page is a paragraph.
   ⚠️ A TITLE PAGE THAT DOES NOT FIT ITS COLUMN (a landscape phone, 844x390, at a large A+)
   takes as many columns as it needs, and the body starts after it: min-height rather than
   height, so it can grow, and safe centring, so it grows DOWN from the top instead of past
   it, where the viewport's overflow clipped the kicker. Measured clipped by 11px at one A+ and
   45px at the largest, and the byline split onto the body's first line.
   ⚠️ 100%, NOT --book-page-h: that variable is the flow's clientHeight, which is
   ROUNDED, and a column at 619.84px given 620px spills 0.16px into the next one - the body then
   starts a column late and the spread has a blank page (measured at 1024x768, 2026-10-08). */
.book-tp{display:flex;flex-direction:column;justify-content:safe center;text-align:left;
  text-indent:0;break-after:column;min-height:100%}
.book-tp h1{margin:0 0 .6em;font-size:var(--fs-h1);line-height:var(--lh-h1);
  letter-spacing:var(--ls-h1);color:var(--c-heading);text-wrap:balance;hyphens:manual}
.tp-kick,.tp-by{font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small);color:var(--c-meta);text-wrap:balance}
.tp-kick{padding-bottom:1.1em}
.tp-deck{font-style:italic;font-size:var(--fs-h4);line-height:var(--lh-h4);
  letter-spacing:var(--ls-h4);padding-bottom:1.2em;text-wrap:balance}
.book-tp :is(.tp-kick,.tp-deck,.tp-by):empty{display:none}
/* The short rule between the standfirst and the byline is drawn by the byline, so a title
   page with no byline has no rule hanging over nothing. */
.tp-by::before{content:"";display:block;width:3rem;border-top:1px solid var(--c-heading);
  margin:0 0 .9em}
`
