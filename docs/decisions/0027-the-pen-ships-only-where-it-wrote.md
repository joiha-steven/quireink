# 0027 — The pen ships only to the pages where it wrote something

Date: 2026-08-21
Status: accepted

## Context

0025 grew the highlighter ten dies and forty grips; 0026 added the underline and the ring.
Every stroke is an SVG data-URI baked into CSS — that delivery was chosen deliberately (a
mask clips the text, measured in 0018's line of work) and none of it is up for revision here.

The bill arrived in the public sheet. Measured on this change: the ink is **280 data-URIs,
266.7 KB raw, ~21 of `site.css`'s 29 KB gzipped** — the pen weighed more than every other
rule on the site combined. Every cold visit paid it and every page parse re-read it,
including the home page, the archive and every post that never uncapped a pen. The owner
toggles from 0026 made it stranger: turning a gesture OFF *added* override bytes to the
inline block while the full ink still shipped underneath.

The obvious cheapenings were all rejected as trades this repo has already refused to make:
fewer dies is less hand (the variety IS 0025's argument), coarser coordinates redraw every
stroke, and a deferred stylesheet shows bare words for a beat before the ink lands — a pen
that flickers is worse than a pen that is heavy.

## Decision

The ink leaves `site.css` and ships as **two hashed, immutable sheets of its own**, linked
render-blocking — but **only on the pages whose HTML contains what they paint**:

- `pen-marks.‹hash›.css` — the highlighter: base `<mark>` rules, forty grips, every die in
  every pigment, both modes.
- `pen-lines.‹hash›.css` — the underline and the ring.

`web/assets.ts` owns the split and the detection (`penSheetsFor`): a tag scan for
`<mark…>` / `<u…>` over the assembled page, exact rather than heuristic because rendered
bodies escape a literal `<mark` in prose to `&lt;mark`. A ring rides the mark element
(`<mark data-form="o">`), so a ringed page matches both scans and both sheets arrive —
the cascade reads exactly as it did when the ink was one string, because the links come
in the ink's old order, immediately after `site.css` and before the inline settings block.

The admin editor takes the whole pen unconditionally (`build-admin.ts` appends `INK_CSS`):
the writing surface must show every gesture before the owner has decided which ones a post
will use.

## Consequences

Measured at this change, gzipped: `site.css` **28.7 → 7.6 KB**; `pen-marks` 11.6 KB;
`pen-lines` 8.5 KB. A page with no ink drops 21 KB and ~260 KB of CSS parse; a highlighted
post pays 19.2 KB across two parallel requests — still less than the old single sheet — and
a page using every gesture pays what it paid before, split three ways and cached the same
year. Not one pixel moves anywhere: the sheets are byte-for-byte the same rules, so this is
a delivery decision, not a design one.

Costs accepted: a marked page's first visit makes two or three CSS requests instead of one
(parallel, HTTP/2, each immutable); `staleSheet`'s eleven-minute grace now covers three
names instead of one; and the sheet count is a thing `web/assets.ts` must keep honest —
the guard in `ink-default.test.ts` fails if a stroke ever leaks back into `PUBLIC_CSS`.
