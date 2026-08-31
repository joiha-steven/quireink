# The admin visual contract

What the admin admits to being, and what a change to it may not break. Read this before
touching a screen under `src/admin`.

This file used to be a LOG: five dated sections, each recording what one pass changed, in
the order the passes happened. That is a snapshot, and snapshots live in the private
repository (ADR 0017) — the dated report of any given pass is not here and does not belong
here. `check:docs` only rejects a dated FILENAME, so this drifted for a month without
failing anything. What is below is the same knowledge rewritten as rules that hold today,
with the measurement that produced each one kept where it is the reason to believe the rule.

## What the admin is

An application workspace, not a reading surface. It shares the product's quiet, editorial
character and none of its typographic rules **except one**, below.

- **The public reading interface is out of scope.** Its typography, fonts and type settings
  are deliberate; admin polish never changes them.
- **ONE FACE. The admin is Inter, everywhere, with one carve-out for the editor.**
  Set on 2026-08-15, with the editor keeping the face the frontend publishes in.
  It replaces the TWO FACES rule adopted eight days earlier (2026-08-14), and both are the
  owner's to set — what is worth writing down is why
  the division works on the reading site and not here. There, it runs between a post title and
  its date: two genuinely different kinds of thing, read by someone with time to feel it. In
  the admin it landed between a setting's LABEL and the sentence under it — two halves of one
  control, four lines apart, in two typefaces. A form is scanned, not read, and a reader
  scanning does not experience that as meaning; they experience two voices. Rank by SIZE and
  WEIGHT instead (`src/admin/components/scale.ts`).
  **The carve-out is the editor, and it is not a preference:** the editor is WYSIWYG, so the
  writing surface and the TITLE field must be set in the face the post will publish in. Those
  two, plus the font picker's own specimen tiles, are the only holders of `.reading-font` —
  `src/admin/components/one-face.test.ts` fails on a fourth. `--font-reading` and `spa.ts`'s
  `fontPresetCss` therefore stay; deleting either makes the owner write in Inter and publish
  in something else.
- **The admin's chrome face is ITS OWN, and it is Inter.** It is not `chromeFont`. It followed
  that setting for a day and was rejected as cluttered and wrong for an admin. A chrome font
  is a branding choice about what a READER sees;
  spending it on the tool put a monospace code face on every label, tab, button and table
  cell, and beside a book serif that is two loud unrelated voices rather than one division.
  Three versions of one Settings screen were photographed — two faces on the mono chrome, one
  face throughout, and Inter + the reading face — and he chose the third. On 2026-08-15 he
  chose the SECOND of those three instead (above), which is the same rejection of the mono
  chrome arriving at a simpler answer.
  ⚠️ Do not wire it back. Two things went with it and must stay gone: `MONO_TRACKING`, which
  corrects a wide monospace and has nothing to correct here, and the `data-chrome-font`
  attribute on the shell, whose only reader that rule was.
  **What the admin still follows is everything about the owner's WORDS** — palette, type
  scale, reading preset, uploaded face — because the editor is WYSIWYG and a post has to be
  written in the face it publishes in.
- **BY ROLE, NEVER BY TAG** — kept, because it is what made the two-faces era survivable and
  it is what will catch the next attempt. The first version was a `.admin p` rule, and a tag is
  not a role: `Setting` renders its hint as a `<p>` and `ui/Input` renders the identical hint as
  a `<span>`, so the Site tab shipped *"Changes the interface language and date format."* in
  Literata four lines above *"Words auto-used as the excerpt…"* in JetBrains Mono — one card,
  one kind of thing, two faces, and neither call site was wrong. Every type decision travels on
  a role from `components/type.ts`, never on an element; `check:admin-kit` fails a screen that
  hand-types a hint or names a typeface at all. `data-prose`, the page-level escape hatch, is
  GONE with the second face — there is nothing left for it to switch to. The one place a
  `fontFamily` may still appear is a `data-specimen` surface, which paints itself in the family
  it offers.
