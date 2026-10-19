# The admin kit, one of each

[admin-design.md](./admin-design.md) says what the admin IS; this one says the kit's rules — found by photographing and measuring the
running admin, enforced by `check:admin-kit` and the primitives themselves.

## One of each

The recurring failure is not a wrong design. It is SEVERAL of the same design: the kit says
a thing once, a screen says it again slightly differently, and the difference is what the
owner sees. Every rule here was found by photographing and measuring the running admin.

**A PRIMITIVE THE PAGE REPEATS IS A NAME, AND ITS LIST IS THE DEFINITION** (2026-10-03). The field,
the button's three axes, the switch, the colour pair, the label, the note, the segmented key, the
rail's rows and the two hidden found-lists reach the markup as `kit-*` names: `component()` in
`admin-shared/component.ts` registers a name for a utility list written where the primitive always
was, and `web/css-compose.ts` adds the name to every rule that selects one of those utilities, at
build time — same rules, same order, same layer, so nothing a call site adds beside the name ties
differently. `/admin/settings` went from 880 KB to 571 KB. A hook an island or the tour looks for
(`admin-note`, `font-mono` on the hex, `no-scrollbar`, `tap-touch`) and a marker (`group`, `peer`)
stay written beside the name; the build refuses a marker in a list, and a utility no rule selects.
A test about a primitive's LOOK reads it through `expandComponents()`, never the name.

**A CARD'S TITLE OUTRANKS WHAT IS INSIDE IT.** 15 / 14 / 13 at 600 / 500 / 400 — heading,
label, note. Since 2026-08-29 `Card panel` imports `SECTION` rather than typing a size; a
hand-typed size is how a scale stops being one.

**TYPE COMES FROM A ROLE, NEVER FROM A WEIGHT OR SIZE TYPED ON THE SPOT** (2026-10-19). `check:admin-kit` fails
`font-bold`/`extrabold`/`black`, `text-[<n>px]` and `text-lg`..`text-9xl` in any admin source file (tests and
`scale.ts` aside): a title is `SECTION`, a number `FIGURE`, a note's size `NOTE_SIZE`. A site that must stay off
the scale is listed in `OFF_SCALE_OK` in `scripts/checks/admin-kit-scale.ts` with the line and the reason, and the entry
fails the check the day it stops matching.

**A two-column band is two STACKS, and their heights get re-measured.** Cards go into explicit
column stacks, never straight into the grid — a grid lays its children out in rows, so a short
card beside a tall one is stretched and the next card cannot start until both have finished.
Which card goes on which side is re-measured when a page is reported uneven, and the
heights are written beside the assignment where the next person will check them.

**An advanced band folds what a writer never needs** (2026-10-19). Server & connections mixed
the owner's cards with a developer's, so a person who came to switch on backups scrolled past
JSON-LD switches, two boxes of raw HTML and an MCP token table. `advancedBand` in
[`settings-shell.ts`](../src/web/admin/screens/settings-shell.ts) draws them below the tab's own
two columns, under one key (*Advanced*) with one line naming what is behind it.
- **What counts as advanced**: a card nobody needs in order to RUN a blog — what crawlers and
  feeds are served and code pasted into every page, redirects, the CDN and the move to
  Cloudflare, the MCP server and the Content API. The cache, updates, storage limits, backups and
  their off-site copy, the import, the AI key the writing assistant runs on and the fediverse
  name are decisions about the blog itself and stay on top. When in doubt a card stays visible.
- **Shut by default, a DEVICE preference** (`quireink-admin-settings-advanced` in
  `localStorage`, like the explanations switch), never a setting. The server draws every card and
  ships the body `hidden`; `island/lib/settings-advanced.ts` opens it.
- **Folding hides nothing from the tools that find a setting.** A search hit, a `?setting=<key>`
  link (the command palette and Help use it) and a field the server refuses all open the band and
  land on the row, without changing the preference. The sheet's Save reads every `data-k` on
  the screen whether shown or not, so a key changed inside and folded away is still counted and
  stored, and a card's own Save works the same open or shut.
- **A shut band never hides a problem, and does not cry wolf.** The key carries a count of the
  cards inside whose test FAILED (`connectionFailed`) or which hold an UNSAVED edit
  (`connectionUnsaved`, or a changed key on a card with no lamp), in the amber of the lamp
  vocabulary ([admin-design.md](./admin-design.md)). *Not set up yet* (`connectionUnset`) is
  never counted: every card in the band is optional, and a count on every fresh blog with no
  Cloudflare account is a count nobody reads. A seeded blog shows no count. The island tells
  the resting amber from the other two by the lamp still wearing the title the server drew.
