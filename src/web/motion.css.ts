// THE MOTION ENGINE of the reading site. One file holds everything that decides HOW the
// site moves; the sheets that own a component keep only WHAT moves (which property, which
// state). Its twin in script is src/assets/js/motion.ts, and the admin has the same shape
// at the foot of src/admin/admin.css. docs/conventions/motion.md is the contract.
//
// Four parts, in the order the cascade needs them:
//   1. the tokens - three durations and ONE curve;
//   2. the floor - every pressable thing eases its colour at the same speed, so nothing snaps
//      beside a neighbour that eases (the admin measured 92 such controls before it got one);
//   3. the click and the entrances - a press lands NOW and springs back, a menu or a dialog
//      arrives rather than appears;
//   4. the two gates - the owner's switch and the reader's OS preference, each one rule.
//
// Cheap properties only: opacity, transform (and the independent translate), colour, shadow.
// Nothing here animates a layout property, and nothing here may HIDE content it cannot
// reveal: an entrance starts from the visible state where the engine is unsupported.
//
// NO BACKTICKS anywhere below, comments included: check:css-literal.

/**
 * The tokens, exported on their own because the sign-in page is served pageStyles +
 * LOGIN_CSS and not the public sheet: it takes this line and the gates, and nothing else.
 *
 * --ease-out is the one curve, and it was introduced only once a real curve had been chosen
 * rather than to complete a set: it is the FLIP the admin rail uses to slide a row, and the
 * same fast-out settle every entrance below shares. The scroll-driven animations do not use
 * it and must not: a timeline a reader scrubs with a thumb is linear or it is wrong.
 */
export const MOTION_TOKENS = ':root{--dur-fast:.15s;--dur-base:.2s;--dur-slow:.5s;--ease-out:cubic-bezier(.2,.7,.3,1)}'

/**
 * The two gates. ONE attribute, server-rendered from settings.motion.enabled, and the OS
 * preference; each sets every animation and transition to none in one rule, on every
 * element and every pseudo-element (::backdrop included, since 2026-09-06 - a dialog that
 * faded its scrim while the switch said off was the one thing still moving).
 *
 * They do NOT zero the tokens (measured: --dur-base still reads .2s with the switch off), so
 * script never reads a token to decide whether to move - it asks motionOn() in motion.ts,
 * which reads the attribute and the media query.
 */
export const MOTION_GATES = `
@media (prefers-reduced-motion:reduce){*,::before,::after,::backdrop{animation:none!important;transition:none!important}}
html[data-motion=off] *,html[data-motion=off] ::before,html[data-motion=off] ::after,html[data-motion=off] ::backdrop{animation:none!important;transition:none!important}`.trim()

export const MOTION_CSS = `
/* --- motion engine ------------------------------------------------------------------ */
${MOTION_TOKENS}

/* THE FLOOR. Every control answers a pointer at the same speed. :where() on purpose: it
   makes this selector specificity ZERO, so any rule a component states for itself wins
   outright - the to-top button keeps its opacity fade, the rail its slide. Only the
   properties a hover or a focus actually changes, never all: transitioning layout is how a
   list starts sliding about when a row is added. */
:where(a,button,summary,input,select,textarea,[role=button]){
  transition-property:color,background-color,border-color,text-decoration-color,outline-color,fill,stroke,opacity,box-shadow;
  transition-duration:var(--dur-fast);transition-timing-function:ease}

/* THE CLICK, for everything a finger can press. Pressing lands at once - the 1px of travel
   and the carved-in shadow arrive with transition-duration:0 - and only the release is
   sprung, on whatever transition the control already carries (the floor, for most). A
   control that eases both ways feels like a screen; a key that drops now and springs back
   is what a hand expects of a pressed thing. The shadow is the palette's own heading ink
   diluted (an engine without color-mix loses the shading, never the button), so every
   palette carves with its own ink. The book arrows keep their translateY centring (colour
   only, no travel) and the resume pill composes its centring with the dip. With motion off
   and under reduced motion the shadow stays and the travel goes: the state must still be
   legible without the movement, so relief is never the only cue. */
.icon-btn:active,.code-copy:active,form.subscribe button:active,.theme-menu button:active,
.lightbox button:active,.to-top:active,.book-x:active,.comment-form button:active{
  transform:translateY(1px);transition-duration:0s;
  box-shadow:inset 0 1.5px 2.5px color-mix(in srgb,var(--c-heading) 22%,transparent)}
.resume-pill:active{transform:translateX(-50%) translateY(1px);transition-duration:0s;
  box-shadow:inset 0 1.5px 2.5px color-mix(in srgb,var(--c-heading) 22%,transparent)}
.book-arrow:active{color:var(--c-heading)}
html[data-motion=off] :is(.icon-btn,.code-copy,form.subscribe button,.theme-menu button,.lightbox button,.to-top,.book-x,.comment-form button):active{transform:none}
html[data-motion=off] .resume-pill:active{transform:translateX(-50%)}
@media (prefers-reduced-motion:reduce){
  :is(.icon-btn,.code-copy,form.subscribe button,.theme-menu button,.lightbox button,.to-top,.book-x,.comment-form button):active{transform:none}
  .resume-pill:active{transform:translateX(-50%)}
}

/* THE ENTRANCES. A menu or a dialog ARRIVES: it starts a shade transparent and a few pixels
   short of its place and settles on the one curve. Pure CSS, from the @starting-style the
   browser applies on the frame an element first appears, so the islands stay as they are -
   hidden = true and showModal() are still the whole of the script. An engine without
   @starting-style or allow-discrete simply shows and hides instantly, which is the state
   every rule below starts from, so nothing can be left invisible.

   Opacity ONLY on a dialog. A transform on it would make the dialog the containing block
   for anything fixed inside it during the entrance, and the element would jump when the
   transform came off. The menu is small and owns no fixed child, so it may also travel. */
dialog{transition:opacity var(--dur-base) var(--ease-out),overlay var(--dur-base) allow-discrete,display var(--dur-base) allow-discrete}
dialog::backdrop{transition:opacity var(--dur-base) var(--ease-out),overlay var(--dur-base) allow-discrete,display var(--dur-base) allow-discrete}
dialog:not([open]),dialog:not([open])::backdrop{opacity:0}
@starting-style{dialog[open],dialog[open]::backdrop{opacity:0}}
.theme-menu{transition:opacity var(--dur-fast) var(--ease-out),translate var(--dur-fast) var(--ease-out),display var(--dur-fast) allow-discrete}
.theme-menu[hidden]{opacity:0;translate:0 -4px}
@starting-style{.theme-menu:not([hidden]){opacity:0;translate:0 -4px}}

${MOTION_GATES}
`.trim()
