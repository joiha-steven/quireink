# What Quire 1.x did: reader-facing behaviour

Sections 1 to 9: content model, taxonomy, rendering, reading, media, comments, mail,
analytics and the SEO surface. Owner-facing behaviour is in
[07-parity-admin.md](07-parity-admin.md).

One line per user-visible behaviour the Next.js implementation had, written before the
rewrite ([00-rationale.md](00-rationale.md)). **This is the primary defence against silent
feature loss**, because the golden harness ([03-golden.md](03-golden.md)) only covers
rendered public HTML: the admin, the 61 API routes and every side effect are invisible to it.

Sources: `/admin/help` (written for a non-technical owner and therefore already a feature
list), [`../features/`](../features/reading.md), `CLAUDE.md`, `CHANGELOG.md`.

## This was a checklist and is not one any more

It carried 232 boxes. 223 of them were never ticked, although 2.0 shipped on 2026-07-28 and
1.x was shut down on 2026-07-31. A tally nobody keeps reads as "223 things still missing",
which was never true. The boxes came off on 2026-08-03; **not one line of content did**.

## How to read it

- `⚠` marks a behaviour that is **easy to lose and has no test covering it**. 48 of them
  across both files. These are the ones that actually go missing. Read the note before
  changing anything near it.
- `✂` marks a change that is **deliberate**, with the parity exception it belongs to
  ([00-rationale.md](00-rationale.md)). Do not "restore" these.
- Find a difference between a line here and the running software and it is one of two
  things: a bug, or a `✂` nobody wrote down. Establish which before doing anything else.
- Correct a line that is wrong, add one that is missing, and say so in the commit. An
  inventory nobody corrects is worse than none.

---

## 1. Content model

- Posts: create, edit, publish, unpublish, delete (soft), restore, purge
- Pages: the same, minus taxonomy and series
- `⚠` Posts and pages share ONE `/{slug}` namespace; a collision is a 409, and a
  **trashed row still reserves its slug** so a restore can never collide
- Draft vs published status; drafts 404 publicly and are excluded from lists, search,
  sitemap, feed and llms.txt
- `⚠` Scheduling is **not a status**: a post is scheduled whenever it is `published`
  with a future date. `isPublicallyVisible` hides it; `isScheduled` is its exact complement
- Editor cue for a future date: button reads "Schedule", toast says "Scheduled", a
  "Scheduled for &lt;local time&gt;" note appears, the "View post" link is hidden
- `⚠` `sweepScheduled` publishes on time via `/api/cron?publish=1` (5 min, short lookback)
  plus an hourly ~65-minute backstop. No watermark is stored; an overlapping purge is an
  idempotent superset
- The cron publishes but **never emails**. Scheduled going live sends nothing
- Revisions: last 3 overwritten versions per slug, restore from the editor,
  non-destructive (current version is snapshotted on the next save)
- Revisions follow a rename and are removed on purge
- `meta_title` / `meta_description` override title, description and OG/Twitter card
- `cover_image` is a visible hero AND the OG fallback, ahead of the SEO-only `featured_image`
- `⚠` "Updated &lt;date&gt;" shows only when `updated_at` is more than 24h after `date`,
  so a save right after publishing adds no noise. `dateModified` in JSON-LD is the real value
- Reading time stored at save (`readingMinutes`)
- Excerpt derived when not given (`deriveExcerpt`)

## 2. Taxonomy, series, redirects

- Categories and tags per post; listing pages with pagination
- `⚠` Taxonomy URLs use the **slugified** term, resolved back by `resolveTerm`, with
  back-compat for raw pre-slug URLs. Never hand-encode a term into a link
- `⚠` `updateTerm` renames a term across EVERY post and **merges on collision**; remove
  deletes it across every post
- Series: name + order on the post, at most one per post, editor field with a datalist of
  existing names (including drafts)
- `⚠` Series ordering is `series_order` ascending **then date ascending**, so a series
  reads oldest first. Drafts and scheduled parts never appear