- **It is two columns too**, balanced by hand like the stacks above it; the measurements sit
  beside the assignment in `settings-server.ts`.

⚠️ **A grid item needs `min-w-0` or a `truncate` row will not let the column shrink.** A grid
item's automatic minimum size is its content's min-content width, and `truncate` sets
`white-space: nowrap`, so one un-truncated headline sets the floor for the whole track. Measured
at 375px: the Overview's widget track resolved to 406px inside a 343px grid and the page scrolled
sideways by 47px. `min-w-0` on the title span was already there and could not help — that lets
the FLEX item shrink, and it was shrinking; the TRACK was not. Same failure as the analytics
table, one level up. `bun run tour` now checks the dashboard at 375px (`atWidth`).

**Two gaps, and there is no third.** `SECTION_GAP` (40px) separates the bands of a page;
`CARD_GAP` (24px) separates two cards side by side or stacked. One Overview
column measured 12, 16, 20 and 28 in a single scroll, which reads as a page assembled from
four screens. A component that wants a third number wants one of these two.

**A field is as tall as the button beside it.** `CONTROL` is `min-h-9 px-3 py-1.5`, the same
36px as `buttonClass`'s `md` (`admin-shared/kit.ts`), so a Copy-next-to-a-token or Choose-image-next-to-a-filename row
sits level. `textField` in [`web/admin/fields.ts`](../src/web/admin/fields.ts)
IMPORTS `CONTROL` rather than declaring a matching copy, which is what its comment used to promise and nothing
enforced — as do the ten settings fields that had each drawn their own at 38px, an 8px radius,
no focus ring and no placeholder shade. One with a measured size of its own takes `CONTROL_CHROME`.

**A field is as wide as its answer.** A two-digit excerpt length in 580px, beside a site
title in 580px and a description in 580px, draws three different questions as one. `textField`
gives a `type="number"` field `FIELD_W.short` unless the caller states a width, and emits
exactly one width class — two competing ones resolve by stylesheet order, which no call site
can reason about.

**One button, two sizes.** There were four: a `Button` component; a New post link that copied the
classes and lost `shrink-0`, `whitespace-nowrap` and the dark hover; two integration cards at
`px-3 py-1.5` with no minimum height; and a restore-draft pair with **square corners**,
against the rule above. `buttonClass()` is exported so an `<a>` can wear the button without
copying it. `md` is a page action; `sm` is an action inside a strip of text.

**One tab strip, two sizes.** `Tabs` carried a variant no caller used and a variant named
`underline` that drew no underline, while three screens hand-rolled their own track — one of
them 40px against the strip above it at 44, with no `aria-pressed` and no hover.
`TAB_TRACK` and `tabItemClass()` are exported for a strip made of LINKS (the analytics range,
which lives in the URL and so cannot be a `<Tabs>` with an `onChange`). `sm` has one
modifier, `dense` (2026-08-17): tighter padding for the write pane's row of five, whose
labels are the pane's own deliberately short `scope*` strings so five words share one line
in all eleven languages — the row may not wrap.

**Two stat shapes, one empty state.** `statCard` and the band it stands in, `statBand`, are
both in [`web/admin/kit-figures.ts`](../src/web/admin/kit-figures.ts) — two shapes, and a third
is a copy. `emptyState` ([`web/admin/kit.ts`](../src/web/admin/kit.ts)) existed and two files
used it while five hand-rolled a message in three styles.

**An empty state is a picture, a state, a sentence and a way out.** `emptyState` takes a
`glyph` — a NAME from `GLYPHS` in `src/icons.ts`, not a node — drawn at 96px two ink steps
below the text. The prop is closed to a name on purpose: it took an arbitrary `icon` node
before 2026-09-07 and nothing ever passed one, so thirteen empty states in eleven files each
showed a single grey sentence in the middle of a large blank card, which is what a page that
FAILED to load also looks like. `GLYPHS` is its own 48-unit board because the icon set's 1.8-of-24 stroke renders
at 7.2px this size, and because a mark drawn to survive at 20px throws away what a 96px
picture has room for — `page` carries ruled lines, `blankPage` carries none, and the second
one is the whole message. The two dead ends, the admin 404 and the empty Write sheet, also
carry `recentPieces()`: the three pieces touched last, read off the same `writeItems` sort
the write pane uses, so both screens name the same piece first.

