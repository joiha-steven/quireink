# Admin surfaces

## Trash (soft delete) — Admin → Trash (`/admin/trash`)

- **Every delete is a soft delete.** `posts`/`pages`/`media`/`files` each have a nullable
  `deleted_at` (NULL = live, timestamp = trashed). `deleteX()` sets `deleted_at`; nothing is
  hard-deleted on a normal delete. EVERY live read filters `.is('deleted_at', null)`
  (index/search/getPost, page index/getPage, media/file lists, the finalize sweeps) so trashed
  items leave the site, lists, search, sitemap/feed/llms and the libraries at once.
- **The way IN is the editor's Attributes panel** (`components/TrashLink.tsx`), beside History
  and View post, and only for a piece that has been saved. It went missing between 2026-08-17
  and 2026-08-30: the old content table's `RowActions` carried the trash icon and the
  `DELETE /api/{posts,pages}/:slug` behind it, and neither was rebuilt when the Write screen
  became two panes (`b4459b4`). For thirteen days and four releases the admin could reach
  `/admin/trash` and had no way to put anything in it — reported from outside as issue #60.
  **Every tour flow that touched the trash called the endpoint directly**, which is why 2,100
  green tests and a 61-flow browser tour all missed it; there is now one that clicks the
  control. The confirmation says the piece can be brought back, because this delete is soft —
  the strings it replaced (`confirmDeletePost`/`confirmDeletePage`) said it could not be
  undone, which was never true of this endpoint.
- **Media/file soft delete KEEPS the blob** — a published post linking a trashed image keeps
  rendering; the blob is removed only on purge. So `/api/media/delete` no longer purges the page
  cache (it used to). A trashed row **keeps its slug** (still reserved via `ensureSlugFree`) so
  restore never collides.
- **Purge-in-use guard:** a media `purge`/`empty` first checks `usedMediaKeys()` (posts + pages +
  revisions + settings); if any target image is still referenced it returns `in_use:<n>` (409) and
  `TrashView` re-asks with a stronger confirm, retrying with `force:true`. Stops a purge silently
  breaking a live page.
- Per kind the lib exports `restoreX`, `purgeX` (hard delete: row + revisions/blobs),
  `getTrashedX`, `emptyXTrash`. The Trash page server-loads all four lists; `TrashView` (4 tabs)
  acts via **`POST /api/trash`** `{ kind, action: restore|purge|empty, ids? }` (owner-gated) then
  `router.refresh()`. **Nothing auto-purges** — permanent removal is manual (per-item or Empty
  trash). Restore and purge are writes like any other, so each clears the whole page cache
  (Invariant 1); there is no per-surface invalidation to get wrong.
- Adding a mutating trash action → log it (activity actions `*.restore` / `*.purge` /
  `trash.empty`) and keep the i18n keys in sync.

## Admin Help — `/admin/help`, `HelpGuide` + `HelpSections` + `HelpTables`

- The in-admin manual. **Body copy is ENGLISH by design** (it mirrors the repo docs, which are
  canonical); only the nav label + page title come from `adminT`. It is a lazily loaded route in
  the admin SPA like any other, so a reader of the public site never fetches it.
- Shape: a numbered **first-five-minutes** path (the order a new blog is actually set up in, each
  step a link), a **jump index** of chips, the reference **sections**, then two lookup **tables**.
  The index is kept in the same order the sections render, so a chip's position predicts where it
  lands.
- Sections are laid out in **CSS columns, not a grid**: the cards differ wildly in height and a
  grid aligns rows, leaving a dead gap under every short one. Each `Anchor` carries
  `break-inside-avoid` so a card is never sliced across the column break.
- The tables are the reason the page is worth opening: **Markdown** (the syntax beyond CommonMark —
  callouts, footnotes, embeds) and **Troubleshooting** (symptom → fix, e.g. the 465-vs-587 TLS pair
  that produces an opaque OpenSSL "wrong version number", and Cloudflare caching HTML so a reader
  cannot refresh a stale page away).
