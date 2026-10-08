// The search page's own sheet: the box with its button inside it, the tag chips and the
// "recent" list under it. Theme tokens only. NO BACKTICKS below (one template literal).
//
// `.qbox` is self-contained on purpose: the menu drawer reuses the same markup
// (`searchBox()` in search-page.ts), so nothing here may lean on the page around it.

export const SEARCH_PAGE_CSS = `
/* The box is the bordered thing; the input inside has no border of its own and the button
   sits at its right end. 44px is the touch floor, and the focus ring goes on the whole box
   (:focus-within) because the input's own outline would draw inside the border
   The 16px floor against iOS zoom is in mobile.css.ts, which lists this input. */
form.qbox{display:flex;align-items:center;min-height:44px;margin:0 0 1.5rem;padding:0 .25rem 0 .875rem;
  border:1px solid var(--c-rule);border-radius:var(--radius,.5rem);background:var(--c-bg);box-shadow:var(--well)}
form.qbox:focus-within{border-color:var(--c-accent);outline:2px solid var(--c-accent);outline-offset:2px}
form.qbox input{flex:1;min-width:0;min-height:44px;border:0;outline:0;padding:0;background:transparent;
  color:var(--c-text);font:inherit}
/* The browser's own clear button is a blue X no palette reaches (see subscribe.css.ts). */
form.qbox input::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none}
form.qbox button{flex:none;display:grid;place-items:center;width:44px;height:44px;margin:0;padding:0;border:0;
  border-radius:calc(var(--radius,.5rem) - 2px);background:transparent;color:var(--c-heading);cursor:pointer}
form.qbox button:focus-visible{color:var(--c-accent)}
form.qbox button svg{width:20px;height:20px}
/* Under the box with no query: the busiest tags as chips, then the newest posts. */
.qs-label{margin:0 0 .75rem;color:var(--c-meta);font-size:var(--fs-small);line-height:var(--lh-small);
  letter-spacing:var(--ls-small)}
.qs-tags{display:flex;flex-wrap:wrap;gap:.5rem;margin:0 0 2rem;padding:0;list-style:none}
.qs-tags a{display:inline-flex;align-items:center;min-height:2.25rem;padding:0 .875rem;
  border:1px solid var(--c-rule);border-radius:99px;color:var(--c-heading);text-decoration:none;
  font-size:var(--fs-small);line-height:var(--lh-small);letter-spacing:var(--ls-small)}
.qs-tags a:focus-visible{border-color:var(--c-accent)}
.qs-recent{display:flex;flex-direction:column;gap:1rem;margin:0;padding:0;list-style:none}
.qs-recent a{color:var(--c-heading);font-weight:var(--fw-heading,600)}
.qs-recent small{display:block;margin-top:.125rem;color:var(--c-meta);font-size:var(--fs-small);
  line-height:var(--lh-small);letter-spacing:var(--ls-small)}
/* The older, labelled form (the not-found page still draws it). */
form.search{display:flex;gap:.5rem;margin:0 0 2rem}
form.search input{min-width:0;flex:1;padding:.5rem .75rem;border:1px solid var(--c-rule);
  border-radius:var(--radius,.5rem);background:var(--c-bg);color:var(--c-text);font:inherit;box-shadow:var(--well)}
form.search button{padding:.5rem 1rem;border:1px solid var(--c-rule);border-radius:var(--radius,.5rem);
  background:var(--c-bg);color:var(--c-heading);font:inherit;cursor:pointer;white-space:nowrap}
@media (max-width:639px){form.search{flex-direction:column}}
`
