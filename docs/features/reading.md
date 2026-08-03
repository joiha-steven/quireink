# Reading and discovery

## Reading & discovery

- Features `{ search, toc, related, readingTime, progressBar, activityLog, sidebar, leadPost,
  categoryLabel, deck, bookText, infiniteScroll, gridView }` (all default on EXCEPT `bookText` and
  `infiniteScroll`, which are off; Admin → Settings → Tính năng); gated in header / `/search` / post page.
  `bookText` = book-page typesetting on the post body (first-line indent + justify ≥600px). `gridView` =
  the reader's grid/list header toggle (`GridToggle`); off hides the button AND the no-FOUC script ignores a
  stored `list=grid`, so every listing stays a list (and the infinite-scroll timeline, hidden in grid, always shows).
- **Sidebar** (`sidebar`): the MAIN (listing) sidebar has two layouts, chosen by `settings.sidebarLayout`
  (**Settings → Site → Layout & menu**): `single` (default) = one left rail with every block stacked
  (full-width column); `two` = **TWO gutter rails on desktop** flanking a narrower reading column
  (listing column = 80% of the post width, via `--shell-w`; the extra compactness pulls both rails in) —
  the two-rail geometry/CSS is emitted ONLY in this mode. **Left rail** = discovery: **most viewed** (auto: top
  `settings.mostViewedCount` public posts by all-time views — default 3, `0` hides it —
  `getViewTotals()` joined to `getPublicPosts()`) + **featured** (owner-curated `settings.featured`
  slugs, in order, first 5, dropped when a slug stops being public). **Right rail** = navigation:
  **menu** (`SidebarMenu`, moved out of the header) + **categories** (a condensed wrapped cloud with
  post counts in parentheses — `CategoryCloud`, `getPublicTaxonomy()`) + **tags** (`TagCloud`). On
  **mobile** there is ONE gutter-less drawer: the left rail is hidden and its two blocks
  are duplicated into the right rail's drawer (`.drawer-only`), giving the order menu → most viewed →
  featured → categories → tags. Assembled in `ListingSidebar` (two `<Rail className="rail-left|rail-right">`
  reusing `IndexBlock`/`CategoryCloud`/`TagCloud`); the geometry (per-page breakpoint + column width + right-rail mirror)
  is injected from `src/render/rail-css.ts` (`singleRailCss` for the layout's default/post ToC rail,
  `listingRailCss` for the two rails — the latter uses higher-specificity `.rail.rail-left|right` so it
  wins without ordering games). Each block self-hides when empty. **Post/page reading views show ONLY the
  `toc`** in a single left rail (full width; the free right gutter stays for wide images). Below the rail
  breakpoint the drawer opens from the **header menu button** (`RailToggle`, mobile only; self-hides on
  pages with no rail) — no separate header dropdown. **The menu is on the header row ONLY where no
  rail can hold it** — today the composed front page alone (`siteMenu` in `web/chrome.ts` behind
  `ChromeOptions.menuInHeader`, `.site-menu` from 60rem up). It briefly rendered on every page, which
  doubled the links on every listing; reverted 2026-08-03. Trade: a desktop ARTICLE has no menu, its
  rail being the ToC. Below 60rem only the drawer has it. Menu + most-viewed count + featured are edited in
  **Admin → Settings → Site → Layout & menu**; `getViewTotals` (`src/analytics/summary.ts`) reads
  `analytics.db` directly and returns `{}` on any error, so a broken analytics database costs the
  block, not the page.