- Split across three files purely to stay under the 400-line cap: `HelpGuide` (shell),
  `HelpSections` (reference cards), `HelpTables` (the two lookups), sharing `help-kit.tsx`.
- **Adding a feature? Add it here too** — the page is the only place a non-technical owner learns
  the feature exists.

## Admin UI kit — `src/admin/components/kit.tsx`

- ONE source of truth for shared admin chrome so no page hand-rolls its own (radius /
  padding / shadow / header size used to drift): `Card` (canonical `CARD` surface, plus a
  `panel` mode for a card living INSIDE a sheet), `PageHeader`, `Tabs` (`lg` underline +
  `sm` segments, with a `dense` modifier), `StatCard`, `EmptyState`, and table tokens
  (`TableFrame` / `THEAD` / `TROW`). The one-sheet page itself lives in
  `components/sheet.tsx` — `SHEET`, `SheetTop`, `NumBand`, `SHEET_FOOT`, `SHEET_TOOL` —
  with `.paper-cols` (two newspaper columns) in `admin.css`; see "One sheet per page" in
  `docs/admin-design.md`. Admin is monochrome plus the product's own PEN BOX, and each ink
  keeps the meaning it has on paper: highlighter marks where you are (the rail's current row,
  the active tab) and search hits; red ballpoint dresses what destroys something and nothing
  else. A selected VALUE is not a place, so it stays on the ink pill — `where-you-are.test.ts`
  fails a chooser that reaches for the highlighter. The kit uses the neutral scale, not public
  theme tokens.
- **Admin canvas:** `<main>` in the admin layout carries `.admin-canvas` (`src/admin/admin.css`) — a flat,
  quiet neutral surface (one fill per light/dark mode); the sidebar + cards sit on solid surfaces
  above it. (The editorial redesign replaced the old dotted-grid canvas — see
  `docs/admin-design.md`.)
- **Sidebar (`AdminSidebar`):** four destinations + "Everything else" (which remembers an
  explicit open/close across sessions). Two registers that must not dress alike: nav rows
  wear `SIDEBAR_NAV`, the footer's CONTROLS (theme, Clear cache, Sign out) wear the
  smaller `SIDEBAR_UTIL`. The collapse/expand control sits at the TOP next to the
  wordmark (a compact chrome button, NOT a nav row) so it can't be mistaken for Sign out;
  Sign out sits alone under its own divider. The "Show icons" switch (bottom of
  Everything else) governs the whole rail's glyphs. Palette selection was REMOVED from
  the admin chrome — it lives on the public site now; the admin only toggles light/dark,
  and that menu opens upward inside the rail (the rail carries `z-30`: `sticky` makes it
  a stacking context the content would otherwise paint over).

## The Write screen (Admin → content)

- `/admin/content` IS the two-pane Write screen (ADR 0024; the Writing Desk mock): the
  write pane — one stream of posts and pages, most recently touched first — beside an
  empty sheet inviting the next piece. Opening a row swaps the sheet for that piece's
  editor; the pane rides along on both editor pages from `xl` up.
- `WritePane` renders; `useWritingItems` owns the stream: title+terms filtering, the
  debounced body search (`/api/admin/search`, hits marked with the pen), five scopes on
  one dense row (All · Pages · Posts · Published · Draft — kind and status are two
  families, and the pane's own short `scope*` strings keep five words on one line in six
  languages), and the sort cycle (last-updated / date-created). The date beside
  "Published" is the PUBLICATION date; a draft's only honest date is its save.
- Taxonomy and Series open as right-hand `SlideOver`s from the pane's tool line —
  `TaxonomyManager`: rename (merge) / remove terms across all posts → `updateTerm`.

## Activity log + Overview (Admin)

- **Activity log:** every mutating route calls `logActivity(action, detail)` (post/page CRUD,
  media/file/icon/font, settings, taxonomy, cache.clear, backup.*). Gated by
  `features.activityLog`. Admin → Log (`getActivity`, latest 200 newest-first, Clear).
  **Adding a mutating route → log it too.** The frozen tree wrapped these in Next's `after()`;
  there is no equivalent here and none is needed — the promise is simply not awaited and the
  runtime keeps running.
