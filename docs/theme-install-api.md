# Installing a theme from a zip, over HTTP

> The owner's routes for themes installed from a zip ([ADR 0072](decisions/0072-a-theme-is-a-checked-skin-over-the-one-markup.md)),
> and the public route that serves their files. The routes are
> [`src/web/admin/themes.ts`](../src/web/admin/themes.ts) and [`src/web/theme-files.ts`](../src/web/theme-files.ts);
> the store is [`src/content/installed-themes.ts`](../src/content/installed-themes.ts) and the
> checking [`src/theme/read-package.ts`](../src/theme/read-package.ts). There is no admin screen for
> them yet; once chosen, the public site wears one ([below](#wearing-one)).

Every `/api/themes` route is on the owner-gated router: a session cookie, and for a write a
same-origin request, or `401` and `403` before anything runs. Answers are the admin's envelope,
`{ "success": true, "data": … }` or `{ "success": false, "error": "<code>" }`.

| Request | Body | Answer |
|:--|:--|:--|
| `POST /api/themes` | multipart form, the zip as `file` | `{ id, version, hash, changed }`. `changed: false` when this exact package was already installed as that version |
| `GET /api/themes` | — | one entry per theme id: `{ id, current, previous, active, reviewed: false }`, `current` with the version, hash, install time and the manifest's name, author, description, license, homepage, api and screenshot URL; `previous` newest first |
| `DELETE /api/themes/<id>` | — | `{ id, removed }`, the number of versions. A blog wearing the theme goes back to `plain` |
| `POST /api/themes/<id>/rollback` | — | `{ id, current, removed }`: the current version removed, the one before it current again |

Refusals: `400 no_file`; `413 file_too_large` past 5 MB (the body cap answers before the handler
past 5 MB and 64 KB of framing); `404 not_found` for an id with no live version; `409
no_previous` for a rollback with nothing to go back to; and **`422 theme_refused`** with
`violations`, one `{ rule, file, line, col, subject }` per finding of the checker (the rule codes
are in [`src/theme/types.ts`](../src/theme/types.ts)). A refused package writes nothing: no row and
no file.

## What an install does

1. **The zip's directory is judged before anything is inflated**: the number of entries, every
   name (no `..`, no absolute path, no backslash, no link, only the files the standard lists) and
   every declared size, per file and in total. Then the entries are inflated under a ceiling per
   entry and in total that zlib enforces, because a declared size is the archive's word; an entry
   that inflates to a size other than the one it declared is refused. Then the bytes, `theme.json`
   and `theme.css` go through the checker.
2. The files are written to the blob store under **`themes/<hash>/<path>`**, `hash` being the
   SHA-256 of the package's files (paths, lengths, bytes, in path order), so the same theme zipped
   again is the same hash. A file already there at its size is not written again.
3. Then one row in `themes`, in one transaction. The same id and version with the same hash does
   nothing; with another hash the old row is soft-deleted and the new one becomes current.

Installs run one at a time in the process: two at once would write the same keys together.

## Serving

`GET /themes/<hash>/<path>` answers a hash the table names, **deleted rows included** (a page a
cache still holds keeps its sheet), and only a path that package listed. `public, max-age=31536000,
immutable` and `nosniff`; an SVG with the same `sandbox` policy `/uploads` gives one; `theme.css`
wrapped in `@layer theme{…}` as it is sent, so the bytes stored are the bytes checked. A row whose
file the store no longer has answers `404` and says so in the log.

Theme files are never deleted. A removed or rolled-back version is a soft-deleted row whose files
stay, and the backup carries both ([backups.md](backups.md#what-it-copies)).

They are not uploads: `/uploads/themes/…` answers `404` however the path is spelled
([`src/media/theme-blobs.ts`](../src/media/theme-blobs.ts)), and the Markdown export leaves them out,
since they are the theme author's files and not the owner's writing.

## Wearing one

A settings save (`PUT /api/settings`, the MCP tool `update_appearance`, the setup step) may set
`theme` to a built-in id or to the id of a theme with a live version; any other id is ignored and
the stored one stays. Choosing is resolved in [`src/content/chosen-theme.ts`](../src/content/chosen-theme.ts)
and the choices it adds in [`src/content/theme-choices.ts`](../src/content/theme-choices.ts).

The page is drawn as **plain**, every field of it, plus what the current version's `theme.json` says:

- `<link rel="stylesheet" href="/themes/<hash>/theme.css">` straight after the base sheet, and
  `data-theme="<id>"` on `<html>` (no `data-look`).
- `layout.menu: "header"` puts the menu in the masthead as the Newspaper does; `layout.deepenMetaInk`
  writes the same meta-ink rule the Notebook gets, behind the theme's sheet.
- `ownsSettings`: the page is drawn without the saved value of each key; the value stays saved.
- Every face of every declared font as `@font-face{font-family:'theme-<font id>';…;font-display:swap;
  src:url('/themes/<hash>/<file>') format('woff2')}`. A `display` font is `--font-display`. A
  `reading` font is a value of the reading-font setting (`fontPreset`) and a `chrome` font one of the
  chrome-font setting, while the theme is chosen; each falls back to the default stack for a missing
  glyph; on a Chinese, Japanese or Korean page the reading font leads that language's CJK stack.
  A palette is a value of the default palette (`themePreset`), written into the same `--c-*`
  variables a built-in one is, the newsletter included, and offered in the reader's palette menu
  by its own name beside the built-ins the owner turned on. Chosen alone, there is no menu: no
  built-in palette is added to the stored list on its behalf.
- A stored font or palette id that is not on offer (the theme removed, another chosen) is drawn as
  the default and **kept** in the row, as an unknown theme id is: choose the theme again and they
  come back.

**When it changes.** The current version is read with one query on the live-version index the first
time a page asks after a flush of the page cache, and kept until the next one. Install, rollback and
removal are writes through the owner's gate, which flushes the page cache and purges the edge as a
settings save does (Invariant 1), and they also drop the kept version themselves; so the next render
shows the new sheet. On Cloudflare the one Durable Object renders, writes and flushes, so the same
holds there (`bun run test:cf` has the case).

**Broken is plain.** No live row for the stored id, a manifest that is not JSON, or a value that the
checker could not have passed (an id outside `[a-z0-9-]`, an id a built-in theme, palette or font
already has, a colour that is not `#rrggbb`, a font file that is not `fonts/<name>.woff2`): the page is plain with a `200`, and the log has one warning naming
the theme until the next flush. A row is read as if it could be anything because a backup puts rows
back unchecked, and these values end up inside CSS the engine writes. Ids reach HTML through
`escapeAttr`; in CSS only after that check.

## Limits

- **Files no row names are not cleaned up.** An install that failed after writing its files, and
  every version removed or rolled back, leaves its files in the store, counted in the storage
  figure and carried by every backup. They are small (a package is at most 10 MB expanded) and
  written once per hash.
- **A backup is trusted as it is.** Loading one puts its theme rows and files back without
  checking them again, as it puts back the owner's custom CSS: the archive is the owner's own.
- **Nothing is written to the activity log yet**; the request log has a line for each install,
  refusal, rollback and removal.
- **No picker shows a theme's fonts and palettes yet**, and the MCP tool's palette and font menus
  are the built-in ones; a theme is chosen by id and its choices are set by id.
- **A theme's fonts are never preloaded.** They are whole woff2 files, not the engine's subsets,
  so like an uploaded font they swap in rather than compete with the sheet ([performance.md](performance.md)).
  A title set in a theme's display or reading face paints first in the fallback.
- **A theme palette's name is the author's, in one language**; the built-in names are translated.
- **When a theme's palette is the stored default but not on offer**, the engine's default (Mono)
  is drawn and joins the reader's menu for as long as that lasts; the stored list is not changed.