- ⚠️ **Two mechanisms were tried against these symptoms and BOTH were wrong.** They are
  recorded because each looked right and each was built on a misread.
  `font-size-adjust: from-font` on `body`, to close the x-height gap — measured per 1em:
  JetBrains Mono 0.550, Inter 0.539, IBM Plex Mono 0.516, Literata 0.508, Source Sans 3 0.486,
  Source Serif 4 0.481, so a 12px serif hint really does render at 92% of the mono label
  beside it. It cannot carry the leading with it and CSS gives no way to make it: `line-height`
  resolves against the COMPUTED font-size, and `20px`, unitless `1.6` and `normal` all produce
  an identical line box with the adjustment on and off while the glyphs inside grow. Tailwind's
  line-heights are absolute, so it took every hint from 1.67 leading to 1.54.
  Then `letter-spacing: normal` on every reading-face role, to undo the inherited mono
  tracking. That one WORKED, and it was still a patch at each site for a problem whose source
  was one line in `adminStyles`. Both are gone. **An x-height gap between two faces is ordinary
  typography; text with less air than it was drawn for is what a reader feels, and the owner
  felt it twice before either mechanism was questioned.**
- **The canvas is PAPER** (`#f7f6f4`), and a card is a SHEET on it: a hairline edge, a 10px
  radius, and no shadow at all. It was a flat neutral gray (`#f5f5f5`) under `rounded-2xl`
  white cards carrying a 1px drop shadow, and on 2026-08-15 that was rejected as looking
  cheap and beneath the product. The diagnosis was not workmanship: gray canvas +
  rounded white card + soft shadow + tinted pill tabs is the costume every generated dashboard
  wears, and **nothing in it came from this product**. The reading site next door is one sheet
  of paper with hairlines ruled across it and nothing floating anywhere, so the tool is now
  built from the same three things — paper, a rule, and space.
  ⚠️ The **font** was not part of this. The admin's chrome face stays Inter and the site's
  monospace chrome font stays out (see above, and the two rejected mechanisms). What the 2026-08-14
  pass got wrong was treating "not the mono font" as the whole answer: the face came out and
  nothing went in, so the admin fell back to the framework's defaults. A typeface and a visual
  language are different questions.
- **Hierarchy comes from spacing and rules, not decoration.** Cards are for genuinely
  independent data; shadows are for overlays, and `check:admin-kit` now fails a raised white
  surface that is not `sticky` or `fixed` — the control-scale relief below is 1–2px of edge,
  not a float, and does not move this rule.
- **Relief says what a control IS (2026-08-31, owner's call; the board that set the direction
  is in the private repository under `brand/signal/`).** Raised means pressable — a light lip
  on top, 1px of contact below. Carved-in means ON or CONTAINING: a field holds its value
  (`CONTROL_CHROME`), and a checked `Tick`, a latched segment and the switch's groove are held
  down. Grey shading in 1–2px, never a gradient; what is neither pressable nor on stays flat.
  THE CLICK: travel and the carved shadow land instantly (`active:duration-0`), only the
  release is sprung — easing both ways feels like a screen. Reduced motion keeps the shadow,
  drops the travel. Homes: `ui/Button`, `ui/Switch`, `ui/Tick`, `CONTROL_CHROME`, the
  segmented item in `tabs.tsx`; screens inherit and add nothing. The toast is now ONE neutral
  sheet with a pilot lamp in the version dot's hues — green good, amber needs you — plus the
  glyph, so colour never carries the message alone. The newsletter send button is a TWO-STAGE
  LATCH in the same amber: the first press arms it and prints the recipient count the send
  will use, only a second press within five seconds sends, and Esc, an outside click or the
  countdown stands it down — it replaced a native `confirm()` that asked with none of the
  numbers, for the one action this product cannot undo.
- **Square corners are a PUBLIC rule.** Admin uses a 10 / 8 / 6px radius hierarchy — sheet,
  nested panel, control — never a global square reset, never arbitrary per-component rounding.
  It was 16 / 12 / 8; a 16px radius on a 1200px panel reads as a pill rather than as a page.
  **Audited by measurement 2026-08-28**, because a rule nobody checks is a wish: every
  computed radius across eighteen admin screens, counted. It found Tailwind's BARE `rounded`
  (4px, not a step in this hierarchy) on 108 chips, badges and thumbnails, and three screens
  that had hand-rolled a square chooser — `border px-3 py-2`, no radius at all — while the
  Pictures and Galleries choosers directly below them on the same screen used the kit's
  segmented track. Both are on the scale now; the choosers use the kit, which is also three
  fewer copies of a control the kit already owns.
  **Under 16px the hierarchy does not apply**, and that is a judgement rather than an
  oversight: 6px on a 16px checkbox is a 38% corner, which reads as a blob. Checkboxes and
  the small state dots keep 4px, and `ui/Switch.tsx` says so where somebody would otherwise
  "fix" it.