- SeriesBox renders only when the series has more than one public part; current part
  highlighted and not linked
- `/series/[slug]` listing preserves the given order and only paginates
- Admin Series tab: rename across all posts (merging on collision), remove (clears the
  fields, posts untouched), reorder with arrows
- Owner-managed 301/302 redirects, CRUD in Settings → SEO
- `⚠` Renaming a slug **auto-adds a 301** so existing links survive
- `⚠` Saving content at slug X **deletes any redirect whose source is /X**, so a live URL
  is never shadowed and an A→B→A rename cannot self-loop
- Redirects resolve in middleware as a real HTTP redirect before any render, fail-open on
  error. `✂` The 60s in-process cache is **deliberately not carried over**: it existed
  because v1's lookup was an HTTP fetch to PostgREST, and against local SQLite it would
  only buy a minute in which a just-saved redirect does not work. Landed 2026-08-02 —
  until then the rows were written and read by nothing
- `source` normalised (leading slash, no query, no trailing slash); destination is a path
  or an absolute http(s) URL; self-redirect rejected
- `/page/1` redirects to the bare path

## 3. Markdown rendering

- CommonMark + GFM through `marked`, unchanged
- `⚠` Raw HTML in markdown is **escaped, never executed**; `safeHref` drops
  `javascript:` / `data:` / `vbscript:`
- Headings H1 to H6; ToC built from them
- `⚠` Heading ids are de-duped (second `foo` becomes `foo-2`) by the SAME counter in
  `dedupeHeadingIds` and `extractHeadings`. Change one, change both or the ToC anchors break
- Footnotes `text[^1]` + `[^1]: note`: numbered by first reference, back-links, a ref in a
  fenced code block is masked and ignored, a ref with no def stays literal, an unreferenced
  def is dropped, definition text is escaped inline markdown
- Callouts: `> [!NOTE|TIP|WARNING|IMPORTANT|CAUTION]` becomes a labelled box; an unknown
  `[!FOO]` and a plain quote are untouched; monochrome, no semantic colours
- Fenced code highlighted by Shiki, server side, zero client JS. Unknown language degrades
  to a plain block
- Copy button on every code block
- Tables with alignment; task lists; underline; inline code; blockquote; hr
- YouTube / Vimeo / TikTok URL alone in a paragraph becomes a responsive iframe embed
- Spotify / Apple Music URL becomes a 175px audio embed, plain iframe, no third-party script
- A direct video file URL (`.mp4/.m4v/.webm/.mov`) becomes a native `<video>`, column width
- `✂` X / Instagram / gist embeds stay unsupported (third-party widget scripts + CSP)
- `<picture>` with AVIF/WebP sources emitted **only when variants exist**
- Consecutive images group into a grid; a title attribute becomes a caption
- `⚠` Image refs are stored **store-relative**: `collapseBlob` on write, `expandBlob` on
  read, in the data layer only, so stored bytes carry no origin

## 4. Reading and discovery

- Home listing with pagination at `/page/[n]`, page 1 at the bare path
- Category, tag and series listings, each paginated the same way
- Feature flags, all default on except `bookText` and `infiniteScroll`: `search`, `toc`,
  `related`, `readingTime`, `progressBar`, `activityLog`, `sidebar`, `leadPost`,
  `categoryLabel`, `deck`, `bookText`, `infiniteScroll`, `gridView`
- `⚠` A feature turned off ships **zero client JS** for it, not a hidden element
- Lead post: newest post on home page 1 takes the `h1` role, the rest stay `h2`
- Sidebar `single` layout: one left rail, all blocks stacked
- Sidebar `two` layout: two gutter rails, narrower reading column, geometry emitted only in
  this mode
- Left rail: most viewed (top N by all-time views, `0` hides it) + featured (owner-curated
  slugs, in order, first 5, dropped when a slug stops being public)