- **Error log (same table):** `errorHandler()` in `src/web/api.ts` — the one handler every route
  falls through to — calls `logActivityError("METHOD /path", message)`, recording an
  `error`-action entry (gated by the same toggle). So unexpected server failures show up in the
  log, rendered as the inverted (ink-on-ink) chip in `ActivityLog.tsx` — the admin is
  monochrome, so "error" is the one chip printed in reverse. Only genuine errors land here
  (validation 400s use `fail()`).
- **Overview (`Overview.tsx`):** the admin home. A header with a **New post** action, five **stat
  cards** — Posts / Pages / Comments / Images / Storage (each links to its section; Comments = sum of
  `countsByPosts()` when comments are on) — then the **dashboard widgets** (`DashboardWidgets.tsx`): a
  **Traffic** card (30-day views + visitors with an inline sparkline + last-7-days, from
  `getAnalytics(30)`), **Most viewed** (top 5 posts/pages by all-time views, `getViewTotals` mapped to
  titles), and **Needs attention** (**draft count only** — unused-media is deliberately excluded, too
  heavy to compute per load; no "pending comments" — comments publish on submit). Below that a **Recent
  activity** list (latest few from `getActivity`, gated by `features.activityLog`, "view all" → Log) and
  a one-line **system footer** — DB reachability · storage · a **View site** link, from `getSystemInfo()`.
- **The editorial redesign** removed the old home-page duplicate cards (SEO health, traffic sources,
  quick-actions row, taxonomy breakdown, and the rich system panel) — that data lives on its own pages
  now; only the compact footer remains. See `docs/admin-design.md`. (`Overview` still declares the
  `seo`/`sources` props, now unused.)
- **Help / Guide:** Admin → Help (`/admin/help`, `HelpGuide.tsx`) — a concise, sectioned index (writing,
  settings, self-host, Cloudflare, cache/ops, MCP) linking out to the repo docs. **Content is English by
  design** (canonical, like the docs); only the nav label + title are localized (`navHelp`).
  Add a section here (not a new i18n dump) when a subsystem needs owner guidance.
