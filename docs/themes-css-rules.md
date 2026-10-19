# Every rule the theme checker refuses

> The companion to [themes.md](themes.md). One section per rule code the checker
> ([`src/theme/`](../src/theme/index.ts)) emits, with the admin's sentence for it (`themeRules` in
> `locales/admin/en.ts`), a refused example and the passing rewrite. A finding prints as
> `rule · file:line:col · subject`; the subject is the offending text, cut to 80 characters. When
> the finding has no place in a file (line 0) the command prints `rule · file · subject` without
> `:line:col`.

The stylesheet examples were each run through the real checker (`checkThemeCss`, with the real
appearance contract), inside a sheet that also styles both surfaces so S2 does not speak: every
"refused" snippet returns the code named, every "passes" snippet returns nothing. The package
examples were run with `bun run theme:check` on a copy of the starter with the one change shown.
Any one finding refuses the theme; the checker reports all it finds in one run.

## C1: a colour is written into the sheet

> A colour is written into the sheet. Colours come only from palettes.

Hex, colour names, system colours and `rgb()`, `hsl()`, `oklch()` and the like with fixed numbers
are refused, in any property. Allowed: `var(--c-*)`, `color-mix()` of palette variables,
`transparent`, `currentcolor`, and a relative colour that derives every channel from a palette
variable.

```css
/* refused: C1 · theme.css:1:16 · #94401f */
.prose a{color:#94401f}
/* refused: C1 */
.card-meta{color:gray}
.rail{background:rgb(240 235 225)}

/* passes */
.prose a{color:var(--c-link)}
.card-meta{color:var(--c-meta)}
.rail{background:color-mix(in srgb,var(--c-heading) 4%,var(--c-bg))}
.chip{border-color:oklch(from var(--c-link) calc(l * .9) c h)}
```

If you need a colour that is not one of the seven, add a palette in `theme.json` instead.

## T1: a font size is written into the sheet

> A font size is written into the sheet. Sizes come only from the type scale.

`font-size` may be `var(--fs-*)` (h1 to h5, body, small, caption, code), `em`, `%`, `inherit`, or
`calc()`, `min()`, `max()`, `clamp()` over a `--fs-*`. `px` and `rem` are refused, as is the `font`
shorthand (except `font: inherit`), `zoom`, `text-size-adjust` and `font-size-adjust`.

```css
/* refused: T1 · theme.css:1:17 · 20px */
.deck{font-size:20px}
/* refused: T1 */
.card-exc{font-size:1.1rem}
.deck{font:italic 20px serif}

/* passes */
.deck{font-size:var(--fs-h4)}
.card-exc{font-size:1.1em}
.deck{font-style:italic;font-size:calc(var(--fs-body) * 1.1)}
```

When you change a size, change its leading and tracking with it from the same role
(`--lh-h1`, `--ls-h1`), as one unit.

## F1: a font family is named in the sheet

> A font family is named in the sheet. Faces come only from the font settings.

