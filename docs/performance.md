> Split from CLAUDE.md — the **resource-loading law**: how fonts, CSS, and JS reach a
> reader. One rule set, applied system-wide (every language, every font preset, every
> uploaded font). Touching `src/web/layout.ts`, the font helpers in `src/content/themes.ts`,
> the `src/web/*.css.ts` sheets, or adding an island? Read this first.

# Performance — resource loading (fonts · CSS · JS)

One principle underlies all three: **a reader downloads only what the visible page needs,
when it needs it — nothing for a feature that's off, a surface they're not on, a font glyph
they won't see, or a browser they're not using.** The public money path is the reading
page; the admin is never on its critical path.

## Images — one gets priority, and it is the one in the first screen

On a post the LCP element is the title (the fonts rule below). **On the composed front page it
is the lead's picture** — measured at y=411 in a 1000px viewport and y=606 in an 812px one, so
inside the first screen on a laptop and on a phone. `front-card.ts` marked EVERY picture
`loading="lazy"`, the lead's included, which takes it out of the preload scanner's reach and
costs a round trip on the one image the page is judged by.

**The rule: exactly one image per page gets `fetchpriority="high"`, everything else gets
`loading="lazy"`** — `fetchpriority` on everything is `fetchpriority` on nothing. Three places
decide it and they now agree: the front page lead (`front-card.ts`, image kind only), the
first body image (`render/post-content.ts`, `seen === 0`), and the light site logo
(`chrome.ts`; never the dark mark, since both ship and only one can be the LCP element).

## Fonts — preload ONLY what the LCP text needs

The LCP element on a post is the **title**, set in the **reading font** (`--font-reading`).
The **chrome font** (`--font-sans`: header/footer/rail/meta/admin) is never the LCP element.
All faces are self-hosted, subset by `unicode-range`, and declared `font-display: swap`, so
the title always paints instantly in a fallback and the web font swaps in. `<link
rel="preload">` exists ONLY to remove that one swap on the LCP title — so we preload exactly
the file(s) that paint it, and nothing else.

**The rule — one place, `fontPreloadHrefs(fontPreset, language, hasCustomFont, chromeFont)`
in `src/content/themes.ts`, called once in `src/web/layout.ts`:**

| Case | Preload |
|---|---|
| Built-in reading font, latin locale (`en`, `de`) | `‹slug›-latin.woff2` |
| Built-in reading font, `vi` | `‹slug›-latin.woff2` **and** `‹slug›-vietnamese.woff2` (a VN title needs both unicode-ranges) |
| Built-in reading font, CJK locale (`ja`, `zh`, `ko`) | **nothing** — the built-ins ship no CJK glyphs, so the title renders in a system font; a latin preload it won't use only steals bandwidth |
| **Uploaded custom font** (`settings.customFont`) | **nothing** — the face is unsubsetted (whole charset, often large); a high-priority preload would contend with the render-blocking CSS and hurt LCP. It still wins `--font-reading` via `fontToCss`; `swap` covers the paint |
| **Chrome font** (Inter default, IBM Plex Mono, "reading") | **NEVER** — not the LCP element; loads at normal priority via its `@font-face` and swaps in |

### Variation axes are trimmed, not shipped whole

`wght` is clamped to 400-700 and **`opsz` is pinned to 18** ([ADR 0009](decisions/0009-pin-optical-size-axis.md)),
and the command that does it is [`scripts/ops/subset-fonts.py`](../scripts/ops/subset-fonts.py):

```
pip install fonttools brotli zopfli
python3 scripts/ops/subset-fonts.py --check    # report, write nothing
python3 scripts/ops/subset-fonts.py --write    # rebuild the files
```

It pulls the upstream faces, instances the axes, subsets to the ranges
[`src/render/font-faces.ts`](../src/render/font-faces.ts) declares, and refuses to write a
file that lost a positioning feature or a declared codepoint. Both of those guards exist
because both failures happened while it was being written: an explicit `--layout-features`
list drops `kern`/`mark`/`mkmk` and yields a font that measures 26% smaller and sets badly,
and a Vietnamese subset with no combining marks silently loses mark attachment.

For a long time this section named `scripts/subset-font-axes.py`, which has never been in
this tree. The one operation the whole font budget rests on was the one nobody could run.

