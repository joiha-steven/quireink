# Layout, header and chrome (HARD RULES)

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

## The article's section break is a SHORT centred rule (HARD RULE)

`.prose hr:not(.fn-rule)` is 6em wide, centred, with air above and below. A book does not
rule a line across the text block to change subject. The FULL-WIDTH rule stays for the
structural separations, which are a different job: the footnote rule, the top of the
comment thread, the pager. Those are edges of the document; a section break is a pause
inside it. In book mode the same break becomes the asterism.

## Chrome reuse, the divider and the rail (HARD RULES)

- **Repeated chrome shares ONE class constant — never hand-roll per element.** Sibling controls
  import the same string so they can't drift. Admin nav is a **collapsible left sidebar**
  (`AdminSidebar.tsx`): each item has an icon (`navIcons.tsx`) + label; a toggle collapses the rail
  to icon-only (persisted in localStorage; it publishes its width as `--admin-nav-w` so the fixed
  settings/editor save bars offset past it). Nav links use `headerActions.ts` `SIDEBAR_NAV` (active
  links add `SIDEBAR_NAV_ACTIVE`); the footer holds the **light/dark toggle + Clear cache + Sign out**
  (palette selection moved to the public site); on mobile
  it's a hamburger drawer (always icon+label). (`ADMIN_NAV` is the older horizontal variant.)
  It lists **four destinations** and puts the rest behind one "Everything else" button
  ([ADR 0024](../decisions/0024-the-admin-is-rebuilt-around-writing.md) step 6) — the group is
  indented by a RULE on its wrapper, never by padding on the rows, because those rows share the
  one class constant this bullet is about.
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
- **Rounded corners are allowed site-wide (public + admin).** The old global `border-radius: 0`
  reset that forced the public frontend square has been DROPPED — elements now carry their own
  `rounded-*` radius and unstyled elements stay square by default. Use ONE radius scale everywhere:
  cards/tables/modals `rounded-2xl` (16px), grouped controls/segmented tracks `rounded-xl` (12px),
  buttons/inputs/selects/nav rows `rounded-lg` (8px), pills/switches/badges fully round. Do not
  invent one-off radii (no `rounded-md`); change shared primitives first (`kit.tsx` CARD/CONTROL/
  Select/Tabs, `ui/*`, `iconButton.ts`). Admin `<select>` uses the styled `Select` (kit.tsx) and
  free-text-with-suggestions uses `Combobox` — never a raw native `<select>`/`<datalist>` (their
  OS popups can't be themed: wrong font, cramped, no hover).

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
- **The same facts are in the markup twice, and exactly one copy has a box at any width — above 768px.** Below it BOTH copies of the book-mode row are hidden (`.meta-book, .book-mode-toggle{display:none}`), which is why the phone gets its own floating entry (`.book-fab`, `assets/js/book.ts`) rather than a third copy of the row.
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

## Paper is a surface (`print.css.ts`)

A reader who prints an essay, or saves it as a PDF, is reading it. Until 2026-08-24 there
was not one `@media print` rule in the twelve sheets, so what they got was the screen: the
progress bar, the site bar's four controls, a "book mode" button, the related posts, the
whole comment thread, the subscribe card and the footer — ten sheets of paper for a
four-page piece.

Three rules govern the print sheet, and they are the same three any change to it should
answer to:

1. **What is left out is anything you DO.** Controls, the conversation, the invitations to
   subscribe. A related-posts list you cannot click is not a courtesy on paper.
2. **The palette is redefined, never the rules.** `--c-bg`, `--c-text`, `--c-heading`,
   `--c-meta`, `--c-link` and `--c-rule` are set to ink-on-paper inside the print block, so
   every existing rule keeps painting in `var(--c-*)` and nothing downstream has to know
   paper exists. `--c-accent` is deliberately NOT overridden: the pen marks are the site's
   signature and a colour printer should give the reader the ones the writer drew.
   `!important` is used, and only here — the settings layer is inline and lands after this
   sheet, so `html.dark` would otherwise win and print a black page.
3. **The owner's type prints.** `check:type-roles` refuses a size on the reader's page that
   the owner cannot set, and it is right about paper too — a blog set large is usually set
   large on purpose. The print sheet sets the MEASURE (150mm, about 70 characters at the
   12pt a default 16px body prints as) and hyphenation, and leaves size and leading alone.

The hide-list is checked by `src/web/print.test.ts`: every selector it silences has to be
one this site still uses, on a rendered page or in the screen half of the sheet. A print
rule that stops matching fails silently forever otherwise — nobody prints a page to check a
refactor.
