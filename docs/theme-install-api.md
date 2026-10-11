# Installing a theme from a zip, over HTTP

> The owner's routes for themes installed from a zip ([ADR 0072](decisions/0072-a-theme-is-a-checked-skin-over-the-one-markup.md)),
> and the public route that serves their files. The routes are
> [`src/web/admin/themes.ts`](../src/web/admin/themes.ts) and [`src/web/theme-files.ts`](../src/web/theme-files.ts);
> the store is [`src/content/installed-themes.ts`](../src/content/installed-themes.ts) and the
> checking [`src/theme/read-package.ts`](../src/theme/read-package.ts). There is no admin screen for
> them yet, and an installed theme is not yet drawn on any page.

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
