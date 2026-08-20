# Typography — one source of truth (HARD RULES)

- **No hardcoded text sizes on the public site**, and since 2026-07-29 that is a check
  rather than a sentence: `bun run check:type` ([`scripts/checks/type-roles.ts`](../../scripts/checks/type-roles.ts))
  fails the build on any `font-size` in the reader's sheets that is not `var(--fs-<role>)`,
  `inherit`, a value in `em` (an ornament measured against its own context), or a listed
  exception with a reason. It was written because the rule had already been broken in nine
  places, and because a related-post title had no size rule at all and silently fell back to
  the body size.
- **A role is THREE numbers, and a rule takes all three or none.** `check:type` fails a
  rule that sets `font-size: var(--fs-X)` without `line-height: var(--lh-X)` and
  `letter-spacing: var(--ls-X)`. It was added on 2026-07-29 after measuring the rendered
  page: eight surfaces took the size alone — figcaption, the footnote block, both code
  forms, the tagline, the footer, the pager and the ToC sub-rows — so the owner's leading
  and tracking for those roles moved nothing at all. A rule that names a role variable
  LOOKS wired, which is why review never caught it.
- 9 roles (`TypeRole`: `h1–h5`, `body`, `small`, `caption`, `code`), each with
  size/line-height/letter-spacing → CSS vars `--fs/--lh/--ls-<role>`, from
  `DEFAULT_TYPOGRAPHY` in [`src/content/fonts.ts`](../../src/content/fonts.ts) (re-exported by
  `themes.ts`, so either import path works). The owner's
  `settings.typography` is emitted by `typographyToCss()` (also applies in the admin editor
  `.prose` = WYSIWYG). `smoothing` adds `-webkit-font-smoothing` on `body`.
- **`--type-scale` lives inside the variable, not at the call site.** Each `--fs-<role>` is
  emitted as `calc(<size>rem * var(--type-scale, 1))`, so any subtree that overrides
  `--type-scale` (book mode sets 1.05, and its A−/A+ lets the reader override) scales EVERYTHING inside it. It used to be spelled
  per rule, so a rule either had it or did not: book mode enlarged the prose and left
  figcaptions, tags and the comment thread behind.
- **`small` is most of the page.** Dates, tags, footnotes, the footer, the related list and
  the whole comment thread are set in it. Treat a change to it as a change to the site.
- **Where applied:** `.prose` (h1–h5/pre/code/figcaption/table) read the role vars; titles/UI
  OUTSIDE `.prose` use `.fs-h1…fs-h5` (titles) + `.t-small` (secondary text) + `.t-body`
  (body-role text outside prose: card excerpts, footer). H1 = single post/page titles +
  category/tag headings + draft preview; list cards (`PostCard`) = H2; brand wordmark = `.fs-h4`.
  Only fixed public size left: the 404 numeral.
- **No hardcoded letter-spacing on public text either — tracking comes from `--ls-<role>`.** The
  `.fs-h*`/`.t-*` classes already emit `letter-spacing: var(--ls-<role>)`, so NEVER write a literal
  `letter-spacing` on a public heading or title: it overrides the owner's tuned value and the Admin
  letter-spacing control stops working. The one sanctioned exception is the mono-chrome tracking
  correction in `src/render/font-faces.ts`, which corrects a FACE, not a role.
- **Reading-optimized defaults.** Restrained, monotonic heading scale (h1 2.0 → h5 1.0),
  18px body at ~1.7 leading. Two claims that used to sit here were measured on 2026-07-29
  and are not true: h5 (1.0rem = 16px) renders BELOW body (1.125rem = 18px), and the
  measure at `contentWidth` 672 is 70 characters in Inter, 71 in Literata and 72 in Source
  Serif — near the 45-75 band's top, not the 66 the note claimed.
