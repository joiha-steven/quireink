// The header overlays - search and the newsletter sign-up - on their ONE panel, and the
// sign-up card and its form, split out of islands.css.ts when that sheet
// reached the 400-line cap — and the seam is real: this is the one island whose markup is
// server-rendered (chrome.ts) and merely enhanced, so its styles serve readers who never
// run the island at all. The overlay wrapper rides along: it restyles this same card, and
// splitting a component's rules across two sheets is how they drift.
//
// NO BACKTICKS anywhere below: check:css-literal enforces that.

export const SUBSCRIBE_CSS = `
/* The overlays. Both are dialogs, so Escape and the inert background are the browser's. */
.overlay[open]{display:flex}
.overlay{flex-direction:column;border:1px solid var(--c-rule);border-radius:var(--radius,.5rem);padding:1rem;
  width:min(32rem,92vw);max-height:70vh;background:var(--c-bg);color:var(--c-text);margin-top:8vh;
  /* Chrome size, not reading size: it inherited the body, so a long-form blog drew a search
     box with 20px placeholder in an 80px field. */
  box-shadow:var(--lift);font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
.overlay::backdrop{background:rgba(0,0,0,.4)}
/* ONE panel for both header overlays. Search and the sign-up used to be two designs: a
   framed 32rem box 8vh down with a close glyph, and a frameless 28rem card 12vh down with
   none. Same frame, same width, same top, same heading, same close - the card inside the
   sign-up overlay drops its own border and padding (subscribe.css.ts) so the panel is the
   only frame. The glyph is named for the panel, not for search, because both carry it. */
.overlay-close{position:absolute;top:.75rem;right:.75rem;width:2rem;height:2rem;display:flex;align-items:center;justify-content:center;
  border:0;border-radius:999px;background:none;color:var(--c-meta);font-size:1.125rem;line-height:1;cursor:pointer}
.overlay-close:hover{color:var(--c-heading);background:var(--c-rule)}
.overlay h2{font-size:inherit;font-weight:var(--fw-heading,600);color:var(--c-heading);margin:0 2rem .75rem 0}
.search-input{width:100%;padding:.5rem .75rem;border:1px solid var(--c-rule);border-radius:var(--radius,.5rem);background:var(--c-bg);color:var(--c-text);font:inherit;box-shadow:var(--well)}
.search-input:focus{border-color:var(--c-heading)}
.search-results{list-style:none;padding:0;margin:.85rem 0 0;overflow-y:auto}
.search-results li{margin:0 0 .6rem}
.search-results a{color:var(--c-heading);text-decoration:none}
.search-results a:hover{text-decoration:underline}

/* The sign-up card: a bordered panel at the end of an article, and the same markup the
   header's mail button opens as an overlay. It was a bare form with a top rule, which read
   as another section of the article rather than as an invitation. */
/* Inside the header overlay the PANEL is the frame (.overlay, book.css.ts, shared with
   search): the card drops its own border and padding so there is one box, not one inside
   another. The card's heading keeps the room the panel's close glyph needs. */
.overlay .subscribe-card{border:0;border-radius:0;padding:0;box-shadow:none}

/* The theme menu. The island builds these two elements and nothing styled them, so the
   rows rendered as unstyled blocks that pushed the header apart instead of a dropdown. */
.theme-wrap{position:relative;display:inline-flex}
.theme-menu{position:absolute;right:0;top:100%;margin-top:.5rem;z-index:50;width:11rem;
  overflow:hidden;border:1px solid var(--c-rule);background:var(--c-bg);padding:.25rem 0;
  /* It had none, so the site's one square corner was the menu that opens off the header. */
  border-radius:var(--radius,.5rem);box-shadow:var(--lift)}
.theme-menu[hidden]{display:none}
.theme-menu button{display:flex;width:100%;align-items:center;justify-content:space-between;
  padding:.5rem .75rem;border:0;background:none;cursor:pointer;text-align:left;font:inherit;
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small);
  color:var(--c-meta)}
.theme-menu button:hover{background:var(--c-rule)}
.theme-menu button.is-current{font-weight:var(--fw-heading,600);color:var(--c-heading)}
/* The tick marks the active mode, as in the frozen tree. It is decoration on a row whose
   state is already carried by the class, so it belongs in CSS, not in the bundle. */
.theme-menu button.is-current::after{content:"✓"}

.subscribe-card{border:1px solid var(--c-rule);border-radius:var(--radius,.5rem);padding:1.25rem;
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
.subscribe-card h2{font-size:inherit;font-weight:var(--fw-heading,600);color:var(--c-heading);margin:0 0 .75rem}
.overlay .subscribe-card h2{margin-right:2rem}
form.subscribe{display:flex;gap:.5rem;margin:0}
/* The honeypot: parked, not display:none — some form fillers skip boxless fields. */
form.subscribe .hp{position:absolute;left:-9999px;width:1px;height:1px;flex:none;border:0;padding:0;opacity:0;pointer-events:none}
form.subscribe input{min-width:0;flex:1;padding:.5rem .75rem;border:1px solid var(--c-rule);
  border-radius:var(--radius,.5rem);background:var(--c-bg);color:var(--c-text);font:inherit;
  box-shadow:var(--well)}
/* The border darkening stays, the outline:none does not: it was cancelling the site's one
   focus ring on the only field in the header, so keyboard focus vanished here alone. */
form.subscribe input:focus{border-color:var(--c-heading)}
form.subscribe button{padding:.5rem 1rem;border:1px solid var(--c-rule);border-radius:var(--radius,.5rem);
  background:var(--c-bg);color:var(--c-heading);font:inherit;font-weight:500;cursor:pointer}
form.subscribe button:hover{background:var(--c-rule)}
form.subscribe button:disabled{opacity:.5}
@media (max-width:639px){form.subscribe{flex-direction:column}}
.subscribe-status:empty{display:none}
.subscribe-status{color:var(--c-meta);margin:.5rem 0 0}
`.trim()
