// The newspaper dialect's SHELF, cut out of `look-paper.css.ts` when that file passed the
// 400-line cap. The cut is by SUBJECT rather than by size: everything here answers one
// question — what a paper does with the navigation that runs down a screen's margin — and
// it is the only block in the dialect that restates a layout generated somewhere else
// (`render/rail-css.ts`).
//
// It is concatenated back into `LOOK_PAPER_CSS`, so it ships as part of the one sheet the
// look links and every guard in `web/looks.test.ts` still reads it.
//
// NO BACKTICKS anywhere below: this is one template literal and a backtick ends it.
// `check:css-literal` enforces that, and this file is IN its list.

export const LOOK_PAPER_SHELF_CSS = `
/* --- NO NAVIGATION RUNNING DOWN THE MARGIN, ON A PIECE ----------------------
   A paper does not carry a site menu beside its text, and with the facts already moved out
   of the right-hand panel the piece was sitting against one full gutter and one empty one.
   The shelf becomes what a printed paper puts there: a contents block at the head of the
   piece, under a rule.

   ON A PIECE ONLY. A listing has no contents of its own to head, and its shelf IS the
   navigation: moved inline there it landed at y=8167, under thirty-three posts, which is
   not a menu. The hook is structural - on a piece the shelf sits INSIDE the <article>, on a
   listing it is a sibling of the feed - and deliberately not a class, because the first
   hook tried was the book-typography class, which is a SETTING: the dialect would have come
   apart silently on any blog that turned that setting off.

   These rules restate the layout the rail already takes between 60rem and the rail
   breakpoint (render/rail-css.ts). Restated rather than shared because that block is
   generated per column width inside a media query, and this one is neither. */
html[data-look=paper] article .rail{text-align:left;position:static;width:auto;height:auto;
  margin:1.5rem 0 2.5rem;padding:0 0 1.25rem;border:0;
  border-bottom:1px solid var(--c-rule);background:none;transform:none;visibility:visible;
  overflow:visible;transition:none}
html[data-look=paper] article .rail::after{display:none}
html[data-look=paper] article .rail-inner{position:static;max-height:none;overflow:visible;
  width:auto;padding:0}
html[data-look=paper] article .rail-inner > * + *{margin-top:1rem}
html[data-look=paper] article .rail h2{margin:0;padding-left:0}
html[data-look=paper] article .rail-inner > nav:not(.toc)::before{content:attr(aria-label);
  display:block;margin-bottom:.5rem;font-weight:var(--fw-heading,600);color:var(--c-heading);
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
html[data-look=paper] article .rail ul{display:flex;flex-wrap:wrap;gap:.4rem 1.5rem}
html[data-look=paper] article .rail li,
html[data-look=paper] article .toc li{margin-top:0}
html[data-look=paper] article .toc ul{display:block;counter-reset:tocsec}
html[data-look=paper] article .toc li{width:max-content;max-width:100%;margin-top:.45rem;
  counter-increment:tocsec}
html[data-look=paper] article .toc li:first-child{margin-top:0}
html[data-look=paper] article .rail-row{padding-left:0}
/* The rule under the row being read takes HEADING ink, for the reason the series box's
   change bar does: the base draws it in the accent, and in this dialect the accent is the
   link colour, so the one row in the index that is NOT a link was the only one underlined
   in blue. */
html[data-look=paper] article .rail-row[aria-current]::after{left:0;right:0;top:auto;
  bottom:-4px;width:auto;height:2px;background:var(--c-heading)}
html[data-look=paper] article .toc-end{margin-top:0}
html[data-look=paper] article .toc summary{pointer-events:auto;cursor:pointer;display:flex;
  align-items:center;gap:.5rem;margin-bottom:.6rem}
html[data-look=paper] article .toc summary h2{margin:0}
html[data-look=paper] article .toc summary::before{content:"";width:.4em;height:.4em;
  flex:none;border-right:1.5px solid var(--c-meta);border-bottom:1.5px solid var(--c-meta);
  transform:rotate(-45deg)}
html[data-look=paper] article .toc details[open] > summary::before{transform:rotate(45deg)}
html[data-look=paper] article .rail-toggle,
html[data-look=paper] article .rail-scrim{display:none}
/* THE CONTENTS CARRY THE SECTION NUMBERS, so the index and the piece agree. The first row
   is the title and the last is the jump to the taxonomy; neither is a section, so neither
   takes a number. Ranged left and tight: .rail-row spreads its children with
   space-between, which is right for a label and its count and put the number hard against
   the far edge of the rail, a thumb's width from the words it belongs to. */
html[data-look=paper] article .toc .rail-row{justify-content:flex-start;gap:.6ch}
html[data-look=paper] article .toc li:first-child,
html[data-look=paper] article .toc li:has(.toc-end){counter-increment:none}
html[data-look=paper] article .toc li:not(:first-child):not(:has(.toc-end)) .rail-row::before{
  content:counter(tocsec) ".";color:var(--c-meta);flex:none;
  font-variant-numeric:tabular-nums}
`.trim()
