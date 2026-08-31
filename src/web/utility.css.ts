// The shared vocabulary a card composes itself from: the type ROLES and the one link
// signature. Split out of public.css.ts at the 400-line limit.
//
// It is its own file because it is the one chunk nothing owns: the listing, the front page,
// the chrome and the rail all reach for these class names, and leaving them buried in the
// base sheet made it look as though they belonged to the page shell.
//
// Every size here is the owner's --fs-* setting, never a literal, which is what makes the
// listing and the article agree without anyone keeping two numbers in step. That rule is
// enforced by scripts/checks/type-roles.ts, and THIS FILE IS IN ITS LIST — a sheet split out
// without being added to that list is a sheet nothing checks, which has happened here before.

export const UTILITY_CSS = `
/* Type ROLES, ported from the frozen tree. A card composes these rather than declaring
   its own sizes, which is why the listing and the article agree without anyone keeping
   two numbers in step. Every size is the owner's --fs-* setting times --type-scale, so
   nothing here is a literal. */
.fs-h1{font-size:var(--fs-h1);line-height:var(--lh-h1);letter-spacing:var(--ls-h1)}
.fs-h2{font-size:var(--fs-h2);line-height:var(--lh-h2);letter-spacing:var(--ls-h2)}
.fs-h3{font-size:var(--fs-h3);line-height:var(--lh-h3);letter-spacing:var(--ls-h3)}
.t-small{font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
.t-body{font-size:var(--fs-body);line-height:var(--lh-body);letter-spacing:var(--ls-body)}
.text-meta{color:var(--c-meta)}
/* One fact of a meta line stays on one line. The reading time is a bracketed number and
   then two words, and at 390px it broke between them on EVERY card of every listing —
   "[4]" orphaned at the end of one line and "min read" starting the next. Measured
   2026-08-22. The line as a whole still wraps between its facts, which is what it should do;
   this only stops a fact wrapping through its own middle. */
.meta-part{white-space:nowrap}
.text-text{color:var(--c-text)}
.reading-font{font-family:var(--font-reading)}
.font-semibold{font-weight:var(--fw-heading,600)}
.mt-2{margin-top:.5rem}
.mt-3{margin-top:.75rem}
/* ONE hover signature for every link outside the body copy: an accent underline. */
.link-accent{color:var(--c-heading);text-decoration:none}
.link-accent:hover{text-decoration:underline;text-decoration-color:var(--c-accent);
  text-decoration-thickness:1px;text-underline-offset:4px}

/* THE CLICK, for everything on the reading site a finger can press. Pressing lands at
   once - the 1px of travel and the carved-in shadow arrive with transition-duration:0 -
   and only the release is sprung, on whatever transition the control already carries.
   The shadow is the palette's own heading ink diluted (an engine without color-mix just
   loses the shading, never the button), so every palette carves with its own ink. The
   book arrows keep their translateY centring (colour only, no travel) and the resume
   pill composes its centring with the dip. data-motion=off and reduced-motion keep the
   shadow and drop the travel, like every press in this product. */
.icon-btn:active,.code-copy:active,form.subscribe button:active,.theme-menu button:active,
.lightbox button:active,.to-top:active,.book-x:active,.comment-form button:active{
  transform:translateY(1px);transition-duration:0s;
  box-shadow:inset 0 1.5px 2.5px color-mix(in srgb,var(--c-heading) 22%,transparent)}
.resume-pill:active{transform:translateX(-50%) translateY(1px);transition-duration:0s;
  box-shadow:inset 0 1.5px 2.5px color-mix(in srgb,var(--c-heading) 22%,transparent)}
.book-arrow:active{color:var(--c-heading)}
html[data-motion=off] .icon-btn:active,html[data-motion=off] .code-copy:active,
html[data-motion=off] form.subscribe button:active,html[data-motion=off] .theme-menu button:active,
html[data-motion=off] .lightbox button:active,html[data-motion=off] .to-top:active,
html[data-motion=off] .book-x:active,html[data-motion=off] .comment-form button:active{transform:none}
html[data-motion=off] .resume-pill:active{transform:translateX(-50%)}
@media (prefers-reduced-motion:reduce){
  .icon-btn:active,.code-copy:active,form.subscribe button:active,.theme-menu button:active,
  .lightbox button:active,.to-top:active,.book-x:active,.comment-form button:active{transform:none}
  .resume-pill:active{transform:translateX(-50%)}
}
`.trim()
