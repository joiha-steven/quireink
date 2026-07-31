> Split from CLAUDE.md — read when touching a feature area: Trash, reading/discovery (search, ToC, related, preview), the editor, the content dashboard, activity log + system panel, or settings.

# Feature areas

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

## Homepage mode — [`docs/homepage.md`](homepage.md)

What `/` serves: the post list, a chosen page, or the composed front page. Its own file, both
because it is long and because it is the one feature somebody installing Quire Ink reads before
they have a blog to configure. [ADR 0014](decisions/0014-homepage-modes.md).
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
  pages with no rail) — no separate header dropdown. Menu + most-viewed count + featured are edited in
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

## Editor (Admin → editor) — `src/admin/components/Editor.tsx`

- StarterKit + underline, inline code, bullet/numbered/**task** lists (GFM `- [ ]`), quote,
  code block, hr, link, captioned image, GFM tables, video. `tiptap-markdown` serializes all.
- **Menus live in `EditorMenus.tsx`** (Toolbar + BubbleBar). The editor sets
  `shouldRerenderOnTransaction: true` — TipTap 3 disables it by default, which leaves every
  `isActive()` (toolbar highlights, the table-tools row) stale until an unrelated re-render.
- **Writing shell:** the title grows instead of clipping; the editor header and document frame share
  one bounded gutter; the toolbar is sticky, vertically centred, never wraps, and scrolls horizontally
  on narrow screens. Icon actions keep localized accessible names. Focusing prose must not draw a
  black outline around the document.
- **Optional typewriter feedback:** `settings.motion.typewriter` enables the block caret, subtle
  insert/delete response, and a synthesized filtered-noise key click (45% internal volume; no audio
  file). It ignores composition, modifier/navigation keys, paste, and held repeats. The master
  `settings.motion.enabled` and `prefers-reduced-motion` still gate the visual feedback; disabling
  typewriter feedback makes the editor standard and silent.
- **Images and galleries** (`CaptionedImage.tsx`): placement rides on the src fragment
  (a Markdown image whose src ends `#right-wide`) and the caption is the alt, so the node still serializes to plain
  Markdown. Two or more consecutive `#grid` images become one `.gallery`, column count by count
  (`galleryCols`). A gallery has two options of its own, also on the fragment: a **ratio**
  (`#grid-1x1`, `3x2`, `4x3`, absent = the photos keep their own shape) which crops every tile with
  `object-fit:cover` so rows line up, and **`nocap`**, which hides the captions with CSS. The alt is
  still emitted either way, so it keeps serving screen readers and search. Both options apply to the
  WHOLE run in one transaction (`applyToGallery`) rather than to the selected image, and the new
  value is decided once from the tile that was clicked so an inconsistent run heals instead of
  flip-flopping. **GOTCHA:** `groupGalleries` matches `img-grid[^"]*`, not `img-grid` exactly. An
  option appends a class, and matching the old exact string made every gallery with an option
  silently stop grouping and fall into a full-width column.
- **BubbleBar:** a floating `BubbleMenu` (`@tiptap/react/menus`) over a text selection or with the
  cursor in a link — bold/italic/underline/strike/code + link edit/remove. `shouldShow` skips node
  selections (image/video) so it never covers their own controls.
- **Tables:** insert is a 3×3 with a header row; a contextual toolbar row (shown only when the
  cursor is in a table) adds/removes columns + rows or deletes the table. The header row + left
  column are shaded with `--c-rule` (the table's own border colour) as a visual spine — the
  left-column shade is CSS-only (GFM has no header-column), so it never changes the saved Markdown.
  **GOTCHA:** list items wrap content in `<p>`; `.prose li > p{margin:0}` keeps them tight.
- **Local (offline) autosave** (`useLocalDraft.ts`): unsaved edits are stashed in `localStorage`
  every 8s while dirty — NEVER to the server, so editing a *published* post can't push
  half-finished text live; only Save/Publish writes to the server. On return, a snapshot that
  outlived its session (crash / closed tab / dropped connection clears nothing) surfaces a
  "restore / discard" bar; a successful server save clears it. **The interval alone lost work**:
  an over-scroll at the top of the editor on a phone triggers pull-to-refresh and the page
  RELOADS, and `beforeunload` does not reliably fire there — so `useLocalAutosave` also flushes on
  `pagehide`, on a `visibilitychange` to hidden, and on unmount. `beforeunload` remains the
  courtesy warning on top, not the safety net.
- Gallery insert adds all picked images in ONE `insertContent` (a per-image loop leaves only the
  last — `setImage` selects the node it inserts, so the next insert replaces it).
- Time machine: each overwrite snapshots the prior version (`revisions.ts`, keeps 3); restore
  loads it into the editor (non-destructive — current version is snapshotted on next save).

## Scheduled publishing — `src/server/scheduled.ts`, `/api/cron`, `src/utils.ts` (`isScheduled`)

- **How to schedule:** set a FUTURE publish date and hit Publish. There is no separate
  `scheduled` status — a post is "scheduled" whenever it is `published` with a date still in
  the future. The read layer already hides it: `isPublicallyVisible` (lists, search, the
  `/[slug]` page) returns false until the date is reached, so a scheduled post 404s publicly
  meanwhile. `isScheduled` is its exact complement for published posts.
- **Editor cue:** with a future date the Publish button reads **Schedule**, its toast says
  **Scheduled**, a "Scheduled for <local time>" note shows under the date field, and the live
  "View post" link is hidden (the URL 404s until it goes live). "Preview draft" still works.
- **Going live on time:** `sweepScheduled` (called from `/api/cron`) is what makes it punctual —
  it finds posts that crossed their time within a bounded lookback (`newlyLive`, a pure
  `(since, now]` window) and, when any did, calls `clearCache()`, which warms the origin and
  purges the edge behind it. The **5-min publish tick** (`/api/cron?publish=1`,
  `PUBLISH_TICK_LOOKBACK_MS` = 6 min) does this and nothing else; the **hourly** tick sweeps
  `HOURLY_LOOKBACK_MS` = 65 min as a backstop and also finalizes image variants, prunes
  `render_cache` and expired sessions, and takes a snapshot when one is due. No watermark is
  stored — an overlapping purge is an idempotent superset. Nothing inside the process calls
  `/api/cron`: an external scheduler has to, and setting one up is
  [`self-host.md`](self-host.md) §8.

## URL redirects — `src/server/redirects.ts`, Admin → Settings → SEO

- **What:** owner-managed 301 (permanent) / 302 (temporary) redirects, plus an automatic
  301 whenever a post/page slug is renamed (so existing links + search results survive a
  move). Rows live in the `redirects` table (`source` unique, `destination`, `permanent`).
- ⚠ **The rows are stored and nothing serves them yet.** Request-time resolution is a parity
  item that has not landed ([`spec/07-parity.md`](spec/07-parity.md) §2), so a redirect created
  in the admin — or auto-created by a rename — does not currently redirect a visitor. The
  frozen tree resolved it in Next's `middleware.ts`; Hono has no reason it cannot be ordinary
  middleware, and the stored rows do not change when it is added.
- **Live content always wins.** Saving a post/page at slug X deletes any redirect whose
  `source` is `/X` (`clearRedirectForPath`), so a live URL is never shadowed by a stale
  redirect and a rename-back (A→B then B→A) cannot create a self-loop.
- **Admin:** a Redirects card (list + add + delete) in Settings → SEO. `source` is normalized
  (leading slash, no query/trailing slash); `destination` is a path or an absolute http(s) URL;
  a self-redirect is rejected. CRUD via the owner-gated `/api/redirects` (+ `/:id`).

## Newsletter — `lib/subscribers.ts`, `lib/mail.ts`, `lib/newsletter-log.ts`, `api/subscribe`, `api/newsletter/*`, `api/broadcast`, Admin → Newsletter

- **Double opt-in.** `subscribers` (email unique · status pending/confirmed/unsubscribed · a
  per-subscriber `token` used for BOTH confirm + unsubscribe links). `POST /api/subscribe`
  (public, rate-limited) upserts a pending row and emails a confirm link;
  `GET /api/newsletter/confirm?token=` → confirmed; `GET /api/newsletter/unsubscribe?token=` →
  unsubscribed. The confirm/unsubscribe routes return a standalone HTML page (`resultPage`) since
  they open from an email. Re-subscribing reuses the row's token; a confirmed address short-
  circuits (no re-send, no membership leak).
- **SMTP (`lib/mail.ts`, Nodemailer).** Config lives on `integration_keys` (server-only secrets,
  env fallback) — set in Admin → Settings → Integrations (`NewsletterFields`, via `api/mail`).
  `sendMail` never throws: `{ sent:false, error:'smtp_not_configured' }` when unset, so subscribe
  still records the pending row. `isMailConfigured` = host + From present.
- **Sign-up form** (`SubscribeForm`) renders at the foot of a post ONLY when SMTP is configured
  (`getMailStatus().configured`). The same gate also puts an envelope button in the public header
  (`SubscribeTrigger`, last before the mobile drawer toggle) that opens the identical card as a
  modal (`SubscribeOverlay`, lazy — Escape / backdrop closes), so a reader can subscribe from any
  page.
- **Admin → Newsletter** (`/admin/newsletter`, `NewsletterView`) is where the list is worked;
  Settings → Integrations keeps ONLY the SMTP credentials (`NewsletterFields`, which now derives
  the TLS checkbox from the port — implicit TLS is 465, 587 is STARTTLS; the wrong pair fails with
  an opaque OpenSSL "wrong version number"). Three tabs:
  - *People* — every subscriber with their send history from the log: emails sent, failures (with
    the last error), open rate, last send. Counts + delete.
  - *Send* — tick one or MORE published posts, review the REAL `broadcastEmail()` HTML in a
    `sandbox=""` iframe (scripts/forms/navigation all blocked), then send. Several posts go out as
    ONE digest, never one email each. A post that already has successful sends needs the resend
    checkbox first; the send itself is `confirm()`-gated.
  - *Test* — the three sample sends.
- **Test send** (`POST /api/mail/test`, owner only, `NewsletterTest`). Three kinds — `smtp`
  (bare "it works" note), `post` (the broadcast, built from the newest published post, or a
  stand-in on an empty blog), `subscribe` (the double opt-in confirmation) — each built by the
  SAME builder the live path uses, so a green test means the real send works. Recipient defaults
  to the signed-in owner's address; confirm/unsubscribe links carry a placeholder token, so they
  deliberately land on the "invalid link" page. Uses the SAVED config, not the unsaved form.
- **Send log** (`newsletter_sends`, `lib/newsletter-log.ts`). `sendMail` writes ONE row per
  outgoing email — success or failure, all four kinds (`confirm`/`broadcast`/`reply`/`test`) — so
  no path can email an address without it showing up. Keyed by ADDRESS, not a subscriber FK:
  reply notifications go to commenters who never subscribed. Deleting a subscriber clears their
  rows. `statsByEmail`/`statsByPost` fold it once into the admin's columns; a failed send is not
  counted as sent, and the open-rate denominator is successful BROADCASTS only.
- **Open tracking.** A broadcast carries a 1x1 pixel at `GET /api/newsletter/open?t=` (public —
  it is fetched by a mail client with no session). The token identifies the SEND row, never the
  address, so the URL leaks no identity; the first hit wins (`is('opened_at', null)`) so a client
  refetching can't inflate the count; no IP, UA or referrer is recorded. The preview and the test
  send pass no token, so reviewing an email never counts as an open. Links are NOT wrapped, so
  there is no click tracking and every URL in the mail is the real one.
- **Manual broadcast** (`lib/broadcast.ts` `broadcastPost`, `POST /api/broadcast`). There is NO
  automatic send: the cron publishes a scheduled post on time but never emails anyone (owner's
  call — every send is previewed and pressed by hand). `broadcastPost` mails one publicly-visible
  post to every confirmed subscriber, one email each with its own open token, and stamps
  `posts.broadcast_at`. The double-send guard reads the LOG, not the stamp: posts from the old
  auto-broadcast era carry a backfilled stamp with no matching log rows, so the stamp alone would
  wrongly report them as sent. `force: true` (the admin's resend checkbox) overrides it. The route
  lives at `/api/broadcast`, NOT under `/api/newsletter/*` — that prefix is the public
  confirm/unsubscribe/pixel family and a send endpoint must stay owner-gated.
- **Comment-reply notifications** (`lib/comment-notify.ts` `notifyReply`, fired via `after()`
  from the comment POST route on a reply). Emails the parent commenter (their `author_email`) a
  link to the thread. Best-effort + transactional: skips a self-reply (same email), a deleted
  parent, and no-ops without SMTP. Never throws.
- **Email design** — `lib/newsletter-email.ts` builds every message (`confirmEmail`,
  `broadcastEmail`, `replyEmail`) through ONE `shell()`, reused by the subscribe route, the manual
  broadcast, the comment route, the admin preview and the test send. It is meant to read like the
  blog, so:
  - Identity comes from `lib/email-brand.ts` (`emailBrand(settings)`) — ONE resolver, so all four
    senders share a letterhead. It carries the owner's OWN palette
    (`getDefaultTheme(...).light`) plus the masthead logo, bundled as `EmailBrand` rather than
    four more positional arguments.
  - **The masthead is the real logo.** Neither of the site's own logo files suits an inbox: the web
    render (`logoRenderUrl`) is WebP, unrenderable in Outlook on Windows (Word engine), and the
    untouched original is frequently WebP or SVG too — so `renderLogo` now emits a **PNG twin**
    beside the WebP (`settings.logoEmailUrl`, `files/logo-<stamp>-mail.png`), rebuilt and deleted
    in lockstep with it so a stale mark can never ship. `emailLogo` prefers the twin, falls back to
    a mail-safe original (png/jpg/gif — for sites predating the twin), and only then to the site
    name as text. `alt` is the site title, because images are blocked by default in many inboxes
    and the letterhead must still read.
  - **Table layout + inline styles on every element**, 600px centred column. Mail clients strip
    `<style>` blocks, collapse margins and ignore flex/grid. Buttons are a `<table>`, not a padded
    `<a>` — Outlook drops padding on inline elements. Cover refs are made ABSOLUTE (they are stored
    store-relative and an inbox has no origin to resolve them against).
  - Light only (`color-scheme: light`): a dark variant needs a `<style>` media query, which the
    clients that most need it are likeliest to strip. No web font — a client will not load one.
  - A hidden preheader (the inbox preview line), a per-post date, and a footer that says WHY the
    reader is getting this next to the unsubscribe link (spam filters look for that pair).
  - Structure: masthead (site name) · rule · lead post (cover + 26px title + excerpt + solid
    button) · each further post (19px title + excerpt + text link, rule-separated) · rule · footer.
  All values are escaped; the reply's `contentHtml` is already-sanitized comment markdown.

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
- **Intentionally NOT supported:** X / Instagram / gist embeds (need third-party widget scripts
  + CSP allowances).

## Callouts + copy-code — `src/render/post-content.ts` (`buildCallouts`), `src/assets/js/code-copy.ts`

- **Callouts:** write a blockquote whose first line is `[!NOTE]` / `[!TIP]` / `[!WARNING]` /
  `[!IMPORTANT]` / `[!CAUTION]`. `buildCallouts` (a post-process on marked's HTML) rewrites it to
  `<div class="callout callout-<type>">` with a bold label; an unknown `[!FOO]` or a plain quote
  is untouched. Styling is monochrome (accent left-border + label) to stay on the palette — no
  semantic colours. CSS in `src/web/public.css.ts` (`.callout`, `.callout-label`).
- **Copy-code:** `codeCopy()` in `post.js` attaches a "Copy" button to every `.prose pre`. Shiki
  highlights server-side at save time, so the button is the one part that has to be added in the
  browser.
- **Deferred:** X / Instagram / gist embeds (need third-party widget scripts + CSP allowances).

## Per-post SEO + cover + dateModified — `posts` columns, `src/web/article.ts`

- **`meta_title` / `meta_description`** override the `<title>`, meta description, and OG/Twitter
  card when set (else post title + excerpt). Set in the editor's SEO section.
- **`cover_image`** is a visible hero at the top of the post AND the OG image fallback (ahead of
  the SEO-only `featured_image`). Distinct roles: featured = social-only/hidden, cover = shown.
- **Real `dateModified`**: the meta line shows "Updated <date>" only when `updated_at` is >24h after
  `date` (so a save right after publishing adds no noise). Read through `posts.ts` `rowToMeta`
  (`updatedAt` etc.). The JSON-LD half of this is **not ported** — see
  [`seo-pwa.md`](seo-pwa.md).

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

## Library: Videos tab + self-hosted video — `VideoLibrary.tsx`, `src/render/video.ts`

- The Library page has THREE tabs (`LibraryTabs.tsx`, the shared kit `Tabs`): **Images**
  (media library), **Videos**, **Files**. The Images grid has a **toolbar** (`MediaToolbar.tsx`):
  total count + size, a name **search**, and a **sort** (newest / name / size); each tile keeps a
  compact `dims · size · shortdate` caption and its copy / download / delete actions **overlay the
  thumbnail** (revealed on hover, always on touch) so they add no layout height. The grid is 5-across
  at desktop so the caption never truncates. Videos are ordinary attachments in the shared `files` store
  (same upload route `/api/files/attach`, same soft-delete) — `isVideoAttachment`
  (MIME `video/*`, extension fallback) splits them between the Videos tab (grid of
  native `<video controls preload="metadata">` players + copy URL) and the Files tab.
  No schema change; `FileUploader` takes `accept`/`label` for the video dropzone.
- **Publishing:** copy the video URL and paste it on its own line in the editor —
  content stays 100% Markdown, exactly like YouTube/Vimeo/TikTok. The renderer
  (`PostContent buildVideos`) turns a platform URL into an iframe embed and a DIRECT
  file URL (`videoFileUrl`: http(s)/root-relative + `.mp4/.m4v/.webm/.mov`) into a
  native `<video>` (`.video-file`, column width, natural aspect). The scheme gate
  means `javascript:`/`data:` can never reach `src`. The editor's Video node previews
  both forms.
- **Serving (`app/uploads/[...path]`): STREAMS from disk and honours byte ranges.**
  Video seeking — and iOS Safari playback at all — needs 206 responses; the route
  parses `Range` via `lib/http-range.ts` (pinned by `http-range.test.ts`) and pipes
  `createReadStream` into the Response, so a large video never sits in server memory
  (this also de-buffered image serving). `lib/mime.ts` maps video/audio extensions —
  without them the fallback octet-stream makes browsers download instead of play.
- **Host limits:** the reverse proxy caps upload size (nginx `client_max_body_size`),
  and proxies/CDNs (e.g. Cloudflare free: 100 MB) cap request bodies — a huge video
  fails at the edge, not in the app. For long/heavy video, a platform embed
  (unlisted YouTube/Vimeo) is still the better tool: transcoding + adaptive bitrate.

## Admin UI kit — `src/admin/components/kit.tsx`

- ONE source of truth for shared admin chrome so no page hand-rolls its own (radius /
  padding / shadow / header size used to drift): `Card` (canonical `CARD` surface),
  `PageHeader` (the title block every screen reuses — was a copy-pasted `<h1>`),
  `Tabs` (`underline` for Settings + `segment` for Content/Analytics, one component),
  `StatCard`, `EmptyState`, and table tokens (`TableFrame` / `THEAD` / `TROW`). Admin is
  monochrome by design — the kit uses the neutral scale, not public theme tokens.
- **Admin canvas:** `<main>` in the admin layout carries `.admin-canvas` (`src/admin/admin.css`) — a flat,
  quiet neutral surface (one fill per light/dark mode); the sidebar + cards sit on solid surfaces
  above it. (The editorial redesign replaced the old dotted-grid canvas — see
  `docs/admin-design.md`.)
- **Sidebar (`AdminSidebar`):** the collapse/expand control sits at the TOP next to the
  wordmark (a compact chrome button, NOT a nav row) so it can't be mistaken for Sign out;
  Sign out sits alone in the footer under its own divider. Palette selection was REMOVED
  from the admin chrome — it lives on the public site now; the admin only toggles light/dark.

## Content dashboard (Admin → content)

- 3 tabs: Bài viết / Trang / Phân loại; "new" hidden on taxonomy.
- `RowActions` (shared): open-in-new (PUBLISHED only) + edit + delete; exports the `ICON_BTN`
  chrome for reuse. `StatusPill` never wraps.
- Tables are mobile-responsive by **hiding secondary columns** (not horizontal scroll): posts
  hide Date (`sm`) + Categories (`md`); pages hide slug (`sm`). Title + Status + actions always show.
- `PostsTable` filter bar: substring search + All/Published/Draft (client-side).
- `TaxonomyManager`: rename (merge) / remove terms across all posts → `updateTerm`.

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
  log, rendered with a red badge in `ActivityLog.tsx`. Only genuine errors land here (validation
  400s use `fail()`).
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
  - **Timezone:** time buckets are truncated in `ANALYTICS_TZ` (an IANA zone, e.g.
    `Asia/Ho_Chi_Minh`; defaults to UTC) so "days" line up with local midnight, not UTC.
  - **Audience** columns (`device`/`browser`/`os`) are **coarse UA buckets** parsed at insert
    (`src/analytics/ua.ts`) — the raw user-agent is never stored, so no fingerprint (same stance as
    the salted visitor hash). **Dwell** = ms on the page before leaving, beaconed by
    `src/assets/js/track.ts` alongside the scroll depth.
  - There is no migration gate on any of this in 2.0: `src/store/schema-analytics.sql` states the
    final shape and is applied at boot, so every section is present on a fresh install. The
    engagement / channel / audience / drill-down queries live in `src/analytics/`
    (`summary.ts`, `aggregate.ts`, `channel.ts`, `page.ts`).

## Settings (Admin → settings) — `SettingsView.tsx`

- **ONE form, ONE save button, SEVEN task-based tabs** (`site | layout | reading | appearance |
  seo | connections | system`; tab state not persisted, but `?tab=` deep-links). Each tab answers
  exactly one question and prints that question under itself — [ADR 0011](decisions/0011-settings-regrouped-into-seven.md)
  is the argument. One `useState<SiteSettings>` → one PUT `/api/settings`.
- **Footer is owner-editable** (Layout tab): `settings.footer` is limited inline markdown
  (`src/render/inline-md.ts` — **bold / italic / underline / link** only, escape-first like
  `comment-md`, link hrefs protocol-checked) authored via `FooterField` (textarea + B/I/U/Link
  toolbar + live preview). `{year}`/`{title}` tokens expand at render. The public layout renders it
  in `<footer class="site-footer">`; default keeps the "© {year} {title} · powered by Quire Ink" line.
- Controlled field groups (no own state/save), per tab: **Site** (identity only, nothing here moves
  a pixel) `SiteFields` + `BrandFields`; **Layout** `LayoutMenuFields` + `FooterField`; **Reading**
  `PostFeatureFields` + `ListingFeatureFields` + `CommentFields` + `ActivityLogField`;
  **Appearance** `ThemeFields` + custom CSS on the left, the type stack `FontFields` (built-in
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
  `enabledPaletteOptions()`; 2.0 ships no reader-facing palette switcher, so that helper went with
  the component and `settings.enabledPalettes` is read by the theme island alone. The no-FOUC
  script ignores a stored palette that is no longer enabled (falls back to the default). Disabled palettes stay fully editable — visibility ≠ customization. Sanitizer
  (`sanitizeEnabledPalettes`): known ids only, preset order, default forced in; a missing field
  (legacy settings) = all on. Pinned by `settings-sanitize.test.ts`.
- Tabs lay cards out `grid lg:grid-cols-2 items-start` (explicit columns, NOT CSS `columns`).
- **Save calls `router.refresh()`** so the admin shell + public header reflect the change
  immediately.

## Comments — `src/comments/`, `src/web/comments.ts`, `src/assets/js/comments.ts`

Text-only reader comments, **off by default** (`settings.comments.enabled`). Identity is either
manual (name + email + optional website, optionally behind Cloudflare Turnstile) or a signed-in
Google account.

- **The form is a card, on the same terms as the newsletter block above it** (border, radius and
  padding all match `.subscribe-card`). Until 2026-07-31 it was the one thing on a post with no
  boundary at all: a Google button, three fields, a textarea, a Turnstile widget and a submit,
  each floating separately on the page background, which is what made the section read as pasted
  in from somewhere else. Name and email now share a two-column grid (they were each spanning the
  full reading width, so a three-field form looked like a column of wide empty boxes), the
  textarea has a VISIBLE label rather than only an `aria-label`, and the Turnstile widget shares
  one row with the submit. Everything collapses to a single column below 640px. A reply form
  opens inside the thread and drops the border, because a card inside a card boxes a box.

- **A comment body is set at the ARTICLE's size**, not the thread's. It already used the
  reading face; running it at `--fs-small` like the rest of `#comments` meant the same
  typeface as the piece two steps smaller, which reads as a caption rather than as somebody
  talking. Only the words grow: the meta line, the reply link and the whole form stay small.
  The meta line itself is `// name · [date at time]` — the marker is the one every block on
  the page opens with (IDE chrome only), and the time is there because two replies on the
  same day said nothing about their order without it.

- **Instant, never cached — by design.** The page itself is cached; the comment block is an
  island (`assets/js/comments.ts`) that fetches `/api/comments?post=<slug>`, and that route is
  refused a shared cache like everything under `/api`, so its read is always live. A new comment
  is POSTed and the thread is then RE-READ, which is what makes it appear. There is no optimistic
  overlay: 2.0 dropped the one the frozen tree had, along with `mergeOptimisticComments`, because
  a refetch is drift-free by construction where an overlay has to keep a second renderer in step
  with the server's. A failed POST leaves the form filled and prints the server's own message.
  Nothing invalidates the page cache for a comment.
- **Limited markdown (`comment-md.ts`):** only `**bold**` / `*italic*`. The source is HTML-escaped
  FIRST, then only `<strong>/<em>/<br>` are injected — no user tag, link, image, or script survives
  (mirrors Invariant 5). Hard cap 1000 chars (server + client).
- **3-tier threading.** `depth` (0/1/2) is enforced server-side in `addComment` (a reply needs
  `parent.depth < 2`); display nesting is rebuilt from the actual ancestry. `buildCommentTree`
  (pure, tested) re-roots orphans (parent purged) and renders a deleted-but-still-replied node as a
  blanked **tombstone**; a deleted leaf is pruned.
- **Sign-in, in 2.0** (`src/web/comment-auth.ts`, `src/comments/{commenter,google-oauth}.ts`,
  [ADR 0013](decisions/0013-google-sign-in-for-commenters.md)): `next-auth` is gone, so a
  commenter is a signed `__Host-` cookie rather than a session row — 30 days, HMAC over name +
  address + expiry, no table. The client id and secret are entered in **Settings → Connections**.
  A signed-in comment takes its identity from the cookie and IGNORES the request body, records
  `provider = 'google'` and skips Turnstile. Turning the toggle off stops trusting cookies
  already issued, rather than waiting for them to lapse.
- **Privacy:** email is stored but NEVER sent to the public client (separate `PUBLIC_COLS` vs
  `ADMIN_COLS`); website gets `rel="nofollow ugc noopener"`. `/api/comments/me` returns the
  signed-in NAME only, and is the one public response on the site marked `no-store`.
- **Post rename / purge:** `renameComments` moves comments with the slug; `deleteCommentsForPost`
  clears them when a post is purged (both wired in `posts.ts`).
- **Admin:** `/admin/comments` lists live comments (content/post/time/name/IP/delete); the content
  cell is clamped to two lines and click-toggles to the full text per row (replies are flat rows, so
  each toggles on its own). The IP column shows the captured commenter IP with the ISO country code
  in parens (`1.2.3.4 (VN)`) — country is best-effort from the reverse proxy / Cloudflare edge
  header, blank when absent, and pre-feature rows show `—`. Delete = soft delete via owner-gated
  `DELETE /api/comments/[id]` → Trash (restore/purge in `TrashView`'s Comments tab). `/admin/content`
  posts table gains a comment-count column when enabled (`countsByPosts`).
- **Abuse:** manual comments only accept a published, visible post + a per-IP in-memory rate limit
  (6/min). The same IP (+ country) is persisted on the row (`author_ip`/`author_country`) for admin
  moderation — admin-only, NEVER sent to the public comment tree.
- **Integration keys live in the ADMIN, not (just) env (`src/store/integration-keys.ts`).**
  Turnstile AND Google keys are SECRETS, kept in the server-only `integration_keys` table (single
  row), set via Admin → Settings → Connections (owner-gated `POST /api/comments/keys`) — NEVER in
  `settings.data`. An env var of the same name is a fallback. `getCommentEnv()`
  (`src/comments/comment-env.ts`) reports which integrations are usable (booleans) + the public
  Turnstile site key; no secret is ever sent to a client. Saving the pair calls `clearCache()`,
  because a cached page carries the old site key and the old "draw the Google button" flag.
- **Cloudflare Turnstile (`src/auth/turnstile.ts`, `src/assets/js/turnstile.ts`).** Toggle
  `settings.comments.turnstile`; **enforced only when the toggle is on AND a Turnstile secret
  exists**, so toggling on without keys never locks out commenting (the admin row shows a "needs
  keys" badge + the key inputs appear right below). The manual form gates the comment box **behind
  the Turnstile pass**; the POST verifies the token server-side via siteverify (fail closed).
  Tokens are single-use → the form re-arms after each post.
- **Google sign-in for commenters** is `settings.comments.googleAuth` and is described in the
  bullet above — the OAuth flow is `src/comments/google-oauth.ts` and the identity is a signed
  cookie, not a session row. **A signed-in commenter is never an owner**: the two are separate
  cookies, separate code paths, and the admin gate is `ownerRouter()` alone.
- **Routes:** `/api/comments` (GET list + POST create) is the ONLY public-exempt comment path, and
  it is listed with its reason in `scripts/checks/routes-guarded.ts`; `DELETE /api/comments/:id`
  stays owner-gated.

## WordPress import — `src/import/wordpress.ts`, Admin → Settings → System

- **One-click import** from a WordPress export (`Tools → Export → All content` = a WXR `.xml`).
  `ImportFields` uploads the file (multipart) to owner-gated `POST /api/import/wordpress`.
- **`parseWxr(xml, now)` is PURE** (no I/O; unit-tested in `src/import/wordpress.test.ts`): each `item`
  with `wp:post_type` post/page and a live status → a post/page. HTML `content:encoded` → Markdown
  (`turndown` + GFM), `<figure><figcaption>` folded INTO the image alt (Quire Ink renders captions from
  alt). A **gallery** (`figure.wp-block-gallery`, which nests one `<figure><img>` per photo)
  emits EVERY nested image, each tagged `#grid` so `groupGalleries` rebuilds it as a grid —
  reading only the first nested image drops the rest of the gallery on the floor.
  Categories/tags split by `@_domain`, `Uncategorized` dropped; dates via `wp:post_date_gmt`
  **falling back to `wp:post_date`** (WordPress leaves the GMT date as `0000-00-00` on anything
  never published, so drafts would otherwise all import dated today) and then to `now`;
  status `publish`→`published` else `draft`; excerpt from `excerpt:encoded` or `deriveExcerpt`.
- **The route persists** via `savePost`/`savePage` — new content is ADDED, a slug that collides with
  existing content gets a numeric suffix (nothing overwritten). One `clearCache()` at the
  end; logged as `import.wordpress`. **Images keep their source URLs** (not rehosted).
- `turndown`/`turndown-plugin-gfm`/`fast-xml-parser` are runtime deps. Max upload 100MB; non-WXR
  files are rejected.
