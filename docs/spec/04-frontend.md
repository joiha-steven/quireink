# Frontend: CSS, islands, admin, editor

Replaces the Go plan's frontend spec. Two frontends with opposite budgets.

- **Public**: server-rendered HTML, no framework, no bundler, **zero JavaScript on an
  article page**.
- **Admin**: the existing React SPA, built once and embedded. Only the owner loads it, so
  its weight is irrelevant to readers and to SEO.

## Budgets

**The gate is per BUNDLE, in raw bytes, in `scripts/build-assets.ts`** — `core.js` 9,600
and `post.js` 11,200, each with the reason it last moved written beside it, and
`bun run build:assets` fails the build when either is passed. That file is the authority;
this section is the intent behind it.

⚠️ **A per-PAGE table stood here until 2026-08-18 claiming "target 0 KB, fail above 3 KB
(brotli)" on an article page, "enforced by a CI check".** No such check ever existed, and
the shipped article page has been roughly twice that figure since the islands landed. It
was the target written before the port, left in the present tense after the port answered
it. Aspirations belong in prose; a number that says "enforced" has to name what enforces
it.

Measured 2026-08-18 on a served article page, at the origin, exactly as a browser fetches
it — **two files and no third**, and no inline script anywhere on the site:

| | raw | gzip (what is served) | brotli |
|---|---|---|---|
| `core.js` — every public page | 9,406 | **3,681** | 3,147 |
| `post.js` — added on `/{slug}` | 11,195 | **4,383** | 3,775 |
| **an article page, total JS** | 20,601 | **8,064** | 6,922 |

The 1.x article page this replaced fetched **182 KB of JS (gzip) across 12 files**, of
which 143 KB was Next and React — the measurement in
[00-rationale.md](00-rationale.md) that ended Next.js, and past tense since the
2026-07-28 cutover. **It cannot be re-measured**: the frozen tree was removed from the
working copy ([ADR 0019](../decisions/0019-remove-the-frozen-tree-from-the-working-copy.md))
and `old.manhhung.me` no longer answers — the name still resolves and Cloudflare still
terminates TLS for it, but the edge returns **522, origin unreachable** (checked
2026-08-18). The number stands as a dated capture of a site that is gone, which is the
only thing it can now be.

Zero on an article page remains the direction and is not where this landed: back to top,
code copy, the lightbox, subscribe, comments, the contents highlight and book mode are all
real reader features and all cost bytes. What the budget buys is that each of those bytes
was argued for in a diff somebody read.

## CSS: hand-written, no Tailwind on the public site

1.x shipped one 63 KB (raw) Tailwind stylesheet covering public and admin. As shipped in
2.0 they are two sheets with nothing in common: the public one is hand-written, **42,890
raw / 8,265 gzipped**, and the admin keeps Tailwind at 80,262 / 17,241, paid by the owner
alone (measured 2026-08-18). The line here read "Currently one 63 KB stylesheet covering
public and admin" until then — the same pre-port present tense as the JS figure above.

**Public CSS is rewritten by hand**, roughly 1,000 lines, built on custom properties.
Reasons, in order:

1. **Ten-year durability.** A CSS framework is the highest-mortality dependency in the
   tree. Tailwind v3 to v4 already broke once. Hand-written CSS on web standards does not
   break, ever, by design.
2. **No build step.** The public site stops needing a bundler at all.
3. The theme system is **already** custom properties: `themesToCss` emits every palette's
   variables. Half the work is done.
4. Modern CSS covers what the framework was providing: nesting, `:has()`, container
   queries, cascade layers, `color-mix()`.

Tailwind is **kept for the admin SPA**, where its churn is contained behind a build that
only the owner's browser sees.

Delivery, as SHIPPED: the sheet is served as one hashed, immutable
`/assets/site.‹hash›.css` and only the settings-dependent half is inlined after it. This
section originally specified inlining the whole thing; measurement said otherwise, and the
reasoning is in [`../performance.md`](../performance.md) "CSS — one hashed sheet".

Conventions from `docs/conventions/` carry over unchanged and are now easier to hold:
theme tokens only, one typeface, no hardcoded sizes, one divider style, no all-caps.

## Fonts: DONE 2026-07-27, 51 KB off the critical path