The `opsz` axis doubled the two book serifs. Literata carries 42% fewer glyphs than Inter
yet was 2.2× its size, entirely because `gvar` must store deltas for every glyph across
the optical range:

| File | Before | After | |
|---|---|---|---|
| `literata-latin` | 80,660 | **37,560** | −53% |
| `literata-vietnamese` | 16,928 | **8,652** | −49% |
| `sourceserif-latin` | 83,240 | **36,160** | −56% |
| **a real preload set** (Literata + `language: vi`) | **97,588** | **46,212** | **−53%** |

That last row is the whole point: an install running Literata with `language: vi` preloads
`literata-latin` **plus** `literata-vietnamese` for the LCP, so this change takes **51 KB**
off its critical path. Any non-Latin language pairs the same way.

> ⚠️ **Measure production, not a local build.** A local `.env` points at a dev database whose
> `settings` row differs from the live one. During this work a local build reported the
> preset as Inter with `lang="en"`, which is not what the site serves. Anything that depends
> on `settings` (font preset, language, palette, enabled features) must be read off the server:
> `curl -s http://127.0.0.1:3000/ | grep -o -- '--font-reading:[^;}]*'`.

Narrowing the range instead was measured and is not competitive (`12-24` still costs
58 KB). 18 was chosen by rendering 14/18/24 side by side: body copy is 18px, so pinning at
18 leaves the body **identical** to what `font-optical-sizing: auto` produced, and body is
where reading time goes. The cost is a 36px title rendering in the 18pt design, slightly
heavier than before. `font-optical-sizing: auto` stays in the public sheet because an
uploaded custom font can still have the axis.

Hard invariants (also in [`conventions.md`](./conventions.md) typography):
- **Self-hosted only.** No runtime or build-time fetch to Google (it broke offline/CI).
  Files in `src/assets/static/fonts/`, served at `/fonts/*` by `src/web/static.ts`, subset
  `-latin` / `-latin-ext` / `-vietnamese`.
- **Never preload `latin-ext` or a specific weight.** Built-in reading fonts are variable
  (one file per subset carries every weight); `latin-ext` glyphs are rare and load on demand.
