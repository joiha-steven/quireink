> Split from CLAUDE.md — read when touching typography, header/menu alignment, layout/divider, i18n, scripts, or releases. Hard rules used everywhere stay in [`CLAUDE.md`](../CLAUDE.md); this file is the per-area detail.

# Conventions (detail)

## Localization — `src/locales/`

- `types.ts` = shapes (`Dict` public, `AdminStrings` admin). Add a key → every locale file
  must define it (`satisfies` → build error otherwise = the no-missing-keys guarantee).
- `langs.ts` = `SITE_LANGS` + `isSiteLang`. Public `src/locales/<code>.ts`, admin
  `src/locales/admin/<code>.ts`. Supported: **en (default), vi, de, ja, zh, ko** (CJK via
  `system-ui` fallback — Inter has no CJK glyphs).
- **Add a language:** extend `SiteLang`, add a `SITE_LANGS` row + a `DATE_LOCALE` entry in
  `i18n.ts` + both locale files.
- **Add/rename a string:** add to `types.ts`, then fill ALL locale files. Build fails until
  complete. **Keep every locale in sync on any UI string change.**

## Header (public) — alignment is a HARD RULE

- Logo + the icon row share ONE flex line (`items-center`) so icons stay on the logo's
  vertical midline; the description sits below.
- **The logo is auto-sized, never the raw original.** `settings.logoUrl` = the owner's
  untouched source; the header renders `settings.logoRenderUrl` (small WebP scaled to
  `logoWidth` @2x for retina, built on save by `renderLogo` in `files.ts`), falling back to
  the original only for vector/animated logos. The `<img>` carries `width`+`height`
  (`logoRenderHeight`) → no CLS. `saveSettings` regenerates on source/width change and deletes
  the old derived file (one ever exists). PageSpeed image-delivery fix.
- The four public-header glyphs are an owner-approved set: search circle, three overlapping
  palette circles, applied-theme sun/moon, and the asymmetric two-line menu. They use a 24px
  viewBox and render at 20px with 1.5–1.6px round strokes. A four-dot palette, split-contrast
  theme mark, and three-line menu were tried on 2026-07-12 and reverted; do not reintroduce
  them without visual approval. Their shared 40px button chrome still comes from `ICON_BTN`.
- **The icon row is pulled right by `-mr-2.5` (10px) so the LAST glyph aligns flush with the
  content column's right margin** — the 40px button centers a 20px glyph, leaving a 10px inset;
  without the negative margin the rightmost icon sits 10px inside the margin while the logo is
  flush-left (asymmetric). Every icon shares `ICON_BTN`, so this aligns whichever icon is last
  (theme when palettes/grid are off; menu on mobile). Verified with a Playwright edge measure.
- Theme default = **system** (no-FOUC script + `ThemeProvider` both `|| 'system'`); the toggle
  reflects the *applied* theme (`useSyncExternalStore` on `<html>.dark`; server snapshot =
  light → no hydration mismatch).
- Two orthogonal axes: **mode** (`.dark`) × **palette** (`data-palette`). Both controls live in
  `assets/js/theme.ts` and write localStorage plus the attribute. ⚠️ Two things differ from the
  frozen tree: there is **no no-FOUC script** (2.0 has no inline script anywhere — CSS decides the
  first paint, see [performance.md](performance.md)), and only the **enabled** palettes' vars are
  emitted, not all six.

## Typography — one source of truth (HARD RULES)

- **No hardcoded text sizes on the public site**, and since 2026-07-29 that is a check
  rather than a sentence: `bun run check:type` ([`scripts/checks/type-roles.ts`](../scripts/checks/type-roles.ts))
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
  `DEFAULT_TYPOGRAPHY` in [`src/content/themes.ts`](../src/content/themes.ts). The owner's
  `settings.typography` is emitted by `typographyToCss()` (also applies in the admin editor
  `.prose` = WYSIWYG). `smoothing` adds `-webkit-font-smoothing` on `body`.
