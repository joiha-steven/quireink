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

- **Highlighter:** `==text==` → `<mark data-pen=…>`; `==text==#green` adds `data-ink=…` (5 inks).
  Inline marked extension, so bold/links/code ride under one stroke; `==` may not open/close on
  space, so `x == y` is untouched. The look is CSS, never markup (`src/web/ink.css.ts`): 10 grown
  dies × 40 grips (`src/render/pen-dies.ts`), dealt per highlight by the `data-pen` hash of its own
  text — identity in the markup, appearance in the sheet. ADR 0018, amended by 0025.
- **Underline & ring:** `++text++` → `<u data-pen>` (graphite pencil; `#green` picks a
  ballpoint-strength ink) and `@@word@@` → `<mark data-form="o" data-pen>` (red ballpoint). Same
  grammar guards, same hash-dealt dies; the ring is two fixed-width caps plus a stretching middle
  so its end curves never flatten on a long word. Owner toggles `features.penUnderline` /
  `features.penRing` flip the CSS only — cached bodies never re-render. ADR 0026.
- **Mathematics:** `$$…$$` / `\[…\]` display, `$…$` / `\(…\)` inline. Temml renders LaTeX to
  **MathML at render time**, so a reader downloads no script, no sheet and no font for it. The TeX
  is never parsed as Markdown (`a_1` would become emphasis). `$…$` carries Pandoc's three guards
  so `$5 và $10` and `$5-$8` stay money — the failing sentences are tests. A formula Temml cannot
  parse falls back to the escaped source with no colour of its own. `src/web/math.css.ts` adds one
  rule that matters: the block scrolls so the page never does. ADR 0020.
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

## The printed page — `src/web/print.css.ts` (inlined into `public.css.ts`)

- **What:** a post printed, or saved as PDF, gets the essay and nothing else. There was no
  `@media print` rule anywhere in the repository until 2026-08-24 — measured, zero across
  twelve sheets — so paper got the screen: the reading-progress bar, the site bar's
  [search] [dark] [palette] [menu] controls, a book-mode link that does nothing on paper,
  then the related posts, the whole comment thread, the subscribe card and the footer. Ten
  sheets for a four-page piece, with four dead buttons at the top.
- **What survives:** the masthead as one line of provenance, the article, its footnotes, its
  tags. Nothing else.
- **The rules divide into three:** what a screen needs and paper does not (removed), the
  palette a sheet of paper actually has (a dark-mode reader gets ink on paper rather than a
  black page), and the breaks a page has to respect — no heading orphaned at the foot, no
  table, figure or code block cut in half, code wrapped rather than losing its right-hand
  end, and an off-site link printing its address so a paper copy is still a lead.
- **The owner's type settings come with it**, at the size they chose: the measure is set for
  paper rather than for a viewport. **The pen marks keep their colour** — they are the reason
  a page off this site looks like this site.
- **No separate stylesheet and no `media="print"` link.** `PRINT_CSS` is appended inside
  `public.css.ts`, so it ships in the one sheet the page already downloads and costs a reader
  no extra request. Held by `src/web/print.test.ts`.

## Copy a quote — `src/assets/js/quote.ts`

- **What:** select text inside a post and one control appears — **Copy quote**. It puts the
  sentence on the clipboard with a link that opens the post *at that sentence*, scrolled to
  it and highlighted by the reader's own browser.
- **Not a share button.** Nothing is sent anywhere, no account is involved and no third party
  is contacted: the link is an ordinary URL with a `#:~:text=` fragment, so a browser that
  does not know the trick simply opens the post.
- **On a phone it sits BELOW the selection**, which is where the operating system's own Copy
  menu is not.
