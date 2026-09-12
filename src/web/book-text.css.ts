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
.book-flow.prose p{text-indent:1.6em}
.book-flow.prose :is(h1,h2,h3,h4,h5,blockquote,figure,pre,ul,ol,hr,table,.table-scroll,.gallery,.video-embed) + p{text-indent:0}
.book-flow.prose li p,.book-flow.prose blockquote p{text-indent:0}
@media (min-width:600px){
  /* The viewport, not the column: below this the overlay is one narrow page and justifying
     it opens rivers no hyphen can close. The limits are the article's own, and their
     reasoning is in prose.css.ts. */
  .book-flow.prose p,.book-flow.prose li{text-align:justify;hyphens:auto;
    hyphenate-limit-chars:6 3 3;
    -webkit-hyphenate-limit-before:3;-webkit-hyphenate-limit-after:3}
}

/* THE BASELINE GRID, which is the thing a printed book has and a column of HTML does not.
   Two columns of a spread only read as one page if their lines sit at the same heights, and
   that holds only while every gap between blocks is a whole number of lines. Measured at
   1440 before this rule: the line is 31.32px, a paragraph gap was 58px (1.85 lines), and
   heading gaps were 67 and 42 (2.14 and 1.34). So the left column and the right column went
   out of phase at the first paragraph break and drifted from there.

   A paragraph therefore leads with NOTHING but its indent, which is what a book does and
   what leaves the gap at exactly one line. A heading takes two lines above and one below —
   above still beats below, which is this admin's own rule about what a heading belongs to —
   and its own line box is set to whole lines of the body: a heading whose leading is not a
   multiple of the text's leading knocks everything under it off the grid, however tidy its
   own margins are. h1 takes two lines because 2em of face does not fit in one. */
.book-flow.prose{--book-line:calc(var(--fs-body) * var(--lh-body))}
.book-flow.prose > p{margin-top:0}
.book-flow.prose > :is(h1,h2,h3,h4,h5){margin-top:calc(2 * var(--book-line))}
.book-flow.prose > :is(h1,h2,h3,h4,h5) + *{margin-top:var(--book-line)}
.book-flow.prose > :is(h2,h3,h4,h5){line-height:var(--book-line)}
.book-flow.prose > h1{line-height:calc(2 * var(--book-line))}
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
`
