// WHAT ONE ROW OF A LIST IS MADE OF, in order: the kicker (the category), the headline, the
// standfirst, and the facts (date, reading time) last. `listing.ts` writes the markup and its
// header says why the facts moved from above the headline to below the standfirst.
//
// NO BACKTICKS anywhere below: this sheet is one template literal and check:css-literal
// enforces that.
//
// The side picture lives here too, because where it goes is a question about this grid: it
// sits to the right of the HEADLINE (and of the standfirst, from 40rem), aligned with the
// headline's first line, and never beside the facts. Its SHAPE (a square, or 3:2 on top) is
// the owner's setting and stays in postimage.css.ts, which is where that promise is kept.
export const LIST_CARD_CSS = `
/* The kicker is the one word that says what shelf this is on, and nothing else shares its
   line: the category is a short label that cannot wrap badly, which the old "Category - date
   - N min read" row could and did beside a picture. */
.card-kick{margin:0 0 .3rem;color:var(--c-heading)}
/* A gap only AFTER something: a short post has no headline and may have no category, and the
   first thing on a card must start where the timeline marker starts. Paragraphs have no margin
   of their own (the base reset). */
:is(.card-kick,h1,h2,.card-exc) ~ :is(.card-exc,.card-meta){margin-top:.75rem}

/* The facts. Each fact is nowrap and carries the separator that FOLLOWS it inside the same
   unbreakable run (listing.ts), so a line can break after a dot and never before one: no row
   of a list begins with a bare separator. The nowrap itself is .meta-part in utility.css.ts,
   so there is no rule for it here. */

/* THE SIDE PICTURE: a grid, not a float. The picture is placed (it follows the headline in the
   markup, so a reader with no CSS meets the words first) and the facts run the full width
   underneath, where they have the room to stay on one line.
   On a phone the picture is a 64px square beside the HEADLINE only; the standfirst takes the
   full width below it. From 40rem there is room for it to span the headline and the standfirst. */
.post-list article[data-thumb=side]{display:grid;grid-template-columns:minmax(0,1fr) 64px;
  grid-template-areas:"kick kick" "title thumb" "exc exc" "meta meta";
  column-gap:calc(var(--sp) * .8);align-items:start}
.post-list article[data-thumb=side] > .card-kick{grid-area:kick}
.post-list article[data-thumb=side] > :is(h1,h2,h3){grid-area:title}
.post-list article[data-thumb=side] > .card-thumb{grid-area:thumb;width:64px;margin:.25rem 0 0}
.post-list article[data-thumb=side] > .card-exc{grid-area:exc}
.post-list article[data-thumb=side] > .card-meta{grid-area:meta}
@media (min-width:40rem){
  .post-list article[data-thumb=side]{grid-template-columns:minmax(0,1fr) 96px;
    grid-template-areas:"kick kick" "title thumb" "exc thumb" "meta meta";
    column-gap:calc(var(--sp) * 1.1)}
  .post-list article[data-thumb=side] > .card-thumb{width:96px}
}
/* A grid of cards is narrow in itself, whatever the screen: the small picture keeps the headline
   a few words wide. */
[data-list=grid] .post-list article[data-thumb=side]{grid-template-columns:minmax(0,1fr) 64px;
  grid-template-areas:"kick kick" "title thumb" "exc exc" "meta meta"}
[data-list=grid] .post-list article[data-thumb=side] > .card-thumb{width:64px}
/* A SHORT POST has no headline (ADR 0064), so the standfirst takes the headline's place beside
   the picture, on a phone and above, and its first line starts level with the picture's top. */
.post-list article[data-thumb=side][data-short]{grid-template-areas:"kick kick" "exc thumb" "meta meta"}
`
