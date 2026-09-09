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
- **ONE FACE. The admin is Inter everywhere, with TWO carve-outs** (one face since
  2026-08-15; the second carve-out 2026-09-07). A form is scanned, not read: two faces
  between a setting's label and the sentence under it read as two voices, not as meaning.
  Rank by SIZE and WEIGHT instead (`src/admin/components/scale.ts`).
  - **The editor**, because it is WYSIWYG: the writing surface, the title field and the font
    picker's specimen tiles are set in the face the post publishes in — the holders of
    `.reading-font`. `--font-reading` and `spa.ts`'s `fontPresetCss` therefore stay.
  - **The page title, and exactly that one line per screen** (`PageHeader`, `.page-title-face`).
    Measured on the home screen 2026-09-07: 129 of 129 text runs were Inter and the title was
    22px/600 against a card title at 15px/600 — seven pixels and no other difference between
    the name of the screen and the name of a box on it, so every page opened with nothing that
    read as its own first line. It is **Literata at a fixed weight, not `--font-reading`**: the
    reading face is a site setting and a screen's own title is not the owner's to re-letter.
    Literata is already loaded in the admin (`allFontFaceCss`), so this costs no new download.

  Both are pinned by `src/admin/components/one-face.test.ts`, which counts the holders of each
  class: a third file wearing either one re-opens a decision by accident.
- **The admin's chrome face is ITS OWN, and it is Inter.** It is never the site's `chromeFont`:
  a chrome font is a branding choice about what a READER sees, and spent on the tool it put a
  monospace on every label, tab and cell. ⚠️ Do not wire it back; `MONO_TRACKING` and the
  `data-chrome-font` attribute on the shell went with it and must stay gone. What the admin
  still follows is everything about the owner's WORDS — palette, type scale, reading preset,
  uploaded face.
- **BY ROLE, NEVER BY TAG** — kept, because it is what made the two-faces era survivable and
  it is what will catch the next attempt. The first version was a `.admin p` rule, and a tag is
  not a role: `Setting` renders its hint as a `<p>` and `ui/Input` renders the identical hint as
  a `<span>`, so the Site tab shipped *"Changes the interface language and date format."* in
  Literata four lines above *"Words auto-used as the excerpt…"* in JetBrains Mono — one card,
  one kind of thing, two faces, and neither call site was wrong. Every type decision travels on
  a role from `components/scale.ts`, never on an element; `check:admin-kit` fails a screen that
  hand-types a hint or names a typeface at all. `data-prose`, the page-level escape hatch, is
  GONE with the second face — there is nothing left for it to switch to. The one place a
  `fontFamily` may still appear is a `data-specimen` surface, which paints itself in the family
  it offers.
