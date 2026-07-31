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
  border:1px solid var(--c-rule);border-radius:12px;background:var(--c-bg)}
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
.login-form input[type=text],.login-form input[type=password]{
  width:100%;padding:.625rem .75rem;font:inherit;font-size:.9375rem;color:var(--c-text);
  background:var(--field);border:1px solid var(--c-rule);border-radius:8px;
  transition:border-color .12s, box-shadow .12s}
.login-form input::placeholder{color:var(--c-meta)}
.login-form input:hover{border-color:color-mix(in srgb, var(--c-text) 22%, var(--c-rule))}
/* A ring, not a 2px outline box. autofocus fires on load, so whatever this draws is the
   first thing anyone sees, and the old one drew a solid red rectangle. */
.login-form input:focus{outline:none;border-color:var(--c-accent);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--c-accent) 16%, transparent)}
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
  cursor:pointer;transition:opacity .12s}
.login-submit:hover{opacity:.85}
.login-submit:active{opacity:.95}
:where(.login-submit,.login-reveal button):focus-visible{outline:2px solid var(--c-accent);
  outline-offset:2px}

.login-error{margin:1.25rem 0 0;padding:.65rem .75rem;font-size:.875rem;color:var(--c-accent);
  border:1px solid color-mix(in srgb, var(--c-accent) 35%, var(--c-rule));border-radius:8px;
  background:color-mix(in srgb, var(--c-accent) 6%, var(--c-bg))}

.login-alt{margin:1.25rem 0 0;font-size:.875rem;text-align:center}
.login-alt a{color:var(--c-link);text-decoration:none}
.login-alt a:hover{text-decoration:underline}
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