- **`--type-scale` lives inside the variable, not at the call site.** Each `--fs-<role>` is
  emitted as `calc(<size>rem * var(--type-scale, 1))`, so any subtree that overrides
  `--type-scale` (book mode sets 1.15) scales EVERYTHING inside it. It used to be spelled
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
- **Reset restores the CHOSEN FONT's setup, not `DEFAULT_TYPOGRAPHY`.** Each preset carries
  typography tuned for its own face, so resetting to the Inter defaults while reading in
  Literata silently swapped the serif's numbers for a sans's. Text wraps normally (no `text-wrap: balance`/`pretty` — both re-broke lines
  and left a premature right rag). Change the numbers in `DEFAULT_TYPOGRAPHY`.
- **A heading belongs to what comes after it.** Space above beats space below at every
  level (`prose.css.ts`). It did not: heading margins were a multiple of the HEADING's own
  size while the space below was a fixed multiple of the BODY's, so the two converged as
  the level dropped and inverted at h5 — 22px above, 25px below. Measured after the fix:
  h2 44/14, h3 36/11, h4 32/11, h5 27/11.
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
- **Admin chrome does NOT follow the reader's type settings** — it uses Tailwind's standard
  scale (a fixed design scale); only the admin editor `.prose` mirrors the reader. Don't wire
  admin chrome to `--fs-*`.
- Editor exposes H1–H5; `marked` renders `####`/`#####` → `h4`/`h5`.
- **A reader never downloads admin CSS.** The public sheets are hand-written and the admin's is
  the only Tailwind in the project; the rule and the seam live in
  [`performance.md`](./performance.md) "The two sheets".

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

## The article's section break is a SHORT centred rule (HARD RULE)

`.prose hr:not(.fn-rule)` is 6em wide, centred, with air above and below. A book does not
rule a line across the text block to change subject. The FULL-WIDTH rule stays for the
structural separations, which are a different job: the footnote rule, the top of the
comment thread, the pager. Those are edges of the document; a section break is a pause
inside it. In book mode the same break becomes the asterism.

## IDE chrome — one switch, `settings.ideChrome` (HARD RULES)

The furniture around the article reads as source code; the reading column stays analogue.
The contrast is the point, and because it is a taste it is a switch (Admin → Appearance →
Rendering), server-rendered as `<html data-ide-chrome="on">` so the first paint is right
and no island runs.

- **Every rule hangs off `html[data-ide-chrome=on]`.** Off leaves not a trace. Tested.
- **It never touches the reading column** — not `.prose`, `.reading-font`, `.deck`,
  `.comment-body` or `.fs-*`. Those are the reader's own words and are the half that must
  not look technical. Tested.
- **Two syntax roles, both from theme tokens.** An editor distinguishes a comment from a
  literal, so: labels are `--c-meta` and carry a `//` marker from CSS (never markup, so the
  heading a feed and a screen reader see stays the plain word); counts, dates and figures
  are `--c-text` and counts are bracketed. Never `--c-accent`: this blog's accent is red,
  so every date read as a link that was not one. No third colour, no hex. Tested.
- **Every chrome label is marked, not just the rail's** — the tagline, the series head,
  the related list, the sign-up card, the comment thread, an empty state. One selector
  list, so a new chrome heading that is missed is visibly missed. Tested.
- **`[n]` means literal; `/` means path.** Both come from the SHEET, never from a renderer
  — the round parentheses in the base sheet too, or the switch could not put them back.
  Dates, figures, indices, counts and the pager are all bracketed, and **the brackets are
  `--c-meta` while their contents are `--c-text`**: they are punctuation, not the value.
  The feed's gutter year takes the slash because a year over its months is a hierarchy.
  Markup supplies only the wrappers CSS cannot invent: `.num` round a figure, `.term-list`
  round a run of terms. Tested both ends. (The rail's counts were a filled ring for one
  deploy, on the argument that a term cloud has no sequence to punctuate. Rejected.)
