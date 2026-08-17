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
  Set on 2026-08-15 at the owner's request — *"admin chỉ xài 1 font thôi, inter"*, then
  *"trừ phần editor, khung soạn thảo và tiêu đề soạn thảo vẫn dùng font mà frontend xài"*.
  It replaces the TWO FACES rule adopted eight days earlier (2026-08-14, *"nên sử dụng 2 font
  chữ, nguyên tắc như frontend"*), and both are his to set — what is worth writing down is why
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
  that setting for a day and the owner's verdict was *"nhìn rối thiệt, 2 font này có vẻ không
  hợp để dùng trong admin"*. A chrome font is a branding choice about what a READER sees;
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
  white cards carrying a 1px drop shadow, and on 2026-08-15 the owner's verdict on that was
  *"giao diện vẫn rẻ tiền, chưa xứng tầm"*. The diagnosis was not workmanship: gray canvas +
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
  surface that is not `sticky` or `fixed`.
- **Square corners are a PUBLIC rule.** Admin uses a 10 / 8 / 6px radius hierarchy — sheet,
  nested panel, control — never a global square reset, never arbitrary per-component rounding.
  It was 16 / 12 / 8; a 16px radius on a 1200px panel reads as a pill rather than as a page.
- **Admin is monochrome, plus exactly ONE accent: the product's highlighter** (the Writing
  Desk mock's `--pen`, 2026-08-17). It appears in two roles only — a search hit wears it as
  a `<mark>` in the write pane, and the small dots that mean "work in progress" (a draft's
  row, the unsaved state, an unfinished chip on the home screen) are its edge tone. Feedback,
  status, analytics trends, media selection, warnings, destructive actions and recovery
  banners stay on the neutral scale: a second use of colour spends the only signal that
  means "your words". The admin theme dropdown's colours are isolated from the site's
  configurable palette.
- **The rail is words, not pictures.** Sidebar icons are OFF by default (2026-08-15, *"không
  cần icon bên sidebar, nó làm cho không cần thiết"*) and switchable from the rail's own
  footer. The switch governs glyphs BESIDE LABELS; a COLLAPSED rail has no labels, so it stays
  icon-only and the collapse control is always available. Reading the setting as "no icons
  anywhere" is what hid the collapse control in the first cut, and the owner could not find it.
- **The rail holds FOUR destinations**, and everything else sits behind one control on it
  ([ADR 0024](./decisions/0024-the-admin-is-rebuilt-around-writing.md) step 6): home, write,
  library, newsletter — then analytics, comments, trash, settings, log, help and View blog
  under "Everything else". The group opens itself when the current page is inside it, because
  a rail that hides where you are is worse than a long one. Eleven rows was eleven decisions
  before the one that matters, and the four are what the owner came to do.
- **Writing is the primary task.** The editor takes the full desktop width and hides the
  global navigation.
- **The home carries the numbers; the DETAIL lives on its own screen.** Views, visitors, time
  per post and read-through are on the home page — that is why Analytics could leave the rail
  — and the charts, the ranges and the per-page breakdown are one click further, from the
  cards that show the headline figures. Taxonomy, integrations and system information still do
  not compete on the home page.
- **The home hands back the unfinished writing before it shows anything else.** A count of
  drafts is not the same fact as the drafts; the band names them and opens the editor on one.
  Administration counts (posts, pages, comments, images, storage) sit BELOW the widgets.

## One of each

The recurring failure is not a wrong design. It is SEVERAL of the same design: the kit says
a thing once, a screen says it again slightly differently, and the difference is what the
owner sees. Every rule here was found by photographing and measuring the running admin.

**A two-column band is two STACKS, and their heights get re-measured.** Cards go into explicit
column stacks, never straight into the grid — a grid lays its children out in rows, so a short
card beside a tall one is stretched and the next card cannot start until both have finished.
That much was already fixed. What was not: which card goes on which side is a decision that
goes stale. The Overview's comment said "traffic is the tall one on its own" and by the time
the owner said the page looked uneven it was the SHORT one — measured at 1440px, 225px against
the other column's 413px, a 188px hole above the next full-width band, and the emptiest card on
the page (5% of its box was text) sitting in the widest space. Two cards a side now: 467 against
485, and both numbers are written where the next person will check them.

⚠️ **A grid item needs `min-w-0` or a `truncate` row will not let the column shrink.** A grid
item's automatic minimum size is its content's min-content width, and `truncate` sets
`white-space: nowrap`, so one un-truncated headline sets the floor for the whole track. Measured
at 375px: the Overview's widget track resolved to 406px inside a 343px grid and the page scrolled
sideways by 47px. `min-w-0` on the title span was already there and could not help — that lets
the FLEX item shrink, and it was shrinking; the TRACK was not. Same failure as the analytics
table, one level up. `bun run tour` now checks the dashboard at 375px (`atWidth`).

**Two gaps, and there is no third.** `SECTION_GAP` (28px) separates the bands of a page;
`CARD_GAP` / `CARD_STACK` (20px) separates two cards side by side or stacked. One Overview
column measured 12, 16, 20 and 28 in a single scroll, which reads as a page assembled from
four screens. A component that wants a third number wants one of these two.

**A field is as tall as the button beside it.** `CONTROL` is `min-h-10 py-2`, not `py-2.5`:
the padded version measured 42px against `ui/Button`'s 40, so every Copy-next-to-a-token and
Choose-image-next-to-a-filename row sat two pixels out. `ui/Input.tsx` IMPORTS `CONTROL`
rather than declaring a matching copy, which is what its comment used to promise and nothing
enforced.

**A field is as wide as its answer.** A two-digit excerpt length in 580px, beside a site
title in 580px and a description in 580px, draws three different questions as one. `Input`
gives a `type="number"` field `FIELD_W.short` unless the caller states a width, and emits
exactly one width class — two competing ones resolve by stylesheet order, which no call site
can reason about.

**One button, two sizes.** There were four: `ui/Button`; a New post link that copied the
classes and lost `shrink-0`, `whitespace-nowrap` and the dark hover; two integration cards at
`px-3 py-1.5` with no minimum height; and a restore-draft pair with **square corners**,
against the rule above. `buttonClass()` is exported so an `<a>` can wear the button without
copying it. `md` is a page action; `sm` is an action inside a strip of text.

**One tab strip, two sizes.** `Tabs` carried a variant no caller used and a variant named
`underline` that drew no underline, while three screens hand-rolled their own track — one of
them 40px against the strip above it at 44, with no `aria-pressed` and no hover.
`TAB_TRACK` and `tabItemClass()` are exported for a strip made of LINKS (the analytics range,
which lives in the URL and so cannot be a `<Tabs>` with an `onChange`).

**One stat tile, one empty state.** `StatTile` was a second copy of `StatCard` that had
already drifted a shade on its sub-line. `EmptyState` existed and two files used it while
five hand-rolled a message in three styles.

**A button is a fixed object; the text beside it gives way.** `ui/Button` carries
`whitespace-nowrap shrink-0` for that reason: without them a button in a flex row beside
anything long is squeezed until its own LABEL wraps. The MCP card shipped "Tạo token" broken
across two lines beside a 28px field.

**Two related numbers go within one glance of each other.** The Traffic card put views at the
far left and visitors 800px away at the far right of the same card, which reads as two
unrelated facts about the same thirty days. The same rule moved the Content filter box and
its status tabs back together: they narrow the same list.

`check:admin-kit` holds all of this. Each primitive has a class signature that belongs to
exactly one file; the check fails if a screen re-types it, and also if a primitive is
reworded so its own rule stops matching — which is how `check:css-literal` came to report a
tick against two sheets it had never read.

## One setting

**A setting reads top to bottom: what it is, what to know about it, then the control.** The
owner asked for it after finding the screens "scattered", and they were: font pickers put
their hint BELOW the grid, the palette card carried a tinted callout and a plain paragraph
saying related things at two sizes, and the gap between a label and its control was 0.5, 1 or
2 depending on the file.

It is enforced by primitives, not by discipline, because discipline is what had already
failed:

- **`Setting` in `components/kit.tsx`** places the three parts for any control that is not a
  text field. `SETTING_LABEL` and `NOTE` come from the same file and `ui/Input.tsx` builds a
  text field from them, so a field and a picker cannot drift apart.
- **`Input`/`Textarea` take a `note`.** They took a label and nothing else, which is why
  every hint was hand-placed and no two callers agreed.
- **`inline` is the one variation**, and only for a boolean: a 24px switch beside its label
  keeps fifteen feature toggles scannable. The ORDER is unchanged. `ToggleRow` is `Setting` +
  `Switch`.
- **`SETTING_GAP`** is the space between two settings in a card. One number.
- **One control style per kind.** `CheckField` replaced the two raw `<input type="checkbox">`
  that looked like a different application from the switches above them.

## Layout

**Cards go in column stacks, never straight into the grid.** A grid lays its children out in
ROWS, and a row is as tall as its tallest cell, so two cards of different heights leave a void
under the shorter one and the next card starts below BOTH. The System tab showed it plainly:
Import, then Backups at twice its height, then Cache stranded with a hole above it. The
owner's words were "is splitting into two columns so hard". A tab is `GRID` holding two `COL`
stacks, with cards assigned to a side by hand so the two come out close in height.

**EVERY settings tab is two columns.** There is no one-column tab, and there was: Site held a
single card and Reading held fifteen toggles beside one switch. Two tabs of seven behaving
differently reads as a mistake. Split the CONTENT, do not leave the layout ragged.

**Do not widen a card to fix its contents.** Making the MCP card span both columns gave its
table room and turned it into a wide slab under a two-column tab. A table that does not fit
scrolls inside its card. Equally: a card holding a five-column table is not a half-width card.

**The workspace** is a 1480px maximum with responsive 16/28/40/48px gutters. The desktop
sidebar is 208px, 72px collapsed; the mobile menu is a floating rounded drawer that overlays
rather than pushing content down. Sidebar footer controls always use the same icon + label
row, and the theme control shows its sun/moon glyph before the applied mode label. Clear
cache stays in the operations footer, reachable from every screen, expanded or collapsed.

## The editor

- The chrome is the SHEET'S OWN top rows (the Writing Desk mock's `sheettop`): the action
  line — back link + save state + word count on the left, quiet Markdown/Attributes text
  controls and the Preview/Save/Publish buttons on the right — is the card's first row, and
  the toolbar sticks directly under it. One piece: a floating band over a crack of page
  between it and the paper is what the owner called "kì kì" (2026-08-17). Never shadowed.
  The global sidebar shows again since the two-pane write screen; the write pane (the list
  column) sits beside the sheet from `xl` up, pinned at the same top as the sheet's chrome.
- The title lives ON the sheet (`SheetTitle`), in the reading face, with the meta line
  (status · last touched) under it. It aligns with the public reading column, wraps
  naturally, and uses content-driven height so a long one is never clipped.
- **The toolbar is BACK, by the owner's verdict after writing on the bare version**
  (2026-08-17, *"ở chế độ bình thường nên có thanh công cụ chứ"* — reversing ADR 0024
  step 4's removal, which the mock had endorsed). It sits at the top of the sheet under the
  action line, full-width, its groups centered, wrapping on a narrow window rather than
  scrolling. The Markdown source view has NO toolbar — raw text needs no formatting
  buttons. The called controls remain beside it: a selection raises the bubble, `/` on an
  empty line raises the insert menu (which prints each block's Markdown shortcut beside
  its row), and the table tools exist only while the cursor is in a table. The closing
  line under the writing says the two gestures once.
- The attributes are a right-hand slide-over (`SlideOver`) over a scrim, never a docked
  column — a column squeezed the writing to make room for the questions. The first Publish
  on an unpublished piece opens it as the publish sheet, footered "Later / Publish".
- The editor frame must NOT use `overflow-hidden` — it breaks the nested sticky bars. The
  table bar's sticky offset is measured from the real action-header height, so it does not
  drift with the viewport or the translation.
- The prose `contenteditable` must not inherit the global focus outline; the surrounding card
  is the boundary. Focus rings stay on discrete controls.
- Insert and delete use a block-style overlay caret, an active-line pulse and a generated
  click. Compositor-only, selection-safe, IME-safe, governed by the global motion setting,
  audio locally generated at 45% internal volume and kept out of composition updates. One
  switch in the Rendering card controls the whole typewriter system; it defaults on.
- Autosave, revisions, preview tokens, media picking, taxonomy and publish behaviour are
  unchanged by any visual pass.

## Navigation and the progress bar

Measured in headless Chromium against a throwaway instance seeded to the size of the real
blog (70 posts, 40,000 analytics events).

**The first click on any admin route cost 330-390ms; the same route clicked again cost
23-35ms.** The difference was not data and not work: the CPU was idle for ~300ms of it and
the page's own fetch had not started. Every page is a `lazy()` import, so a first visit
suspends; outside a transition React answers a suspension with the Suspense fallback and then
throttles putting real content back by a fixed 300ms.

- **Route changes run inside `startTransition`** (`router.tsx`). The current page stays on
  screen until the new one is ready, so no fallback is shown and there is no reveal to
  throttle. The Suspense boundary in `App.tsx` is reached on the FIRST paint only.
- **Scrolling to the top belongs after the commit.** During a transition the old page is
  still the one being looked at.
- **A navigation must show it is happening.** `ui/TopProgress.tsx` is the only signal a click
  did anything. It covers the router's `pending` and every in-flight `useView`, through the
  counter in `pending.ts`.
- **The bar never claims a percentage.** Nothing here knows how far along a fetch is. It
  eases toward an edge it never reaches, then snaps closed, and honours `data-motion`.
- **The entry preloads the current route's chunk** before React runs (`main.tsx`).

After: Content 355 → 49ms, Media 336 → 59ms, Comments 348 → 43ms, Settings 346 → 45ms,
Analytics 418 → 83ms. Cold load of `/admin` 501 → 329ms.

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
- Backup scheduling and import controls use the shared rounded inputs and buttons, with
  native file-input chrome hidden behind an accessible labelled trigger.

## Still open

- Translated strings for editor chrome labels still written in Vietnamese.
- Very narrow content tables could become stacked list rows.
- Integrations may need its own secondary navigation if it keeps growing.
- The editor's link prompt is still `window.prompt`; a small accessible popover would be
  better.
