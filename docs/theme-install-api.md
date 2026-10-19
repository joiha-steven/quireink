# Installing a theme from a zip, over HTTP

> The owner's routes for themes installed from a zip ([ADR 0072](decisions/0072-a-theme-is-a-checked-skin-over-the-one-markup.md)),
> and the public route that serves their files. The routes are
> [`src/web/admin/themes.ts`](../src/web/admin/themes.ts) and [`src/web/theme-files.ts`](../src/web/theme-files.ts);
> the store is [`src/content/installed-themes.ts`](../src/content/installed-themes.ts) and the
> checking [`src/theme/read-package.ts`](../src/theme/read-package.ts). Writing a theme is [themes.md](themes.md). The admin drives them from
> the Look card ([below](#in-the-admin)); once chosen, the public site wears one ([below](#wearing-one)).

Every `/api/themes` route is on the owner-gated router: a session cookie, and for a write a
same-origin request, or `401` and `403` before anything runs. Answers are the admin's envelope,
`{ "success": true, "data": … }` or `{ "success": false, "error": "<code>" }`.

| Request | Body | Answer |
|:--|:--|:--|
| `POST /api/themes` | multipart form, the zip as `file` | `{ id, version, hash, changed }`. `changed: false` when this exact package was already installed as that version |
| `GET /api/themes` | — | one entry per theme id: `{ id, current, previous, active, reviewed: false, readable, ownsSettings }`, `current` with the version, hash, install time and the manifest's name, author, description, license, homepage, api and screenshot URL; `previous` newest first. `readable: false` when the current manifest does not read (a backup puts rows back unchecked): then `current` has the row's own columns, the id as the name, the other manifest fields empty and `screenshot: ''`. `ownsSettings` is the settings the theme draws itself, as a page wearing it reads them: only keys in `OWNABLE_SETTINGS`, and `[]` when the page could not draw the manifest |
| `DELETE /api/themes/<id>` | — | `{ id, removed }`, the number of versions. A blog wearing the theme goes back to `plain` |
| `POST /api/themes/<id>/rollback` | — | `{ id, current, removed }`: the current version removed, the one before it current again |
| `GET /api/themes/<id>/preview` | — | `303` to `/?theme-preview=<id>` with the preview cookie set; an id the site cannot draw clears the cookie and goes back to the Look card with the reason ([below](#previewing-one)) |

Refusals: `400 no_file`; `413 file_too_large` past 5 MB (the body cap answers before the handler
past 5 MB and 64 KB of framing); `404 not_found` for an id with no live version; `409
no_previous` for a rollback with nothing to go back to; and **`422 theme_refused`** with
`violations`, one `{ rule, file, line, col, subject }` per finding of the checker (the rule codes
are in [`src/theme/types.ts`](../src/theme/types.ts)). A refused package writes nothing: no row and
no file.

## Check before installing

`bun run theme:check <dir|zip>` runs the install's own checker on a theme directory (what an author
edits) or a `.zip`, and writes nothing. A directory is zipped in memory, deflated and with its
directories as records like a real `zip -r`, and read by the same `readThemePackage` with the same
options the route passes ([`src/content/theme-package-options.ts`](../src/content/theme-package-options.ts)),
so a pass there is a pass here. A link inside the directory is refused, not followed, and a directory
with more than 66 entries or a file past its limit is refused from the sizes alone, before anything is read.

- Accepted: one line (`ok · <id> <version> · <n> files`), exit 0.
- Refused: one line per finding, `rule · file:line:col · subject`, with the admin's English sentence for
  the rule under it, exit 1.
- No argument, or a path that is missing or cannot be read: a message and the usage line
  (`usage: bun run theme:check <theme directory | theme.zip>`), exit 2.

**Zip the folder's CONTENTS, not the folder.** `theme.json` must be at the top of the zip. Finder's
Compress and Explorer's "Send to compressed folder" on the folder itself nest everything one level down,
and the install refuses that. Hidden files are refused too (`.DS_Store`, `Thumbs.db`, `__MACOSX/`), so
leave them out:

```
# macOS / Linux, from inside the theme folder
zip -r ../my-theme.zip . -x '.*' '*/.*' '__MACOSX/*'

# Windows PowerShell, from inside the theme folder (the built-in bsdtar, not Compress-Archive,
# which writes backslashes in names on Windows PowerShell 5)
& "$env:SystemRoot\System32\tar.exe" -a -cf ..\my-theme.zip --exclude Thumbs.db --exclude .DS_Store (Get-ChildItem -Name)
```

## Preview before installing

`bun run theme:preview <dir|zip> [--out <dir>] [--widths 375,768,1440] [--pages <id,…>] [--port <n>] [--force]`
([`scripts/theme-preview.ts`](../scripts/theme-preview.ts)) photographs a theme on every kind of page a
reader reaches, on a throwaway instance, before it goes near a blog. It needs a headless Chrome, found
as the tour finds it ([`scripts/chrome-path.ts`](../scripts/chrome-path.ts)).

1. It runs `theme:check` first; a refused theme prints the findings and stops (exit 1).
2. It seeds an instance under `.tmp/` on a free port, as `theme:matrix` does (the same seeder, fixture
   post and pinned clock, [`scripts/theme-matrix-instance.ts`](../scripts/theme-matrix-instance.ts)),
   plus a post with no title; installs the theme with the function `POST /api/themes` calls, and
   chooses it through the settings writer, with the fonts it suggests (else the first of each role).
3. Pages ([`scripts/theme-preview-plan.ts`](../scripts/theme-preview-plan.ts), `--pages` takes their
   ids): the post list and its page 2, the front page as `image` and `text`, a post with every block,
   a post in a series with a table and a footnote, the untitled post, book mode, a page, a category,
   a tag, a series, the archive, search results, the notebook and one note, and the 404. Each at
   every width, light and dark, once per palette the theme declares (the site's default when none).
4. Every shot is measured ([`scripts/theme-preview-layout.ts`](../scripts/theme-preview-layout.ts)):
   a page wider than the window, a box past the window's edge, text cut by `overflow: hidden`, an
   image that did not load, a font file that did not load. What the page does on purpose is left
   out: a wide table or code block scrolling in its own frame, `line-clamp` and ellipses, book mode's
   other pages, the parked skip link.

Shots go to `.tmp/theme-preview/<id>/`, with `REPORT.txt` and `index.html`, a contact sheet grouped
by page with each page's findings above its shots. `--out` must be inside `.tmp/` and empty; `--force`
replaces only a directory theme:preview made (it leaves a `.theme-preview` file in each), so it never
empties `.tmp/theme-preview` itself or a `theme:matrix` baseline. Exit 0 with no finding, 1 when the
theme is refused, a finding was made or the run failed, 2 for bad usage. About 70 seconds for one palette.

Each run keeps its instance in its own `.tmp/theme-preview-work-*` directory, with an `owner.json`
naming its process. The server and the browser are stopped and the directory deleted however the run
ends, Ctrl-C included. A run killed outright skips that (on Windows, `taskkill /F` or a kill from
another program runs no handler): its server and browser still die with it, measured with `taskkill
/F` on the parent alone, and the next run deletes a directory whose owner process is gone. A directory
whose owner is alive, or with no `owner.json`, is left alone.

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
- `layout.menu: "header"` puts the menu in the masthead as the Newspaper does, and the engine keeps
  the rail's copy (`.rail-menu-copy`) and a rail holding only that copy (`.rail-menu-only`) off the
  screen from 60rem up, where the masthead shows the menu; below that the copy is the phone drawer's
  ([looks.md](conventions/looks.md#what-every-dialect-must-obey)). `layout.deepenMetaInk`
  writes the same meta-ink rule the Notebook gets, behind the theme's sheet.
- `ownsSettings`: the page is drawn without the saved value of each key; the value stays saved.
- Every face of every declared font as `@font-face{font-family:'theme-<font id>';…;font-display:swap;
  src:url('/themes/<hash>/<file>') format('woff2')}`. A `display` font is `--font-display`. A
  `reading` font is a value of the reading-font setting (`fontPreset`) and a `chrome` font one of the
  chrome-font setting, while the theme is chosen; each falls back to the default stack for a missing
  glyph; on a Chinese, Japanese or Korean page the reading font leads that language's CJK stack.
  A palette is a value of the default palette (`themePreset`), written into the same `--c-*`
  variables a built-in one is, the newsletter included. The reader's palette menu lists, by their
  own names, the default and every palette the owner turned on (`enabledPalettes`), the theme's
  as well as the built-in ones, in stored order. A write may name a theme's palette there only
  when the theme it leaves chosen has it (`enabledPalettesFor`, shared with MCP). Chosen alone,
  there is no menu: no built-in palette is added to the stored list on its behalf.
- A stored font or palette id that is not on offer (the theme removed, another chosen) is drawn as
  the default and **kept** in the row, as an unknown theme id is: choose the theme again and they
  come back. So are a theme's ids in `enabledPalettes`: kept by every save, not drawn.

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

## Previewing one

The owner can look at any theme the site can draw, built in or installed, before choosing it
([`src/web/theme-preview.ts`](../src/web/theme-preview.ts)). Nothing is saved and nothing is logged.

- **Preview** on a tile is a link to `GET /api/themes/<id>/preview` in a new tab. That route is on the
  owner's gated router; it sets `__Host-quire_theme_preview=<id>` (`HttpOnly; Secure; SameSite=Lax;
  Path=/; Max-Age=3600`) and sends the tab to `/?theme-preview=<id>`. An id the site cannot draw
  (removed meanwhile, never installed, unreadable) clears the cookie and sends the tab to the Look
  card with `?preview-refused=<id>&why=missing|unreadable`, where the card says which in words.
- **On every public GET or HEAD carrying the cookie** (never the admin, sign-in, setup or `/api/`), the
  page is drawn in the previewed theme only when the request has the owner's session AND the id is a
  built-in one or an installed one whose current version reads. Otherwise the cookie is ignored and
  the answer is the reader's page, byte for byte: no bar, no header, nothing that names it.
- The previewed page is the reader's page drawn by the same renderers in a request-scoped preview
  ([`src/server/theme-preview-scope.ts`](../src/server/theme-preview-scope.ts)), where `resolveTheme`
  answers the previewed theme, plus a bar at the top in the admin's words in the site's language:
  "Previewing &lt;name&gt;", **Choose this theme** and **Leave preview**. The bar is in the flow above
  the page, so it covers nothing, and coloured only with the page's tokens.
- It goes out `private, no-store`, `Vary: Cookie`, `X-Robots-Tag: noindex, nofollow`, with a robots
  meta saying the same and no `speculation-rules`. A file named by its hash (`immutable`) keeps its
  own headers.
- **The page cache neither serves nor stores a previewed page**: `PageCache` refuses both while a
  preview scope is open, whoever calls it, and the warm renders outside any scope, so a flush started
  inside a previewed request (a link card fetched while it rendered) cannot fill the cache with it.
  The purge fetches no page.
- **Leave preview** is `GET /theme-preview/leave?to=<path>`: public, so a session that ran out can
  still leave; it clears the cookie and goes back to the page it was pressed on, without the
  `theme-preview` parameter (a path on this site only, anything else goes to `/`; characters a
  header cannot carry are percent-encoded). **Choose this theme** leaves the same way and lands on
  `/admin/settings?tab=appearance&pick-theme=<id>`, where the island presses that tile as a click
  would and takes the parameter out of the address; Save stores it. A theme removed meanwhile is
  not pressed, and the card says so.

## In the admin

Settings → Appearance → **Theme** lists every installed theme as a tile after the four built in,
in the same grid and the same track (`src/web/admin/screens/settings-appearance-installed.ts`, the
island [`src/admin/island/lib/settings-themes.ts`](../src/admin/island/lib/settings-themes.ts)).

- **Choosing one is choosing a built-in.** The tile is a key in the `theme` choice track, so it is
  pressed, counted and stored by the sheet's one Save as a built-in tile is; nothing new on the
  wire. The tile shows the screenshot (`current.screenshot`, cropped from the top over a neutral
  drawing that shows if the file does not load), the manifest's name, the version and author, and
  an **Unreviewed** badge on every one.
- **Install from a file** sends the zip to `POST /api/themes` and says what came back under the key:
  installed, already installed (nothing changed), refused with one line per finding (the rule in
  words from `themeRules` in `locales/admin/`, then the code, `file:line:col` and the subject), too
  large (`413`), no answer (a network failure), or the status of any other error. The key is busy
  while the file travels and one install runs at a time.
- **Preview** sits under every built-in tile and every readable installed one (never on an
  unreadable one), a link opening the site in a new tab wearing that theme ([above](#previewing-one)).
- **Roll back to &lt;version&gt;** appears only on a theme with an earlier live version; **Remove**
  asks first, saying a blog wearing it goes back to Plain.
- After an install, a rollback or a removal the picker is drawn again by the server
  (`/admin/settings?tab=appearance`, read and swapped in place): the rest of the form keeps its
  unsaved edits, and an unsaved pick of a theme still on offer stays pressed.
- **The pickers offer what a theme adds while its tile is pressed**, saved or not
  ([`settings-appearance-offers.ts`](../src/web/admin/screens/settings-appearance-offers.ts), the
  island [`settings-offers.ts`](../src/admin/island/lib/settings-offers.ts)). Every installed theme's
  palettes and reading and chrome fonts are drawn into the palette cards and the two font grids,
  after the built-in ones, marked `data-theme-option="<id>"` and "from <name>", hidden unless their
  theme is the pressed tile. A palette card shows its own colours and opens a note in place of a
  colour table; its "Shown to visitors" tick works as a built-in card's. A font tile is set in
  `'theme-<hash>-<font id>'` (its `@font-face` rules ride in the redrawn part of the card) over a
  generic family, so two themes naming a font alike never draw each other's file; when the browser
  cannot load the face, the tile drops its sample and says so. Every lookup is scoped to the cards
  and keys on offer, so ids two themes share stay apart. Pressing another tile hides them; a pick
  of one goes back to the stored value when that is on offer, else to the default the page would
  draw, and comes back if the theme is pressed again before anything else is picked. A stored id
  that is not on offer is drawn pressed as the default, so the screen opens clean and the id stays
  stored; pressing its theme presses it again. While the pressed tile is not the saved theme, the
  save sends the palette, both fonts and the reader's palettes as shown (`data-k-force`), changed
  or not, so the row never keeps a value the form does not show. The Save key counts what moved.
  Picking a theme reading font leaves the type table alone.
- **The settings it draws itself** (`ownsSettings`) ride on its tile as `data-owns`, and the
  controls are hidden with the line naming it while it is pressed, as for Newspaper.
- **Use this theme’s suggested palette and fonts** shows under the tiles while the pressed theme,
  built in or installed, suggests a palette or font that is on offer and differs from the pick
  (`data-suggested` on every tile). It presses them as the owner would, unsaved. Pressing an
  installed tile moves nothing by itself; a built-in tile still moves its chrome font as before.
- **The admin's own document** draws the editor in the reading face and palette the site draws, a
  theme's included, and never a theme's chrome font.
- **A warning** sits at the top of the card when the stored theme is not what the site draws:
  no live version of it (`missing`), a manifest the renderer refuses (`unreadable`), or its
  `theme.css` gone from the blob store (`sheet_missing`). The check is
  [`src/content/theme-health.ts`](../src/content/theme-health.ts), run when the screen is drawn.
- **A theme whose manifest does not read** is listed as a dashed tile with its id, a line saying it
  cannot be read, and its Remove key (and Rollback, when an earlier version exists); it is not a
  key of the theme track, so it cannot be chosen. One such row used to take the whole Settings
  screen down with a 500.
- **A screenshot that does not decode** is hidden by the island, so the drawing under it shows.
- After a redraw, focus lands on the theme just installed or rolled back, or on the pressed tile
  after a removal; the install answers sit outside the redrawn part, in a live region that stays.
- **The activity log** records `theme.install` (id and version; an install that changed nothing is
  not recorded), `theme.rollback` (id, the version left and the one current again), `theme.remove`
  and `theme.choose`, written by both the settings save and the MCP tool `update_appearance` when
  `theme` moved ([`src/content/theme-choice-log.ts`](../src/content/theme-choice-log.ts)): an
  installed theme as `Name (id)`, a built-in one as its id, named on the log screen in the
  reader's language.

## Limits

- **Files no row names are not cleaned up.** An install that failed after writing its files, and
  every version removed or rolled back, leaves its files in the store, counted in the storage
  figure and carried by every backup. They are small (a package is at most 10 MB expanded) and
  written once per hash.
- **A backup is trusted as it is.** Loading one puts its theme rows and files back without
  checking them again, as it puts back the owner's custom CSS: the archive is the owner's own.
- **A refused install is not in the activity log**, since it changed nothing; the request log has a
  line for each install, refusal, rollback and removal.
- **A theme's palettes reach the reader's menu only while it is chosen.** Its ids stay in the
  stored list under another theme, unseen, and the Appearance screen shows their ticks only with
  its tile. Removing the theme leaves them there too; they are drawn only for a theme that has
  them, so they do nothing, and only unticking them under that theme takes them out.
- **The MCP tool's description lists the built-in palettes and fonts only.** It takes the chosen
  installed theme's ids too, checked by the rule the settings route uses
  (`content/theme-choices.ts`), and refuses anything else, but an agent has to know them.
- **A theme's fonts are never preloaded.** They are whole woff2 files, not the engine's subsets,
  so like an uploaded font they swap in rather than compete with the sheet ([performance.md](performance.md)).
  A title set in a theme's display or reading face paints first in the fallback.
- **A theme palette's name is the author's, in one language**; the built-in names are translated.
- **A preview draws the theme over the saved settings as they are.** What pressing the tile would
  move (a built-in theme's suggested chrome font) moves only when it is chosen, and a stored palette
  or font of another installed theme is drawn as the default, as it would be once this one is chosen.
- **A preview is one browser's, by cookie.** Every tab of that browser shows it until Leave, Choose
  this theme, or an hour; another browser signed in as the owner does not. Behind a CDN that keeps
  HTML whatever the cookies say, pages after the first may come from the edge without the preview
  ([delivery.md](delivery.md#a-theme-preview-passes-both-layers-by)).
- **Offline reading never keeps a preview**: the service worker stores no page marked `private` ([reading.md](features/reading.md)).
- **When a theme's palette is the stored default but not on offer**, the engine's default (Mono)
  is drawn and joins the reader's menu for as long as that lasts; the stored list is not changed.
