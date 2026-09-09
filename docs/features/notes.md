# The notebook — notes and clips

Written like a post, kept apart from the posts ([ADR 0044](../decisions/0044-a-note-is-not-a-post.md)).

## Reading — `src/web/notes-page.ts`

- **`/notes`**: every published note whose date has arrived, newest first. Same shell and
  rail as a listing; a card is the date, the title, the kept passage when there is one, and
  where it came from. `/notes/{slug}` reads one note: the passage (a blockquote in the
  reading face, so the pen's marks land on it like on any paragraph) above the owner's own
  words. No comments, no series, no table of contents, no related posts.
- **Never in the post feed, the front page, the archive or the newsletter.** In the sitemap
  and in `llms.txt` under its own heading. A draft is private to the owner and answers 404.
- **Its own slug namespace.** A note and a page may share a name; `notes` is reserved so no
  post can shadow the notebook (`RESERVED_SLUGS`). A rename leaves a 301 under `/notes/`.

## Writing — `src/content/notes.ts`, `src/web/admin/notes.ts`

- **The note editor** (`/admin/note-editor`, `NoteForm`): the page editor's sheet with a
  date and, on the attributes panel, the three clip fields — source address (`http(s)` only,
  anything else is dropped at save), source title, and the passage kept. Autosave under the
  `note` kind, the same draft safety net, Trash with restore and purge.
- **In the Write list** a note is a third kind beside posts and pages: its own scope tab, a
  `Note` label on the row, a *New note* button on the empty sheet and in the command palette.
- **API**: `GET/POST /api/notes`, `GET/PUT/DELETE /api/notes/:slug`, `POST|GET
  /api/notes/:slug/autosave`, and `POST /api/trash` with `kind: "notes"`. Activity log
  actions `note.create` / `note.update` / `note.delete`.
- **MCP** (`src/mcp/tools-notes.ts`): `list_notes`, `get_note`, `create_note`,
  `update_note`, `delete_note`, `restore_note`. `create_note` with `sourceUrl`, `sourceTitle`
  and `quote` is how an agent keeps a passage for the owner with where it came from.

## Data — `notes` table, migration `012-notes`

`slug` (primary key), `title`, `date` (ms), `status` (`draft` | `published`), `content`
(Markdown), `source_url`, `source_title`, `quote`, `created_at`, `updated_at`, `deleted_at`,
and the editor's `autosave_json` / `autosave_at` pair. Searched through `notes_fts`, shaped
like the posts' index.

## The door — `src/web/clip-page.ts`, `/notes/clip` ([ADR 0045](../decisions/0045-the-notebook-opens-a-door.md))

- **`GET /notes/clip?url=&title=&quote=&note=`**: the owner's page (anyone else is sent to
  sign in and returned). Shows the passage and its source, and one form — title, note,
  private (default) or public, *Keep* — that **posts to itself**; no script on the page.
  `POST /notes/clip` (owner-gated) writes the note and answers `303` to
  `/notes/clip?saved=<slug>`. A name already taken keeps the passage under `clip-<time>`
  rather than refusing it. Passage and note are capped at 4,000 characters; the source must
  be `http(s)`.
- **With nothing to keep** it is the tool's page: a bookmarklet to drag to the bookmarks bar
  which, on any page, opens the door with the selection and where it came from.
- **From the reader's pen** (`reader-pen.ts`): a mark's card has *Send to my notebook*. The
  first time it asks for the notebook's address and remembers it in that browser
  (`quire:notebook`); then it opens the door in a small window. No token travels.

## The standards — `src/web/micropub.ts`, `src/server/webmention.ts` ([ADR 0046](../decisions/0046-the-notebook-speaks-the-open-standards.md))

- **IndieAuth** rides the MCP OAuth server (`docs/mcp.md`): an `https:` `client_id` whose
  `redirect_uri` shares its origin needs no registration; the requested `scope` travels in
  the code and a writing scope mints a `full` token; the token response carries `me`; the
  authorization endpoint answers the sign-in-only exchange with `{ me }`. Gated by the MCP
  switch, and the head's `rel` links (`indieauth-metadata`, `authorization_endpoint`,
  `token_endpoint`, `micropub`) appear only while it is on.
- **Micropub** at `POST /micropub`: `h-entry` as form or JSON with a bearer token; `name`,
  `content`, `bookmark-of` / `quotation-of` / `in-reply-to` (a clip), `post-status`,
  `mp-slug`; `q=config`, `q=source`; `action=delete`. Always a note. A `read` token gets
  `insufficient_scope`.
- **Webmention out**: a published clip tells its source from every write path — endpoint by
  `Link` header or `rel="webmention"` markup, through the SSRF guard, never awaited.
- **Webmention in** at `POST /webmention` (advertised on every page): target on this site,
  `202`, verified in the background by fetching the source; kept in `webmentions` with the
  passage when the source is a Quire Ink clip. Read with the `list_mentions` tool
  (`mostKept` counts which sentence readers keep most). Nothing is shown to readers.
- The note page is an `h-entry` (`p-name`, `dt-published`, `e-content`, `u-url`, `p-author
  h-card`, `u-quotation-of` on the source link).