- **Analytics:** Admin → Analytics (24h/7d/30d/1y); a View column on the content tables
  (`getViewTotals`). The **overview** shows five headline metrics — views, visitors (with
  **period-over-period trend** + a **new-vs-returning** split), **avg time on page** (dwell), avg
  read depth, and a **bounce rate** (single-page-visit share) — a **dual-series time chart** (views
  + visitors, an SVG in `analytics-kit.tsx`; the year range buckets by month, 24h by hour), a **top
  pages** table (each row links to its drill-down), **sources** (traffic **channels**
  Direct/Search/Social/Referral + top external referrers), **audience** (countries + **device /
  browser / OS**), and the **read-depth distribution**. Referrers/countries/channels/facets count
  **distinct visitors** (one person = 1, not page views). **Per-page drill-down** (`?path=`,
  `AnalyticsPageDetail`) repeats the trend + sources + depth for a single URL. (A **CSV export** of
  the daily series sat in the page header until 2026-08-30. It went because nobody wanted the file:
  a chart is the artefact here, and a two-column dump of it is not.)
  - **Every piece, not the busiest ten** (`PieceIndex`, 2026-08-30). The top-pages table stays the
    screen's default face — it answers "what is doing well" — and underneath it sits the complete
    index: one row per post and page, filterable, each linking to that piece's drill-down. Until it
    existed the ONLY door into a piece's own figures was a row in the top ten, so the fortieth piece
    could not be looked at even though its screen and its numbers were already built. Deliberately
    unranked and **uncapped** (a "top 50" would put the same wall one row lower); capped in HEIGHT
    only. Pieces with no views in the window are listed at zero — read by nobody is an answer — which
    is why `pieces` is joined to `titles` on the client rather than on the server. There is a second
    door in the editor itself (`EditorLinks`), on the same condition as View post.
  - **Left quickly** — on the drill-down, the share of measured leaves that were a glance: under ten
    seconds, **or** under a quarter read (`QUICK_MS` / `QUICK_DEPTH`, the latter deliberately the
    same boundary as the first bar of the read-depth split, so two numbers on one screen cannot
    disagree). It never shows without the sample count beside it, exactly as Delivery's bytes do:
    a leave sample exists only when the browser delivered the beacon, so the denominator is not the
    view count.
    ⚠️ **The beacon used to drop the entire bounce cohort.** `depth()` is 0 on a long article nobody
    scrolled, and the leave beacon refused to send at depth 0 — so a reader who arrived, looked and
    left in four seconds sent no sample, while everyone who stayed long enough to scroll sent one.
    Every figure drawn from `analytics_scroll` was therefore an average over the people who did NOT
    bounce: **average time on page and average read depth both read high, by construction.** Fixed
    2026-08-30 (`src/assets/js/track.ts`). Both averages fall on any install after the fix, and the
    lower numbers are the true ones; rows recorded before it are still missing that cohort, which is
    what the sample count beside the share is there to expose.
  - **Right now:** a live strip under the range tabs — distinct visitors over the trailing five
    minutes and the pages they are on (`getRightNow`, polled every 10 s via
    `/api/admin/view/analytics-now`; the poll pauses while the tab is hidden). No socket: the flush
    buffer holds writes for at most 2 s, so one indexed five-minute scan is already honest to real
    time.
  - **Timezone:** time buckets are truncated in the site's zone — **Settings → Site →
    Timezone**, falling back to the `ANALYTICS_TZ` variable and then to UTC — so "days" line
    up with local midnight rather than with UTC. Since 2026-08-22 that one setting is the
    whole site's clock and not just this chart's: it also decides the date printed under
    every post, which until then was read off the SERVER's timezone and therefore changed
    if the site moved machine. The daily
    series emits **every bucket, zeros included** — a quiet day is a point on the chart, not a gap.
  - **The window is whole days, aligned to that zone** (`windowStart`), so a 30-day range is
    thirty full columns and not thirty-one with a sliver at the left. It used to start at
    `now - 30 days`, an instant in the middle of a day: the leftmost column then covered only
    the hours after it while carrying a whole day's label, so it read as a collapse in traffic
    that had not happened — and it shrank all day and reset at midnight, because its width was
    the time of day. The LAST column is still partial, and that one is honest: today is not
    over. The **previous-period** comparison uses the same elapsed length rather than a full
    extra day-count, so a part-finished today is not measured against a whole yesterday.
  - **Three numbers were wrong until 2026-08-30**, all found by reading the queries against
    what the labels claim and all measured on a live blog before and after:
    - **Bounce rate** asked `count(*) = 1` — one EVENT, not one page. A reader who opened one
      post and reloaded it, or came back to the same post later, was dropped from the count, so
      the rate read low by exactly the people who bounced twice. Now `count(distinct path) = 1`.
      Measured over 30 days: **41% shown, 48% true.** (It remains a share of VISITORS over the
      window, not of sessions — there are no sessions in this schema — so someone who bounced in
      March and again in April is one bouncer, not two.)
    - **Channels double-counted.** The beacon sends a referrer only when it is EXTERNAL, so every
      page after the first writes `referrer_host = NULL`, and `channelOf(null)` is `direct`.
      Anyone who arrived from somewhere and read one more post was in that channel AND in Direct.
      A bare row now speaks only for a visitor with no external referrer anywhere in the window.
      Measured over 30 days: the bars summed to **229 for 197 visitors**, Direct carrying all 32
      of the excess; they now sum to 197 exactly and Direct falls 164 → 132.
    - **`0s` and `0%` for a page never measured**, printed in the top-pages table beside pages
      printing `2m 10s`. `TopPage.avgDepth` / `avgDwellMs` are `null` when there is no sample and
      the table prints an em-dash. This became load-bearing with the beacon fix: an unscrolled
      leave now records depth 0, so zero is a real reading and cannot also mean "no reading".
    - Ordering gained a name tiebreak everywhere (`order by … desc, path|country|name`), so rows
      on equal counts stop reshuffling between loads.
  - **Tablets, which the user agent cannot describe.** iPadOS 13+ identifies as Macintosh Safari
    on purpose, so until 2026-08-30 every iPad counted as a desktop Mac — measured over 30 days
    on a live blog: 117 desktop, 80 mobile, **0 tablet**. Multi-touch is the whole of the
    difference and it exists only in the browser, so the view beacon sends `touch` and `parseUa`
    reads a touching **macOS** agent as `tablet` / **iPadOS**. Gated on macOS deliberately: a
    Windows touchscreen laptop is a desktop and its string says so. Nothing new is stored — the
    same two coarse columns, with the right values — and a reader on cached JS or with scripting
    off is bucketed exactly as before. Expect tablets to appear gradually as the old bundle
    falls out of browser caches.
  - **Referrer hosts are folded for display** (`canonicalHost`): plumbing labels (`www.`, `m.`,
    `l.`, `lm.`, `out.`, `away.`, …) peel off, so `l.facebook.com` and `m.facebook.com` count as one
    `facebook.com` row — folded on the (host, visitor) pairs, so one person through two doors is
    still one visitor. Identity subdomains (`news.google.com`) survive; the stored rows keep the
    raw host.
  - **Audience** columns (`device`/`browser`/`os`) are **coarse UA buckets** parsed at insert
    (`src/analytics/ua.ts`) — the raw user-agent is never stored, so no fingerprint (same stance as
    the salted visitor hash). **Dwell** = ENGAGED ms on the page, metered by
    `src/assets/js/track.ts` alongside the scroll depth: the clock runs only while the tab is
    visible and the reader has scrolled, typed or moved within the last three minutes, and the
    aggregates clamp every stored sample at 30 minutes (`DWELL_CAP_MS`) so the wall-clock samples
    recorded before the meter existed cannot drag the average — one forgotten 24-hour tab was worth
    ~3 minutes of "average time on page" on a real instance.
  - **Delivery** (2026-08-29) answers what a blog costs to serve, and both halves are labelled
    for what they are NOT. **Page weight** is `analytics_scroll.bytes`: the reader's own browser
    sums `transferSize` across Navigation and Resource Timing and sends it on the LEAVE beacon,
    beside the dwell, because a view row is written while the page's fonts and pictures are still
    arriving. It is READER bytes and never server egress — a bot, a feed reader and anyone with
    JavaScript off download bytes and report none, and a CDN answers most requests without the
    origin hearing about them. NULL means not measured and is reported as such: the panel always
    shows the denominator, because `bytes` is null on every sample older than the column, on
    browsers with no Navigation Timing, and whenever `features.transferStats` is off. Clamped to
    64 MB in `recordScroll`, since the route is an open POST. **Page cache** is `cacheStats` in
    `src/server/cache.ts`, counted at the one line in `web/listing-page.ts` that decides hit from
    miss, in memory and since boot: persisting it would mean a write on the read path, on the one
    path that file exists to keep cheap. It measures the IN-PROCESS cache and only for requests
    that got past the CDN, so a blog can read low here and still be served almost entirely from
    the edge; the edge's own rate is not visible from inside the origin at all.
  - `analytics.db` gained a migration ledger on the same day, and it needed one:
    `create table if not exists` cannot add a column to a table that already exists. Steps live in
    `src/store/migrations-analytics.sql` and run through the same `applyMigrations` the content
    database uses. `src/store/schema-analytics.sql` still states the final shape, so a fresh
    install has every section without running a step. The engagement / channel / audience /
    drill-down queries live in `src/analytics/` (`summary.ts`, `aggregate.ts`, `channel.ts`,
    `page.ts`).

