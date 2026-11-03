# Theme recipes and questions

> For the person who makes a Quire Ink theme, beside [themes.md](themes.md) (the steps and the
> rules) and [themes-css-rules.md](themes-css-rules.md) (one section per refusal). Each answer here
> came from making a theme from nothing and getting stuck at that point. Every CSS block on this
> page passes the checker as written: `bun run check:theme-docs` runs them all, so a block that
> stopped passing would fail the build.

## The variables a theme reads

A theme reads these with `var()` and never sets them (V1); its own are named `--t-*`. The owner's
settings write them, so a sheet built from them follows every setting. The full list with the
classes and attributes is [appearance-contract.md](appearance-contract.md): its heading says
"safe to set" because it is written for the owner's Custom CSS box; for a theme it is read-only.

| Group | Variables | What follows them |
|:--|:--|:--|
| Colour | `--c-bg` `--c-text` `--c-heading` `--c-meta` `--c-link` `--c-accent` `--c-rule` | the palette, light and dark |
| Type size | `--fs-h1` … `--fs-h5` `--fs-body` `--fs-small` `--fs-caption` `--fs-code` | the owner's Text sizes card |
| Leading, tracking | `--lh-*` and `--ls-*` for the same nine roles | the same card |
| Face | `--font-reading` `--font-sans` `--font-mono` `--font-display` | the reading and chrome font settings, and your `fonts` |
| Weight | `--fw-title` `--fw-heading` | the base |
| Space | `--sp` (the unit) `--density` `--radius` | the owner's Shape setting |
| Measure | `--shell-w` `--rail-gap` | the owner's Content width |
| Motion | `--dur-fast` `--dur-base` `--dur-slow` `--ease-out` | the motion switch |
| Label | `--l-figure` `--l-table` (only in `content`) | the blog's language |

## Colours