- **Never preload the chrome font**, in any config. (Regression to watch: a "no swap flash
  on chrome" instinct will try to re-add it — don't; chrome is not LCP.)
  **REVERSED 2026-07-29 for a self-hosted chrome family.** That rule was written when the
  chrome font was Inter and the fallback a system sans, so the swap was barely visible. It
  is a MONOSPACE on any site that picks one, and the header, the meta line and both rails
  re-flow when it lands. Measured at the origin, cold, 4x CPU throttle, median of five:

  | | LCP | CLS |
  |---|---|---|
  | no chrome preload | 472 ms | 0.0004 on four runs of five |
  | chrome face preloaded | **472 ms** | **0 on all five** |
  | Inter preloaded by mistake (44 KB unused) | 632 ms | 0.0004 |

  Free in LCP, and it removes the shift. The third row is the trap: `getChromeFont` falls
  back to Inter for an unknown id, which is right for the font STACK and costs 160 ms as a
  preload. `chromeFont: 'reading'` preloads nothing extra — it is the reading face again.
- Changing which subsets exist? Keep `fontPreloadHrefs`, the `@font-face` `unicode-range`
  blocks (`src/render/font-faces.ts`) and the served file list (`src/web/static.ts`) in sync.

## CSS — one hashed sheet, plus the settings inline

**Measured 2026-07-29.** The whole stylesheet used to be inlined into every page. That
removes one round trip on a COLD visit and charges for it on every visit after: of the
48.7 KB assembled per page, **42.6 KB (13.8 KB gzipped) was byte-identical everywhere**
and only 6.1 KB (1.7 KB gzipped) actually varied with the owner's settings. Reading three
articles re-sent 41 KB of gzipped CSS carrying one page's worth of information, and none of
it could be cached, because it was not a resource.

So the two halves are split at exactly that seam:

| Half | Where | Cost |
|---|---|---|
| Static rules (`PUBLIC_CSS`) | `<link rel="stylesheet" href="/assets/site.‹hash›.css">` | one request, `immutable` for a year; the hash changes when the bytes do |
| Settings (fonts, `--shell-w`, rail geometry, palette, type roles, custom CSS) | inline `<style>`, immediately AFTER the link | ~1.7 KB gzipped per page |

The order is the load-bearing part: the inline block is allowed to WIN, so it has to come
second, exactly where it sat when the two were one string.

Measured after (origin, `127.0.0.1`, median of three cold loads): HTML per page **60.3 KB
→ 20.7 KB** on the home page and **65.0 KB → 25.4 KB** on a post; the sheet is discovered
at ~11 ms and done at ~18 ms; LCP 100 ms home / 132 ms post; CLS 0. A loopback measurement
cannot price the extra round trip a real network charges on the FIRST visit — that is the
cost this trade accepts, and it is paid once.

### The sheet is minified before it is hashed

**Measured 2026-07-30**, against the live site: the served sheet was **65,645 bytes raw, of
which 34,438 were comment text** — 52% of it — and 20,903 bytes compressed. These sheets are
commented the way the rest of the codebase is, and that is worth keeping; it was worth
keeping in the `.ts` file rather than on the wire. `web/css-min.ts` strips comments and
collapses whitespace once at module init, and `PUBLIC_SHEET` hashes the MINIFIED bytes:
**30,811 raw / 6,519 compressed**, a saving of 14.4 KB on every cold visit, which is more
than the whole JavaScript budget for a page.

The minifier is hand-written and string-aware because two things in this sheet break a naive
one, and both break it silently:

- **A quoted string may contain anything.** The book-mode paper grain is a `data:image/svg+xml`
  URI full of spaces and slashes; `content:"("` exists too.
- **Whitespace is load-bearing next to a colon and inside `calc()`.** `.book-flow :is(img,…)`
  is a DESCENDANT selector, and deleting that one space silently rewrites it to
  `.book-flow:is(…)`, which matches something else. So whitespace collapses to nothing only
  beside `{ } ; ,` and to a single space everywhere else.

It found a bug on the way in: `ide.css.ts` carried a paragraph of prose with a closing `*/`
and **no opener**, so a browser read the prose as a selector, failed, and discarded the rule
that followed it — seven selectors meant to darken every count and date under the IDE chrome,
which had therefore never applied. `check:css-literal` now counts `/*` against `*/` in every
sheet, because nothing about that failure was visible: no error, no log, and the sheet reads
correctly in the editor.

**The check DISCOVERS the sheets; it does not keep a list of them.** It used to, and the
list went stale three times — the third time it reported "ok (6 sheets)" while `front.css.ts`
and `utility.css.ts` had never been read, and a backtick in one of them was caught by the
type checker instead. `check:type-roles` had the same list and the same hole (`mobile.css.ts`
was never in it). Both now scan `src/web/*.css.ts`, so a new sheet is covered the moment the
file exists, and the old rule "add a new sheet to the check in the same commit" is gone
along with the way to forget it. `type-roles` keeps ONE exclusion, `login.css.ts`, because
the sign-in page renders with no base sheet and a role reference there resolves to nothing.

### A fourth sheet: the phone

`web/mobile.css.ts` is appended LAST, after the islands and the IDE chrome, because several
of its rules win on a specificity tie alone. The seam is a real one rather than a split at
the line limit: a phone is not a narrow desktop. It carries the 16px floor on form controls
(below that, iOS Safari zooms the page on focus and the site's small role is 14px),
thumb-sized padding on the drawer rows and the tag cloud, `@media (hover:none)` for the
copy-code button that was invisible on touch, a faint scrim behind the drawer, and the
`env(safe-area-inset-*)` offsets. Nothing in it matches above 639px, so the desktop keeps
the geometry it was measured into — verified by measuring the same element at both widths.

### Dark before the island runs

`.dark` is applied by `assets/js/theme.ts`, a DEFERRED module — so for the length of one
paint the page is whatever CSS alone can decide, and the sheet had no `prefers-color-scheme`
rule at all (measured: 0 of 429). `system` is the default mode, so **every reader whose
machine is dark was shown a white page on every navigation.**

The handoff is `data-theme` on `<html>`:

- `themesToCss` emits `@media (prefers-color-scheme:dark){:root:not([data-theme]){…}}` after
  the base tokens. `:root:not([data-theme])` is 0,2,0 — above `:root` and `[data-palette=…]`,
  and never in a fight with `.dark`, which only exists once `data-theme` does.
- The island sets `data-theme` to the RESOLVED `light`/`dark` on its FIRST apply, not only
  when the reader picks something. `system` and `time` are questions; the attribute has to
  be an answer or the CSS cannot use it.
- `color-scheme` rides along, which is what makes the scrollbar and the form controls follow
  the page instead of staying light under a dark one.

Nothing server-rendered sets `data-theme` and nothing may: the page cache is keyed by URL
alone ([invariant 1](invariants.md)), so a server-rendered mode would be the first visitor's
mode for everyone.

The honest cost: a reader who explicitly chose LIGHT on a dark machine now gets the inverse
flash, for exactly as long as the dark reader used to get theirs. That moves it off the
common case and onto the rare one. Removing it altogether needs an inline script, which this
project does not have anywhere and asserts it does not.

## The two sheets — a reader never loads admin CSS

The split is now by implementation, not by a scanner's `@source` list, which is what
[ADR 0008](./decisions/0008-hand-written-css-no-tailwind-public.md) bought:

- **Public** — hand-written `src/web/*.css.ts`, assembled into `PUBLIC_CSS` and served as
  the one hashed sheet above. No Tailwind, no scanner, so an admin utility cannot leak into
  it by accident.
- **Admin** — `src/admin/admin.css`, the only Tailwind in the project, compiled by
  `scripts/build-admin.ts` and served under `/admin/assets/*`. A reader never requests that
  path, so its size is the owner's problem alone.

`PROSE_CSS` is the one sheet both need, so it is defined once in `src/web/prose.css.ts` and
appended to the admin bundle by the build (Tailwind cannot import a TypeScript module).

**Rule:** an admin-only rule never goes in a `src/web/*.css.ts` sheet.

### The admin's size is the owner's problem, but not on every load

Not budgeted (ADR 0006) — but "the owner pays it" is not the same as "the owner pays it
again every time". Two things were wrong and both are cheap:

- `main.js` (194 KB) and `admin.css` (68 KB) are the two files Bun does not hash, and they
  went out `no-cache` with **no validator at all**, so 262 KB came down on every admin load
  while the twelve hashed chunks beside them were `immutable` and free. They are now served
  under a fingerprinted URL — `main.<hash>.js`, `admin.<hash>.css` — computed in
  `web/admin/spa.ts` from the bytes, because `[name]-[hash].js` is already the CHUNK pattern
  and the chunks are also called `main-…`. The bare names still serve, and still revalidate.
- The shell linked the entry and nothing else, so the browser found the module graph one
  level at a time. Measured on the dashboard: **four waves, at 4 / 13 / 24 / 31 ms** — on
  localhost, where a hop costs a millisecond; on a real connection, four round trips of blank
  screen. `spa.ts` now walks the entry's STATIC imports transitively at startup and emits a
  `modulepreload` for each. **Three waves**, and the six boot chunks start with the entry
  rather than after it. The two that remain are the lazy route and its own deps, which is
  what code-splitting by route means.

Dynamic imports are deliberately NOT preloaded: `import("./Content-hash.js")` is a screen the
owner may never open, and preloading all fourteen would trade one problem for a worse one.

## JS — ship only what's used, only when it's used

1. **Two bundles, and a budget in a test.** `core.js` on every public page, `post.js` added
   on an article; `scripts/build-assets.ts` builds both from `src/assets/js/` and FAILS the
   build when either passes the byte budget written beside it. There is no framework
   baseline to hide inside, which is the point of the whole rewrite.
2. **Every island gates itself on its own DOM hook** and returns immediately when it is
   absent — `toc()` on `.toc`, `lightbox()` on the images, `comments()` on the block. A
   feature the owner turned off renders no markup, so its island costs one failed
   `querySelector`. Nothing is feature-gated at build time, because there is nothing to
   split.
3. **Heavy libs stay off the reader.** `@tiptap`/ProseMirror, `shiki`, `turndown` and
   `marked` are admin-only or run server-side (Shiki highlights at save time into
   `render_cache` → zero client JS). Never import one from `src/assets/js/`.
4. **No third-party analytics/tag JS on the reader.** Built-in cookieless analytics only
   (`track.ts` → `/api/track`). (Edge injections — e.g. Cloudflare Web Analytics / Bot JS
   Detections — are a dashboard concern, not code, and are redundant here.)
5. **Scroll-reveal is pure CSS first.** `.reveal` cards ease in via `animation-timeline:
   view()` — zero JS on Chromium. The fallback in `core.js` covers ONLY browsers without
   scroll-timeline, and is gated on `motion.enabled`.

## Navigation: prefetch every link, prerender on hover, zero runtime JS

Every public HTML response carries a `Speculation-Rules` header pointing at
`/speculation-rules.json` ([`src/web/speculation.ts`](../src/web/speculation.ts), set in
[`src/web/cache-headers.ts`](../src/web/cache-headers.ts)). Two rules, because the two
speculations do not cost the same thing:

| Rule | Eagerness | Trigger | Cost |
|---|---|---|---|
| `prefetch` | `eager` | every matching link on the page | ~20 KB gzipped of HTML, no render |
| `prerender` | `moderate` | pointer rests on a link ~200ms | a full document plus its JavaScript |

**Why prefetch was added on 2026-07-31.** `moderate` alone starts its work only after a
200ms hover dwell, which on a normal hover-and-click leaves no time at all: measured from a
Vietnamese home connection that day, TTFB through the CDN is **~145ms on an edge HIT and
~185ms on a miss** (against ~65ms straight to the origin, which is in Vietnam — the CDN
routes VN readers to the `HKG` PoP). The prerender was still in flight when the click landed,
so readers waited out the whole round trip and the feature looked broken. Prefetch pays that
round trip *before* the reader decides.

`prerender` stays on `moderate` for the reason it always was: at `eager` a reader who scrolls
past ten cards has paid for ten full renders. Hover earns that cost; being in the viewport
does not. The honest cost of `eager` prefetch is a listing pulling ~400 KB it may never use;
Chrome caps prefetch at fifty documents and drops them under Save-Data.

**Chromium only.** Safari and Firefox ignore Speculation Rules entirely and navigate cold.
There is no fallback and deliberately so: the only ones available are a JS pjax layer or a
service worker, and both cost more than the 80ms they would recover here. What helps those
browsers is shortening the round trip itself, not speculating over it.

**A header, not an inline `<script type="speculationrules">`.** The frozen tree used the
inline form. 2.0 ships no inline script on the public site, which is what lets the
recommended CSP omit `unsafe-inline` from `script-src`, and an inline speculationrules block
is governed by `script-src` like any other. The header keeps both.

Excluded from BOTH rules: `/admin/*`, `/api/*`, `/uploads/*`, `/preview/*`, `/og*`, plus
`[rel~=nofollow]` and `[download]` links. A prefetch of `/preview` burns a token exactly as a
prerender does. The header itself is only set on a public HTML 200, so the owner's surfaces
never offer it at all.

> This shipped on 2026-07-29 and was absent before then, while both this file and
> `spec/04-frontend.md` described it as present. What the port DID carry over was
> `whenActivated` — the guard that exists only because a prerendered page runs its JS at
> speculation time. A guard with nothing to guard against is the quietest possible way for a
> feature to be missing.

> **RULE: a prerendered page runs its JavaScript at speculation time.** Any island that
> writes, measures time, or beacons **on mount** must be wrapped in `whenActivated()`
> (`src/assets/js/activation.ts`), which defers it to the `prerenderingchange` event. A
> discarded prerender never activates, so the work never happens.
>
> The tracking beacon and the dwell timer are already wrapped: without it, one hover would
> record a pageview for a page nobody opened, and the dwell timer would count the
> speculation wait as reading time. Analytics rows are kept forever, so this class of bug
> is not self-correcting. Adding a new on-mount side effect? Wrap it.

## Verify (no browser needed)

- **Reader JS size:** `bun run build:assets` prints each bundle's bytes against its budget
  and exits non-zero when one is over. That is the check; there is nothing to diff by hand.
- **What a reader loads:** `bun run start`, fetch a post, extract `<script src>` + `<link
  rel=stylesheet>`; confirm one sheet, `core.js` + `post.js` and nothing else, and the
  correct font preloads for the site language.
- **Critical path / LCP:** Lighthouse "Network dependency tree" — the chain should be HTML →
  public CSS → (at most) the reading font's language subset(s). No chrome font, no unused
  subset, no admin CSS.