## The assistant (Admin → Assistant) — `src/server/assistant.ts`, `src/web/admin/assistant.ts`

- **What:** a chat box in the admin whose every ability is a tool from
  [`src/mcp/registry.ts`](../mcp.md) — the SAME surface an MCP client gets. Somebody with a
  Claude subscription connects over MCP and never needs this; somebody who put an API key in
  Settings → AI gets the same steward without leaving the admin.
- **One list, two doors, one rulebook.** The assistant cannot do anything MCP cannot, by
  construction: it holds no private tool, so a tool absent from the registry (the newsletter
  broadcast, token minting) is absent from both doors at once. That is what keeps the security
  story reviewable, and `registry.test.ts` pins the forbidden names at the registry level.
- **The loop is small on purpose:** at most 8 tool rounds per message, and **every argument is
  validated against the tool's own zod schema before the handler runs** — a model's JSON is a
  guess, not a contract. Results are truncated before they ride back.
- **No server-side conversation.** The history lives in the open admin tab and is posted back
  each turn (`POST /api/assistant`, owner-gated, capped at 60 turns). Close the tab and it is
  gone. Short memory, no web access, and as clever as the model the owner chose — the in-product
  help says exactly that rather than implying an agent.
- **It is the owner acting.** Tools run on the server under the owner's session and are logged
  like every other admin action, deletes go to the Trash, and the system prompt tells the model
  to name a destructive or bulk action and ask once before doing it.