- Right rail: menu + category cloud with counts + tag cloud
- Mobile: one drawer, left-rail blocks duplicated into it, order menu → most viewed →
  featured → categories → tags
- Each rail block self-hides when empty
- The pen's colours are the owner's (2026-08-24, ADR 0029): five highlighter pigments, the
  ring and the underline, each defaulting to the measured ink and each deriving its own dark
  and line versions when set. A site that has chosen nothing serves the same immutable sheets
  it always has. Selected text is black on a light page and the palette's mid grey on a dark
  one, both overridable
- Quote gesture (2026-08-24, ADDED HERE — the frozen tree had nothing like it): selecting
  twelve characters or more inside `.prose` raises one control that copies the sentence and
  a `#:~:text=` link to it. Above the selection on a mouse, BELOW it on a touch screen where
  the OS puts its own callout above. Never drawn where `navigator.clipboard` is missing
  (any plain-http page), and it is not a share button: no third party, no account, no
  network call at all
- Post and page views show ONLY the ToC, in a single left rail
- ToC shows when a post has headings or an in-page jump, otherwise renders nothing
- ToC mixed-level styling (`.rail-lead` with a dot, `.rail-sub` without); uniform when all
  one level
- ToC sticky and capped to the viewport with internal scroll; collapsible on every viewport
- ToC header: clickable "Tiêu đề" when there are headings, plain "Mục lục" when not; the
  line under it joins present tags/categories/comments and jumps to the first existing section
- Infinite scroll: whole published list handed to the client as light metadata, first chunk
  server-rendered for SEO, `/page/[n]` 404s
- `⚠` Infinite-scroll date timeline: sticky year tag, per-month dot in the gutter, spine
  hairline, a year's own first month skipped. **No JS and no measurement**, pure CSS sticky
- Timeline hidden below its breakpoint and in grid view, where year groups dissolve
- Grid/list toggle, remembered in `localStorage`, honoured pre-paint by the no-FOUC script
- `gridView` off hides the button AND makes the no-FOUC script ignore a stored `list=grid`
- Search: local index (instant, accent-insensitive) merged with server FTS over title + body
- Search overlay from the header, plus the `/search` route for deep links and no-JS
- Related posts: shared tags weighted double, then categories
- Reading progress bar; back to top; reveal-on-scroll (CSS first, JS fallback only where
  `animation-timeline` is missing)
- Draft preview at `/preview/[slug]?key=<hmac>`, force-dynamic, noindex; the editor's
  "Preview draft" saves pending edits first
- Themed skeleton while a blog route loads, gated on the motion engine
- `⚠` Book mode: fullscreen two-column spread, paged with arrow keys, always sepia
  regardless of theme, hidden below 767px, driven by the `#read` hash so Back closes it
- Book mode clones the already-rendered body (Shiki, images, footnotes intact), forces
  cloned images eager, recomputes on resize and after `document.fonts.ready`
- Book mode caps media to one page height so nothing overflows a spread; wide images
  neutralised to column width
- Base page keeps normal scroll, so SEO, a11y and find-in-page are untouched

## 5. Media and files

- Drag-and-drop upload in the editor and the Library
- AVIF + WebP variants at 1024 and 1600 plus a thumbnail; the original is always kept
- `⚠` Heavy variants are deferred and swept by cron; a valid original never fails the
  upload because dims and thumbs are best-effort
- `⚠` The original is written with an EXCLUSIVE (`O_EXCL`) write, so two concurrent uploads
  of the same name retry a fresh name instead of overwriting
- Library: three tabs (Images, Videos, Files), toolbar with total count and size, name
  search, sort by newest / name / size
- Per-tile actions overlay the thumbnail (hover on desktop, always on touch) so they add no
  layout height
- Unused-media audit reports orphans and **never deletes**
- `⚠` Media soft delete KEEPS the blob, so a published post linking a trashed image keeps
  rendering. The blob goes only on purge