- **TWO INKS NOW, owner's call 2026-08-29** — and the rule below is kept because its argument
  is still the test, not because the count is still one. The wordmark took three colours
  (ink, red ballpoint, highlighter) when it shipped on 2026-08-27, so "monochrome plus one"
  had stopped describing the product it belongs to. What did not change is WHY a colour is
  allowed: it has to mean on screen what it means on paper. The highlighter is what you mark
  as worth returning to. **The red ballpoint is what you strike OUT — so it dresses the
  actions that destroy something, and nothing else.** `SHEET_TOOL_DANGER` and the `danger`
  button variant are its only two homes; Restore, Cancel and Close stay grey beside them,
  because a delete that looks like its neighbour is what put a native `confirm()` in the way
  of a deleted post. Values from `PEN_AUX_LIGHT`/`PEN_AUX_DARK` in `render/pen.ts`, the one
  source — measured off a photograph of a real pen box, never re-typed by eye.
  A colour that means one thing is a signal; a palette is not. The test for a third ink is
  the same as it always was: what does this pen MEAN on a page?
- **The card carries ONE shadow step** (2026-08-29): 1px of contact at 4% black, an edge
  rather than a lift, dark mode none. It is deliberately an arbitrary value and not
  `shadow-sm`, so `check:admin-kit` did not have to move for it — the thing that guard
  protects against is a card PRETENDING to float while sitting in the flow, which is what a
  named Tailwind shadow gives you. There is no second step; a surface that wants one wants to
  be an overlay.
- **The highlighter marks WHERE YOU ARE** (2026-08-29, and it is the ink's third role rather
  than a fourth colour). The rail's current row and the active tab wear `--pen` with
  `--on-pen`; a SELECTED VALUE does not, and that distinction is the whole point. They had
  the identical black pill, which put "Site" — the section you are in — eight lines above
  "English" — a field's value — in the same ink, size and shape, with nothing answering
  "where am I". A screen where everything is the same rectangle has told you nothing by the
  time you have looked at all of it. The seam is the `Tabs` component, the admin's only
  navigation strip; the ten call sites that build a chooser from `tabItemClass` directly get
  the ink pill, and `components/where-you-are.test.ts` fails the day one of them reaches for
  the marker. ⚠️ The active row is composed from `SIDEBAR_NAV_QUIET`, which has NO hover:
  both hovers are rules on the same property and Tailwind decides which lands last, so
  pointing at the page you were already on repainted it grey. Structure, not out-ranking.
