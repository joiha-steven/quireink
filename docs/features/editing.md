# Writing and publishing

## Editor (Admin → editor) — `src/admin/components/Editor.tsx`

- StarterKit + underline, inline code, bullet/numbered/**task** lists (GFM `- [ ]`), quote,
  code block, hr, link, captioned image, GFM tables, video. `tiptap-markdown` serializes all.
- **The extension set is `editorExtensions.ts`, not a literal in `Editor.tsx`.** Both round-trip
  suites (`ink-mark.test.ts`, `math-node.test.ts`) import that one list. They used to rebuild it by
  hand under a comment claiming it was what the editor mounts, so a node added to the editor was
  absent from its own test.
- **Mathematics** (`MathNode.tsx`): atom nodes for inline and display, rendered live with the same
  `renderMath` the server uses, TeX editable in place when the node is selected. The markdown-it
  rule registers `before('escape')` and the delimiter the author typed is stored on the node — both
  are correctness, not polish: without the first, `\(a\)` loses its delimiters on save; without the
  node at all, every `\times` gains a second backslash. ADR 0020.
  - **Two toolbar buttons**, `tbMath` (display) and `tbMathInline`. Both insert an EMPTY formula
    with the caret already in its TeX box. The glyph is a pi and the lines around it carry the
    distinction: full rules above and below for its own line, a dash either side for in-sentence.
  - **Typing `\(x\)` or `$$x$$` sets it on the spot; `$…$` deliberately does not.** An input rule
    fires on the text already typed, so it cannot see the next character — and Pandoc's third
    guard ("closing `$` not followed by a digit") is a lookahead at exactly that. Typing
    `giá $5-$8`, the rule would see `$5-$` and convert the price mid-word. `$…$` stays valid
    everywhere and converts when the post is next opened, where the whole line is known.
  - `nodeInputRule` from Tiptap is the WRONG helper here: it replaces only capture group 1 and
    leaves the delimiters standing (`\(x\)` saved as `\(\(x\)\)`). `mathInputRule` deletes the
    whole matched range first.
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
  (`asis`, `1x1`, `3x2`, `4x3`) which crops every tile with `object-fit:cover` so rows line up, and
  **captions** (`cap` / `nocap`), which show or hide them with CSS. The alt is
  still emitted either way, so it keeps serving screen readers and search. Both options apply to the
  WHOLE run in one transaction (`applyToGallery`) rather than to the selected image, and the new
  value is decided once from the tile that was clicked so an inconsistent run heals instead of
  flip-flopping. **GOTCHA:** `groupGalleries` matches `img-grid[^"]*`, not `img-grid` exactly. An
  option appends a class, and matching the old exact string made every gallery with an option
  silently stop grouping and fall into a full-width column.
- **Gallery defaults, site-wide** (*Settings → Layout → Galleries*, `GalleryFields.tsx`): the shape
  and caption state every gallery follows when it has no opinion of its own. Each option is
  THREE-valued and the third value is silence: no token means "follow Settings", which is what lets
  one screen restyle a whole imported archive, and `asis` / `cap` exist so a gallery can disagree
  with a non-default site setting out loud. **The default is applied as CSS, never as markup**
  (`galleryCss` in `web/layout.ts` emits `--gallery-ratio` / `--gallery-w` / `--gallery-cap` on
  `:root`; `public.css.ts` reads them with the old behaviour as the `var()` fallback). That is not
  a style preference: rendered Markdown is content-addressed in `render_cache` under a hash of its
  INPUT, so a default that changed the HTML would leave every already-rendered body serving the old
  shape until something unrelated evicted it. The per-gallery override wins on specificity (tile
  class beats `:root`), not on source order.
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
  [`self-host.md`](../self-host.md) §8.

## Per-post SEO + cover + dateModified — `posts` columns, `src/web/article.ts`

- **`meta_title` / `meta_description`** override the `<title>`, meta description, and OG/Twitter
  card when set (else post title + excerpt). Set in the editor's SEO section.
- **`cover_image`** is a visible hero at the top of the post AND the OG image fallback (ahead of
  the SEO-only `featured_image`). Distinct roles: featured = social-only/hidden, cover = shown.
- **Real `dateModified`**: the meta line shows "Updated <date>" only when `updated_at` is >24h after
  `date` (so a save right after publishing adds no noise). Read through `posts.ts` `rowToMeta`
  (`updatedAt` etc.). The JSON-LD half of this is **not ported** — see
  [`seo-pwa.md`](../seo-pwa.md).

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
- **The app's own limits (`src/media/limits.ts`): `MAX_UPLOAD_MB` (64) and
  `STORAGE_QUOTA_GB` (5).** Added 2026-08-11, when the only byte limit in the tree turned
  out to be the WXR import's. A file over the cap gets a 413 and the reason
  `file_too_large`; one that would push the store past the quota gets `quota_exceeded`.
  Both are checked from `File.size` **before** the body is read, so an oversized upload
  never becomes resident memory, and again in `blob-local.put()` — the one function every
  stored byte passes through — so a route that forgets cannot write past the ceiling.
  Settings → System → Storage can lower either for this blog and can never raise it.
- **Host limits, still there and still first:** the reverse proxy caps upload size (nginx
  `client_max_body_size`), and proxies/CDNs (e.g. Cloudflare free: 100 MB) cap request
  bodies — a huge video fails at the edge, more cheaply than in the app. What the app's
  own limits add is every path a proxy never sees: a binary run behind a tunnel or nothing
  at all, and `add_media_from_url`, where the bytes arrive on a fetch the server made. For
  long/heavy video, a platform embed (unlisted YouTube/Vimeo) is still the better tool:
  transcoding + adaptive bitrate.

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
