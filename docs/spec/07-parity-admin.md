# What Quire 1.x did: owner-facing behaviour

Sections 10 to 15: the admin, the editor, settings, MCP, operations and auth. Reader-facing
behaviour is in [07-parity-public.md](07-parity-public.md), which carries the full account of
what this inventory is, why it stopped being a checklist, and how to read the markers. In
short: `⚠` is easy to lose and untested, `✂` is a deliberate omission, and a difference
between a line here and the running software is either a bug or an unrecorded `✂`.

---

## 10. Admin

> **This whole section is invisible to the golden harness.** 8,578 lines, 66 components,
> and the M3 gate requires a scripted headless tour of at least 30 flows. These are the flows.

- `✂` **The SHAPE of the admin is 2.x's own** since
  [ADR 0024](../decisions/0024-the-admin-is-rebuilt-around-writing.md): the three content tabs
  are one list, the search reaches the body, the toolbar arrives on a selection, the
  attributes are asked at publish time, the rail is four destinations with the rest behind one
  control, and the home carries the reader numbers plus the unfinished writing. Every line
  below describes **1.x**; where one differs from the running admin, that ADR is the reason and
  not a bug.
- Sign in, sign out, unauthorised address bounced
- Overview: five stat cards, traffic card with sparkline, most viewed, needs-attention
  (draft count only), recent activity, one-line system footer
- Content dashboard: three tabs, substring search, All/Published/Draft filter
- Row actions: open-in-new (published only), edit, delete
- Responsive tables hide secondary columns rather than scrolling horizontally
- Taxonomy manager: rename (merge) and remove across all posts
- Series manager: rename, remove, reorder
- Trash: four tabs, restore, purge, empty, all owner-gated
- `⚠` Nothing ever auto-purges. Permanent removal is always manual
- Media library: upload, search, sort, copy URL, download, delete, unused badge
- Video tab with native players; Files tab for attachments
- Comments moderation list with clamp-toggle and delete
- Newsletter: People, Send, Test
- Analytics view and per-page drill-down
- Activity log, latest 200, with Clear
- `⚠` Errors from every route catch land in the same log with a red badge. Validation 400s
  do not
- Help page, English body, localized nav label and title, zero client JS
- Clear-all-cache action purges origin + Cloudflare and re-warms
- Light/dark toggle in the admin; palette selection is public-side only
- Sidebar collapse control at the top next to the wordmark; Sign out alone in the footer

## 11. Editor

- Markdown with a toolbar; `tiptap-markdown` serialises everything
- StarterKit, underline, inline code, bullet / numbered / task lists, quote, code block, hr,
  link, captioned image, tables, video
- `⚠` Local autosave to `localStorage` every 8s while dirty, **never to the server**, so
  editing a published post cannot push half-finished text live
- `⚠` A snapshot that outlived its session surfaces a restore/discard bar; a successful
  server save clears it; `beforeunload` still warns
- Conflict detection: saving sends the loaded version and warns instead of overwriting
- Revision restore loads a version into the editor
- `⚠` Gallery insert adds all picked images in ONE `insertContent`; a per-image loop leaves
  only the last
- Bubble menu over a selection or in a link; skips node selections so it never covers image
  or video controls
- Table insert 3x3 with header row; contextual row for add/remove column and row, delete
  table; header row and left column shaded CSS-only so the saved Markdown never changes
- SEO section: meta title, meta description, cover, featured image
- Settings panel: series field with datalist, order number, publish date
- Preview draft opens the preview URL after saving pending edits
- `⚠` Optional typewriter feedback: block caret, insert/delete response, synthesized key
  click. Ignores composition, modifiers, navigation keys, paste and held repeats
- `⚠` **Vietnamese IME (Telex) must be tested explicitly.** Toolbar and autosave must not
  interfere mid-composition
- Title grows instead of clipping; toolbar sticky, never wraps, scrolls horizontally on
  narrow screens; focusing prose draws no black outline

## 12. Settings

- ONE form, ONE save, five tabs, `?tab=` deep links
- Save calls a refresh so the admin shell and public header update immediately
- Site: title, logo, header menu, language, content width, sidebar layout, most-viewed count,
  featured slugs
- `⚠` Footer is owner-editable limited inline markdown (bold, italic, underline, link only,
  escape-first, protocol-checked) with `{year}` and `{title}` tokens
- Content: reader feature toggles, comments, WordPress import
- Appearance: 6 palettes, which palettes readers may switch, font preset, chrome font, custom
  font upload, per-role type sizes, font smoothing, motion engine, typewriter, custom CSS
- `⚠` The DEFAULT palette's checkbox is locked so the enabled set is never empty; the
  no-FOUC script ignores a stored palette that is no longer enabled; disabled palettes stay
  fully editable
- SEO: sitemap, RSS, robots, OG, redirects manager
- Integrations: SMTP, MCP tokens, Cloudflare, backups, comment keys
- `⚠` Secrets never enter the settings payload: Turnstile keys, SMTP credentials and the
  backup token live in server-only tables
- 6 locales in sync (en default, then vi, de, ja, zh, ko)
- 6 theme palettes, light and dark each, reader-switchable with no flash

## 13. MCP

- MCP server enabled from the admin, tokens minted there, shown once, stored hashed
- `⚠` Token hash format must survive cutover, and a live MCP write must be verified BEFORE
  the DNS switch. AI publishing failing silently is the failure mode this guards
- Post and page CRUD, media, settings through MCP, with the same revalidation and activity
  logging as a human action
- OAuth dynamic client registration, code signing, replay guard
- `⚠` MCP token routes must NOT bust the `db` cache tag, and out-of-band writes MUST. The
  asymmetry is deliberate

## 14. Operations

- `/api/health` reports database and storage separately
- Boot fails fast on a missing required setting
- Tracked SQL migrations, applied once, aborting startup on failure
- Cron: publish tick, variant sweep, backup, cache purge
- `⚠` Cache invalidation is a **superset**, never an under-purge (becomes a total flush in
  v2, parity exception 3)
- Cloudflare purge on content writes, using the token from the admin
- `✂` Google Drive backup removed (parity exception 1). Three things replace it and none
  of them is an OAuth flow: an off-server cron to R2, scheduled snapshots kept on the server
  (the `intervalDays`/`keep` fields drive these, as of 2026-07-29), and the manual export
  archive. See [`../backups.md`](../backups.md)
- Backup restore into an empty instance, verified end to end
- WordPress import: WXR upload, HTML to Markdown, figcaption folded into alt, categories and
  tags split, `Uncategorized` dropped, status mapping, slug collision gets a numeric suffix,
  nothing overwritten, images keep their source URLs
- Rate limits on public `track`, `search`, `subscribe`, `comments`, `mcp/register`
- Activity log entry for every mutating route

## 15. Auth

`✂` This area changes wholesale. See [06-auth.md](06-auth.md), parity exception 5.

- `✂` Google login removed, `next-auth` removed
- Username + password (argon2id), TOTP required, 10 single-use recovery codes
- Sessions in SQLite, revocable, sliding 30 days with a 90-day maximum
- Password change revokes every other session
- Rate limits and lockout on password, TOTP and recovery attempts, all written to the
  activity log
- Bootstrap through the CLI; TOTP enrolment forced at first sign-in
- Sign-in page carries the site masthead, correct autocomplete attributes, caps-lock warning,
  2FA on its own screen, errors that never reveal whether an account exists
- `✂` Sessions do not survive cutover; everyone signs in once (parity exception 4)
- `⚠` MCP tokens DO survive cutover

---