**A button is a fixed object; the text beside it gives way.** `buttonClass()` carries
`whitespace-nowrap shrink-0` for that reason: without them a button in a flex row beside
anything long is squeezed until its own LABEL wraps. The MCP card shipped "Tạo token" broken
across two lines beside a 28px field.

**Two related numbers go within one glance of each other.** The Traffic card put views at the
far left and visitors 800px away at the far right of the same card, which reads as two
unrelated facts about the same thirty days. The same rule moved the Content filter box and
its status tabs back together: they narrow the same list.

`check:admin-kit` holds all of this. Each primitive has a class signature that belongs to
exactly one file; the check fails if a screen re-types it, and also if a primitive is
reworded so its own rule stops matching — which is how `check:css` came to report a
tick against two sheets it had never read. A signature only catches a COPY, so three rules
match an idea: a raised white surface, a named typeface, a field drawing its own focus.

It also refuses **`line-clamp-N` standing beside a display utility**. The clamp works by
switching the box to `display:-webkit-box`, so `block` (or `flex`, or a `lg:` variant of
either) in the same class list wins the cascade and the clamp is silently ignored. Measured
on the write pane, 2026-09-12: the summary line carried `line-clamp-2 block` and rendered
112px, which is seven lines against the two it asked for; the rows of that list ran from
44px to 199px, and five pieces fitted on a 900px screen out of forty-nine. Nothing else in
the tree could see it — the class was right there in the markup, doing nothing.

## One setting

**A setting reads top to bottom: what it is, what to know about it, then the control.** The
owner asked for it after finding the screens "scattered", and they were: font pickers put
their hint BELOW the grid, the palette card carried a tinted callout and a plain paragraph
saying related things at two sizes, and the gap between a label and its control was 0.5, 1 or
2 depending on the file.

It is enforced by primitives, not by discipline, because discipline is what had already
failed:

- **`settingRow` in [`web/admin/fields.ts`](../src/web/admin/fields.ts)** places the three
  parts for any control that is not a text field. `SETTING_LABEL` and `NOTE` come from
  `admin-shared/scale.ts` and `textField` builds a text field from the same three, so a field and
  a picker cannot drift apart.
- **`textField`/`textArea` take a `note`.** They took a label and nothing else, which is why
  every hint was hand-placed and no two callers agreed.
- **`inline` is the one variation, and it is for a SHORT ANSWER** — a boolean, a two-digit
  number, a short list; the ORDER is unchanged. It was booleans only, and ten settings paid
  for it: a number under a label and a sentence is three stacked rows to say "10", reported
  2026-08-29 as wasted space and hard on the eyes. **`textField`
  decides it for `type="number"`**, from the same test that gave a number `FIELD_W.short`: a
  field as wide as its answer needs no row of its own. `inline={false}` opts out.
- **`FIELD_GAP`** is the space between a setting's words and the control under them. It was
  8px in the text field and 10px in the setting row, so a field and a picker in one card sat two pixels
  apart from their own labels.
- **`SETTING_GAP`** is the space between two settings in a card. One number.
- **ONE COLUMN PER CARD, in both states of the explanations switch.** With the sentences
  shown, an inline row is `justify-between` and every control ends on the card's right edge.
  With them hidden there is no sentence to fill the middle, so the row STACKS like the text
  fields beside it and every control starts on the card's left edge. A BOOLEAN keeps the far
  end either way (`.switch-row`), which puts its column on the card's right edge — where the
  full-width fields already end. Measured on the Blog tab at 1440 on 2026-09-12, before the
  rule held: 294, 502 and 753 in six rows of one card, and 137px of nothing between a 55px
  label and the box it belonged to.
- **One control style per kind.** `tick()` (`web/admin/kit.ts`) is the box — a real `input[type=checkbox]` under
  `appearance-none`, drawn, since `accent-` colours a fill and leaves the platform's border.

- **A count row that filters is a choice, never the pen.** Newsletter > People once printed the
  confirmed / pending / unsubscribed counts and then the same words again as a strip, which
  (drawn without a role) wore the pen a second time under the People / Send / Test tabs. The
  count row is the filter now: its cells are `data-tab` keys, the chosen one takes the sunken key
  and `aria-pressed`, and `wireSubscribers` narrows by them. The comments tally sentence ships
  hidden and shows only while a filter narrows the list; unfiltered it repeated the band.