- **THE MEASURE IS A FUNCTION OF THE LANGUAGE, not of `contentWidth` alone**, which is why
  `siteWidthHint` names no character count in any of the six locales. Same setting, same
  face, same 18px: the line above measures 71 characters in Literata, and the same column
  running Vietnamese measures **67**. Vietnamese syllables are short, so a line carries ~16
  words and therefore ~15 of the narrow glyphs a space is — more characters fit in fewer
  pixels. CJK is further away again, and a Latin band quoted at a Japanese or Chinese owner
  would be wrong by more than it is right.
  Measured 2026-08-14 on a live Vietnamese article, by walking every rendered line box and
  dropping each paragraph's last (partial) line — 417 to 473 full lines per width:
  `contentWidth` 720 → 72 · 685 → 68 · **672 → 67** · 665 → 66 · 650 → 64.
  ⚠️ Two cheaper methods were tried first and BOTH lied. Dividing a paragraph's character
  count by its line count reads low, because every paragraph ends on a partial line. Laying
  the text out in an off-screen probe read 80, because the line count was derived from the
  block height and rounded. Only the per-line-box walk agrees with the 2026-07-29 figure.
- **Reset restores the CHOSEN FONT's setup, not `DEFAULT_TYPOGRAPHY`.** Each preset carries
  typography tuned for its own face, so resetting to the Inter defaults while reading in
  Literata silently swapped the serif's numbers for a sans's. Text wraps normally (no `text-wrap: balance`/`pretty` — both re-broke lines
  and left a premature right rag). Change the numbers in `DEFAULT_TYPOGRAPHY`.
- **A heading belongs to what comes after it.** Space above beats space below at every
  level (`prose.css.ts`). It did not: heading margins were a multiple of the HEADING's own
  size while the space below was a fixed multiple of the BODY's, so the two converged as
  the level dropped and inverted at h5 — 22px above, 25px below. Measured after the fix:
  h2 44/14, h3 36/11, h4 32/11, h5 27/11.
- **Every text family declares a metric-matched fallback** (`'<Family> Fallback'` in
  `src/render/font-faces.ts`, riding each stack right behind the primary name): the local
  face the stack falls back to — Georgia for the serifs, Arial for the sans — reshaped with
  `size-adjust`/`ascent-override`/`descent-override` to the family's own measurements, so
  the `font-display:swap` moment changes glyphs without moving a line break. Verified in
  the browser: 1,200 chars at 640px set 17 lines/505px in Literata AND in its fallback,
  where bare Georgia set 16/475 — the swap used to move a full line. The numbers are
  measured by `scripts/ops/font-fallback-metrics.py` over a Vietnamese + English sample
  read glyph-by-glyph from the shipped woff2 subsets (NOT `OS/2.xAvgCharWidth`, which
  averages bare a–z and misreads diacritics); rerun it when a font file is re-dropped. The
  monos carry no fallback on purpose: their files only download on pages with code, and a
  code block's box, not its glyphs, sets that layout. Pinned in `typography.test.ts`.