- **Infinite scroll** (`infiniteScroll`, off by default): on every listing (home / category / tag) the
  feed reveals posts on scroll instead of paginating, and a **date timeline** fills the right gutter. The
  whole published list is handed to the `InfiniteListing` client island as light metadata (no bodies), so
  revealing more is pure client work — no network; the first `postsPerPage` chunk still server-renders for
  SEO, and `/page/[n]` URLs 404 (would be duplicate content). The left rail is forced to its single-rail
  branch (all blocks stacked); the right gutter holds a **date timeline** — but NOT a boxed widget: a spine
  runs the full height of the feed (`.post-list::after`) and the FIRST card of each month/year carries a
  timeline. The feed is grouped by year (`.tl-yr`): each **month**'s first card carries a `.tl-mark` (round
  `--c-meta` dot + month name) absolutely positioned in the gutter and scrolling with the post, while the
  **year** is a STICKY header (`.tl-year` = a 0-size gutter anchor; `.tl-year-tag` = a compact `fs-h3` number
  + accent dot on a `--c-bg` background) that pins to the top of the gutter while its year's posts scroll and
  is pushed out when the next year's group arrives — the tag's background masks months sliding up under it.
  A year's own first month is skipped (the sticky year covers it). Dates line up with the posts on the left —
  **no JS, no measurement** (`PostCard`'s `month` prop + CSS `position:sticky`; geometry from `timelineCss`).
  The spine is the same faint `--c-rule` hairline as the sidebar dividers; dots are round (an explicit
  exception to the site-wide square-corners rule). No post counts, no click nav. Its breakpoint is much LOWER
  than the sidebar's (a short date label needs only a thin gutter — `colWidth + 2*(gap+130)`), so it shows on
  normal laptops. **Desktop list view only**: below the breakpoint there is no gutter (markers + spine
  `display:none`), and the **grid view** hides them AND dissolves the year groups (`.tl-yr{display:contents}`)
  back to a plain card grid. The `reveal` card easing is pure CSS so appended cards animate for free.
- **Lead post** (`leadPost`): the newest post on home page 1 takes the `h1` role, the rest stay `h2`.
  Sizes come from the type roles, so the display size is an Admin → Appearance setting, not CSS.
- **Category label** (`categoryLabel`) and **standfirst** (`deck`, the excerpt under a post title).
- `/search` — **two layers:** a lean local index (`GET /api/search/index`, `{slug,title,date,terms}`,
  instant + accent-insensitive) merged with `GET /api/search?q=` (SQLite FTS5 over title + BODY via
  `searchPosts`, `posts_fts match ?` joined back to live published rows). **NOTE:** FTS5 is accent-
  *sensitive* — accent-insensitivity comes from the local layer only. The header search is a
  `<dialog>` overlay opened by `src/assets/js/search.ts`; the `/search` route stays for deep links
  and no-JS.
- Post page: back-to-top, ToC and related posts (`getRelatedPosts`: shared tags ×2 + categories).
  The reading-progress bar is CSS (`animation-timeline: scroll()`), not an island. There is no
  loading skeleton: a page is rendered on the server and sent in one piece, so there is nothing to
  stream into.
- `Toc` shows whenever a post has headings OR an in-page jump (`showToc` in the page; renders
  nothing otherwise). When the post MIXES levels (H2 + H3), top-level rows get `.rail-lead` (a bigger
  `•` dot marker via `::before`) and child rows get `.rail-sub` (smaller, no dot) — so it reads as a
  few big markers over quieter children; the dot is inline so it flows for both rail orientations. An
  all-H2 or all-H3 ToC stays uniform. In the gutter rail the ToC is sticky (`.rail-inner`); `railCss`
  caps it to the viewport with `overflow-y:auto`, so a ToC longer than the screen scrolls inside its own
  box instead of pinning its tail off-screen (the drawer already scrolls via `.rail`). Header: clickable **"Tiêu đề"** (`tocTitle`) that scrolls to top when there
  ARE headings, else a plain non-clickable **"Mục lục"** (`tocIndex`). One line under it joins the
  present tags/categories/comments labels (comments prefixed with their server-rendered count) and
  jumps to the first existing section via `TOC_ANCHORS` + `scroll-mt-24` targets. Collapsible on
  every viewport — pinned in the desktop gutter, and on mobile it shares the sidebar drawer (opened
  from the header menu button, mobile only), outside-tap/Escape-dismissable. Solid page background;
  `post-content.ts` assigns slug ids. Phones get wider side gutters for the reading text.
- **Heading ids are de-duped** (2nd `foo` → `foo-2`): `dedupeHeadingIds`
  (`src/render/post-content.ts`) and `extractHeadings` (`src/utils.ts`) run the SAME counter over
  H2/H3 in document order — change one, change both or the ToC anchors break.
- **Link hrefs are sanitized** (`safeHref` in `post-content.ts` drops `javascript:`/`data:`/`vbscript:`)
  — marked v5+ no longer does. Raw HTML in markdown is already escaped (the `html` renderer →
  `escapeHtml`), so `<script>`/`<img onerror>` render as visible text.
- **Draft preview:** `/preview/:slug?key=<hmac>` (`src/web/preview.ts`), sent
  `cache-control: no-store` and `x-robots-tag: noindex, nofollow`, and never entered in the page
  cache. `previewToken` = HMAC(slug, `serverSecret('preview-link')`) — **not** `AUTH_SECRET`,
  which left with next-auth and, while the code still read it, silently keyed every token with
  the empty string. The editor's "Preview draft" button saves pending edits first, then opens the
  URL in a new tab. The separate route is what keeps `/:slug` published-only, with no branch in it
  that a token could reach.

## Footnotes + music embeds — `src/render/footnotes.ts`, `src/render/video.ts`, `src/render/post-content.ts`

- **Footnotes:** `text[^id]` + `[^id]: definition`. `prepareFootnotes` (pre-marked) pulls the
  definitions out and swaps each reference for a private-use placeholder (so marked leaves it
  alone and the html-escaping renderer can't touch it); `applyFootnotes` (post-marked) turns
  placeholders into `<sup class="fnref">` links and appends `<section class="footnotes"><ol>`
  with back-links. Numbered by first reference; a `[^x]` in a fenced code block is masked and
  ignored; a ref with no def stays literal; an unreferenced def is dropped. Definition text →
  `renderInlineMarkdown` (escaped). CSS: `.fnref` / `.footnotes` / `.fn-back` in `src/web/public.css.ts`.
- **Spotify / Apple Music:** `videoEmbed` recognizes `open.spotify.com/{track,album,playlist,
  episode,show}/…` and `music.apple.com/<cc>/{album,playlist,song,music-video}/…` and returns
  the official `/embed` URL. `buildVideos` renders these as an `audio-embed` (fixed 175px frame)
  instead of a 16:9 `video-embed`. Plain `<iframe>` like the video embeds — NO third-party
  script, so no CSP change (the CSP sets no `frame-src`/`default-src`, so iframes are allowed).
  The Apple Music URL is quote-guarded against an `src` breakout.
## Highlighter + callouts + copy-code — `src/render/ink.ts`, `src/render/post-content.ts` (`buildCallouts`), `src/assets/js/code-copy.ts`

- **Highlighter:** `==text==` → `<mark>`; `==text==#green` → `<mark data-ink=…>` (5 inks). Inline
  marked extension, so bold/links/code ride under one stroke; `==` may not open/close on space, so
  `x == y` is untouched. Ink `src/web/ink.css.ts`; 3 shapes = a setting, CSS not markup. ADR 0018.
- **Callouts:** write a blockquote whose first line is `[!NOTE]` / `[!TIP]` / `[!WARNING]` /
  `[!IMPORTANT]` / `[!CAUTION]`. `buildCallouts` (a post-process on marked's HTML) rewrites it to
  `<div class="callout callout-<type>">` with a bold label; an unknown `[!FOO]` or a plain quote
  is untouched. Styling is monochrome (accent left-border + label) to stay on the palette — no
  semantic colours. CSS in `src/web/public.css.ts` (`.callout`, `.callout-label`).
- **Copy-code:** `codeCopy()` in `post.js` attaches a "Copy" button to every `.prose pre`. Shiki
  highlights server-side at save time, so the button is the one part that has to be added in the
  browser.
- **Deferred:** X / Instagram / gist embeds (need third-party widget scripts + CSP allowances).

## Series / collections — `src/content/series.ts`, `/series/:slug`

- **A series is a name + order on the post**, not a table: the `series` (text) and
  `series_order` (int) columns on `posts`. A post belongs to at most one series. Assign it in
  the editor (Settings panel: a Series field with a datalist of existing names + an Order
  number shown once a series is set). `getAllSeriesNames` feeds the autocomplete (incl. drafts).
- **Ordering** (`orderSeries`, pure — in `src/content/series-order.ts`, kept db-free so both the
  server and the admin can import it): `series_order` ascending, then date
  ascending — so a series reads oldest-to-newest / lowest-order-first. `getSeriesForPost(slug)`
  returns the ordered PUBLIC siblings + the current index (a draft/scheduled part never shows).
- **Series box** (`src/web/article.ts`) renders at the top of a post when its series has >1 public
  part: a `Part n/total` line linking to `/series/:slug` and the ordered list of parts (current
  part highlighted, not linked). Colours are theme tokens only (`border-rule`, `text-meta`,
  `text-heading`, `link-accent`).
- **Admin management** (Content → **Series** tab, `SeriesManager.tsx`): every series (incl.
  drafts) built from the dashboard's post index via `seriesEntries` (pure) — no extra fetch.
  Per series: **rename** (across all its posts, merges on collision) / **remove** (clears
  `series`+`series_order`, posts untouched) / **reorder** parts with up-down arrows. Each action
  POSTs `/api/series` (`updateSeries` / `reorderSeries`, owner-gated) then `router.refresh()`.
  `series_order` is otherwise set per-post in the editor's Settings panel.
- **`/series/:slug`** lists a series in the owner's order and is never paginated: a series is read
  front to back and is not a timeline. Slug derived with `slugify` and reverse-resolved by
  `resolveSeries` (like categories/tags). Held in the page cache like every other public page, so
  an admin save empties it along with everything else (Invariant 1).

## Book reading mode — `src/assets/js/book.ts`, `features.bookMode`

- **What:** an opt-in "Chế độ đọc sách" link on the post meta line (after the reading time)
  opens the article as a **fullscreen two-column book spread**, paged horizontally with the
  arrow keys / on-screen arrows and a soft fade between spreads. Gated by `features.bookMode`
  (default **on**; toggle in Admin → Settings → Features). **Posts only** (the toggle is emitted
  from the post branch of `src/web/article.ts`).
- **Not the Fullscreen API — a `<dialog>`.** Escape, focus trapping and the inert background come
  from the browser instead of from this file, so **desktop and iPad behave identically** and there
  are no Safari fullscreen quirks. Scroll is locked with `body:has(.book-overlay[open])`. Hidden
  below the iPad width (`@media (max-width: 767px)`), so mobile never shows it. **Always paper**
  — the `::backdrop` and the overlay's own tokens are a warm-paper palette regardless of the site
  theme or dark mode; closing restores the page's own tokens.
- **Opened from `[data-book-open]`,** and ALL matches are bound: an article carries two toggles
  (the meta line above the title and the info panel in the right gutter) and exactly one has a box
  at any given width, so binding only the first left the button dead on whichever layout lost.
  A **drop cap** opens the first paragraph (`.book-flow.prose > p:first-child::first-letter`).
- **How it paginates:** the reader **clones** the already-rendered `.prose` markup (Shiki
  highlight, images, footnotes intact — no re-render), flows it into a CSS `column-width` element
  sized so the spread is exactly as wide as the site's content column at a fixed page height, and
  reads `scrollWidth` to count columns → spreads = `ceil(cols / pages)`. The flow is itself `.prose`,
  so the reading view's indents and justification apply unchanged. **Wide images
  (`figure.img-wide`) render at column width here**, so a wide image never spills into the next
  column. Advancing is one `scrollLeft` assignment plus a 130 ms crossfade — the browser has
  already done the pagination, and re-implementing it is how this becomes a measurement loop that
  fights the layout engine. Recomputes on resize. The base page keeps normal scroll, so **SEO,
  a11y and find-in-page are untouched**.
- **Media** stays column-width (no full-bleed) and is capped to one page height (`--book-page-h`)
  with `break-inside: avoid`, so images/code/tables never overflow a spread. `--font-reading`
  drives the body; all colours are theme tokens. Respects `prefers-reduced-motion` (no fade).
- **A spread is TWO pages only while two pages can hold words.** Below `MIN_COLUMN * 2 + COL_GAP`
  the reader drops to **one** page, `viewport[data-pages="1"]` hides the centre spine, and the
  page count divides by one instead of two. The spread used to be an unconditional two, which at
  390px meant two 119px columns of about ten characters each. The toggle is hidden below 767px so
  a phone does not reach that state, but a narrow window that still shows the rail does: the rail
  is subtracted from the footprint, so the spread can be far narrower than the window.
  Pinned by `shell.test.ts`.
- **The running head reserves room for the page count**, which lives in an absolutely positioned
  box and therefore takes part in no layout. Without the reservation the centred title ran under
  it and printed as `owning your ow1 / 5`.
