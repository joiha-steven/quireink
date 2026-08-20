// The newsletter sign-up card and its form, split out of islands.css.ts when that sheet
// reached the 400-line cap — and the seam is real: this is the one island whose markup is
// server-rendered (chrome.ts) and merely enhanced, so its styles serve readers who never
// run the island at all. The overlay wrapper rides along: it restyles this same card, and
// splitting a component's rules across two sheets is how they drift.
//
// NO BACKTICKS anywhere below: check:css-literal enforces that.

export const SUBSCRIBE_CSS = `
/* The sign-up card: a bordered panel at the end of an article, and the same markup the
   header's mail button opens as an overlay. It was a bare form with a top rule, which read
   as another section of the article rather than as an invitation. */
/* The sign-up card IS the modal panel: it is already a bordered card on theme tokens, so
   the overlay strips its own frame rather than drawing a second one around it. */
.subscribe-overlay{border:0;padding:0;background:none;width:min(28rem,92vw);margin-top:12vh}
.subscribe-overlay .subscribe-card{background:var(--c-bg);
  box-shadow:0 25px 50px -12px rgba(0,0,0,.25)}

/* The theme menu. The island builds these two elements and nothing styled them, so the
   rows rendered as unstyled blocks that pushed the header apart instead of a dropdown. */
.theme-wrap{position:relative;display:inline-flex}
.theme-menu{position:absolute;right:0;top:100%;margin-top:.5rem;z-index:50;width:11rem;
  overflow:hidden;border:1px solid var(--c-rule);background:var(--c-bg);padding:.25rem 0;
  box-shadow:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1)}
.theme-menu[hidden]{display:none}
.theme-menu button{display:flex;width:100%;align-items:center;justify-content:space-between;
  padding:.5rem .75rem;border:0;background:none;cursor:pointer;text-align:left;font:inherit;
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small);
  color:var(--c-meta)}
.theme-menu button:hover{background:var(--c-rule)}
.theme-menu button.is-current{font-weight:600;color:var(--c-heading)}
/* The tick marks the active mode, as in the frozen tree. It is decoration on a row whose
   state is already carried by the class, so it belongs in CSS, not in the bundle. */
.theme-menu button.is-current::after{content:"✓"}

.subscribe-card{border:1px solid var(--c-rule);border-radius:.5rem;padding:1.25rem;
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
.subscribe-card h2{font-size:inherit;font-weight:600;color:var(--c-heading);margin:0 0 .75rem}
form.subscribe{display:flex;gap:.5rem;margin:0}
/* The honeypot: parked, not display:none — some form fillers skip boxless fields. */
form.subscribe .hp{position:absolute;left:-9999px;width:1px;height:1px;flex:none;border:0;padding:0;opacity:0;pointer-events:none}
form.subscribe input{min-width:0;flex:1;padding:.5rem .75rem;border:1px solid var(--c-rule);
  border-radius:.5rem;background:var(--c-bg);color:var(--c-text);font:inherit}
/* The border darkening stays, the outline:none does not: it was cancelling the site's one
   focus ring on the only field in the header, so keyboard focus vanished here alone. */
form.subscribe input:focus{border-color:var(--c-heading)}
form.subscribe button{padding:.5rem 1rem;border:1px solid var(--c-rule);border-radius:.5rem;
  background:var(--c-bg);color:var(--c-heading);font:inherit;font-weight:500;cursor:pointer}
form.subscribe button:hover{background:var(--c-rule)}
form.subscribe button:disabled{opacity:.5}
@media (max-width:639px){form.subscribe{flex-direction:column}}
.subscribe-status:empty{display:none}
.subscribe-status{color:var(--c-meta);margin:.5rem 0 0}
`.trim()