## The admin on a phone, and on a phone that folds

The owner's readers write from phones, so this is measured rather than assumed. Audited
2026-08-28 at seven widths — 344 (Galaxy Z Fold, shut) · 360 · 390 · 412 (Z Flip, open) ·
673 (Z Fold, open, upright) · 768 · 841 (Z Fold, open, turned) — across twelve admin screens,
for three faults: anything past the viewport, anything clipped by an ancestor that hides its
overflow, and any hit area under a fingertip. Before: 8 screens overflowed, 24 controls were
clipped, 26 kinds of control were under 32px. After: **0 · 2 · 23**, and the two that remain
are a scroll container behaving as one.

- **A segmented track SCROLLS, it does not clip** (`SEGMENT_TRACK`). `overflow-hidden` makes a
  box a scroll container that no finger can move — script and focus can, a user cannot. Five
  of the eight Settings tabs sat past the edge at 390px, AI and System among them, reachable
  only by typing a `?tab=` URL. Its items also carry `shrink-0 whitespace-nowrap`, or a
  squeezed strip wraps its labels instead of scrolling — "Search & URLs" broke over three
  lines and made a 32px control 130px tall.
- **`min-w-0` on the Settings columns** (`COL`). A grid item defaults to `min-width: auto` and
  refuses to shrink below its content's intrinsic minimum, so the Layout tab pushed the page
  160px sideways at 344px and took the fixed Save bar off the edge with it. One declaration,
  every tab at exactly 0.
- **The rail waits for `lg` (1024), not `md` (768)** — see `AdminSidebar.tsx` for the numbers.
  It cost 208px of a 768px screen, which made unfolding a phone a step backwards: a Z Fold
  open and upright gave a form all 673px, and the same device turned to landscape gave it 633.
- **A table in the writing sheet scrolls on its own wrapper**, not by panning the whole sheet:
  the reader's rule moves the prose, which is right for a page you read and wrong for one you
  are typing into.
- **Controls are ROUNDED in the admin** — square corners are the public site's rule
  ([admin-design.md](../admin-design.md)). Three screens had hand-rolled their own square
  chooser (`border px-3 py-2`) instead of using the kit's segmented track; they now use it,
  which is also three fewer copies of a control the kit already owns.

## Settings (Admin → settings) — `SettingsView.tsx`

- **ONE form, ONE save button, EIGHT task-based tabs** (`site | layout | reading | appearance |
  seo | connections | ai | system`; tab state not persisted, but `?tab=` deep-links). Each tab
  answers exactly one question and prints that question under itself —
  [ADR 0011](../decisions/0011-settings-regrouped-into-seven.md) is the argument, and it was
  seven when that decision was written; `ai` joined them on 2026-08-23 when the key stopped
  being a single field and became a provider, a model and three jobs. One
  `useState<SiteSettings>` → one PUT `/api/settings`.