- **The rail keeps the alignment it has with the switch off:** ranged right, hugging the
  article, which is what the owner asked for. The line numbers are rings sitting ON the
  rail's divider out past the text, so they cost the rail no width. An earlier pass ranged
  the rail left to put a gutter column where an editor puts it, and it was rejected.
- **The gutter is legible** (`--c-meta`, 4.56:1), not a hairline. `--c-rule` measured
  1.16:1 against the page, and a generated counter is still announced by some screen
  readers. What makes a gutter a gutter is where it sits and that its figures are tabular.

## IDE chrome — the header and the index (HARD RULES)

- **The header controls swap icons for tokens, from 640px up**: `[/tìm] [tối] [lưới]
  [@email]`. BOTH are in the markup and the sheet decides which has a box, because the
  switch must leave no trace when it is off — a reader who does not want the terminal look
  gets the icons the site has always had. Below 640px the icons stay: five words are far
  wider than five 40px squares and would wrap the header.
- **A sub-heading in the index is a PATH SEGMENT, not a smaller line.** Same size and weight
  as its parent with a leading `/`, and numbered WITHIN it (`2.1`), because a flat 1..12 run
  made a sub-heading of section 2 look like section 7. Use **`counter-set`, never
  `counter-reset`**: a reset on the parent row creates a new instance scoped to that row and
  its siblings, and the children go on reading the outer one — measured, the index ran
  `1.1 1.2 2.3 2.4 2.5 3.6`. With the switch off the index keeps its bullet and smaller size.

## The article's right gutter — the info panel (HARD RULES)

Above the rail breakpoint an article's right gutter carries `.post-info`: the date, the
length, the way into book mode, then the tags and the categories, **one fact per line**. The
article header is then the title and the deck alone. `post-info.ts` renders it;
`singleRailCss` places it.

- **It does NOT scroll with the article** and its box does not scroll internally. A sticky
  panel rides down the gutter and sits on top of the wide images, which nose out into that
  same gutter by one rail width. The owner ruled on this directly.
- **A `#wide` image or video in the first two blocks stays in the column.** Measured: a post
  opening on one printed the panel's tag rows across the picture. The gutter cannot hold
  both, and text over a photograph is the worse failure. Two blocks and not one, because the
  panel runs to six rows and the header is only the `h1` when the deck is off.
- **The same facts are in the markup twice, and exactly one copy has a box at any width.**
  Below the breakpoint there is no gutter: the panel is `display:none` and the meta line
  above the title plus the taxonomy over its rule are what the reader gets, unchanged. Above
  it, `.post-meta,.taxo-rule,.post-taxo{display:none}`. That rule travels with the panel —
  a panel with nothing hidden is the date printed twice. (`drawer-only` in the listing
  sidebar is the same pattern.) `book.ts` therefore binds **every** `[data-book-open]`.
- **The end-of-article anchors are their own empty `.anchor` elements**, never ids on the
  taxonomy. An anchor with no box cannot be scrolled to, so ids on the hidden paragraphs
  killed the contents list's last row on every desktop, silently.
- **Facts first, the one ACTION last.** Date, length, tags, categories run at one even
  rhythm; book mode sits at the foot with air above it, in `--c-heading` at 500, and takes
  the IDE chrome's `//` because it is the only row that does something. Order is tested.
- **The panel's VALUES are `--c-heading`**, a step darker than the words around them — the
  same ink the contents list gives the row you are on. It is the only place a desktop
  reader sees the date and the length, so it carries the hierarchy alone.
- **The divider carries a dot at the panel's first line.** `--c-rule` measures 1.16:1 and
  all but vanishes over a run this short; the feed's timeline answers the same problem the
  same way, so both gutters speak one language.
- **`article > header .mt-2{margin-top:0}` at this width.** That margin spaced the title
  away from the meta line, which is no longer there — it was the three columns not lining
  up. Both rails start their first line at the same `y`; the title now does too.

## Tags — hyphenated for display, untouched underneath (HARD RULE)