- **Inter is self-hosted** (`src/assets/static/fonts/inter-{latin,latin-ext,vietnamese}.woff2`,
  variable, declared via `@font-face` + `unicode-range` in `src/render/font-faces.ts`, which is
  also where `--font-inter` is set). **Never fetch a font from Google** at build or at runtime —
  it broke offline and CI builds, and it is the reason all of these are in the tree. The OG
  route self-hosts the same Inter separately as `.woff` (Satori can't decode woff2). To update
  Inter, re-drop the woff2 files. **Which font files are `<link rel=preload>`-ed is one
  system-wide rule** (`fontPreloadHrefs` → `docs/performance.md`): only the LCP title's reading
font, only the site language's subset(s), never the chrome font or an uploaded custom face.
- **ONE typeface for everything the reader READS, and one for code.** Two handles, plus
  `--font-mono`. There is no third: no `font-family` anywhere else, no second text family.
  `--font-mono` is JetBrains Mono, self-hosted, and it dresses BOTH inline code and fenced
  blocks — it was a `var(--font-mono, ui-monospace)` fallback that nothing ever defined, so
  inline code came out in the book serif and a fenced block three lines later came out in
  whatever `ui-monospace` meant on that machine. Declaring the face costs a page with no
  code nothing: `unicode-range` means the browser fetches a file only when a glyph needs it
  (measured 2026-07-29 — 30 KB on a post with code, 0 KB on one without). A custom font (`settings.customFont` =
  family + `faces[]` per weight 400/500/600/700, uploaded via `FontUpload` → `/api/files/font`,
  stored at `files/font-<weight>-<ms>`, store-relative) overrides `--font-reading` —
  one `@font-face` per weight because faux-bold is disabled (`font-synthesis-weight: none`).
  `/og` renders Inter + the custom font (`src/web/og.ts` `?font=`). Empty = bundled Inter.
- **Admin chrome does NOT follow the reader's type settings** — not the scale, and since
  2026-08-14 not the FACE either. It uses Tailwind's standard scale and its own Inter; only
  the admin editor `.prose` mirrors the reader. Don't wire admin chrome to `--fs-*`, and don't
  wire it back to `chromeFont`: the admin followed that setting for a while, and putting a
  mono code face on every label, tab, button and table cell is what the owner then called
  "rối" — cluttered — and "không hợp để dùng trong admin". A chrome font is a branding choice
  about what a READER sees; the tool is not where it is spent. What the admin still follows is
  everything about the owner's own WORDS — palette, type scale, reading preset, uploaded face
  — because the editor is WYSIWYG. See `web/admin/spa.ts` `adminStyles` and
  [`admin-design.md`](../admin-design.md).
- Editor exposes H1–H5; `marked` renders `####`/`#####` → `h4`/`h5`.
- **A reader never downloads admin CSS.** The public sheets are hand-written and the admin's is
  the only Tailwind in the project; the rule and the seam live in
  [`performance.md`](../performance.md) "The two sheets".

## Book mode is ONE number, fixed by the owner (HARD RULE)

    book mode reading text = article reading text x 1.15
    every gap inside the article  = the same x 1.15

Set on 2026-07-29 and not to be changed. Type and the space around it are one system:
enlarging the words and leaving the gaps gives crowded reading, not bigger reading. So
`--sp` (the article's spacing unit) carries `--type-scale` exactly as `--fs-<role>` does,
and every gap inside the article is a multiple of `--sp`.

**The block is emitted TWICE, and that is the mechanism.** A `var()` inside a custom
property is substituted where the property is DECLARED, not where it is used. `--fs-body`
on `:root` therefore resolves `var(--type-scale, 1)` against `:root`, where the scale is
undefined, and the resolved value inherits. Overriding `--type-scale` on a descendant
changes nothing. This file used to state the opposite, and **book mode had been rendering
at exactly the article's size since the port** — measured 2026-07-29, every ratio 1.000.
`typographyToCss` now emits the identical block on `:root` and on `.book-overlay`, which
re-substitutes it there. Pinned by `web/typography.test.ts`.

## Fonts — two handles, four built-in presets

- **Built-in fonts (`fontPreset`).** Four self-hosted families in `FONT_PRESETS`
  (`src/content/fonts.ts`): Inter, Source Sans 3, Literata, Source Serif 4 — each declared per
  unicode-range in `src/render/font-faces.ts`,
  so a family downloads ONLY when the chosen preset uses it. Each preset carries the typography
  TUNED for it; picking a font in Admin → Appearance drops that setup into the editable roles (still
  owner-owned). Preload tracks the chosen font. A preset may also set `readingBold` (the serifs use
  600, since their 700 is blacker than the 600 headings) — `fontPresetCss` emits it as `--reading-bold`,
  consumed by `.prose strong`; sans presets omit it and fall back to 700.
- **Two font handles — chosen font ≠ site font.** `--font-reading` is the reader's own words (post
  body + title, list cards, comment body, the editor `.prose`) and is what `fontPresetCss` /
  `fontToCss` point (custom upload wins). `--font-sans` is the system-chrome face (dates/reading-time,
  related/taxonomy, header, footer, rail — **the PUBLIC page only**), driven INDEPENDENTLY by the `chromeFont` selector
  (`CHROME_FONTS` in `src/content/fonts.ts`, Admin → Appearance): `inter` (default, no override) ·
  `reading` (points `--font-sans` at `--font-reading` so the chrome follows the reading font) ·
  `plex-mono` (self-hosted IBM Plex Mono — a "code" chrome while the body stays readable; declared
  per unicode-range in `src/render/font-faces.ts`, two static weights range-mapped 400/600,
  preloaded when active).
  `chromeFontCss` emits the override LAST in the layout (after the reading font resolves); the legacy
  boolean `fontChromeInter` migrates on read (`false` → `reading`). Layout also stamps
  `<html data-chrome-font>`; a rule in `font-faces.ts` uses `[data-chrome-font="plex-mono"]` to pull the wide
  mono chrome in by `-0.04em` (on `body`/`.t-small`/`.t-body` — the reader's `.prose`/`.fs-*` keep
  their own tracking, other chrome fonts keep default). Apply reading text with the `reading-font`
  class (`.prose` sets it).
