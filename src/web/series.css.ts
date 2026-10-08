// THE SERIES BOX at the top of a part (markup: `web/series-box.ts`).
//
// Split from `public.css.ts`, which sits at its line limit. Each look restyles the box in its
// own sheet; this one is the base they start from.
//
// A bordered card at the TOP of the post: part 3 of 6 comes BEFORE reading. The name is the
// card's title in heading ink, the part indicator stands right-aligned on the same row, a thin
// segmented bar under them shows how far along it is, and the current part wears the rail's own
// 2px accent "you are here" bar in the list.
//
// THE HEAD IS ONE ROW OF TWO, and it is the NAME that gives way: it has a basis of its own and
// may shrink and wrap inside its box, while the indicator is held on one line. Only when the
// card is too narrow for even that does the indicator drop under the name, still on the right.
//
// NO BACKTICKS anywhere below: check:css-literal enforces that.
export const SERIES_CSS = `
aside.series{border:1px solid var(--c-rule);border-radius:var(--radius,.5rem);padding:1.25rem 1.5rem;
  margin:2rem 0 0;font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
aside.series .series-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;
  gap:.1rem .75rem;margin:0 0 .6rem;color:var(--c-meta)}
aside.series .series-name{flex:1 1 9rem;min-width:0}
aside.series .series-name a{font-weight:var(--fw-heading,600)}
aside.series .series-part{flex:none;margin-left:auto;white-space:nowrap;font-weight:400;
  color:var(--c-meta);font-variant-numeric:tabular-nums}
/* Decorative (aria-hidden): one segment per part, the read ones and the current one filled. The
   columns share the row equally, so a long series stays ONE row and its segments only narrow. */
aside.series .series-bar{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);
  gap:4px;margin:0 0 .9rem}
aside.series .series-bar-dense{gap:2px}
aside.series .series-bar i{display:block;height:3px;background:var(--c-rule)}
aside.series .series-bar i.on{background:var(--c-heading)}
aside.series ol{margin:0;padding:0 0 0 1.25rem}
aside.series li + li{margin-top:.65rem}
aside.series li a{color:var(--c-meta);text-decoration:none}
aside.series li a:hover{color:var(--c-heading)}
aside.series li[aria-current]{position:relative;color:var(--c-heading);font-weight:var(--fw-heading,600)}
aside.series li[aria-current]::after{content:"";position:absolute;left:-2.75rem;top:3px;bottom:3px;
  width:2px;background:var(--c-accent)}
`.trim()