- **The link stays readable.** The obvious way to build one percent-encodes every non-Latin
  letter, which turned a Vietnamese sentence into two hundred characters of hex — a URL
  fragment carries UTF-8 as it is. Escaped instead: whitespace, the three characters this
  syntax reserves (`-` `,` `#`), `%` first so the escapes cannot escape each other, and
  `&` `"` `<` `>` `` ` `` so a URL that lands in HTML somewhere cannot open a tag. A long
  quote is anchored on its two ends rather than carried whole, each end trimmed back to a
  whole word.

## The way onward, and the way back — `src/web/article.ts` (`features.readNext`), `src/assets/js/resume.ts` (`features.resume`)

Both owner-approved 2026-08-27, both default **on**, both toggled from the Reading card.

- **Read next** ends every post with ONE pointer forward: the next part of its series when
  there is one (labelled `readNextSeries`), else the ADJACENT post — the **older** neighbour
  first, because the index is newest-first and a reader who just finished this post is walking
  back through the archive; only the oldest post points toward newer. It sits after the
  taxonomy rule and before Related: a whispered label (`.read-next-label`, small role) and the
  title as the only thing at reading size (`--fs-h3`). Server markup — costs the bundle
  nothing. Route tests in `src/web/read-next.test.ts`.
- **Resume** keeps the reader's place in THEIR browser and nowhere else
  (`localStorage`, `quire:resume:<pathname>`, 90 days): past 1.5 viewports a position is worth
  keeping, past 92% the post counts as finished and is **forgotten** — "continue where you left
  off" at the end of a text is not memory, it is nagging. Returning near the top raises one
  pill, bottom centre, that scrolls back on click (instant under `prefers-reduced-motion`) and
  withdraws once the reader scrolls >200px on their own: scrolling IS the answer. The localized
  prompt rides `<body data-resume-prompt>` only when the feature is on — no words, no island.
  It cannot collide with the to-top button: the pill requires `scrollY < innerHeight`, the
  button the opposite. Cost ~1.1 KB in `post.js` (budget 15,800 → 17,000, reason recorded in
  `scripts/build-assets.ts`).

## Book reading mode — `src/assets/js/book.ts`, `features.bookMode`

- **What:** an opt-in "Chế độ đọc sách" link on the post meta line (after the reading time)
  opens the article as a **fullscreen two-column book spread**, paged horizontally and with a
  soft fade between spreads. Gated by `features.bookMode` (default **on**; the "Reading
  features" card in Admin → Settings → **Reading**). **Posts only** (the toggle is emitted
  from the post branch of `src/web/article.ts`).
- **The reader sets the type size.** The a/A pair in the overlay chrome moves `--type-scale` between
  0.85 and 1.35 in 0.05 steps, persisted per browser under `quire-book-scale` and written as an
  INLINE override, so a reader who has never touched it follows whatever the sheet ships. The
  sheet's own default is **1.05** (it was 1.15 until 2026-08-21). Every change re-measures: a
  bigger glyph is fewer lines per column, which is a different page count.
- **Not the Fullscreen API — a `<dialog>`.** Escape, focus trapping and the inert background come
  from the browser instead of from this file, so **desktop and iPad behave identically** and there
  are no Safari fullscreen quirks. Scroll is locked with `body:has(.book-overlay[open])`.
  **A phone gets in through a floating button**, not through the meta line: both server-rendered
  entries hide under 767px (the meta line is cramped there), which left the one width whose
  one-page mode works with no way to open it. `.book-fab` is a twin of the to-top circle one slot
  up the same column, on the same scroll trigger, and the stylesheet keeps it off desktop.
  **Always paper**
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
  column. Advancing is one **transform on the flow** plus a 130 ms crossfade — the browser has
  already done the pagination, and re-implementing it is how this becomes a measurement loop that
  fights the layout engine. Recomputes on resize. The base page keeps normal scroll, so **SEO,
  a11y and find-in-page are untouched**.
- **It was `scrollLeft` until Chrome 148, and that is worth knowing before you "simplify" it
  back.** The engine stopped treating a multicol's overflow columns as scrollable overflow —
  measured on the fixture, `flow.scrollWidth` 3,964px against `viewport.scrollWidth` 279px, and
  an assigned `scrollLeft` snapping straight back to 0 — so every instance showed "1 / 1" of
  every article with dead arrows and no error anywhere. It also stopped **painting** those
  columns, so a translated flow came up blank paper past page one. Hence two things in
  `book.ts`: the turn is a transform, and the flow is explicitly width-sized to hold every
  column as a real box. The count reads `flow.scrollWidth`, never the viewport's. Two tour
  flows pin it, desktop and 375px, because 57 green flows said nothing while this was broken.
- **Media** stays column-width (no full-bleed) and is capped to one page height (`--book-page-h`)
  with `break-inside: avoid`, so images/code/tables never overflow a spread. `--font-reading`
  drives the body; all colours are theme tokens. Respects `prefers-reduced-motion` (no fade).
- **A spread is TWO pages only while two pages can hold words.** Below `MIN_COLUMN * 2 + COL_GAP`
  the reader drops to **one** page, `viewport[data-pages="1"]` hides the centre spine, and the
  page count divides by one instead of two. The spread used to be an unconditional two, which at
  390px meant two 119px columns of about ten characters each. A phone reaches that state **on
  purpose** now, and a narrow window that still shows the rail reaches it too: the rail is
  subtracted from the footprint, so the spread can be far narrower than the window.
  Pinned by `shell.test.ts`.
- **A phone is not a narrow desktop, and the chrome says so.** Under 640px the page margin is
  20px a side rather than the desktop's 48 (which took a quarter of a 375px screen), the
  mouse-sized hover arrows retire, and the turn is a **swipe** (48px of travel, 1.5× more
  sideways than down, so an ordinary reading scroll never turns a page) or a **tap in the outer
  thirds** — links stay links, and the middle third is left for a thumb to rest on. Under 520px
  the running head goes silent rather than stammering three letters into the size buttons.
- **The running head reserves room for the page count**, which lives in an absolutely positioned
  box and therefore takes part in no layout. Without the reservation the centred title ran under
  it and printed as `owning your ow1 / 5`. **The reservation is twice the box**, because the
  head is centred and half of whatever it is allowed grows rightwards: reserving the box once
  let a long title run under the size pair again the day it was widened. 540px since 2026-08-27.
- **The chrome is three things, and is spaced to say so** (2026-08-27, owner's report: "thiếu
  trực quan, xấu vô cùng"). The size pair is a small `a` and a large `A`, **plain glyphs on the
  paper, on one shared baseline** — the size difference is the whole label. The pill-and-rule
  cut that preceded it read as buttons (the owner's second complaint), and wore a "black seam"
  on first paint: `showModal()` focuses the first focusable element, and the pill's
  `overflow:hidden` cropped that focus ring to a single dark line between the two halves.
  Initial focus now lands on the stage via `autofocus` (tabindex −1, no outline), so keyboard
  focus rings survive on every control without one being worn at open. The page count sits
  18px away, and the close button 26px further, as a round target that fills under the pointer.