The Go plan called Literata a ~107 KB LCP bottleneck. Measured against production it is
**97,588 B** (`literata-latin` 80,660 + `literata-vietnamese` 16,928, because the site runs
Literata with `language: vi`), so the claim was substantially right.

Two of the three sub-items were already implemented before this plan existed:

| Sub-item | State |
|---|---|
| Subset per script | **Already done**, `-latin` / `-latin-ext` / `-vietnamese` |
| Preload only the LCP face | **Already done**, `fontPreloadHrefs` implements exactly this rule |
| Make the file smaller | **This is where the work was** |

The find was the `opsz` axis, which doubles the two book serifs: Literata carries 300
glyphs to Inter's 518 yet was 80 KB to Inter's 36 KB, all of it `gvar` deltas across the
optical range. Pinning it at 18 gives:

| | Before | After |
|---|---|---|
| `literata-latin` | 80,660 | **37,560** |
| `literata-vietnamese` | 16,928 | **8,652** |
| **Preload set** | **97,588** | **46,212** (−53%) |

Also 180 KB off the font directory overall, since Source Serif 4 gets the same treatment.

Reasoning, the rejected alternatives, and why 18 was chosen over 14/16/24 live in
`docs/performance.md` and `scripts/subset-font-axes.py`.

**Standing rules**, unchanged and already honoured:

- Subset per script. A Vietnamese reader must not download Cyrillic or Greek ranges.
- Preload **only** the single face that renders the LCP element, never the family.
- `font-display: swap` with a metric-matched fallback so the swap does not shift layout.
- Trim variation axes before shipping a font file (`scripts/ops/subset-fonts.py`; why 18: `docs/performance.md`).

## Perceived speed: two zero-JavaScript wins

**Speculation Rules.** ✅ Shipped 2026-07-29, as a `Speculation-Rules` response header
pointing at `/speculation-rules.json` rather than the inline `<script type="speculationrules">`
this section originally specified — the public site ships no inline script, and an inline
rules block is governed by `script-src` like any other. See
[`../performance.md`](../performance.md) and [`src/web/speculation.ts`](../../src/web/speculation.ts).

`moderate` (hover) is the eagerness; `eager` prerenders everything merely in the viewport,
which on a listing page is every card. Tune against real analytics.

**View Transitions.** ❌ Not shipped. Cross-document transitions via
`@view-transition { navigation: auto }` in CSS: smooth navigation with no framework and no
client router. One rule, and it degrades to nothing where it is unsupported — but it is a
visible change to how the site moves, so it is the owner's call rather than an omission.

## The 23 islands

Each current `'use client'` component in `src/components/blog/` and its replacement.
Three eagerly loaded files, none of them bundled, each hand-written and self-contained.

```
core.js       every page      Track, ScrollDepth, RailToggle, BackToTop, SearchTrigger
listing.js    listings        GridToggle, InfiniteListing
post.js       /{slug}         only if the CSS-only routes below fail their measurement

lazy, fetched on first use:
search.js     when the search overlay opens
comments.js   when comments scroll into view
subscribe.js  when the subscribe trigger is used
reader.js     when book mode is entered
turnstile     third party, only when a comment form is opened
```

| Component | Does | Replacement | Bundle |
|---|---|---|---|
**Shipped so far (2026-07-27):** `BackToTop`, `CodeCopy` and `Lightbox` as `post.js`
(2,966 b minified, one deferred request). `ReadingProgress` was deleted as planned and is
now CSS. The bundle names below are the plan; `core.js` arrives with the analytics beacon.

