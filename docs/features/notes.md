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

## What it does not do yet

Receive a passage from another site. That is the next tier of the reader's pen
([ADR 0043](../decisions/0043-the-reader-gets-a-pen.md)): a receiving door, then the open
standards it speaks (IndieAuth, Micropub, Webmention).