- `⚠` Purge-in-use guard: a purge checks posts + pages + revisions + settings first and
  returns 409 `in_use:<n>`; the admin re-asks with a stronger confirm and retries with `force`
- Delete removes every derived version
- Uploads served from `/uploads`, **streamed from disk with byte-range (206) support**, which
  video seeking and iOS Safari playback both require
- Video and audio MIME mapping, without which browsers download instead of play
- Site icons (`favicon-`, `app-icon-`) and custom fonts live under `files/`; delete refuses
  to remove the icons
- `⚠` Logo render emits a **PNG twin** beside the WebP for email, rebuilt and deleted in
  lockstep so a stale mark can never ship

## 6. Comments

- Off by default; enable in Settings → Content
- Manual identity (name + email + optional website) or a signed-in account
- `⚠` Limited markdown only: `**bold**` and `*italic*`, escape-first, hard cap 1000 chars
  on both server and client
- 3-tier threading, depth enforced server-side (a reply needs `parent.depth < 2`)
- `⚠` `buildCommentTree` **re-roots orphans** whose parent was purged and renders a
  deleted-but-still-replied node as a blanked **tombstone**; a deleted leaf is pruned
- `⚠` Email is stored but NEVER sent to the public client (separate public and admin column
  sets); website links get `rel="nofollow ugc noopener"`
- Optimistic insert rendered with the SAME renderer the server uses, then replaced by an
  authoritative refetch; a failed POST removes it and shows the error
- `⚠` A comment never triggers `revalidatePath`. The block is a client island fetching
  `no-store`, so the post page stays static
- Comment count comes from the same fetch plus the optimistic overlay
- Turnstile: enforced only when the toggle is on AND a secret exists, so toggling on without
  keys never locks out commenting. Tokens are single-use and the form re-arms
- Per-IP rate limit (6/min); only a published, visible post accepts a comment
- IP and best-effort country persisted for moderation, admin-only, never public
- Admin list with two-line clamp that click-toggles per row; delete is a soft delete into
  Trash with restore and purge
- Comments follow a post rename and are cleared when a post is purged
- Reply notification emails the parent commenter; skips a self-reply, a deleted parent, and
  no-ops without SMTP

## 7. Newsletter and mail

- `⚠` **Double opt-in**: a pending row is written BEFORE the mail is sent, so a sign-up
  survives a broken SMTP
- One per-subscriber token serves BOTH confirm and unsubscribe
- Re-subscribing reuses the token; a confirmed address short-circuits with no re-send and no
  membership leak
- Confirm and unsubscribe return a standalone HTML page, since they open from an email
- Sign-up form appears at the foot of a post and as a header button ONLY when SMTP is
  configured
- `⚠` `sendMail` **never throws**; it degrades to `{sent:false, error:'smtp_not_configured'}`
- `⚠` `sendMail` is the ONE choke point that writes the send log: one row per email, every
  kind, success or failure. No path can email an address without it showing up
- Send log is keyed by ADDRESS, not a subscriber FK, because reply notices go to commenters
  who never subscribed. Deleting a subscriber clears their rows
- `⚠` A failed send is not counted as sent, and the open-rate denominator is successful
  BROADCASTS only
- Sending is **always manual**. Nothing is emailed automatically, not even a scheduled post
- Several ticked posts go out as ONE digest, never one email each
- `⚠` The double-send guard reads the **send log**, not `broadcast_at`: posts from the old
  auto-broadcast era carry a backfilled stamp with no log rows and would wrongly report as sent
- Resend requires the checkbox, and the send itself is confirm-gated
- Admin preview renders the REAL email HTML in a `sandbox=""` iframe
- Test send: three kinds (smtp, post, subscribe) built by the SAME builders as the live path,
  to the owner's address, using the SAVED config not the unsaved form
- `⚠` Test and preview pass no open token, so reviewing an email never counts as an open
- Open pixel: token identifies the SEND row not the address, first hit wins, no IP, UA or
  referrer recorded
