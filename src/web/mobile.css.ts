// Rules that apply only on a phone, last in the cascade so they win.
//
// The seam is a real one rather than an arbitrary split at the line limit: a phone is not a
// narrow desktop. A target that is comfortable under a mouse is not comfortable under a
// thumb, iOS zooms the page when a focused field is set below 16px, and hover is not a
// gesture a touch screen has. Nothing here matches above the phone breakpoint, so the
// desktop keeps the geometry it was measured into.
//
// The breakpoint is 639px, the width the sign-up form already stacks at. It is deliberately
// NOT the rail breakpoint: that one is computed from the reading column and decides where
// the sidebar lives, which is a different question from whether a thumb is doing the
// tapping.
//
// NO BACKTICKS anywhere below: check:css-literal enforces that.

export const MOBILE_CSS = `
@media (max-width:639px){
/* iOS Safari zooms the whole page when a focused control is set below 16px, and --fs-small
   measures 14px on this site: tapping the sign-up field shifted the layout sideways and left
   it there. A FLOOR rather than a size, so a larger type role still wins. Each selector
   names the rule that set the size, because font:inherit on those carries the same
   specificity as a bare element selector would. */
form.search input,form.subscribe input,.search-input,
.comment-form input,.comment-form textarea{font-size:max(16px,1em)}

/* THE GUTTER IS THE MEASURE, on a phone and nowhere else.
   The shell has always taken 2rem a side. Above the phone breakpoint that padding is dead
   weight -- the 42rem max-width binds first -- so it only ever spends anything on the one
   screen with nothing to spare. Measured at 390px: 64px of 390 went to gutters and the
   article set 33 characters to the line, against 67 on a laptop. Half the measure, on the
   site whose lead essay argues that 66 is the number.
   1.5rem, not 1rem. It is the whole win: at 390px both give 37 characters and 9 lines
   where 2rem gave 33 and 10, so going narrower buys nothing measurable and only pushes the
   words against the bezel. On a 360px Android the same step goes 30 to 33.
   max() rather than a plain length, so a notch in landscape still wins. */
.wrap{padding-left:max(1.5rem,env(safe-area-inset-left,0px));
  padding-right:max(1.5rem,env(safe-area-inset-right,0px))}

/* The drawer IS the navigation on a phone, and its rows measured 22px tall, 26px apart.
   padding-block rather than a height: a row is a flex line whose label can wrap to two
   lines, and a fixed height would clip the second one. */
.rail-row{padding-block:.6rem}
.rail-tags a{padding-block:.4rem}
footer.site a{display:inline-block;padding-block:.35rem}
/* The newspaper's own links, which the three rules above did for every other surface and
   which arrived after them. A kicker and a topic link are standalone links on their own
   line -- not words inside a sentence -- so the inline-text exemption does not cover them,
   and they measured 20px tall against the 24px minimum. inline-block because padding-block
   does nothing to an inline box's hit area. */
.fc-cat a,.front-topics a,.front-label a{display:inline-block;padding-block:.2rem}

/* Two solid surfaces separated by one hairline. With nothing dimmed, the strip of page left
   beside the open drawer read as part of the drawer itself, so the tap-to-close area was
   invisible. Faint on purpose: the drawer is a list, not a modal. */
.rail-scrim{background:rgba(0,0,0,.15)}
}

/* Copy sat behind pre:hover, and a touch screen never hovers: the button existed on a phone
   but was transparent, so copying a code block was a lucky tap. Keyed on the POINTER rather
   than the width, because a touchscreen laptop has the same problem at desktop width. */
@media (hover:none){.code-copy{opacity:1}}

/* The home indicator and the notch. Both resolve to 0px on a device that has neither, which
   is why the fallback is in the env() rather than in a second rule. */
.to-top{bottom:calc(1.25rem + env(safe-area-inset-bottom,0px))}
.rail{padding-left:calc(1.25rem + env(safe-area-inset-left,0px))}
`.trim()
