// WHAT A PARAGRAPH HOLDING NOTHING BUT A LINK LOOKS LIKE: a player, a bookmark card, or a
// download card. ADR 0058.
//
// The player rules came from `public.css.ts` when this sheet was written. They had sat between
// the series box and the callout since the port, which is where a rule about one element lands
// when there is no file for its subject -- and `render/link-cards.ts` had just become the one
// place that decides which of the three a paragraph becomes. The stylesheet follows the code.
//
// NO BACKTICKS anywhere below: this sheet is one template literal and check:css-literal
// enforces that.
//
// Every colour is a theme token, so a card wears the palette the reader chose and the look the
// owner picked, in light and in dark, with nothing to switch. The one shape decision worth
// naming: a card is BORDERED and not filled. A filled block reads as a callout -- something the
// author is saying louder -- and this is the opposite, a thing the author is pointing away at.
export const CARD_CSS = `
/* THE PLAYER. A 16:9 frame for video, a short fixed one for the audio services -- both plain
   iframes, so the reading page still ships no third-party script. */
.video-embed,.video-file{margin:calc(var(--sp) * 2) 0}
.video-embed{position:relative;padding-top:56.25%}
.video-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.video-file video{width:100%;display:block}
.audio-embed iframe{width:100%;height:9.25rem;border:0}
/* Both cards are one link, so the whole block is the target and nothing inside it is
   underlined. The reset is on the anchor because a:hover elsewhere sets a colour. */
.link-card,.file-card{display:flex;gap:1rem;align-items:stretch;
  margin:1.6em 0;border:1px solid var(--c-rule);border-radius:var(--radius,.5rem);
  overflow:hidden;text-decoration:none;color:var(--c-text);
  transition:border-color .15s ease,background-color .15s ease}
.link-card:hover,.file-card:hover{border-color:var(--c-meta);
  background:color-mix(in srgb, var(--c-text) 3%, var(--c-bg));color:var(--c-text)}
.link-card:focus-visible,.file-card:focus-visible{outline:2px solid var(--c-accent);outline-offset:2px}

.link-card-text,.file-card-text{display:flex;flex-direction:column;gap:.3rem;
  justify-content:center;min-width:0;flex:1;padding:.9rem 1rem}
/* The SMALL role, all three numbers of it, on every line of both cards. A card is not special
   enough to invent a leading for: the scale is the blog's, and check:type-roles is the guard
   that stops one selector at a time drifting off it. The clamp works at any line-height. */
.link-card-title,.file-card-name{font-family:var(--font-sans);font-weight:var(--fw-heading,600);
  color:var(--c-heading);font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small);
  overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
/* Two lines of description and no more. A card that grows with whatever a stranger wrote in
   their meta tag is a card whose height this page does not control. */
.link-card-desc{color:var(--c-text);font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small);opacity:.85;
  overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.link-card-site,.file-card-meta{color:var(--c-meta);font-size:var(--fs-small);
  font-family:var(--font-sans);line-height:var(--lh-small);letter-spacing:var(--ls-small)}

/* The picture is a fixed column, not a percentage: a card holding a wide screenshot and one
   holding a square avatar have to be the same height in a column of them. */
.link-card-pic{width:8.5rem;flex:0 0 8.5rem;object-fit:cover;align-self:stretch;
  background:color-mix(in srgb, var(--c-text) 6%, var(--c-bg))}

/* The kind badge stands in the same column the picture would, so a run of mixed cards keeps
   one left edge for its text. NOT text-transform:uppercase -- the string is already a file
   extension, and the rule against ALL-CAPS is about setting words that way. */
.file-card-kind{display:flex;align-items:center;justify-content:center;
  width:4.5rem;flex:0 0 4.5rem;font-family:var(--font-sans);font-size:var(--fs-small);
  line-height:var(--lh-small);letter-spacing:var(--ls-small);color:var(--c-meta);
  background:color-mix(in srgb, var(--c-text) 5%, var(--c-bg));
  border-inline-end:1px solid var(--c-rule)}

/* Under 34rem the picture goes on top: an 8.5rem column beside two lines of text on a 320px
   screen leaves the title four words wide. */
@media (max-width:34rem){
  .link-card{flex-direction:column-reverse}
  .link-card-pic{width:100%;flex:0 0 auto;height:8rem}
}

/* ⚠️ THE PRINT RULES FOR THESE CARDS ARE IN print.css.ts, NOT HERE, and that is a rule rather
   than a preference. There is ONE print block and it is last in the sheet: print.test.ts finds
   it with indexOf and reads to the end, because a print rule is the one kind that fails in
   silence -- nobody prints a page to check a refactor. A second @media print in a component
   sheet does not merely sit in the wrong file; it makes that test read every screen rule after
   it as a print rule, which is how this comment came to be written. */
`