**How do I change the colours?** In `theme.json`, not in the sheet. A palette is seven colours
twice, once for light and once for dark ([themes.md section 7](themes.md#7-palettes-fonts-and-layout-switches)).
The sheet then reads them, and follows whichever palette the owner or the reader picks:

```css
.prose a{color:var(--c-link)}
.prose blockquote{border-left:3px solid var(--c-accent)}
```

**I need a shade that is not one of the seven.** Mix it from them. A shadow, a card ground and a
hover tint are all a palette colour with less of itself:

```css
:root{--t-card:color-mix(in srgb,var(--c-heading) 4%,var(--c-bg))}
.post-list article{background:var(--t-card);box-shadow:0 2px 8px color-mix(in srgb,var(--c-heading) 8%,transparent)}
.chip:hover{background:color-mix(in srgb,var(--c-link) 12%,transparent)}
```

`white`, `black` and `rgba(0,0,0,.1)` are C1. `transparent` and `currentcolor` are allowed.

**Something only in the dark.** Scope it on the root:

```css
:root[data-scheme=dark] .prose img{opacity:.9}
```

## Type

**Which fonts can a theme use?** <a id="which-fonts-can-a-theme-use"></a> The sheet never names a
face; it uses one of four variables, `var(--font-reading)` (the words of a post), `var(--font-sans)`
(the chrome: header, footer, rail, dates), `var(--font-mono)` (code) and `var(--font-display)`
(headlines). Behind them is either a font the theme ships or one already in the engine:

| Built-in id | Face | Can be suggested as |
|:--|:--|:--|
| `literata` | Literata (serif) | `readingFont` |
| `source-serif` | Source Serif 4 | `readingFont` |
| `inter` | Inter (sans) | `readingFont`, `chromeFont` |
| `source-sans` | Source Sans 3 | `readingFont` |
| `plex-mono` | IBM Plex Mono | `chromeFont` |
| `jetbrains-mono` | JetBrains Mono | `chromeFont` |
| `reading` | the reading font, used for the chrome too | `chromeFont` |

So a serif theme with no font file of its own writes `"suggests": { "readingFont": "source-serif" }`
in `theme.json`, and the owner gets it with one press of "Use this theme's suggested palette and
fonts". Each picker has its own list: `"chromeFont": "source-sans"` names a reading font and the
checker refuses it (A6, `suggests.chromeFont`). A face that is not in the table (Georgia, a Google font) ships as a woff2
in `fonts/` if its licence allows it ([themes.md section 7](themes.md#7-palettes-fonts-and-layout-switches)).
A font installed on your computer is not on your readers'.

**Bigger headlines.** Change the size, the leading and the tracking together, from the same role:

```css
article > header h1{font-size:calc(var(--fs-h1) * 1.25);line-height:var(--lh-h1);letter-spacing:var(--ls-h1)}
.prose small{font-size:80%}
```

**Never set a face on `body`, `*` or `.wrap`.** The chrome inherits from there, so
`body{font-family:var(--font-reading)}` sets the menu, the footer, the rail and every date in the
reading face, and the owner's chrome-font setting stops doing anything; `body{font-family:inherit}`
drops them to the browser's default, Times. Set the face on the pieces you mean:

```css
header.site .title{font-family:var(--font-reading)}
.deck{font-family:var(--font-reading);font-style:italic}
```

## Spacing

**How do I change the spacing everywhere?** You cannot move the engine's own rhythm: `--sp` (the
unit every gap is a multiple of) and `--density` (the owner's Shape setting multiplies every gap
by it) are read-only to a theme (V1). Read the unit, and give the pieces you restyle their own gaps from it:

```css
:root{--t-gap:calc(var(--sp) * 1.5)}
.prose p + p{margin-top:var(--t-gap)}
.post-list article{padding:var(--t-gap)}
.post-list{row-gap:calc(var(--t-gap) * 2)}
```

**A wider reading column.** The width is the owner's Content width setting, written as
`--shell-w`; `.wrap{max-width:var(--shell-w)}` is the base's rule. A theme that replaces it takes
that setting away from the owner. Leave it, or read it: `calc(var(--shell-w) * 1.2)`.

## Layout

**The home page as a grid.** The blog home's feed groups its rows by year, inside `.tl-yr`, so a
grid on `.post-list` alone puts each year in one cell and the page reads as one narrow column. The
theme:preview finds nothing wrong with that; only the contact sheet shows it. Let the rows join
the grid, as the reader's own grid view does, and keep the year and month marks across it:

```css
@media (min-width:48rem){
  html:not([data-list=grid]) .post-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:calc(var(--sp) * 2)}
  html:not([data-list=grid]) .tl-yr{display:contents}
  html:not([data-list=grid]) .tl-yr article{margin-top:0}
  .post-list :is(.tl-year-tag,.tl-mark),.post-list article[data-lead]{grid-column:1 / -1}
  /* Half a 672px column leaves a title beside a full-size picture about 150px: break-a-word narrow. */
  html:not([data-list=grid]) .post-list article[data-thumb=side]{grid-template-columns:minmax(0,1fr) 64px}
  html:not([data-list=grid]) .post-list article[data-thumb=side] .card-thumb{width:64px}
}
```

`html:not([data-list=grid])` leaves the reader's own grid button alone; the last two rules shrink a
row's side picture as that grid view does, because at half the column a title beside a full-size
one breaks inside its words (the preview does not report that; the contact sheet shows it).

**Hiding the excerpt on list rows.** A post with no title (`data-short`) has nothing but its
excerpt to show, so hiding every `.card-exc` leaves that row as a bare date. Keep it there:

```css
.post-list article:not([data-lead],[data-short]) .card-exc{display:none}
```

**The menu in the masthead.** `"layout": { "menu": "header" }` in `theme.json` moves the menu into
the header, but the header row is not rearranged for it: on its own the title, the menu and the
buttons share one line and wrap where they run out of room. The starter's chrome group
(`theme/theme.css`, "Chrome") lays the three out on a grid; copy it whole.

**Hiding the side column of a post.** Read [the pitfall](themes.md#8-pitfalls-that-happened) first:
hiding `.post-info` drops an untitled post's date unless you bring its header back.

## When something does not work

**I changed the CSS and nothing changed.** In order of likelihood:

1. A typo in a property or a value. The checker does not catch `colour:`, `display:gird` or a
   missing `;` between two declarations ([X1](themes-css-rules.md#x1-css-a-browser-would-drop-or-read-differently)).
   Open the preview's page in a browser's developer tools: the browser strikes through what it dropped.
2. A base rule outweighs yours. A handful keep their weight against any theme
   ([themes.md section 6](themes.md#6-the-contract)); a heavier selector wins, a later one does not.
3. On a blog: you installed the new zip without raising `version`. That works (the same version
   with other bytes replaces the installed one), but the previous bytes are gone, so there is no
   **Roll back** to them. Raise the version for anything you hand out.

**theme:check says it "left out" files, or read the zip "from inside the folder".** A
`.DS_Store` (Finder writes one into every folder it opens), a `__MACOSX/` copy (Finder adds one per
file), `Thumbs.db` or `desktop.ini`: the install leaves them out the same way, and reads a zip of
the folder from inside it. Nothing to fix. A `warning:` about another hidden file (`.htaccess`) is
different: a zip that carries it is refused.

**My zip was refused with `hint: theme.json is at …`.** The package is further in than one folder
(a folder inside a folder). Zip the folder that holds `theme.json`, or use the command in
[themes.md step 5](themes.md#2-start).

**theme:preview takes a minute.** That is every page, at three widths, light and dark, per palette.
While you work on one thing, photograph only that:
`bun run theme:preview <theme> --force --pages home-list,front-image --widths 1440` takes about
five seconds. Page ids are in [theme-install-api.md](theme-install-api.md#preview-before-installing).

**Where are the shots?** In the product clone, at `.tmp/theme-preview/<id>/`: `index.html` is the
contact sheet, `REPORT.txt` the findings, `screenshot.webp` the tile picture.
