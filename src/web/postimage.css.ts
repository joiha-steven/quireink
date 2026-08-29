// A post's own picture, and the author box. Both arrived on 2026-08-29 and both are OFF on
// a fresh install, so every selector below is inert until an owner turns something on.
//
// NO BACKTICKS anywhere: this is one template literal and a backtick ends it.
// `check:css-literal` enforces that, and this file is IN its list — the mistake `prose.css`
// made was being split out without being added.
//
// The shapes are read from `data-` attributes rather than from classes, because the shape
// is a SETTING: a page rendered while `thumb` was `side` sits in the cache with its markup
// already written, and a class would have baked the old answer into it. The attribute is
// written by the same render, but the CSS that acts on it is not — so the two shapes cost
// one selector each and nothing has to be re-rendered when the setting moves.

export const POST_IMAGE_CSS = `
/* --- the hero, above an article ------------------------------------------------
   The reading column, and no wider. A breakout version existed for one afternoon
   and was measured out of existence: the rails sit eight pixels from the column and
   travel with it, so anything wider prints the picture over the table of contents.
   render/rail-css.ts reached the same answer for in-body pictures before this.

   3:2, ALWAYS, and it is not a question the owner is asked. One blog's covers should
   look like one blog's covers, and the shape doing that job belongs to the design.
   Fixing it also removes the case that made a chooser look necessary: an ordinary
   977x1400 portrait scan is 963px tall inside a 672px column, a whole screen of
   picture standing between the headline and the first sentence.

   The ratio pins the box, so the space is reserved before the file arrives, and
   object-fit crops the overflow rather than squashing the photograph. The 70vh cap
   stays underneath as a floor for a very wide reading column, where even 3:2 is tall. */
/* Above the headline, so the gap that matters is the one UNDER it. */
.post-hero{margin:0 0 calc(var(--sp) * 1.5)}
.post-hero img{display:block;width:100%;height:auto;aspect-ratio:3/2;max-height:70vh;
  object-fit:cover;border-radius:var(--radius,.5rem)}

/* --- the thumbnail, on a list row ----------------------------------------------
   'side' turns the card into a two-column grid; the words keep their order in the
   markup and the picture is placed, so a screen reader and a no-CSS reader both get
   the headline first. A phone drops back to one column: 96px of picture beside a
   headline at 375px leaves the headline nowhere to go. */
/* CROPPED, ALWAYS, and the shape is not a setting.
   A gallery gets to choose because a gallery IS the photographs; a list thumbnail is
   chrome, and its job is recognition. Measured with three real files on 2026-08-29 —
   ratios 0.70, 2.10 and 0.72 — an uncropped column read as a tall block, a thin strip
   and a tall block, which is not a list. The aspect-ratio also reserves the box before
   the file lands: every thumbnail measured height 0 until then. */
.card-thumb img{display:block;width:100%;height:auto;object-fit:cover;
  border-radius:var(--radius,.5rem)}
.post-list article[data-thumb=side] .card-thumb img{aspect-ratio:1/1}
.post-list article[data-thumb=top] .card-thumb img{aspect-ratio:3/2}
.post-list article[data-thumb=top] .card-thumb{margin:0 0 calc(var(--sp) * .75)}

/* FLOATED, not a grid column. A two-column grid pins the words beside the picture for the
   whole card, so a 96px square against four lines of standfirst leaves a hole under the
   picture and the row reads as a table with an empty cell. Floating lets the text run past
   the picture and close up underneath it, which is what the space is for.

   'flow-root' contains the float: without it a card shorter than its own picture would let
   the picture hang into the card below. It does not clip, so the timeline marker — absolutely
   positioned out in the gutter by rail-css.ts — is untouched. */
.post-list article[data-thumb=side]{display:flow-root}
.post-list article[data-thumb=side] .card-thumb{float:left;width:96px;
  margin:.2rem calc(var(--sp) * 1.1) calc(var(--sp) * .45) 0}

/* A phone has ~230px left beside a 96px picture, which is not a column for a headline.
   Smaller picture, tighter gutter: the words still wrap under it, just sooner. */
@media (max-width:559px){
  .post-list article[data-thumb=side] .card-thumb{width:72px;
    margin:.2rem calc(var(--sp) * .8) calc(var(--sp) * .4) 0}
}

/* --- the author box ------------------------------------------------------------
   Same quiet register as '.related' above it: this is chrome at the end of the
   words, not a second article. The portrait is the one round thing on the page and
   keeps its own shape whatever '--radius' says — a square avatar at radius 0 reads
   as a missing image. */
.author-box{display:flex;gap:calc(var(--sp) * .9);align-items:flex-start;
  margin:calc(var(--sp) * 2) 0 0;padding:calc(var(--sp) * 1.1) 0 0;
  border-top:1px solid var(--c-rule)}
.author-face{width:48px;height:48px;border-radius:50%;object-fit:cover;flex:none}
.author-text{min-width:0}
.author-name{margin:0;font-weight:var(--fw-heading,600);color:var(--c-heading);
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
.author-bio{margin:.35rem 0 0}
`
