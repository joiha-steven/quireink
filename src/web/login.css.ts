// The sign-in screens, styled as a PRODUCT surface rather than a blog page.
//
// This sheet used to be an appendix to the public one, and the login page loaded the whole
// of it: the rail, the prose rules, the listing cards, book mode. That cost more than
// weight. `main{flex:1}` in the public sheet applies to any main element, and the card is a
// main, so it stretched to the full viewport height and the form sat in a 780px-tall empty
// box. The fix is structural: the login document no longer loads the public sheet at all,
// so nothing written for an article can reach it.
//
// What it still shares is the PALETTE. Colours come from the same `--c-*` tokens every page
// uses, so the door matches the house and dark mode needs no second definition. Everything
// else is stated here in absolute units, on purpose: the reading typography is tuned for
// long-form text by a reader who can enlarge it, and a sign-in form inheriting a 22px
// reading size is how the old one ended up looking like a terminal.
//
// This sheet is appended AFTER the owner's custom CSS, which is deliberate. A blog's custom
// CSS may not distort the page you have to get through to fix it.
//
// NO BACKTICKS BELOW. This is one template literal, so a backtick inside it ends the
// string. It has cost two failed boots in this repository already; check:css-literal guards
// this file, public.css.ts and islands.css.ts.

export const LOGIN_CSS = `
*,*::before,*::after{box-sizing:border-box}
/* Inter, not the blog's chrome face. The sign-in page belongs to Quire Ink and looks the same
   on every install; the blog's own typeface starts at the door it opens. */
:root{--font-ui:'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-code:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --field:color-mix(in srgb, var(--c-text) 3%, var(--c-bg))}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--c-bg);color:var(--c-text);font-family:var(--font-ui);
  font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}

.login-wrap{min-height:100dvh;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:1.75rem;padding:2.5rem 1.25rem}
.brand{display:flex;align-items:center;gap:.55rem;color:var(--c-heading)}
.brand-mark{display:block}
/* The word is an SVG of outlines, so it needs no size or weight of its own: height on the
   element sets it and the width follows from the viewBox. width:auto is stated because a
   bare svg in some resets is handed 100%. */
.brand-word{display:block;width:auto}

/* flex:0 0 auto is not decoration. The card is a main element, and one line of custom CSS
   naming main would otherwise stretch it again, which is the bug this rewrite fixed. */
.login-card{flex:0 0 auto;width:100%;max-width:24rem;padding:1.75rem;
  border:1px solid var(--c-rule);border-radius:10px;background:var(--c-bg)}
.login-card h1{margin:0;font-size:1.375rem;line-height:1.25;font-weight:600;
  letter-spacing:-.015em;color:var(--c-heading)}
.login-card h2{margin:1.5rem 0 0;font-size:.9375rem;font-weight:600;color:var(--c-heading)}
.login-lede{margin:.4rem 0 0;font-size:.875rem;color:var(--c-meta)}
.login-step{margin:.4rem 0 0;font-size:.8125rem;color:var(--c-meta)}
.login-hint{margin:.65rem 0 0;font-size:.875rem;color:var(--c-meta)}

.login-form{display:flex;flex-direction:column;margin-top:1.5rem}
.login-form label{margin:1rem 0 .35rem;font-size:.8125rem;font-weight:500;color:var(--c-heading)}
/* first-of-type, not first-child: the hidden ticket and next fields sit ahead of it. */
.login-form>label:first-of-type{margin-top:0}
/* Every input EXCEPT the checkbox, rather than a list of the types that exist today.
   The list was the original design and the reason was sound — the checkbox on the
   recovery-codes screen must not be given a text field's box — but a list means each new
   type is invisible until somebody opens the page. It happened twice in one afternoon: the
   claim form's email field and then the setup form's url field both rendered wearing the
   browser's default border beside two filled siblings, and neither a type-check nor a test
   could see it. Excluding the one exception says the same thing and stays true. */
.login-form input:not([type=checkbox]){
  width:100%;padding:.625rem .75rem;font:inherit;font-size:.9375rem;line-height:1.5;color:var(--c-text);
  background:var(--field);border:1px solid var(--c-rule);border-radius:8px;
  /* The well. Black rather than a palette token on purpose: a shadow is dark in every
     palette, and a token here would light the inside of the field on a dark one. */
  box-shadow:inset 0 1px 1.5px rgba(0,0,0,.07);
  /* Literal, not var(--dur-fast), and checked rather than assumed: the sign-in page is served
     pageStyles(settings) + LOGIN_CSS and NOT the public sheet, so BASE_CSS's :root{--dur-*} is
     not on this document. A token here would resolve to nothing and the transition would
     silently not happen, which is a failure neither this file nor a test can see. Defining the
     tokens a second time here is the other half of the same problem, and moving them into
     pageStyles would put a static value in the per-page inline half. One screen, two
     transitions, its own system on purpose. */
  transition:border-color .12s, box-shadow .12s}
.login-form input::placeholder{color:var(--c-meta)}
.login-form input:hover{border-color:color-mix(in srgb, var(--c-text) 22%, var(--c-rule))}
/* A ring, not a 2px outline box. autofocus fires on load, so whatever this draws is the
   first thing anyone sees, and the old one drew a solid red rectangle. */
.login-form input:focus{outline:none;border-color:var(--c-accent);
  box-shadow:inset 0 1px 1.5px rgba(0,0,0,.07), 0 0 0 3px color-mix(in srgb, var(--c-accent) 16%, transparent)}
/* A code is read off a phone one character at a time, so it is set like one: centred,
   monospaced, spaced out. text-indent cancels the trailing letter-space, which otherwise
   pushes the digits half a character left of centre. */
.login-form #code{text-align:center;font-family:var(--font-code);font-size:1.0625rem}
.login-form #code[inputmode=numeric]{letter-spacing:.35em;text-indent:.35em}

.login-reveal{position:relative;display:block}
/* Padding on the input, not a wrapper, so the toggle never sits over typed text. */
.login-reveal input{padding-right:2.75rem}
.login-reveal button{position:absolute;right:.375rem;top:50%;transform:translateY(-50%);
  display:flex;align-items:center;justify-content:center;width:2rem;height:2rem;padding:0;
  border:0;border-radius:6px;background:none;color:var(--c-meta);cursor:pointer}
.login-reveal button{transition:color .12s, background-color .12s, box-shadow .12s, transform .12s}
.login-reveal button:hover{color:var(--c-text);
  background:color-mix(in srgb, var(--c-text) 7%, transparent)}
.login-reveal svg{width:18px;height:18px}
/* The icon states what the NEXT click does, so it flips with the field. The island only
   owns the attribute; which glyph that means is a styling question and lives here. */
.login-reveal .eye-off{display:none}
.login-reveal button[data-shown] .eye-on{display:none}
.login-reveal button[data-shown] .eye-off{display:block}
.login-caps{margin:.5rem 0 0;font-size:.8125rem;color:var(--c-accent)}

.login-submit{margin-top:1.5rem;padding:.7rem 1rem;font:inherit;font-size:.9375rem;
  font-weight:600;color:var(--c-bg);background:var(--c-heading);border:0;border-radius:8px;
  cursor:pointer;transition:box-shadow .12s, transform .12s;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -1px 0 rgba(0,0,0,.2),
    0 1px 2px rgba(0,0,0,.28)}
.login-submit:hover{box-shadow:inset 0 1px 0 rgba(255,255,255,.24),inset 0 -1px 0 rgba(0,0,0,.22),
    0 2px 4px rgba(0,0,0,.3)}
/* Landing is instant and only the release is sprung, like every press in this product. */
.login-submit:active{transform:translateY(1px);transition-duration:0s;
  box-shadow:inset 0 2px 4px rgba(0,0,0,.5),inset 0 -1px 0 rgba(255,255,255,.22)}
.login-reveal button:active{transform:translateY(-50%) translateY(1px);transition-duration:0s;
  box-shadow:inset 0 1.5px 2.5px color-mix(in srgb, var(--c-text) 20%, transparent)}
html[data-motion=off] .login-submit:active{transform:none}
html[data-motion=off] .login-reveal button:active{transform:translateY(-50%)}
@media (prefers-reduced-motion:reduce){
  .login-submit:active{transform:none}
  .login-reveal button:active{transform:translateY(-50%)}
}
:where(.login-submit,.login-reveal button):focus-visible{outline:2px solid var(--c-accent);
  outline-offset:2px}

.login-error{margin:1.25rem 0 0;padding:.65rem .75rem;font-size:.875rem;color:var(--c-accent);
  border:1px solid color-mix(in srgb, var(--c-accent) 35%, var(--c-rule));border-radius:8px;
  background:color-mix(in srgb, var(--c-accent) 6%, var(--c-bg))}

.login-alt{margin:1.25rem 0 0;font-size:.875rem;text-align:center}
.login-alt a{color:var(--c-link);text-decoration:none}
.login-alt a:hover{text-decoration:underline}
/* A button that has to read as a way out rather than as the answer. It is a real <button>
   because it POSTs — a link cannot — but it must not look like the submit above it, or the
   screen offers two equal doors and the safe one stops being obvious. */
.login-linkish{background:none;border:0;padding:0;font:inherit;color:var(--c-link);
  text-decoration:none;cursor:pointer}
.login-linkish:hover{text-decoration:underline}

/* First run, step two: two drawings of a front page, side by side.
   Bars and blocks rather than screenshots. The difference between a list and a composed
   front page is coarse enough that a diagram carries it, and a screenshot would be a build
   step, a cache and one more thing to keep in sync for a single screen. */
.face-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin:.25rem 0 .25rem}
@media (max-width:28rem){.face-grid{grid-template-columns:1fr}}
.face-choice{display:block;padding:.7rem;border:1px solid var(--c-rule);border-radius:.5rem;
  cursor:pointer;background:var(--c-bg)}
.face-choice:hover{border-color:color-mix(in srgb, var(--c-text) 22%, var(--c-rule))}
/* The radio is the mechanism and must stay reachable by keyboard, so it is moved off screen
   rather than display:none — which would take it out of the tab order and out of the
   accessibility tree with it. */
.face-choice input{position:absolute;opacity:0;pointer-events:none}
.face-choice:has(input:checked){border-color:var(--c-accent);
  box-shadow:0 0 0 1px var(--c-accent), inset 0 2px 4px rgba(0,0,0,.10)}
.face-choice:has(input:focus-visible){outline:2px solid var(--c-accent);outline-offset:2px}
.face-art{display:flex;flex-direction:column;gap:.28rem;height:4.6rem;padding:.45rem;
  border-radius:.3rem;background:color-mix(in srgb, var(--c-text) 4%, transparent)}
.face-art span{display:block;background:color-mix(in srgb, var(--c-text) 20%, transparent);
  border-radius:.1rem}
.face-row{height:.34rem}
.face-wide{width:62%}
/* Scoped through the parent class, and it is not decoration. The rule two lines up is
   (0,1,1) and a bare face-cols is (0,1,0), so display:block won and the flex row never
   happened: the three columns stacked, each as wide as the card, and the newspaper drawing
   rendered as one grey slab that looked nothing like a newspaper. Measured rather than
   noticed - the boxes came back 118x21 each inside a card 110px wide.
   (No backticks anywhere in this file. It is one template literal; see the top.) */
.face-art .face-item{display:flex;flex-direction:column;gap:.18rem;background:none}
.face-line{height:.22rem}
.face-short{width:45%}
.face-lead{height:1.5rem}
.face-art .face-cols{display:flex;flex-direction:row;gap:.28rem;background:none;flex:1}
.face-art .face-cols>span{flex:1 1 0;height:100%}
.face-name{display:block;margin:.5rem 0 .1rem;font-weight:600;font-size:.9rem}
.face-hint{display:block;font-size:.8rem;color:var(--c-meta);line-height:1.45}
/* The select repeats the input's box EXACTLY rather than approximating it. Written first
   with its own rounded rem values, it came out 7.2px where its neighbours were 8px, padded
   9.6/11.2 against their 10/12, and on a different background formula — four fields in a
   column, one of them almost right, which reads as a mistake rather than as a choice.
   Same tokens, same numbers, same focus ring as the inputs above.

   min-height is the last 2.5px of that, and it is here because LINE-HEIGHT CANNOT DO IT:
   Chrome forces line-height:normal on a select and ignores the declaration even inline
   with !important — measured, not assumed. So the select sat at 42px beside three inputs
   at 44.5px, matching on every property the first pass compared and still visibly shorter.
   The value is not a magic number: it is the input's own box restated — content
   (1.5 x .9375rem) + padding (2 x .625rem) + border (2 x 1px) — so the two move together
   when a token moves. The inputs above pin line-height:1.5 for the same reason: without
   it their content box is whatever normal means in the current face, and this sum stops
   being true. */
.login-form select{width:100%;padding:.625rem .75rem;font:inherit;font-size:.9375rem;
  min-height:calc(1.5 * .9375rem + 2 * .625rem + 2px);
  color:var(--c-text);background:var(--field);border:1px solid var(--c-rule);
  border-radius:8px;box-shadow:inset 0 1px 1.5px rgba(0,0,0,.07);
  transition:border-color .12s, box-shadow .12s}
.login-form select:hover{border-color:color-mix(in srgb, var(--c-text) 22%, var(--c-rule))}
.login-form select:focus{outline:none;border-color:var(--c-accent);
  box-shadow:inset 0 1px 1.5px rgba(0,0,0,.07), 0 0 0 3px color-mix(in srgb, var(--c-accent) 16%, transparent)}
.login-back{font-size:.8125rem;color:var(--c-meta);text-decoration:none}
.login-back:hover{color:var(--c-text)}

/* The QR carries its own white quiet zone (render/qr.ts), so it needs a frame, not a
   background. On a dark palette a token-coloured backdrop would eat the margin scanners
   rely on. */
.login-qr{display:flex;justify-content:center;margin-top:1rem}
.login-qr svg{width:10.5rem;height:10.5rem;border:1px solid var(--c-rule);border-radius:10px}
.login-secret{margin:1rem 0 0;padding:.6rem .75rem;text-align:center;background:var(--field);
  border:1px solid var(--c-rule);border-radius:8px}
/* No word-break here. The key is printed in groups of four so it can be typed without
   losing your place, and break-all split a group across two lines, which undoes that. */
.login-secret code{font-family:var(--font-code);font-size:.8125rem;letter-spacing:.08em;
  word-spacing:.2em;color:var(--c-heading)}
.login-codes{display:grid;grid-template-columns:repeat(2,1fr);gap:.4rem 1rem;margin:1rem 0 0;
  padding:.85rem 1rem .85rem 2.25rem;background:var(--field);border:1px solid var(--c-rule);
  border-radius:8px;font-size:.8125rem;color:var(--c-meta)}
.login-codes code{font-family:var(--font-code);font-size:.8125rem;color:var(--c-heading)}
.login-check{display:flex;align-items:flex-start;gap:.55rem;margin-top:1.25rem;
  font-size:.875rem;color:var(--c-text)}
.login-check input{margin:.2rem 0 0;accent-color:var(--c-accent)}

@media (max-width:26rem){
  .login-wrap{gap:1.25rem;padding:1.5rem 1rem}
  .login-card{padding:1.375rem}
}
`
