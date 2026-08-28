// Figures: the picture, its caption, where it sits, the frame it may wear, and a gallery.
//
// Split out of `public.css.ts` on 2026-08-28, when adding the frame took that file past its
// 400-line cap. `check:docs` and `check:filesize` both say a file at the cap gets split
// rather than squeezed, and this was the section that could leave whole: everything here is
// about one element and nothing outside it reaches in. The two `.prose` rules travel with
// it because they exist ONLY to clear the float a `#third` figure makes — a clearing rule
// separated from the thing it clears is a rule nobody can explain.
//
// ORDER IS PRESERVED. It is composed immediately after `BASE_CSS`, which is where it used
// to sit; nothing before line 300 of that file touched a figure, and everything after it
// (the rail, the islands, book mode, mobile) still lands later and still wins, which is
// what `mobile.css.ts` relies on to unfloat a third-width picture on a phone.
//
// NO BACKTICKS below: this is one template literal and a backtick ends it.

export const FIGURE_CSS = `
figure{margin:calc(var(--sp) * 2) 0}
figure img{display:block;margin:0 auto;border-radius:.5rem}
figcaption{color:var(--c-meta);font-size:var(--fs-caption);line-height:var(--lh-caption);
  letter-spacing:var(--ls-caption);text-align:center;margin-top:calc(var(--sp) * .5)}
.img-left img{margin-left:0}
.img-right img{margin-right:0}
.img-wide{margin-left:calc(-1 * clamp(0px,4vw,4rem));margin-right:calc(-1 * clamp(0px,4vw,4rem))}
/* A 30% figure (#third). Alone it is a small centred plate; with an align it floats and the
   words run around it, magazine-fashion — the one fragment that changes how TEXT lays out.
   The img fills its figure, so the figure's width is the whole geometry. Floats exist
   nowhere else in the prose, so headings and the footnote rule clear them: a section
   boundary should never wrap around a picture from the section before. */
.img-third{width:30%}
.img-third img{width:100%}
.img-center.img-third{margin-left:auto;margin-right:auto}
.img-left.img-third{float:left;margin:calc(var(--sp) * .35) var(--sp) calc(var(--sp) * .5) 0}
.img-right.img-third{float:right;margin:calc(var(--sp) * .35) 0 calc(var(--sp) * .5) var(--sp)}
.img-left.img-third figcaption,.img-right.img-third figcaption{text-align:left}
/* THE FRAME.
   Drawn on the IMG, not on a wrapper, and that is the whole design. An img with padding
   shows its background in the padding box, so the mat costs no extra element and no markup
   change - and the caption stays outside it, where a caption belongs. box-sizing is
   border-box for everything, so a framed picture is exactly as wide as an unframed one and
   nothing below it moves.

   THROUGH VARIABLES, so the site-wide default and a per-picture override can both exist
   without either knowing about the other - the same contract the gallery ratio already
   uses, and for the same hard reason: a rendered body is cached under a hash of its INPUT,
   so a default that rewrote the markup would leave every already-rendered post wearing the
   old frame until something unrelated evicted it. Through CSS it is instant instead.
   :root carries the site default (pageStyles, from settings). A figure class carries an
   override, including the override that says NO frame - which has to be sayable out loud
   once a site default exists to disagree with.

   THE STEPS ARE NAMED, and the site default points at a NAME rather than a length. That
   indirection is what makes the phone rule survive: the settings block is inlined AFTER the
   linked sheet, so a site default written as a length would outrank the media query and a
   thick default would keep its desktop mat on a 350px column. Pointing at --fig-step-* lets
   the media query redefine the step underneath it.

   Border WIDTH is the variable, not the border. A transparent 1px border still takes its
   2px out of a border-box picture, so an unframed image would quietly shrink by two pixels
   the day this shipped.

   The LINE is mixed rather than picked. The rule token is the site's divider colour and it
   is far too pale to hold a photograph (measured on the default palette: #ebebeb against a
   pale sky is invisible at 1px), while the meta colour at full strength reads as a heavy
   border. color-mix() lands between the two and stays inside the palette, so it still
   follows the theme. The plain rule-colour declaration before it is the fallback for an
   engine with no color-mix: a paler frame, never a missing one.

   INK inverts by itself: the heading colour is near-black on a light palette and near-white
   on a dark one, so one declaration gives a dark mat on paper and a light mat at night
   without a media query or a second token. */
:root{--fig-step-thin:calc(var(--sp) * .5);--fig-step-med:var(--sp);--fig-step-thick:calc(var(--sp) * 1.75)}
figure img{padding:var(--fig-pad,var(--fig-default-pad,0));
  background:var(--fig-mat,var(--fig-default-mat,transparent));
  border:var(--fig-bw,var(--fig-default-bw,0)) solid var(--fig-line,var(--fig-default-line,transparent))}
.img-frame{--fig-pad:var(--fig-step-med);--fig-mat:var(--c-bg);--fig-bw:1px;--fig-line:var(--c-rule);
  --fig-line:color-mix(in srgb,var(--c-rule),var(--c-meta) 35%)}
.img-frame-thin{--fig-pad:var(--fig-step-thin)}
.img-frame-thick{--fig-pad:var(--fig-step-thick)}
/* The mat is the ink itself, so the line would only draw a second edge on top of it. */
.img-frame-ink{--fig-mat:var(--c-heading);--fig-line:var(--c-heading)}
/* Said out loud, because silence means "whatever the site says". */
.img-noframe{--fig-pad:0;--fig-mat:transparent;--fig-bw:0}
.prose h2,.prose h3,.prose .fn-rule{clear:both}
.prose::after{content:"";display:table;clear:both}
.gallery{display:grid;gap:calc(var(--sp) * .5);margin:calc(var(--sp) * 2) 0}
.gallery figure{margin:0}
.gallery-cols-2{grid-template-columns:repeat(2,1fr)}
.gallery-cols-3{grid-template-columns:repeat(3,1fr)}
.gallery-cols-4{grid-template-columns:repeat(4,1fr)}
/* Gallery shape and captions, as VARIABLES, so two places can set them without either
   knowing about the other: the site default on :root (pageStyles, from settings) and a
   per-gallery override on the tile, which wins on specificity. The var() fallbacks are what
   a gallery did before any of this existed, so an untouched site is unchanged.
   picture is inline, and an inline box is a poor containing block for a percentage width. */
.gallery picture{display:block}
.gallery figure img{aspect-ratio:var(--gallery-ratio,auto);width:var(--gallery-w,auto);object-fit:cover}
.gallery figcaption{display:var(--gallery-cap,block)}
/* Width rides with the ratio: a cropped tile fills its cell, an uncropped one must not. */
.gallery .g-asis{--gallery-ratio:auto;--gallery-w:auto}
.gallery .g-1x1{--gallery-ratio:1/1;--gallery-w:100%}
.gallery .g-3x2{--gallery-ratio:3/2;--gallery-w:100%}
.gallery .g-4x3{--gallery-ratio:4/3;--gallery-w:100%}
.gallery .g-cap{--gallery-cap:block}
.gallery .g-nocap{--gallery-cap:none}
`.trim()