- Links are not wrapped, so there is no click tracking and every URL is the real one
- People tab: emails sent, failures with the last error, open rate, last send, delete
- Email HTML: table layout, inline styles on every element, 600px column, buttons as tables
  (Outlook drops padding on inline elements)
- Cover refs made absolute (an inbox has no origin to resolve store-relative refs against)
- Light only, no web font, hidden preheader, per-post date, footer saying why the reader is
  receiving it next to the unsubscribe link
- Identity from one resolver so all four senders share a letterhead; masthead prefers the PNG
  twin, then a mail-safe original, then the site name as text
- `⚠` SMTP TLS is derived from the port (465 implicit, 587/25 STARTTLS); the wrong pair fails
  with an opaque OpenSSL error

## 7a. Comments identity (2026-07-27)

- Manual comments: name, valid email, optional website, Turnstile when configured
- A Google-signed-in commenter is trusted: name and email from the cookie, Turnstile
  skipped. **Restored 2026-07-29 by [ADR 0013](../decisions/0013-google-sign-in-for-commenters.md).**
  This entry previously read "REMOVED, not pending" and cited ADR 0007, which is about
  the OWNER'S sign-in and says nothing about readers. The toggle stayed in Settings the
  whole time and controlled nothing

## 8. Analytics

- Cookieless. A visitor is a salted hash of IP + UA; the raw UA is never stored
- Coarse device / browser / OS buckets parsed at insert
- Bots, admin and api are skipped, and so is the owner. Closed 2026-07-30, and it went
  further than parity: the frozen tree only asked for a session, so the owner in a second
  browser or on their phone still counted. `analytics/exclude.ts` also drops a request
  from any address a LIVE session was created from (the salted `ip_hash` the sessions
  table already keeps, so nothing new is stored), and any request from a loopback or
  private address, which is the server talking to itself
- Kept forever, no rolling window
- Pageview beacon; scroll depth; dwell sampled on leave
- `⚠` Both beacons are deferred until the document is actually viewed (prerender guard,
  shipped in M0). Any new on-mount side effect needs the same treatment
- Overview: views, visitors with period-over-period trend and a new-vs-returning split, avg
  time on page, avg read depth, bounce rate
- Dual-series time chart; year buckets by month, 24h by hour
- Top pages table, each row linking to its drill-down
- Sources: channels (Direct / Search / Social / Referral) + top external referrers
- Audience: countries + device / browser / OS
- Read-depth distribution
- `⚠` Referrers, countries, channels and facets count **distinct visitors**, not page views
- Per-page drill-down repeats trend + sources + depth for one URL
- CSV export of the daily series
- `⚠` Buckets truncated in `ANALYTICS_TZ` so days line up with local midnight. Port the
  existing timezone test cases FIRST
- View totals column on the content tables
- `✂` Search ranking changes from none to BM25 and becomes accent-insensitive at the index
  level (parity exception 2)

## 9. SEO, feeds, agent surface

- `sitemap.xml` and `sitemaps.xml`
- `feed.xml` (RSS), toggleable
- `robots.txt`
- `llms.txt`
- OG images via satori, per post, with the cover fallback chain
- JSON-LD article schema with real `dateModified`
- PWA manifest, favicon and app icon resolution
- `/api/md/[slug]` markdown negotiation
- `.well-known` discovery endpoints and the proxy rule
- Content-Signal and Link headers
- `auth.md`

## Known gaps in this list

Stated so nobody reads this inventory as proof of completeness:

- Visual fidelity is not covered here at all. The golden harness compares article bodies;
  chrome is deliberately loose. Screenshot comparison is a separate job.
- Performance budgets live in [04-frontend.md](04-frontend.md), not here.
- The 61 API routes are covered only through the behaviours they serve. A route with no
  user-visible behaviour (health, internal sweeps) may be missed.
- i18n completeness is one line here and is really 4,983 lines across 6 files.