- **AI tab** — the provider (Anthropic / OpenAI / Gemini), the key, the model, and which jobs
  the model does on its own: `ai.altText` (describe an uploaded image), `ai.excerpt` (write the
  excerpt when a post publishes with the field blank), `ai.commentGuard` (hold spam in the
  Trash — NOTE: this one sends a READER'S comment text to the configured provider, which the
  other two jobs never do; the toggle says so in the UI, and an owner who enables it should
  say so in their privacy policy). **The key is the master switch**: with none stored, every job is off whatever its own
  toggle says. Like the other credentials it is written and never read back. The model list is
  the provider's own, with a measured default per provider (`DEFAULT_MODELS` in
  `src/server/ai-provider.ts`).
- **Footer is owner-editable** (Layout tab): `settings.footer` is limited inline markdown
  (`src/render/inline-md.ts` — **bold / italic / underline / link** only, escape-first like
  `comment-md`, link hrefs protocol-checked) authored via `FooterField` (textarea + B/I/U/Link
  toolbar + live preview). `{year}`/`{title}` tokens expand at render. The public layout renders it
  in `<footer class="site-footer">`; default keeps the "© {year} {title} · powered by Quire Ink" line.
- Controlled field groups (no own state/save), per tab: **Site** (identity only, nothing here moves
  a pixel) `SiteFields` + `BrandFields`; **Layout** `LayoutMenuFields` + `FooterField` +
  `GalleryFields` + `FigureFields` (the shape galleries take and the mat pictures wear when
  they say nothing themselves — both applied as CSS on `:root` rather than as markup, see
  [editing.md](editing.md)); **Reading**
  `PostFeatureFields` + `ListingFeatureFields` + `CommentFields` + `ActivityLogField`;
  **Appearance** `ThemeFields` (the **Default appearance** selector — `settings.defaultScheme`,
  `system` | `light` | `dark`, what a first-time visitor opens in — then the palette grid) +
  custom CSS on the left, the type stack `FontFields` (built-in
  `fontPreset` picker + `chromeFont` selector) / `FontUpload` / `TypographyFields` /
  `AdvancedFields` (Rendering card: font smoothing, IDE chrome, the **Motion** engine toggle →
  `settings.motion.enabled`, the editor **Key feedback** instrument → `settings.motion.keys`
  and its **Key volume** slider → `settings.motion.keyVolume`, which plays a key as it moves)
  on the right; **Search & URLs** `SeoFields` + `RedirectsManager`
  (an old address is a search-engine concern before it is anything else); **Connections**
  `NewsletterFields` + `CloudflareFields` + `CommentIntegrations` + `McpFields` — every credential
  here is written to the server and never read back, which is why these cards show status rather
  than values; **System** `ImportFields` (the one-time WordPress importer, a tool rather than a
  setting) + `CacheFields` + `ExportFields`. `McpFields` is the EXCEPTION to "no own state/save":
  the MCP enable toggle flows through the settings form, but its token manager has its own
  `/api/mcp/tokens` API (plaintext shown once).
- **Palette is FRONTEND-ONLY now** — the admin chrome no longer carries a `PaletteToggle` (only the
  light/dark toggle). The Appearance tab still sets the site's **default palette** + which palettes
  readers may switch between (`settings.enabledPalettes`), with a note (`themeAdminNote`) explaining
  this. The DEFAULT palette (`themePreset`) is always shown (its checkbox is locked) so the set is
  never empty. The frozen tree filtered a public `PaletteToggle` through
  `enabledPaletteOptions()`; 2.0's equivalent is the header control in `assets/js/theme.ts`
  (`palette()`, ported 2026-08-11), which renders only when two or more are enabled and reads its
  ids and translated names off the button rather than from a bundled table. It ignores a stored
  palette that is no longer enabled, falling back to the default, because that palette's CSS is no
  longer emitted. Disabled palettes stay fully editable — visibility ≠ customization. Sanitizer
  (`sanitizeEnabledPalettes`): known ids only, preset order, default forced in; a missing field
  (legacy settings) = all on. Pinned by `settings-sanitize.test.ts`.
- Tabs lay cards out `grid lg:grid-cols-2 items-start` (explicit columns, NOT CSS `columns`).
- **Save calls `router.refresh()`** so the admin shell + public header reflect the change
  immediately.