`tagText()` in `content/taxonomy.ts` replaces the spaces inside a tag with hyphens
**everywhere a tag is shown**: the sidebar cloud, the article footer, the info panel, the
tag archive's own heading. "giao diện" reads as two ordinary words, and a cloud of them
reads as a sentence with no way to see where one tag ends. Hyphenated, each is one
unbroken token and the run needs no separator, chip or box.

Display only. The stored term, `termSlug()` and every link keep the real name, so nothing a
URL, a bookmark or a lookup depends on changes. **Categories are proper names and are never
hyphenated.** The Vietnamese label is "Tag", not "Thẻ" — the owner reads the translation as
ambiguous.

## Chrome reuse, divider, colour (HARD RULES)

- **Repeated chrome shares ONE class constant — never hand-roll per element.** Sibling controls
  import the same string so they can't drift. Admin nav is a **collapsible left sidebar**
  (`AdminSidebar.tsx`): each item has an icon (`navIcons.tsx`) + label; a toggle collapses the rail
  to icon-only (persisted in localStorage; it publishes its width as `--admin-nav-w` so the fixed
  settings/editor save bars offset past it). Nav links use `headerActions.ts` `SIDEBAR_NAV` (active
  links add `SIDEBAR_NAV_ACTIVE`); the footer holds the **light/dark toggle + Clear cache + Sign out**
  (palette selection moved to the public site); on mobile
  it's a hamburger drawer (always icon+label). (`ADMIN_NAV` is the older horizontal variant.)
  Public header's 40px icon buttons → `ICON_BTN` (`ui/iconButton.ts`). Adding an item = reuse the
  constant, never copy a class list.
- **Editor toolbar stays one row.** Text is reserved for B/I/U/S, P, H1–H5, and compact table
  abbreviations; semantic actions use line icons with localized `title`/`aria-label`. The row is
  `flex-nowrap` inside `overflow-x-auto` on desktop and mobile. Never put `overflow-hidden` on the
  editor frame: it creates a scroll container and prevents the toolbar from sticking to the viewport.
- **Header/menu alignment must be pixel-exact — the owner is very sensitive and it has drifted
  repeatedly.** Every header-row item (incl. the bigger brand wordmark) is an
  `inline-flex h-9 items-center` box; the row is `items-center`. NEVER align a bigger wordmark
  by `items-baseline` (the recurring bug); never leave an item without the `h-9` box. Verify the
  rendered result before shipping.
- **One divider style site-wide:** the global `<hr>` (full width, faint). Never bespoke
  `border-t`/`border-b` as content dividers; never ALL-CAPS (no `uppercase`) in shipped UI.
- **The sidebar rail never moves the reading column.** `.rail` is absolutely placed inside
  `.with-rail` (which wraps the content, not the header, so the rail's first line is level with
  the article's first line) and sticks on scroll. Its breakpoint is COMPUTED from `contentWidth`
  in `src/render/rail-css.ts` — a media query cannot read a CSS variable — so a wider column simply
  keeps the rail hidden for longer. Below it the SAME DOM becomes a slide-out drawer opened by the
  header menu button (`RailToggle`, mobile only — flips `<html data-rail>`; the drawer + scrim react
  in CSS; the layout hides the button above the breakpoint via `.rail-toggle`). The rail carries the
  site menu at its top (`SidebarMenu`) — the header has no separate menu dropdown. In the gutter the
  rail is type on the page: no border, no shadow, no background.
- **Built-in fonts (`fontPreset`).** Four self-hosted families in `FONT_PRESETS`
  (`src/content/themes.ts`): Inter, Source Sans 3, Literata, Source Serif 4 — each declared per
  unicode-range in `src/render/font-faces.ts`,
  so a family downloads ONLY when the chosen preset uses it. Each preset carries the typography
  TUNED for it; picking a font in Admin → Appearance drops that setup into the editable roles (still
  owner-owned). Preload tracks the chosen font. A preset may also set `readingBold` (the serifs use
  600, since their 700 is blacker than the 600 headings) — `fontPresetCss` emits it as `--reading-bold`,
  consumed by `.prose strong`; sans presets omit it and fall back to 700.
- **Two font handles — chosen font ≠ site font.** `--font-reading` is the reader's own words (post
  body + title, list cards, comment body, the editor `.prose`) and is what `fontPresetCss` /
  `fontToCss` point (custom upload wins). `--font-sans` is the system-chrome face (dates/reading-time,
  related/taxonomy, header, footer, rail, admin), driven INDEPENDENTLY by the `chromeFont` selector
  (`CHROME_FONTS` in `src/content/themes.ts`, Admin → Appearance): `inter` (default, no override) ·
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
- **One accent, one token.** `--c-accent` (per palette, editable in Admin → Appearance) paints the
  active rail marker and the title hover underline. It is seeded from each palette's `link`, so
  Mono stays monochrome. Never hardcode a highlight colour.