- `font-size-adjust: from-font` and a per-role `letter-spacing: normal` were both tried against
  the mixed-face symptoms and both removed: the source was one line in `adminStyles`.
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
- **Relief says what a control IS (since 2026-08-31; the board that set the direction
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
  Audited by measurement on 2026-08-28: every computed radius across every admin screen is
  on this scale, and the choosers use the kit's segmented track rather than a hand-rolled
  square one.
  **Under 16px the hierarchy does not apply**, and that is a judgement rather than an
  oversight: 6px on a 16px checkbox is a 38% corner, which reads as a blob. Checkboxes and
  the small state dots keep 4px, and `ui/Switch.tsx` says so where somebody would otherwise
  "fix" it.
- **TWO INKS NOW, since 2026-08-29** — and the rule below is kept because its argument
  is still the test, not because the count is still one. The wordmark took three colours
  (ink, red ballpoint, highlighter) when it shipped on 2026-08-27, so "monochrome plus one"
  had stopped describing the product it belongs to. What did not change is WHY a colour is
  allowed: it has to mean on screen what it means on paper. The highlighter is what you mark
  as worth returning to. **The red ballpoint is what you strike OUT — so it dresses the
  actions that destroy something, and nothing else.** `SHEET_TOOL_DANGER` and the `danger`
  button variant are its only two homes; Restore, Cancel and Close stay grey beside them,
  because a delete that looks like its neighbour is what put a native `confirm()` in the way
  of a deleted post. Values from `PEN_AUX_LIGHT`/`PEN_AUX_DARK` in `pen/pigments.ts`, the one
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
  than a fourth colour). The active tab wears `--pen` with ink text (the reading site's olive `--on-pen` stays on marks in running text — on a control it read as grey, measured 2026-08-31); the rail's current row
  is a KEY HELD DOWN in the pen — the same full ink as the tab, with the same carved inset
  (2026-08-31: a bar-plus-wash read as a label, and a diluted wash beside the full tab pill
  read as a second ink; one ink, one strength, held down). A SELECTED VALUE gets neither,
  and that distinction is the whole point. They had
  the identical black pill, which put "Site" — the section you are in — eight lines above
  "English" — a field's value — in the same ink, size and shape, with nothing answering
  "where am I". A screen where everything is the same rectangle has told you nothing by the
  time you have looked at all of it. The seam is the `Tabs` component, the admin's only
  navigation strip; the ten call sites that build a chooser from `tabItemClass` directly get
  the SUNKEN KEY, one grey step DOWN from its ground — solid ink shows no relief, and a
  white key vanishes against the white card, so a chosen value is a darker key pressed into
  the groove (2026-08-31, the font tiles and the palette card's editing state carved the
  same way) — and `components/where-you-are.test.ts` fails the day one of
  them reaches for the marker. ⚠️ The active row is composed from `SIDEBAR_NAV_QUIET`, which has NO hover:
  both hovers are rules on the same property and Tailwind decides which lands last, so
  pointing at the page you were already on repainted it grey. Structure, not out-ranking.
- **TWO control heights, and only two (2026-09-01).** `CONTROL`/`Button` `md` are **36px**
  and move together — a field two pixels proud of the button that acts on it is one row
  broken. `CONTROL_SM`/`Button` `sm`/the segmented strip are **32px**, which is what a
  SHEET'S TOOLS ROW wears throughout: the strip sets that row's height, being the widest
  object on it and the first one read, and the key and the field beside it answer to it. The
  ordinary control was 40 until this release — a number the admin arrived with rather than
  one anyone measured. ⚠️ A caller cannot shrink a control by passing `h-8`: it loses to
  `min-h-9`, which is a different property. `Select` swaps its BASE (`small`) instead.
- **Enclosure weakens inward, and settings is built from three ranks.** The sheet's edge, then
  the card's, then whatever is in the card — each line lighter than the one around it. It ran
  backwards until 2026-09-01: the sheet `neutral-200/80`, the card `neutral-100`, and a box
  inside the card `neutral-200` at the card's own 8px radius, so the innermost frame shouted
  loudest and drew a corner inside an identical corner. The three ranks are **card**
  (`SettingsCard`: a hairline box, its name on a ruled header row at 16px/600), **group**
  (`SettingsGroup`: one rule and a 12px `UTIL` eyebrow, no box — a box inside a card is the
  arrangement above, one level further in) and **list** (`PANEL_LIST`: the card's full width,
  `-mx-4` against the body's `p-4`, the rows keeping their padding so their labels land on the
  card's own left edge, and a rule BETWEEN them and nowhere else).
  **A rank is set by type, never by decoration.** Until 2026-09-07 a settings card wore a 17px
  title, a tinted header band and a grey dot, all three bought to separate it from the groups
  inside it — which were set at 16px/600, one point below. Dropping the group to an eyebrow
  makes the distance four points and two weights, and all three marks came off with nothing
  lost. The same reasoning took the list's own top and bottom rules away: a group's rule or the
  card's header already sits above the first row and the card's edge below the last.
- **Admin is monochrome plus two inks and the version dot, each with a named role. The accent is the product's highlighter** (the Writing
  Desk mock's `--pen`, 2026-08-17). Its roles are named and closed — where you are (above), a
  search hit as a `<mark>` in the write pane, and the small dots that mean "work in progress"
  (a draft's row, the unsaved state, an unfinished chip on the home screen) in its edge tone.
  Feedback,
  status, analytics trends, media selection, warnings, destructive actions and recovery
  banners stay on the neutral scale: a second use of colour spends the only signal that
  means "your words". The admin theme dropdown's colours are isolated from the site's
  configurable palette.
  **ONE exception, since 2026-08-22: the dot beside the version on the dashboard** is
  amber when a newer release exists and green when this install is on the newest, asked for
  in those words. It is the only place in the admin where colour carries a status, and the
  argument for it is that this particular status is rare, actionable, and often a security
  fix — the thing the rule protects ("your words") is not competing for attention on a line
  of build metadata. A third state exists and draws NO dot: not knowing is not the same as
  being current. Adding a second such exception is how the rule stops meaning anything, so
  the next one is a decision rather than a precedent.
- **The rail carries its glyphs, and the words stay.** Sidebar icons are ON by default since
  2026-09-07; the switch stays, so a rail of pure words is one click away. They were OFF from
  2026-08-15 on the argument that the rail did not need them, and the rail measured on
  2026-09-07 is what retired it: four destinations plus a group, every row 40px of 14px grey
  `oklch(0.556)`, nothing on the column but text at one size — a list of words is scanned
  letter by letter where a glyph is recognised. The switch lives at the BOTTOM of
  "Everything else" (2026-08-17 — a set-once device preference does not need a permanent
  footer row), and it means the WHOLE rail: nav glyphs and the footer controls' glyphs alike
  A COLLAPSED rail has no labels, so it stays icon-only
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
- **The rail is the owner's to arrange** (2026-09-06). "Rearrange sidebar", under the collapse
  row, turns every row into something that can be dragged — or walked with the up/down buttons,
  which are the touch and keyboard route and reach across the three groups the same way a drag
  does. The wordmark and the search button are the two things that cannot be dragged, because a
  logo dropped into a column of destinations becomes a destination; they get switches instead,
  and with the wordmark off, search becomes the first ROW of the column rather than a glyph
  floating over it. The order is a SITE SETTING (`navOrder`), not a device preference like
  collapse and Show icons: those describe a rail on one machine, this is a person saying where
  their things go, and it has to be the same on the laptop and on the desktop. The drag is
  POINTER-BASED, not HTML5 drag-and-drop: the native API does not fire on a touch screen and can
  only drag a ghost, while what a hand expects is the list opening where the row will land — so
  the rows reorder live under the pointer and letting go stores what is on screen. The carried
  row is not offset towards the pointer between crossings: the column scrolls, and a row pushed
  past the edge of that box is clipped — carried towards the footer it vanished mid-drag. Three empty
  lists mean "whatever the code says", which is how a release that adds a screen needs no
  migration —
  `content/nav-order.ts` reconciles a stored order against the live rail on every mount. The
  rail widens from 208 to 256px while arranging, measured: the grip and two steppers take 62px,
  and at 208 "Everything else" read as "Ever…".
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
  screen at any width and leaves the paper. **It applies beside an EDITOR only.** On the
  Write screen the pane is not chrome around the paper, it is the screen — hiding it there
  left the list gone and, below `xl`, nothing at all, on every visit until the switch was
  found again inside an editor (2026-09-06). It is a device preference in localStorage, not a
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

1. **Every page is ONE full-width sheet at ONE width, as long as what is on it** — the
   editor's paper, given to every screen, with a **60vh floor** so a near-empty page still
   reads as paper rather than as a strip. It was "at least the window tall" until 2026-09-07,
   and what that shipped was measured: Trash, the assistant and an empty Write screen each
   drew about 2,000px of white with one sentence at the top, which reads as a page that failed
   to load rather than as a page with nothing in it. A floor answers the sparse page; a
   window-height MINIMUM answers it by printing blank paper. Long prose (Help) takes a reading
   column INSIDE the sheet; the page never changes size. Never fix a sparse page by narrowing it.
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

**A settings tab is grouped by the QUESTION it answers, and Save is where the eye looks**
([ADR 0041](./decisions/0041-settings-by-the-owners-question.md), 2026-09-07, superseding the
grouping in [0011](./decisions/0011-settings-regrouped-into-seven.md)). The eight tabs were
grouped by which part of the CODE a key belonged to, and the count measured on 2026-09-07 says
what that cost: Appearance carried 137 controls over 2,825px while five other tabs sat at
about 1,236px each, and the answer to "how do readers sign in to comment" lived three tabs
away from "how does mail leave this machine". The sheet's Save button renders on every tab and
stores every ordinary settings key waiting on the screen, counting them on its face; tabs 5–7
are also made of cards that own their keys, and each of those keeps its own key for the part
the sheet's cannot do — testing what it just stored.

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
  sun/moon, two-line menu. Shared button
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