- **Admin is monochrome, plus exactly ONE accent: the product's highlighter** (the Writing
  Desk mock's `--pen`, 2026-08-17). Its roles are named and closed — where you are (above), a
  search hit as a `<mark>` in the write pane, and the small dots that mean "work in progress"
  (a draft's row, the unsaved state, an unfinished chip on the home screen) in its edge tone.
  Feedback,
  status, analytics trends, media selection, warnings, destructive actions and recovery
  banners stay on the neutral scale: a second use of colour spends the only signal that
  means "your words". The admin theme dropdown's colours are isolated from the site's
  configurable palette.
  **ONE exception, owner's call 2026-08-22: the dot beside the version on the dashboard** is
  amber when a newer release exists and green when this install is on the newest, asked for
  in those words. It is the only place in the admin where colour carries a status, and the
  argument for it is that this particular status is rare, actionable, and often a security
  fix — the thing the rule protects ("your words") is not competing for attention on a line
  of build metadata. A third state exists and draws NO dot: not knowing is not the same as
  being current. Adding a second such exception is how the rule stops meaning anything, so
  the next one is a decision rather than a precedent.
- **The rail is words, not pictures.** Sidebar icons are OFF by default (2026-08-15 — the
  rail does not need them); the switch lives at the BOTTOM of
  "Everything else" (2026-08-17 — a set-once device preference does not need a permanent
  footer row), and it means the WHOLE rail: nav glyphs and the footer controls' glyphs alike
  (the always-glyph carve-out tried that day — hiding the nav icons while Light, Clear cache
  and Sign out kept theirs — lasted one evening). A COLLAPSED rail has no labels, so it stays icon-only
  and the collapse control is always available. Reading the setting as "no icons anywhere"
  is what hid the collapse control in the first cut, and the owner could not find it.
  The "Everything else" group itself remembers an EXPLICIT open/close across sessions
  (localStorage); arriving on a page inside it still opens it for the visit, unrecorded.
- **The rail holds FOUR destinations**, and everything else sits behind one control on it
  ([ADR 0024](./decisions/0024-the-admin-is-rebuilt-around-writing.md) step 6): home, write,
  library, newsletter — then analytics, comments, trash, settings, log, help and View blog
  under "Everything else". The group opens itself when the current page is inside it, because
  a rail that hides where you are is worse than a long one. Eleven rows was eleven decisions
  before the one that matters, and the four are what the owner came to do.
- **Writing is the primary task.** Since the two-pane Write screen (2026-08-17) the editor
  no longer hides the rail: the mock draws it, and the owner circled the whole frame. The
  write pane — the list of everything written — rides beside the sheet on the Write screen
  at every width, and **beside an EDITOR only from 1640px**; on a narrower window the sheet
  takes the room and the list is one "← Write" away.
  ⚠️ **1640 is measured, and it was `xl` (1280) until 2026-08-24.** At 1280 the pane left
  the sheet 630px and the editor's button row needs 787: the row wrapped to two lines, the
  action line above it wrapped to two more, and a writer on a 13-inch laptop met THREE tiers
  of chrome before the first word. The pane is 320 and the shell takes 330, so the sheet is
  the window less 650 and the row needs ~950 with air around it. Both the pane and the row
  are the owner's explicit picks; below 1640 they do not both fit, and the writing wins.
  Do not put it back to `xl` without re-measuring the row.
- **Focus mode is the other half of that** (`components/useFocusMode.ts`, 2026-08-24). One
  switch in the action line, `Ctrl/Cmd + \`, takes the pane AND the button row off the
  screen at any width and leaves the paper. It is a device preference in localStorage, not a
  setting: it is a fact about this person at this desk, like the rail's icon switch. The
  default does not change. Nothing is lost while it is on — the bubble bar on a selection and
  "/" at the caret carry every command the row holds, which is the arrangement Medium is
  known for and the reason putting the row away costs nothing.
- **The home carries the numbers; the DETAIL lives on its own screen.** Views, visitors, time
  per post and read-through are on the home page — that is why Analytics could leave the rail
  — and the charts, the ranges and the per-page breakdown are one click further, from the
  cards that show the headline figures. Taxonomy, integrations and system information still do
  not compete on the home page.
- **The home hands back the unfinished writing before it shows anything else.** A count of
  drafts is not the same fact as the drafts; the band names them and opens the editor on one.
  Administration counts (posts, pages, comments, images, storage) sit BELOW the widgets.

## One sheet per page

Adopted 2026-08-18 from the admin-pages mock, which replaced a page-by-page fix session:
mock every page first, then work through them, and stop the pages coming out at different
widths. Four laws, held by the
primitives in `components/sheet.tsx` (`SHEET`, `SheetTop`, `NumBand`, `SHEET_FOOT`,
`SHEET_TOOL`) and `.paper-cols` in `admin.css`:

1. **Every page is ONE full-width sheet at ONE width**, at least the window tall — the
   editor's paper, given to every screen. Long prose (Help) takes a reading column INSIDE
   the sheet; the page never changes size. Never fix a sparse page by narrowing it.
2. **A page's tools live on the sheet's own first row** (`SheetTop`): scope tabs, search,
   sort, export, "empty this kind" — never scattered over the paper around the sheet. A
   second chrome row (the Library's count · search · sort band) is the editor's own
   two-row precedent.
3. **Writing first; the numbers are one line of small print after it.** A comment is two
   lines of its text with one ledger line under it, not a six-column spreadsheet. Where a
   page IS numbers (Analytics), they stand directly on the paper in a `NumBand` divided by
   hairlines — not floated in five little cards. Cards INSIDE a sheet become hairline
   PANELS (`Card panel`), one radius step down, title on a ruled header row.
4. **Lists of short rows fill two newspaper columns** (`.paper-cols`, with the rule a paper
   would draw between them) — one column left half the sheet blank, which the owner read
   as a hole. Comments, subscribers, trash and the activity log all flow this way; the
   columns collapse to one below `lg`.

## One of each · One setting

The kit's measurement-driven rules — how a card title ranks, the two gaps, a field's
height, the anatomy of one setting — moved to [admin-kit.md](./admin-kit.md) when this
file hit the 400-line cap. The name is the guard's: `check:admin-kit` is those rules
made executable.

## Layout

**Cards go in column stacks, never straight into the grid.** A grid lays its children out in
ROWS, and a row is as tall as its tallest cell, so two cards of different heights leave a void
under the shorter one and the next card starts below BOTH. The System tab showed it plainly:
Import, then Backups at twice its height, then Cache stranded with a hole above it. The
fix asked for was simply two columns that pack. A tab is `GRID` holding two `COL`
stacks, with cards assigned to a side by hand so the two come out close in height.

**EVERY settings tab is two columns.** There is no one-column tab, and there was: Site held a
single card and Reading held fifteen toggles beside one switch. Two tabs of seven behaving
differently reads as a mistake. Split the CONTENT, do not leave the layout ragged.

**Do not widen a card to fix its contents.** Making the MCP card span both columns gave its
table room and turned it into a wide slab under a two-column tab. A table that does not fit
scrolls inside its card. Equally: a card holding a five-column table is not a half-width card.

**The workspace** is a 1480px maximum with responsive 16/28/40/48px gutters. The desktop
sidebar is 208px, 72px collapsed; the mobile menu is a floating rounded drawer that overlays
rather than pushing content down. **The rail holds two registers and they must not dress
alike** (2026-08-17 — the rail read as subtly wrong, and the something was four CONTROLS
wearing the nav's row, one of them reading as a page named "Light"): destinations
wear `SIDEBAR_NAV`; the footer's controls (theme, Clear cache, Sign out) wear the smaller,
quieter `SIDEBAR_UTIL`, and their glyphs are ALWAYS drawn — the "Show icons" switch governs
decoration beside nav labels, and a control's glyph is not decoration, it is the part that
says "this does something". That switch itself lives at the bottom of "Everything else",
not on a permanent footer row. The theme control shows its sun/moon glyph before the
applied mode label, and its menu opens UPWARD inside the rail (the rail carries `z-30`
because `sticky` makes it a stacking context the content would otherwise paint over).
Clear cache stays in the operations footer, reachable from every screen, expanded or
collapsed.

## The editor

Its own file: [`admin-editor.md`](./admin-editor.md). The writing surface is the one screen
in this admin with rules nothing else shares — a second typeface, a caret drawn by hand, a
sound — and it grew past the point where it could ride along in a document about cards and
gaps. Everything in this file still applies to it; that one adds what is true only there.

Route changes, the progress bar and recovery from a deploy have their own file:
[`admin-navigation.md`](./admin-navigation.md).

## Icons and marks

- Admin navigation uses the custom Quire Ink line-icon language.
- **The four public-header glyphs are settled** — search circle, three-circle palette,
  sun/moon, two-line menu. A July 12 replacement was reviewed and reverted. Shared button
  sizing still comes from `ICON_BTN`; preserving glyphs does not permit per-button drift.
- Tag labels render lowercase across the public rail, tag archives, post metadata, editor
  selections and taxonomy management, without mutating stored values.
- The mobile reading-rail handle is a restrained 16 × 64px edge tab with a 10 × 18px chevron.
  Keep it narrow; the earlier 24 × 76px footprint needs a mobile review before returning.
- Palette cards stay readable in every state. Use neutral border/surface hierarchy for
  selected, available and hidden; never lower opacity on a whole card or its labels.
  ⚠️ **Shipped broken; found by the owner, not by a check.** An unchecked palette carried
  `grayscale opacity-60`, so hiding Sepia from readers turned Sepia grey *in the editor*
  (reported 2026-08-29). Hidden is a **dashed border** now. The
  swatch also draws all SEVEN colours: six are near-white or near-black in every palette, so
  with the accent as a 4px bar only 3.2% of the card was coloured and Mono, Sepia and Forest
  were three identical grey stripes.
- Backup scheduling and import controls use the shared rounded inputs and buttons, with
  native file-input chrome hidden behind an accessible labelled trigger.

## Still open

- Integrations may need its own secondary navigation if it keeps growing.
- The editor's link prompt is still `window.prompt`; a small accessible popover would be
  better.