`font-family` may be `inherit` or exactly one of `var(--font-reading)`, `var(--font-sans)`,
`var(--font-mono)`, `var(--font-display)`. Your own face is declared in `theme.json`
([fonts](themes.md#7-palettes-fonts-and-layout-switches)) and reaches the page through those
variables.

```css
/* refused: F1 · theme.css:1:20 · Georgia,serif */
.prose{font-family:Georgia,serif}

/* passes */
.prose{font-family:var(--font-reading)}
```

## P1: `!important`

> !important is not allowed: the owner's settings must still win.

```css
/* refused: P1 · theme.css:1:31 · !important */
.prose a{color:var(--c-accent)!important}

/* passes: the theme layer already sits below the owner's settings, so weight is for your own rules */
.prose a{color:var(--c-accent)}
```

## S1: a selector names something the contract does not promise

> A selector names something the theme API does not promise to keep.

Element names are free. A class, an id, or a `data-*` attribute must be in
[appearance-contract.md](appearance-contract.md). `[class*=post]` and the other substring matches
on `class` or `id` are refused, because they reach names nobody promised; `[class~=x]` and
`[class=x]` are held to the same list as `.x`. The check reads inside `:is()`, `:not()`, `:has()`
and every other functional pseudo-class.

```css
/* refused: S1 · theme.css:1:1 · .entry-title */
.entry-title{margin:0}
/* refused: S1 */
[class*=post]{margin:0}
.post-list .my-card{margin:0}

/* passes */
.post-list article h2{margin:0}
.post-list article[data-thumb=top]{margin:0}
```

If the thing you want to style has no name in the contract, that is worth telling the project
about: it usually means a name is missing. Until then, see the
[pitfall on unnamed markup](themes.md#8-pitfalls-that-happened).

## S2: the blog and the front page must both be styled

> The sheet must style both the blog and the front page, and one of them is missing.

At least one selector must use a class or id the contract marks **blog** (`.post-list`, `.prose`,
`.deck`, ...) and one it marks **front** (`.front`, `.fc`, `.front-grid`, ...). Names marked
**both** (`.rail`, `header.site`, `.title`) count for neither. The finding has no place in the
file; the subject is the missing surface.

```css
/* refused: S2 · theme.css · front (a sheet that styles only the blog) */
.post-list{margin:0}

/* passes */
.post-list{margin:0}
.front{margin:0}
```

## S3: no words in `content`

> Text in content is not allowed. The words on the page are the engine's.

A string in `content`, `quotes`, `list-style`, `text-overflow`, `hyphenate-character` or
`text-emphasis` may not read as words (any letter, or a digit outside ASCII 0 to 9).
The digits 0 to 9 and punctuation are fine, an empty string is fine, `counter()` and `counters()` are fine
with a digit or symbol style (`decimal`, `decimal-leading-zero`, `disc`, `circle`, `square`,
`none`; not the alphabetic or roman ones), and `var(--l-figure)` and `var(--l-table)` print the
engine's own label in the page's language. `attr()`, `string()` and `content()` in generated text
are refused too. A string in a custom property is held to the same rule where it is written,
because `var()` can carry it into any text property: `:root{--t-label:"Read"}` is S3.

```css
/* refused: S3 · theme.css:1:27 · "Section " */
.prose h2::before{content:"Section "}
/* refused: S3 */
.prose figure::before{content:"Figure"}

/* passes */
.prose h2::before{content:counter(list-item) "."}
.prose figure::before{content:var(--l-figure)}
```

## V1: a custom property the theme may not set or read

> A custom property the theme may not set or read.

You may **set** only properties named `--t-*`. You may **read** with `var()` only a variable from
the contract, a `--t-*`, or a `--l-*` label. `inherit(--x)` and `if(style(--x))` are refused too,
since they reach variables by name without `var()`.

```css
/* refused: V1 · theme.css:1:7 · --accent-soft */
:root{--accent-soft:var(--c-link)}
/* refused: V1 */
.prose a{color:var(--link-colour)}

/* passes */
:root{--t-accent-soft:var(--c-link)}
.prose a{color:var(--c-link)}
```

Setting `--c-bg` or any other engine variable is V1 as well (and C1 when the value is a colour):
colours come from palettes.

## A1: an at-rule or property that is not allowed

> An at-rule or a property that is not allowed, such as @import or @font-face.

Only `@media`, `@supports`, `@container` and `@keyframes` are allowed. `@import`, `@font-face`,
`@layer`, `@namespace` and the rest are refused. So are the properties `behavior` and `binding`,
`expression()`, and `attr()` in any value outside `content` (in `content` it is S3). Fonts go in
`theme.json`; your sheet is already in the `theme` layer.

```css
/* refused: A1 · theme.css:1:1 · @import "more.css" */
@import "more.css";
/* refused: A1 · theme.css:1:1 · @font-face */
@font-face{font-family:"Mine";src:url("fonts/serif.woff2")}
/* refused: A1 · theme.css:1:1 · @layer extras */
@layer extras{.prose{margin:0}}
/* refused: A1 · theme.css:1:13 · attr(data-width px) */
.deck{width:attr(data-width px)}

/* passes */
@media (min-width:60rem){.prose{margin:0}}
.deck{width:100%}
```

For the font, the rewrite is a `fonts` entry in `theme.json` and `font-family: var(--font-display)`
(or reading) in the sheet.

## A2: a URL that is not a file in the package

> A URL that is not a file in the package. Remote and data URLs are refused.

`url()` and `image-set()` must name, as a quoted or bare literal, a file the package holds, written
as the package names it (`images/paper.webp`). A remote URL, a `data:` URL, a path that is not in
the zip, or a `var()` inside `url()` is refused.

```css
/* refused: A2 · theme.css:1:29 · url(https://example.com/paper.webp) */
.post-hero{background-image:url(https://example.com/paper.webp)}
/* refused: A2, the file is not in the zip */
.post-hero{background-image:url("images/missing.webp")}

/* passes, with images/paper.webp in the package */
.post-hero{background-image:url("images/paper.webp")}
```

## A3: a file the package may not hold

> A file the package may not hold, or one whose content is not what its name says.

Covers the package's paths and kinds ([themes.md section 3](themes.md#3-the-package)): a path not
on the list, a hidden file, a link, a nested folder, a missing required file, more than 64 files,
a screenshot that is not a 1200 x 900 WebP (the subject is its size, for example `1000x750`), a
file whose first bytes do not match its extension (the subject is the first bytes in hex), a text
file that is not plain UTF-8, a zip that is not a zip (`not_a_zip`).

```
# refused: a licence text inside fonts/
A3 · fonts/OFL.txt · fonts/OFL.txt
# refused: a hidden file
A3 · .DS_Store · .DS_Store
# refused: screenshot.webp holding text (the subject is its first bytes in hex)
A3 · screenshot.webp · 6e6f7420616e20696d616765
# refused: the folder was zipped, not its contents
A3 · folder/theme.json · folder/theme.json
A3 · theme.json · theme.json     (missing at the top of the zip)
```

The rewrite: remove the file (keep the licence beside the zip), re-export the screenshot at
exactly 1200 x 900, and zip the contents with the commands in
[themes.md](themes.md#2-start).

## A4: an SVG with active content

> An SVG with active content: a script, an event handler or a link out.

An SVG in `images/` is read against an allow list of drawing elements (`svg`, `g`, `path`, shapes,
gradients, `use`, `text` and a few more). A script, an `on*` attribute, a `style` attribute, an
external `href`, `data:` or `javascript:` is refused; the subject names the first thing found.

```
# refused: images/mark.svg containing <script>alert(1)</script>
A4 · images/mark.svg · <script
```

The rewrite is the same drawing as plain shapes and paths, without the script; or export it as
WebP or PNG.

## A5: too large

> Too large: a file, the package, or what it expands to is past the limit.

The limits are in [themes.md section 3](themes.md#3-the-package). The subject is the size in bytes
(for the zip as a whole: the zip's size, or `expands past the limit`).

```
# refused: a font of 518384 bytes (the limit is 409600)
A5 · fonts/literata.woff2 · 518384
```

The rewrite is a smaller file: subset the font to the scripts the blog needs (keeping one file that
covers all of them, see [fonts](themes.md#7-palettes-fonts-and-layout-switches)), or compress the image.

## A6: the manifest is not right

> theme.json is missing a field, or a field has the wrong shape.

The subject is the JSON path of the first problem on each field, and line and column are 0. Missing
field, wrong type, a value outside its allowed set, an unknown key, a duplicate id, a reserved id,
a palette colour that is not `#rrggbb`, a text colour under the contrast floor, a font file that is
not in the package, `not json` when the file does not parse.

```
# refused: author removed
A6 · theme.json · author
# refused: "id": "plain" (a built-in theme)
A6 · theme.json · id
# refused: palettes[0].light.meta is #b5aa9a on #f7f3ec, under 5.0:1
A6 · theme.json · palettes[0].light.meta
# refused: an unknown key at the top level
A6 · theme.json · colour
# refused: a face names a file that is not in the package
A6 · theme.json · fonts[0].faces[0].file
```

Each has the same rewrite: make the field right. For contrast, darken `meta` (or lighten it in a
dark palette) until it reaches 5.0:1 against that half's `bg`.

## X1: CSS a browser would drop or read differently

> CSS a browser would drop, or read differently from how it is written.

The checker refuses a sheet where the browser would repair or ignore part of it, so you are never
left wondering which half applied: CSS nesting (a rule inside a rule), a declaration with no colon,
an unclosed brace or string, a bad URL token, a stray `;` where a selector should be, a class
inside `@keyframes`, `<!--` and `-->` in a selector.

```css
/* refused: X1 · theme.css:1:8 · a{color:var(--c-link)} (nesting) */
.prose{a{color:var(--c-link)}}
/* refused: X1 · theme.css:1:8 · margin 0 (no colon) */
.prose{margin 0}

/* passes */
.prose a{color:var(--c-link)}
.prose{margin:0}
```

An unclosed brace swallows everything after it, so it also tends to show up as S2 or S1 further
down: fix the X1 first and run the checker again.

A file keeps at most 200 findings. Past that the list ends with one more line,
`X1 · theme.css · truncated`: nobody fixes 200 things at once, so fix these and run it again.

## Not a rule, but worth knowing

The checker has limits on purpose and says so in [`src/theme/check-values.ts`](../src/theme/check-values.ts): a relative colour channel can
cancel its keyword (`calc(l * 0 + .6)` is a fixed lightness and passes), and `filter`, `transform`
and `scale` may shift what palette and type produce. Passing the checker means the owner's
settings still reach the page; it does not mean the theme is good. Look at the preview.