- **Rounded corners are allowed site-wide (public + admin).** The old global `border-radius: 0`
  reset that forced the public frontend square has been DROPPED — elements now carry their own
  `rounded-*` radius and unstyled elements stay square by default. Use ONE radius scale everywhere:
  cards/tables/modals `rounded-2xl` (16px), grouped controls/segmented tracks `rounded-xl` (12px),
  buttons/inputs/selects/nav rows `rounded-lg` (8px), pills/switches/badges fully round. Do not
  invent one-off radii (no `rounded-md`); change shared primitives first (`kit.tsx` CARD/CONTROL/
  Select/Tabs, `ui/*`, `iconButton.ts`). Admin `<select>` uses the styled `Select` (kit.tsx) and
  free-text-with-suggestions uses `Combobox` — never a raw native `<select>`/`<datalist>` (their
  OS popups can't be themed: wrong font, cramped, no hover).
- **Public UI colours come ONLY from theme tokens — never hardcode `neutral-*`/`white`/`black`
  or a hex.** Vars `--c-bg/text/heading/meta/link/rule` are utilities (`bg-bg`, `text-text`,
  `text-heading`, `text-meta`, `text-link`, `border-rule`). Every line/border + faint surface
  (code blocks, hovers, banners) uses `--c-rule`. Admin tooling may stay neutral.

## Motion — one engine, token-gated (HARD RULES)

- **`--dur-fast` .15s · `--dur-base` .2s · `--dur-slow` .5s**, in `public.css.ts` `BASE_CSS`
  (2026-08-11; promised here since the frozen tree, absent for all of 2.0). **No `--ease` token:
  its value would be the keyword `ease`, and the scroll-driven animations must stay `linear`.**
  The reasoning, and the count that settled it, is at the definition.
- ⚠️ **The sign-in page has no `--dur-*`** — it is served `pageStyles + LOGIN_CSS`, not the public
  sheet, so a `var()` there silently drops the transition. `login.css.ts` keeps literals, and says
  so at the line.
- **ONE switch gates ALL visual motion.** `<html data-motion>` is server-rendered from `settings.motion.enabled`
  (no flash, no client JS); `html[data-motion='off']` AND `@media (prefers-reduced-motion: reduce)`
  each set `animation:none!important;transition:none!important` on `*` — instant, no branching.
  ⚠️ They do NOT zero `--dur-*` (measured: still `.2s` with the switch off), so never read a token
  in script to decide whether to animate; read the media query and the attribute. Toggle in
  Admin → Appearance → Rendering. Don't add a second motion gate.
- `settings.motion.typewriter` is a scoped editor preference, not another global motion engine. It
  enables the custom caret/line response and synthesized key sound; its visual parts must still obey
  the master motion gate and reduced-motion preference. Audio is generated locally at 45% internal
  volume and must ignore IME composition, modifiers/navigation, paste, and held-key repeats.
- **Cheap properties only** (`opacity`/`transform`/colour) so motion never causes CLS or jank; entrance
  effects must default to fully-visible (e.g. `.reveal` is gated behind `@supports (animation-timeline)`
  + `data-motion='on'`) so unsupported browsers / motion-off never hide content. There is no page-nav
  cross-fade in 2.0: cross-document View Transitions were considered and not shipped
  ([`spec/04-frontend.md`](spec/04-frontend.md)).

## Scripts — `scripts/`

`bun scripts/<name>.ts` — idempotent. Every one of them is a `package.json` script too, and
that is the name to use: `bun run build:assets`, `bun run check:all`, `bun run user`,
`bun run shot`, `bun run drive`. Node is not in the toolchain
([ADR 0005](decisions/0005-rewrite-in-bun-hono-sqlite.md)).

- **The schema is not a script.** `src/store/schema.sql` and `src/store/schema-analytics.sql`
  are embedded and applied at boot; `src/store/migrations.sql` is one file, not a directory.
  Nothing has to be run by hand on a fresh install.
- **WordPress import is an in-app feature** (Admin → Settings → Integrations →
  `src/import/wordpress.ts`), NOT a script. `turndown`, `turndown-plugin-gfm` and
  `fast-xml-parser` are runtime **dependencies** because the importer uses them.
- **`scripts/checks/`** holds the static guards `check:all` runs — `file-size`, `css-literal`,
  `no-nul`, `routes-guarded`, `type-roles`, `admin-kit`, `docs`. A new load-bearing rule that a
  test cannot hold belongs here, not in a comment.

## Docs & releases — keep current

On any behavior change, update the matching doc in the SAME change (Working principle #3):
- **CLAUDE.md** = a router, and nothing else. **`docs/`** = how it works now, one rule in one
  file. **`docs/decisions/`** = why, append-only. **CHANGELOG.md** = one entry per user-facing
  change. **README.md** = setup + features. Direction, dated snapshots and the worklog are
  **not in this repository** ([ADR 0017](decisions/0017-move-state-and-instance-config-private.md)).
- **README is the canonical install/usage doc — keep it current.** Its **two install paths**
  (1️⃣ do-it-yourself, 2️⃣ hand-to-an-AI-agent) + the **MCP "let an agent write & publish"** section
  + the **env-var table** must be updated in the SAME change whenever setup/deploy/env/auth/MCP/backup
  behavior changes (new/renamed env var, a new owner setup step, a changed redirect URI, etc.).
  Never let the README drift from how the app is actually installed and run.
- **Keep personal and instance values out of this repository entirely** — not just
  credentials, but a host, a unix user, an internal port, a service name or a live domain.
  This repository is the product; a fact about one installation belongs in the private
  `quireink-private` ([ADR 0017](decisions/0017-move-state-and-instance-config-private.md)).
  Credentials go nowhere but the gitignored `.env`. Where a script must name such a value,
  it takes it from an environment variable and documents the variable, the way
  [`scripts/ops/quire-backup.sh`](../scripts/ops/quire-backup.sh) does.
- **Audits** are dated snapshots, so they are write-only and they live with the author's
  notes rather than here. Read the latest first so a pass starts from the last clean line.
- **Versioning (owner's rule — do NOT auto-bump):** the version is **`2.0.2`**, released
  2026-08-10. From 2.0 onward the number is **semver and means something**, which is the change
  from the 1.5.x era where `x` was a running counter: MAJOR for a break in how the thing is
  installed or run, MINOR for a feature, PATCH for a fix. **Never bump any of the three on your
  own** — a release is the owner's call, and so is the number. Ship the work, write the
  CHANGELOG entry under an "Unreleased" heading, and ask.
- **Cutting a release** (only when asked): `bun run check:all` exits 0 and `bun run build`
  produces the binary; the CHANGELOG entry is written and dated; push `main`; then
  `gh release create v<version> --title "v<version> — <tagline>" --notes-file <file>`.
  The version lives in exactly **four** tracked places — `package.json`, the title line of
  **both** READMEs (`# quire**INK** <version>`), and this line — plus the CHANGELOG entry
  heading. It said three and named `# **quire**blog`, from before the rename and before
  `README.vi.md` existed, so the instruction for finding the stale copy was itself a stale
  copy. `grep -rn '<old>' package.json README.md README.vi.md docs/conventions.md` before
  tagging; a number left behind in a README is the usual miss.
