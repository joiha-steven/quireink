// `/archive`: the year index. Split out of `public.css.ts` on 2026-09-01, when that sheet hit
// its 400-line ceiling and this page needed work.
//
// The page is an INDEX, not a listing. Two things followed from forgetting that:
//
//   · The row titles inherited the BODY size while the date beside them was set at `small`,
//     so a single row carried two type sizes — 18.08px against 15.2px, measured on the
//     default settings under the monospace chrome, where a mono face at 18px also runs
//     visibly wider than the reading face it borrows the size from. Two hundred rows of it
//     read as a wall. A row is ONE size now, and it is the small role: this page is scanned,
//     and its own date column already said what size that is.
//   · The year jumps sat on a line of their own between the title and the first year, with
//     no rule, no label and nothing to belong to — two bare numbers floating in the gap.
//     They are the page's table of contents, so they go ON the title's line, pushed to the
//     far edge, which is the shape `.front-head` already uses for the way through to here.
export const ARCHIVE_CSS = `
/* The heading row: the page's name, and its own contents at the far edge. An auto left
   margin rather than a spacer, so the years stay at the edge and drop to their own line —
   still at the edge — when the title runs out of room. */
.arc-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.5rem 1.5rem}
.arc-head .arc-jump{margin:0 0 0 auto}

/* Rows, not cards: this page exists to be scanned, and 200 excerpts is the listing page the
   reader came here to skip. Sizes are roles, so it follows the owner's typography like
   everything else. */
.arc-jump{display:flex;flex-wrap:wrap;gap:.5rem 1rem;margin:0 0 2.5rem;
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small);
  font-variant-numeric:tabular-nums}
.arc-yr + .arc-yr{margin-top:3rem}
/* Sticky, so the year stays named through a long one; the --c-bg band is what stops rows
   sliding out from under it, the same trick the timeline's year tag uses. */
.arc-yr h2{position:sticky;top:0;z-index:1;background:var(--c-bg);
  margin:0 0 1.25rem;padding:.25rem 0;display:flex;align-items:baseline;gap:.5rem;
  color:var(--c-heading);font-weight:var(--fw-heading,600);
  font-size:var(--fs-h3);line-height:var(--lh-h3);letter-spacing:var(--ls-h3)}
.arc-count{color:var(--c-meta);font-weight:400;
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
.arc-yr ul{list-style:none;padding:0;margin:0}
/* ONE SIZE ON THE ROW, set here rather than on the parts, so the date and the title cannot
   drift apart again: the title used to inherit the body size while the date was small. */
.arc-yr li{display:flex;gap:1rem;align-items:baseline;padding:.35rem 0;
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
/* 5ch is exactly "MM-DD" in tabular figures, so every title starts on the same column
   without a table and without a fixed px width that a larger type setting would break. */
.arc-yr time{flex:0 0 5ch;color:var(--c-meta);font-variant-numeric:tabular-nums}
/* On a phone the fixed date column costs a fifth of the line and a wrapped title ranges
   under it, so the date goes above its title instead. */
@media (max-width:34rem){
  .arc-yr li{display:block;padding:.5rem 0}
  .arc-yr time{display:block}
}
`.trim()
