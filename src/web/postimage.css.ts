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
   render/rail-css.ts reached the same answer for in-body pictures before this. */
.post-hero{margin:calc(var(--sp) * 1.5) 0 0}
.post-hero img{display:block;width:100%;height:auto;border-radius:var(--radius,.5rem)}

/* --- the thumbnail, on a list row ----------------------------------------------
   'side' turns the card into a two-column grid; the words keep their order in the
   markup and the picture is placed, so a screen reader and a no-CSS reader both get
   the headline first. A phone drops back to one column: 96px of picture beside a
   headline at 375px leaves the headline nowhere to go. */
.card-thumb img{display:block;width:100%;height:auto;border-radius:var(--radius,.5rem)}
.post-list article[data-thumb=top] .card-thumb{margin:0 0 calc(var(--sp) * .75)}

@media (min-width:560px){
  .post-list article[data-thumb=side]{display:grid;grid-template-columns:96px 1fr;
    column-gap:calc(var(--sp) * 1.25);align-items:start}
  .post-list article[data-thumb=side] .card-thumb{grid-row:1 / span 4;width:96px}
  .post-list article[data-thumb=side] .tl-mark{grid-column:1 / -1}
}
@media (max-width:559px){
  .post-list article[data-thumb=side] .card-thumb{max-width:96px;margin:0 0 calc(var(--sp) * .5)}
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
