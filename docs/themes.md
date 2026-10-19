# Writing a theme

> For the person who makes a Quire Ink theme. Read this and the
> [starter repository](https://github.com/joiha-steven/quireink-theme-starter), and you can ship a
> theme that passes the checker without asking anyone. The rules behind it are
> [ADR 0072](decisions/0072-a-theme-is-a-checked-skin-over-the-one-markup.md); the owner's side
> (installing, choosing) is in [appearance.md](appearance.md) and
> [theme-install-api.md](theme-install-api.md). One page per refusal, with a refused and a passing
> example for each, is [themes-css-rules.md](themes-css-rules.md).

## 1. What a theme is, and is not

A theme is a **CSS skin over the one markup**. The engine draws every page with the same HTML for
every theme, and a theme is a zip holding `theme.json`, one `theme.css`, a screenshot, and
optionally woff2 fonts and images.

- **No HTML and no JavaScript.** You cannot add an element, move one in the source, or run a
  script. You can only style the elements and names the engine draws.
- **It sits over `plain`**, never in place of it. What your sheet does not style is drawn as the
  base draws it, so a feature added to Quire Ink later shows up in your theme too, unstyled by you.
- **The owner wins.** The theme's sheet is served in a cascade layer; the owner's settings and
  Custom CSS are outside every layer and beat it whatever your selectors weigh
  ([section 6](#6-the-contract)). Colours reach the page only through palettes, and sizes and
  faces only through the engine's variables, so the owner's palette, text sizes and font choices
  still apply to a theme that follows the rules. `!important` is refused.
- **It is checked, not trusted.** The same checker runs when someone installs the zip and on your
  machine as `bun run theme:check`. A theme it passes is a theme the install accepts.
- **What is never themed:** sign-in, setup, restore and the whole admin. A theme also cannot
  write words: the text on the page is the engine's, in the reader's language
  ([S3](themes-css-rules.md#s3-no-words-in-content)).

## 2. Start

Copy the [starter](https://github.com/joiha-steven/quireink-theme-starter): it is a complete,
passing theme written to be changed. Its README walks the same steps.

1. Clone the starter, and clone and install the product once (the checker and the preview live
   there). You need [Bun](https://bun.sh) and, for the preview, a headless Chrome:

   ```
   git clone https://github.com/joiha-steven/quireink.git
   cd quireink && bun install
   ```

2. In the starter's `theme/theme.json` change `id`, `name`, `author`, `homepage`, `description`;
   start `version` at `1.0.0`. The id is lowercase letters, digits and single hyphens, at most 40
   characters, and not `plain`, `code`, `paper` or `notes`.
3. Loop: edit `theme/theme.css`, then, from inside the product clone:

   ```
   bun run theme:check /path/to/quireink-theme-starter/theme
   bun run theme:preview /path/to/quireink-theme-starter/theme
   ```

   `theme:check` writes nothing. It prints `ok · <id> <version> · <n> files` and exits 0, or one
   line per finding as `rule · file:line:col · subject` with the admin's sentence for the rule
   under it, and exits 1. `theme:preview` checks first, then photographs the theme on every kind of
   page, at 375, 768 and 1440 wide, light and dark, once per palette, into
   `.tmp/theme-preview/<id>/` (open `index.html`, the contact sheet). About a minute per palette;
   `--pages`, `--widths` and `--force` are in
   [theme-install-api.md](theme-install-api.md#preview-before-installing). The starter's
   `check.sh` and `check.ps1` run both in one go.
4. **Zip the folder's contents, not the folder.** `theme.json` must be at the top of the zip.
   Finder's Compress and Explorer's "Send to compressed folder" on the folder itself nest everything
   one level down and the install refuses that. Hidden files are refused too (`.DS_Store`,
   `Thumbs.db`, `__MACOSX/`).

   ```
   # macOS / Linux, from inside the theme folder
   zip -r ../my-theme.zip . -x '.*' '*/.*' '__MACOSX/*'

   # Windows PowerShell, from inside the theme folder (the built-in bsdtar, not Compress-Archive,
   # which writes backslashes in names on Windows PowerShell 5)
   & "$env:SystemRoot\System32\tar.exe" -a -cf ..\my-theme.zip --exclude Thumbs.db --exclude .DS_Store (Get-ChildItem -Name)
   ```

   Then `bun run theme:check /path/to/my-theme.zip` on the zip itself.
5. **Install:** Settings → Appearance → Theme → **Install from a file**. The admin answers
   installed, already installed, or refused with one line per finding. The tile shows your
   screenshot, name, version, author and an **Unreviewed** badge, on every installed theme: nothing
   but the engine's checks has looked at it.
6. **Preview in the admin:** **Preview** under the tile opens the site in a new tab wearing the
   theme, changing nothing; **Choose this theme** there, then Save, puts it on the blog.
7. **Ship a fix:** raise `version` and install the new zip over the old. The previous version is
   kept: **Roll back to &lt;version&gt;** on the tile removes the current one and brings the earlier
   back. **Remove** deletes the theme; a blog wearing it goes back to Plain paper.

**There is no gallery and no review service.** Quire Ink does not host themes. To share one, hand
over the zip (a release on your repository is a good place); whoever installs it sees it as
Unreviewed.

## 3. The package

Only these paths exist in a package, one level deep, nothing else:

| Path | Required | Limit |
|:--|:--|:--|
| `theme.json` | yes | 65536 bytes (64 KiB) |
| `theme.css` | yes | 65536 bytes (64 KiB) |
| `screenshot.webp` | yes | WebP, exactly **1200 x 900**, at most 1048576 bytes (1 MiB) |
| `fonts/<name>.woff2` | no | each at most 409600 bytes (400 KiB) |
| `images/<name>.webp\|png\|jpg\|jpeg\|avif\|svg` | no | each at most 1 MiB; an SVG may hold no script, event handler or link out |

Whole package: at most **64 files**, **10485760 bytes (10 MiB)** once expanded, and a zip of at most
**5242880 bytes (5 MiB)**. The numbers are `THEME_LIMITS` and `SCREENSHOT_SIZE` in
[`src/theme/types.ts`](../src/theme/types.ts) and
[`src/theme/check-files.ts`](../src/theme/check-files.ts).

- Hidden files, other names, other folders, a link, two names that differ only in case, a name
  with `..` or a backslash, and a file whose bytes are not what its extension says (a `.webp` that
  is not a WebP, a `.woff2` that does not start `wOF2`) are refused. Text files are UTF-8 without a
  byte order mark.
- A licence text cannot go inside the zip (`fonts/OFL.txt` is refused). Keep it beside the zip, as
  the starter does in `licenses/`.
- The screenshot is drawn on the theme's tile at the top of the picture; any other size is refused
  rather than stretched.

## 4. `theme.json`

Every key is checked and an unknown key at any level is refused (a typo would otherwise do nothing
and you would never learn why). Every failure is rule A6
([A6](themes-css-rules.md#a6-the-manifest-is-not-right)) naming the JSON path, for example
`palettes[0].light.meta`.

| Field | Type | Required | Allowed |
|:--|:--|:--|:--|
| `api` | integer | required | `1` (the versions this build reads) |
| `id` | string | required | kebab-case (`a-z`, `0-9`, single hyphens), at most 40; not `plain`, `code`, `paper`, `notes` |
| `name` | string | required | 1 to 60 characters, visible, no control or format characters |
| `version` | string | required | `major.minor.patch`, numbers only: `1.0.0` |
| `author` | string | required | 1 to 80 characters, visible, no control or format characters |
| `license` | string | required | 1 to 40 characters, same check (an SPDX id such as `MIT-0` is a good habit) |
| `homepage` | string | optional | `https://` URL, at most 200, no user or password |
| `description` | string | optional | 1 to 200 characters, same check |
| `layout` | object | optional | `menu`: `"rail"` or `"header"`; `deepenMetaInk`: boolean ([section 7](#7-palettes-fonts-and-layout-switches)) |
| `palettes` | array | optional | up to 8 ([section 7](#7-palettes-fonts-and-layout-switches)) |
| `fonts` | array | optional | up to 6, each with 1 to 4 faces; a font `name` is 1 to 60 characters from letters, digits, space, `.`, `_`, `-` |
| `suggests` | object | optional | `palette`, `readingFont`, `chromeFont`: ids of something that exists |
| `ownsSettings` | array | optional | up to 16 distinct keys from `table.head`, `table.grid`, `table.ruleWeight` |

A palette is `{ id, name, light, dark }`; `light` and `dark` each hold `bg`, `text`, `heading`,
`meta`, `link`, `rule`, `accent` as `#rrggbb`. A font is `{ id, name, role, faces }`; a face is
`{ file, weight, style }`. The starter's manifest, trimmed: two of its three palettes are left out,
the font is declared at 400 and 700 instead of 400, 500, 600 and 700, and the description is
shortened:

```json
{
  "api": 1,
  "id": "starter",
  "name": "Starter",
  "version": "1.0.0",
  "author": "Quire Ink",
  "homepage": "https://github.com/joiha-steven/quireink-theme-starter",
  "license": "MIT-0",
  "description": "A calm reading theme with the menu in the masthead.",
  "layout": { "menu": "header" },
  "palettes": [
    {
      "id": "linen",
      "name": "Linen",
      "light": { "bg": "#f7f3ec", "text": "#2e2a25", "heading": "#1d1a16", "meta": "#665d52", "link": "#94401f", "rule": "#e2d9cb", "accent": "#94401f" },
      "dark": { "bg": "#1c1a17", "text": "#e3dcd1", "heading": "#f3ede4", "meta": "#a99f91", "link": "#e8a07c", "rule": "#3a352f", "accent": "#e8a07c" }
    }
  ],
  "fonts": [
    {
      "id": "starter-literata",
      "name": "Literata",
      "role": "reading",
      "faces": [
        { "file": "fonts/literata.woff2", "weight": 400, "style": "normal" },
        { "file": "fonts/literata.woff2", "weight": 700, "style": "normal" }
      ]
    }
  ],
  "suggests": { "palette": "linen", "readingFont": "starter-literata", "chromeFont": "inter" }
}
```

## 5. CSS rules

The checker reads `theme.css` as a browser does and refuses what the standard refuses. The one
line to remember: **a theme sets the shape; colour, size, face and words come from the engine.**

| Code | In one line |
|:--|:--|
| [C1](themes-css-rules.md#c1-a-colour-is-written-into-the-sheet) | no hex, colour name or fixed `rgb()`; colour only from palette variables or derived from them |
| [T1](themes-css-rules.md#t1-a-font-size-is-written-into-the-sheet) | font size only `var(--fs-*)`, `em`, `%`, or `calc()` over `--fs-*` |
| [F1](themes-css-rules.md#f1-a-font-family-is-named-in-the-sheet) | `font-family` only an engine font variable or `inherit` |
| [P1](themes-css-rules.md#p1-important) | no `!important` |
| [S1](themes-css-rules.md#s1-a-selector-names-something-the-contract-does-not-promise) | classes, ids and `data-*` only from the contract |
| [S2](themes-css-rules.md#s2-the-blog-and-the-front-page-must-both-be-styled) | style both the blog pages and the front page |
| [S3](themes-css-rules.md#s3-no-words-in-content) | no words in `content` and the other text properties |
| [V1](themes-css-rules.md#v1-a-custom-property-the-theme-may-not-set-or-read) | set only `--t-*` properties; read only contract variables, `--t-*`, `--l-*` |
| [A1](themes-css-rules.md#a1-an-at-rule-or-property-that-is-not-allowed) | only `@media`, `@supports`, `@container`, `@keyframes`; no `attr()` outside `content` rules |
| [A2](themes-css-rules.md#a2-a-url-that-is-not-a-file-in-the-package) | `url()` only to a file in the package |
| [A3 to A6](themes-css-rules.md#a3-a-file-the-package-may-not-hold) | the package and `theme.json` ([section 3](#3-the-package), [4](#4-themejson)) |
| [X1](themes-css-rules.md#x1-css-a-browser-would-drop-or-read-differently) | syntax a browser would drop: nesting, a missing colon, an unclosed brace |

Each has the admin's sentence, a refused example and the passing rewrite in
[themes-css-rules.md](themes-css-rules.md). Every example there was run through the real checker.

## 6. The contract

[appearance-contract.md](appearance-contract.md) is the list of names the product promises to
keep. It has three kinds of name, and the checker holds you to all three:

- **Variables** (`--c-bg`, `--fs-h2`, `--font-display`, `--sp`, ...): you **read** them with
  `var()`; you never set one. Setting any custom property that is not `--t-*` is V1, so a theme
  cannot overwrite what the engine or the owner sets. Your own variables are named `--t-*`; the
  starter builds its card ground that way:
  `--t-card: color-mix(in srgb, var(--c-heading) 4%, var(--c-bg))`.
- **Selectors** (classes and ids, `.post-list`, `.fc`, `#comments`, `header.site`): any element
  name is free (`article`, `h2`, `a`), but a class or id must be in the contract. The last column
  of its tables, **blog**, **front** or **both**, is what S2 counts: use at least one **blog**
  name and one **front** name. A name marked **both** counts for neither.
- **Data attributes** (`data-palette`, `data-scheme`, `data-theme`, `data-list`, `data-motion`
  on `<html>`; `data-lead`, `data-thumb`, `data-short` on a list row): you may select on them.
  Your own theme is `html[data-theme=<your id>]`; the attribute is on every page.

**Versioning.** `theme.json` declares `"api": 1`. Within api 1 the contract only grows: names are
added, none removed or renamed. Removing or renaming a name raises the api number, and the
previous api is still read for at least one minor release, so an installed theme keeps working
while its author moves it. A name that is not in the contract may still work today and may change
in any release without a note.

**Cascade layers, and why custom CSS wins.** The base stylesheet is `@layer base`; your sheet is
served wrapped in `@layer theme` (so you write no `@layer`, and `@layer` is refused), after base;
the owner's settings, the pen and the Custom CSS box are in no layer, which beats every layer.
Inside the theme layer, specificity and order apply as normal. Three consequences:

- You do not need heavy selectors to beat the base: `.post-meta{...}` wins over the base's own
  rule for it.
- A handful of base rules keep their weight against any theme (the engine restates them in the
  theme layer ahead of your sheet). To override one you need a heavier selector than the base
  uses, not just a later rule. The untitled post's header is the known case
  ([section 8](#8-pitfalls-that-happened)); the full table is in
  [looks.md](conventions/looks.md#who-wins-cascade-layers).
- The base sheet's own `!important` declarations are served outside every layer, so they beat any
  rule in your sheet, and P1 forbids you `!important`. When a base declaration will not move,
  do not fight it with weight: style a different contract element (a wrapper or a child) to get
  the look, or accept the base's value. Run the preview to see which declaration holds. If the
  look is impossible without it, that is a missing name or knob in the contract, worth reporting.

## 7. Palettes, fonts and layout switches

**Palettes.** A palette is a menu entry the owner can make the default and the reader can pick.
Up to 8; `id` is kebab-case, unique in the theme and not `mono`, `sepia`, `forest`, `ocean`,
`scifi` or `amber`; `name` is 1 to 40 characters and is in your one language (built-in names are
translated, yours are not). Each of `light` and `dark` needs all seven colours as `#rrggbb`.
`text`, `heading`, `meta` and `link` must each reach a contrast of **5.0:1** against `bg`, in both
halves (the floor every built-in palette clears); `rule` and `accent` are not measured. A failure
names the path: `palettes[0].light.meta`. A palette is written into the same `--c-*` variables a
built-in one is, so everything in your sheet that reads `var(--c-meta)` follows it.

**Fonts.** Declared in `theme.json`, never in the sheet (`@font-face` is refused, A1).

- One `file` per face: `fonts/<name>.woff2`, in the package. Up to 6 fonts, up to 4 faces each.
  `weight` is one number, 100 to 900 in hundreds, never a range; `style` is `normal` or `italic`;
  two faces of one font may not share a weight and style.
- **No `unicode-range`.** The engine writes one `@font-face` per face, so a file subset to Latin
  leaves every other glyph to the fallback. A Vietnamese or other latin-ext blog needs a file
  covering all its subsets. The starter's README shows building one file covering Latin, Latin
  Extended and Vietnamese.
- **A variable font is declared once per weight you use**, the same file listed again for each
  weight (the starter lists `literata.woff2` at 400, 500, 600, 700), or the browser fakes the
  others.
- `role`: `reading` (a choice in the reading-font setting while the theme is chosen), `chrome`
  (a choice in the chrome-font setting), or `display` (the headline face, reached as
  `var(--font-display)`). `name` is letters, digits, space, `.`, `_` and `-` only.
- `id` is kebab-case, unique in the theme and not a built-in font's: `inter`, `source-sans`,
  `literata`, `source-serif`, `reading`, `plex-mono`, `jetbrains-mono`. The starter ships Literata
  as `starter-literata` for that reason.
- **Licence files cannot go inside the zip** (A3). Keep an OFL or similar text beside it. A font
  with a Reserved Font Name may not keep that name once you subset it.
- Fonts are not preloaded, so a title in your display face paints first in the fallback and then
  swaps in.

In the sheet you use a font only by variable: `font-family: var(--font-display)`. A `display` font
is `--font-display` for the whole theme; reading and chrome fonts apply only when the owner picks
them (or presses "Use this theme's suggested palette and fonts").

**Layout switches** are declared in `layout`, from the engine's list (a built-in theme can do
nothing an installed one cannot):

- `menu: "header"` draws the site menu in the masthead, as Newspaper does; `"rail"` (default) keeps
  it in the sidebar. **The engine does the work**: it marks the rail's copy of the menu
  (`.rail-menu-copy`) and a rail holding only that copy (`.rail-menu-only`), and hides both from
  60rem up where the masthead shows the menu; below that the copy is the phone drawer's. A theme
  writes nothing for this. Only a theme that also shows its header menu below 60rem hides the
  copies itself (see [looks.md](conventions/looks.md#what-every-dialect-must-obey)); style where
  the menu sits with `header.site .site-menu`, as the starter does.
- `deepenMetaInk: true` for a theme that lays the page on a ground darker than the palette's `bg`
  (the Notebook's desk): the engine moves the meta ink a step toward the text ink for the whole
  page, because your sheet may not set `--c-meta` itself. Default false.

**`ownsSettings`** lists owner settings your theme draws itself, from the closed list `table.head`,
`table.grid`, `table.ruleWeight` (the table header row, which lines, line weight). While the theme
is chosen the admin hides those controls and the page is drawn without their saved values (the
values stay saved and apply again on another theme). Leave it out unless you style tables
completely.

**`suggests`** names a palette, a reading font and a chrome font that the admin offers to switch on
with the theme ("Use this theme's suggested palette and fonts"), unsaved until the owner saves. Each
must be one of yours or a built-in id of that kind.

## 8. Pitfalls that happened

- **Hiding `.post-info` drops an untitled post's date.** Above the rail breakpoint the base draws
  no header for a post with no title, because its date is in the `.post-info` side column. Hide
  the column and the date appears nowhere. Bring the header back with a rule heavier than the
  base's hold. These four rules pass the checker; they are adapted from Newspaper's rules, with the
  theme id as prefix (`src/web/look-paper.css.ts`, "A PIECE WITH NO HEADLINE"):

  ```css
  html[data-theme=my-theme] .post-info{display:none}
  html[data-theme=my-theme] article > header:has(.post-facts):not(:has(h1)){display:grid}
  html[data-theme=my-theme] article > header:not(:has(h1)) ~ .prose{margin-top:calc(var(--sp) * 2.5)}
  html[data-theme=my-theme] article > header:not(:has(h1)) .post-facts{margin-top:.5rem}
  ```

  The `:has(.post-facts)` is deliberate: it makes the selector outweigh the base's hold. Check it
  with `--pages post-untitled`. The starter avoids the trap by keeping the panel.
- **Selectors on markup the contract does not name pass the checker and can break on any update.**
  The checker only reads class, id and `data-*` names, so these all pass:
  `header.site .site-bar{display:contents}` (what sits inside `.site-bar`, and that it is one box,
  is not promised), `display:contents` plus grid placement of an element's children, positional
  selectors such as `article > :first-child`, `body:has(.toc) .prose`. Each depends on structure
  the engine may change. (A list page's heading is not one of these: it is `.listing-head h1`,
  named in the contract.) Prefer contract names; where you cannot, put a
  comment on the rule saying what it depends on (the starter does) so the next update's breakage
  is easy to find.
- **A sheet that sets `body{font-family: var(--font-reading)}` passes F1 and breaks the owner's
  chrome-font control**, because the chrome (header, footer, rail, dates) stops following it. Set
  a face on the specific pieces you mean (`.title`, `.deck`), not on `body`.
- **`theme:preview` measures five things**: a page wider than the window, a box past the window's
  edge, text cut by `overflow: hidden`, an image that did not load, a font file that did not load.
  It leaves out what a page does on purpose (a wide table scrolling in its frame, `line-clamp`).
  It does **not** catch uneven spacing, misalignment, overlap that fits in the window, low contrast
  of text you placed on a ground of your own (only palettes are contrast-checked), hover and focus
  states, print, or a missing date like the one above. Look at the contact sheet.
- **A theme can only be as good as its screenshot is honest.** The tile shows
  `screenshot.webp`, cropped from the top; make it from the preview's shots of your own theme at
  exactly 1200 x 900. The four built-in tiles beside it show the same kind of picture, the front
  page at the top, so a sheet of grey bars would read as the one tile with nothing to show.
