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
.text-text{color:var(--c-text)}
.reading-font{font-family:var(--font-reading)}
.font-semibold{font-weight:600}
.mt-2{margin-top:.5rem}
.mt-3{margin-top:.75rem}
/* ONE hover signature for every link outside the body copy: an accent underline. */
.link-accent{color:var(--c-heading);text-decoration:none}
.link-accent:hover{text-decoration:underline;text-decoration-color:var(--c-accent);
  text-decoration-thickness:1px;text-underline-offset:4px}
`.trim()
