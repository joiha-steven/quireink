// The newspaper dialect's SHELF, cut out of `look-paper.css.ts` when that file passed the
// 400-line cap. The cut is by SUBJECT rather than by size: everything here answers one
// question — what a paper does with the navigation around a piece: the menu down the
// margin, the contents, and the series box — and it is the only block in the dialect that
// restates a layout generated somewhere else (`render/rail-css.ts`).
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
  margin:1.5rem 0 2rem;padding:0 0 1.1rem;border:0;
  border-bottom:1px solid var(--c-rule);background:none;transform:none;visibility:visible;
  overflow:visible;transition:none}
html[data-look=paper] article .rail::after{display:none}
html[data-look=paper] article .rail-inner{position:static;max-height:none;overflow:visible;
  width:auto;padding:0}
html[data-look=paper] article .rail h2{margin:0;padding-left:0}
/* THE MENU IS IN THE MASTHEAD on this look, on every page (menuInHeader in article.ts
   and listing-page.ts), so the rail's copy goes - on a listing's shelf as well as a piece's.
   Inline on a piece it was a block headed MENU between the series box and the contents: a
   paper does not print its section list in the middle of a story, and it pushed the first
   line of the text to y=980 on a 1000px screen. */
/* ONLY WHEN THE MASTHEAD HOLDS IT. The header's menu is markup the server draws for this look,
   so a page that wears the look without having been SERVED in it - a demo that swaps looks in
   the browser, a cached page from before the switch - has no masthead menu, and hiding the
   shelf's copy there left the page with no menu at all. */
html[data-look=paper] body:has(.site-bar > .site-menu) .rail-inner > nav:not(.toc){display:none}
/* AND A SHELF LEFT WITH NOTHING ON IT GOES. On a page, or a piece with its contents switched
   off, the menu was the rail's only content: with it hidden the rail still drew its margins
   and its rule, an empty 19px box and a hairline between the title and the text. */
html[data-look=paper] body:has(.site-bar > .site-menu) article .rail:not(:has(.rail-inner > :not(nav:not(.toc)))){display:none}
html[data-look=paper] article .rail ul{display:flex;flex-wrap:wrap;gap:.4rem 1.5rem}
html[data-look=paper] article .rail li,
html[data-look=paper] article .toc li{margin-top:0}
/* THE CONTENTS ARE ONE RUN OF TEXT, the way a paper's "In this article" line is: label,
   then numbered sections side by side. A column of rows was a web sidebar laid on its back,
   and it cost a line of height per section above the first word of the piece. The first
   row is the piece's own title, printed large six lines up, so it goes. */
html[data-look=paper] article .toc ul{display:flex;flex-wrap:wrap;gap:.35rem 1.4rem;
  counter-reset:tocsec}
html[data-look=paper] article .toc li{max-width:100%;margin-top:0;counter-increment:tocsec}
html[data-look=paper] article .toc li:first-child{display:none}
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
/* --- THE SERIES BOX IS A STANDING BOX ---------------------------------------
   A rounded card with a hairline all round it is a web component, and it was the one thing
   left on the page that said so. A paper sets a standing box the way it sets a section: a
   heavy rule over it, the head as small letterspaced capitals on a band of its own, a
   hairline under that, then the list. Nothing else on this page draws a corner radius, and
   nothing else should.

   Capitals by TEXT-TRANSFORM, never typed: the series name reaches the feed, the search
   result and a screen reader as the owner wrote it.

   The marker beside the part being read is the margin's CHANGE BAR, which is a printed
   convention rather than a borrowed web one - so it moves to the column edge and takes
   heading ink. It was the accent, which in this look is the link blue, and a blue bar
   beside a line of black type says the line is a link. */
/* AND IT STAYS WHERE THE MARKUP PUTS IT, over the text. For one build it was moved to the foot
   of the piece with a flex column and 'order', and the release review of 2026-09-23 measured
   what that costs: the box was drawn at y=4050 while Tab and a screen reader still met it
   straight after the byline, then jumped back up to the contents - a reading order that is not
   the visual one (WCAG 1.3.2, 2.4.3). Moving it is a markup decision, not a sheet's. What this
   sheet can do is make it short: one head band and one run of numbered parts. */
html[data-look=paper] aside.series{border:0;border-radius:0;padding:0 0 1rem;
  border-top:2px solid var(--c-heading);border-bottom:1px solid var(--c-rule)}
html[data-look=paper] aside.series .series-head{margin:0 0 .7rem;padding:.45rem 0;
  line-height:1;color:var(--c-heading);border-bottom:1px solid var(--c-rule);
  font-family:'Inter','Inter Fallback',system-ui,-apple-system,'Segoe UI',sans-serif;
  text-transform:uppercase;letter-spacing:.08em;font-weight:600}
html[data-look=paper] aside.series .series-head a{color:inherit;text-decoration:none}
/* THE PARTS ARE ONE RUN, numbered, like the contents line under it: a column of four
   rows was 200px of box between the byline and the first word. Numbered by a counter
   because a flex row drops the list's own markers. The part being read is marked the way
   the contents mark the section being read, with a rule under it in heading ink. */
html[data-look=paper] aside.series ol{display:flex;flex-wrap:wrap;gap:.35rem 1.4rem;
  border-top:0;padding:0;list-style:none;counter-reset:part}
html[data-look=paper] aside.series li{margin:0;padding:0;counter-increment:part}
html[data-look=paper] aside.series li::before{content:counter(part) ".";margin-right:.6ch;
  color:var(--c-meta);font-variant-numeric:tabular-nums}
html[data-look=paper] aside.series li[aria-current]{color:var(--c-heading)}
html[data-look=paper] aside.series li[aria-current]::after{left:0;right:0;top:auto;
  bottom:-3px;width:auto;height:2px;background:var(--c-heading)}
/* The shelf is on the page, so there is no drawer for the header button to open. */
html[data-look=paper] body:has(main > article > .rail) .rail-toggle{display:none}
`.trim()