| `Track` | Pageview beacon | `navigator.sendBeacon` on load | core |
| `ScrollDepth` | Max depth + dwell on leave | scroll listener + `visibilitychange` beacon | core |
| `RailToggle` | Sidebar rail open/closed | click handler + `localStorage` | core |
| `BackToTop` | Scroll-to-top button | ~15 lines | post ✅ (moved out of core: nothing else in core exists yet) |
| `RevealFallback` | Reveal on scroll | **CSS `animation-timeline: view()`. Delete the JS** | none |
| `CodeCopy` | Copy button per code block | per-`<pre>` button + `navigator.clipboard`, ~20 lines | post ✅ |
| `Toc` | Highlights the active heading | `IntersectionObserver`, or CSS scroll-driven if it measures clean | post |
| `Lightbox` | Click an image to zoom | `<dialog>`, native backdrop and Esc | post ✅ |
| `ReadingProgress` | Progress bar | **CSS `animation-timeline: scroll()`. Delete the JS** | none ✅ |
| `BookMode` | Toggle into book mode | click handler that imports `reader.js` | core |
| `BookReader` | Fullscreen 2-column overlay | the heavy one, stays lazy, rewritten vanilla | lazy |
| `GridToggle` | List vs grid | class toggle + `localStorage` | listing |
| `InfiniteListing` | Infinite scroll | `IntersectionObserver` + fetch of the next page fragment | listing |
| `SearchTrigger` | Opens search | inline, imports `search.js` | core |
| `SearchOverlay` | Overlay shell | `<dialog>` | lazy |
| `SearchClient` | Queries and renders | fetch + template literals | lazy |
| `SubscribeTrigger` | Opens subscribe | inline | core |
| `SubscribeOverlay` | Overlay shell | `<dialog>` | lazy |
| `SubscribeForm` | Posts the email | plain `<form>` + fetch for the inline result | lazy |
| `Comments` | Renders the tree | **server-rendered HTML fragment**, fetched on demand | lazy |
| `CommentsLazy` | Defers the above | `IntersectionObserver` | lazy |
| `CommentForm` | Submits a comment | plain `<form>` POST, enhanced with fetch | lazy |
| `Turnstile` | Cloudflare widget | third-party script, with the comment form | lazy |

Note the pattern: several exist as separate components only because React forces a
component boundary for state. In vanilla, the Search trio is one file and so is the
Subscribe trio.

**The 0 KB target on an article page depends on `Toc`, `Lightbox` and `CodeCopy`.** If all
three land in CSS or in `core.js`, `post.js` does not need to exist. Decide during M2 with
a measurement, not an assumption.

## Comments rendered on the server

Today the tree is fetched as JSON and rebuilt by React. In Quire 2.0 the lazy fetch
returns **rendered HTML** and the client inserts it. This removes the client-side tree
rebuild, the orphan re-rooting and the tombstone logic from the browser, since all three
already exist on the server.

## Admin: the existing React SPA, embedded

**61 of 66 admin components are already `'use client'`.** The admin is a React SPA that
happens to be wrapped in Next. So it is extracted, not rewritten.

```
1. Move src/components/admin + src/app/admin  ->  src/admin/
2. Replace the Next-isms:
     next/link       -> <a> or the router's Link      (29 sites, all files)
     next/navigation -> a small client router          (30 sites)
     next/dynamic    -> React.lazy                     (4 sites)
     next-auth/react -> the session endpoint in 06-auth.md
3. Build with Bun's bundler to admin.js + admin.css
4. Embed and serve from Hono at /admin/*
```

What this deletes from the Go plan: the Tiptap port to vanilla, the ProseMirror NodeView
rewrites for `CaptionedImage` and `VideoNode`, the toolbar and bubble-menu rewrite, and
the reimplementation of autosave, crash recovery, conflict detection and Vietnamese IME
handling. All of it keeps working because none of it is touched.

The editor features that must not regress are therefore not a risk register entry any
more; they are existing code:

- Autosave to `localStorage` only, **never to the server** — see [`../features/editing.md`](../features/editing.md)
- Crash recovery offering a newer local draft
- Conflict detection warning instead of overwriting
- Revision history (SQLite makes rows cheap, so raising the limit past 3 is now a product
  decision, not a technical one)
- Vietnamese IME with Telex

**Analytics is the one admin area worth revisiting later.** `AnalyticsView.tsx` plus
`AnalyticsPageDetail.tsx` are about 13 KB of React producing charts that server-rendered
SVG would produce with no client JavaScript and less code. Not in scope for v2.0; noted
because it is the highest-value cleanup left in the admin.

## Building

- **Public JS: `bun run build:assets`.** Three entry points (`core`, `post`, `login`) built
  from `src/assets/js/` as minified **IIFE** bundles — not ESM: they are injected as classic
  `<script src defer>`, so three ESM bundles put every top-level declaration on the global
  scope and stamped on each other. Each bundle has a byte BUDGET the build fails on.
- **Public CSS: no build.** Hand-written `src/web/*.css.ts`, assembled and minified once at
  module init.
- **Admin: `bun run build:admin`.** The admin is the only part of the project with a real
  build step, and that is the whole point of keeping it separate.
