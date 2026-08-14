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
- **TWO FACES, the same division the reading site makes** (`docs/conventions/type.md`):
  `--font-reading` is what a PERSON wrote and a person reads; `--font-sans`, the owner's
  chrome font, is what the MACHINE says. The one public rule the admin follows, adopted
  2026-08-14 at the owner's request — *"toàn bộ dùng font giao diện, thay vào đó nên sử dụng
  2 font chữ, nguyên tắc như frontend"*.
  On the reading site that line runs between a post title and its date. In here it runs
  between a setting's sentence and its label, a post's title and its view count, a comment's
  words and the address that sent them. Navigation, buttons, tabs, table heads, counts,
  slugs, filenames, timestamps and the activity log stay on the chrome font, where a
  monospace's aligned digits are the point.
  **BY ROLE, NEVER BY TAG.** The first attempt was a `.admin p` rule, and a tag is not a
  role: `Setting` renders its hint as a `<p>` and `ui/Input` renders the identical hint as a
  `<span>`, so the Site tab shipped *"Changes the interface language and date format."* in
  Literata four lines above *"Words auto-used as the excerpt…"* in JetBrains Mono — one card,
  one kind of thing, two faces, and neither call site was wrong. The face now travels on
  `READING` / `NOTE_TEXT` from `components/kit.tsx`, a whole page of sentences takes
  `data-prose` (Help: 33 `li` and 19 `td` of article), and `check:admin-kit` fails a screen
  that hand-types a hint or names a typeface at all.
  **The two faces are normalised to one apparent size**, by `font-size-adjust: from-font` on
  `body` — one declaration, because `from-font` resolves there to the chrome face's own
  x-height ratio and *inherits*, so anything switching to the reading face is re-sized
  without either face being named. Measured x-height per 1em: JetBrains Mono 0.550, Inter
  0.539, IBM Plex Mono 0.516, Literata 0.508, Source Sans 3 0.486, Source Serif 4 0.481 — so
  a 12px hint in Literata beside a 12px label in JetBrains Mono rendered at 92% of it, and
  the worst pair the settings allow at 87%. That, not leading, is what made the second voice
  look like an afterthought. A table of ratios was the alternative and it cannot work:
  `settings.customFont` accepts a face nobody has measured yet. **`.prose`, the editor title
  and the font/typography pickers opt out** via `data-specimen` — a writing surface must be
  the published page, and a picker that renders four faces at one apparent size hides the
  thing being chosen. See `src/admin/admin.css`, "Two faces".
- **The canvas is a flat neutral light gray** (`#f5f5f5`). No warm cast, no cool blue-gray.
- **Hierarchy comes from spacing and rules, not decoration.** Cards are for genuinely
  independent data; shadows are for overlays.
- **Square corners are a PUBLIC rule.** Admin uses the shared 16 / 12 / 8px radius
  hierarchy — never a global square reset, never arbitrary per-component rounding.
- **Admin is monochrome**: black, white and the neutral scale. Feedback, status, analytics
  trends, media selection, warnings, destructive actions and recovery banners included. The
  admin theme dropdown's colours are isolated from the site's configurable palette.
- **Writing is the primary task.** The editor takes the full desktop width and hides the
  global navigation.
- **Detail lives on its own screen.** Analytics, taxonomy, integrations and system
  information do not compete on the home page.

## One of each

The recurring failure is not a wrong design. It is SEVERAL of the same design: the kit says
a thing once, a screen says it again slightly differently, and the difference is what the
owner sees. Every rule here was found by photographing and measuring the running admin.

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

- Focus mode: the global sidebar is hidden while editing. Save, preview, publish and the
  property controls live in a sticky editor header, framed and aligned to the editor surface
  rather than as a flush edge-to-edge strip.
- The title aligns with the public reading column, wraps naturally, and uses content-driven
  height so a long one is never clipped.
- The property inspector is collapsible and sticky on wide screens. There is no bottom action
  bar; it used to cover the end of a long post.
- **H1–H5 stay visible** in the toolbar. They are frequent writing actions and were rejected
  once already as a paragraph-style selector.
- Formatting is a single non-wrapping icon row with horizontal overflow, centred when it fits
  and starting at the leading edge when it does not. The editor frame must NOT use
  `overflow-hidden` — it breaks the nested sticky toolbar. The toolbar's sticky offset is
  measured from the real action-header height, so it does not drift with the viewport or the
  translation.
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
