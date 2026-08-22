# Admin surfaces

## Trash (soft delete) — Admin → Trash (`/admin/trash`)

- **Every delete is a soft delete.** `posts`/`pages`/`media`/`files` each have a nullable
  `deleted_at` (NULL = live, timestamp = trashed). `deleteX()` sets `deleted_at`; nothing is
  hard-deleted on a normal delete. EVERY live read filters `.is('deleted_at', null)`
  (index/search/getPost, page index/getPage, media/file lists, the finalize sweeps) so trashed
  items leave the site, lists, search, sitemap/feed/llms and the libraries at once.
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
  `docs/admin-design.md`. Admin is monochrome plus ONE accent (the pen: search hits and
  work-in-progress dots) — the kit uses the neutral scale, not public theme tokens.
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
  `AnalyticsPageDetail`) repeats the trend + sources + depth for a single URL. Plus a **CSV export**
  of the daily series.
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
  - There is no migration gate on any of this in 2.0: `src/store/schema-analytics.sql` states the
    final shape and is applied at boot, so every section is present on a fresh install. The
    engagement / channel / audience / drill-down queries live in `src/analytics/`
    (`summary.ts`, `aggregate.ts`, `channel.ts`, `page.ts`).

## Settings (Admin → settings) — `SettingsView.tsx`

- **ONE form, ONE save button, SEVEN task-based tabs** (`site | layout | reading | appearance |
  seo | connections | system`; tab state not persisted, but `?tab=` deep-links). Each tab answers
  exactly one question and prints that question under itself — [ADR 0011](../decisions/0011-settings-regrouped-into-seven.md)
  is the argument. One `useState<SiteSettings>` → one PUT `/api/settings`.
- **Footer is owner-editable** (Layout tab): `settings.footer` is limited inline markdown
  (`src/render/inline-md.ts` — **bold / italic / underline / link** only, escape-first like
  `comment-md`, link hrefs protocol-checked) authored via `FooterField` (textarea + B/I/U/Link
  toolbar + live preview). `{year}`/`{title}` tokens expand at render. The public layout renders it
  in `<footer class="site-footer">`; default keeps the "© {year} {title} · powered by Quire Ink" line.
- Controlled field groups (no own state/save), per tab: **Site** (identity only, nothing here moves
  a pixel) `SiteFields` + `BrandFields`; **Layout** `LayoutMenuFields` + `FooterField`; **Reading**
  `PostFeatureFields` + `ListingFeatureFields` + `CommentFields` + `ActivityLogField`;
  **Appearance** `ThemeFields` (the **Default appearance** selector — `settings.defaultScheme`,
  `system` | `light` | `dark`, what a first-time visitor opens in — then the palette grid) +
  custom CSS on the left, the type stack `FontFields` (built-in
  `fontPreset` picker + `chromeFont` selector) / `FontUpload` / `TypographyFields` /
  `AdvancedFields` (Rendering card: font smoothing, IDE chrome, the **Motion** engine toggle →
  `settings.motion.enabled`, and the editor **Typewriter feedback** option →
  `settings.motion.typewriter`) on the right; **Search & URLs** `SeoFields` + `RedirectsManager`
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
