# 0048 — The pen is a stylesheet anyone may link

Date: 2026-09-09
Status: accepted

## Context

The pen became one module with one door in 0042, and the door's own comment names the
reason: "the WordPress theme, the marketing site and an embeddable `pen.css` can each take
the whole hand without taking the blog around it." The first two exist. The third did not,
and it is the one that reaches a page that runs nothing of ours — a WordPress theme somebody
else wrote, a static site, a slide deck, a newsletter's web view.

The two sheets are already the whole contract: three elements, and CSS that paints them.
What kept them from travelling was two habits of a sheet that only ever lived here. They
hang off `.prose`, the blog's own article class; and in dark mode a highlight borrows the
blog's heading colour through a variable no other page defines.

## Decision

**`GET /pen.css` on every Quire Ink.** Both halves of the pen in one file, under the `.pen`
class instead of `.prose` — a class the host page puts on any container — with the same
`.dark`-ancestor convention for a dark page and `color: inherit` where the site's sheet
reached for its heading colour. Nothing in it assumes a variable, a font or a class of this
blog's exists on the host page. The markup is exactly what the renderer emits here:
`<mark data-pen="N">` with `data-ink` for a colour, `<u data-pen="N">`, and
`<mark data-form="o" data-pen="N">`; `N` from 0 to 79 picks the stroke, and the hash the
renderer uses to pick it is six lines a host may copy or ignore.

**In this blog's inks.** The sheet is built from the owner's ink settings, so a site that
links a particular Quire Ink's `pen.css` gets that Quire Ink's colours, and follows them.

**A stable path that revalidates.** Not a hashed, immutable URL: the point is an address
somebody writes down once. Fresh for an hour, stale for a day while a new copy is fetched,
and the compression layer's ETag turns a conditional request into a 304. CORS is open.

**The list marks stay out.** They ride the always-loaded prose sheet, hang off `ul` and `ol`
rather than an element the host chose to write, and the numerals need a font served from
here. A host that wants them is asking for the typography, not the pen.

## Consequences

- One route, one sheet builder parameterised by scope (`SITE_SCOPE`, `EMBED_SCOPE` in
  `src/pen/ink.css.ts`); the site's own two sheets are byte-identical to before.
- The file is the size of both halves: about 35 KB compressed. That is the pen, and it is a
  host's choice to take it; this blog's own pages keep linking one half at a time, and only
  where a mark is (0027).
- A public URL is a promise. `/pen.css`, the `.pen` class, the `.dark` convention and the
  three elements are the contract; changing any of them takes a note in the changelog like
  the appearance contract does (`docs/appearance.md`).
- `docs/pen.md` is the host's page: what to link, what to write, and what not to expect.
