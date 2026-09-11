# The admin kit, one of each

[admin-design.md](./admin-design.md) says what the admin IS; this one says the kit's rules — found by photographing and measuring the
running admin, enforced by `check:admin-kit` and the primitives themselves.

## One of each

The recurring failure is not a wrong design. It is SEVERAL of the same design: the kit says
a thing once, a screen says it again slightly differently, and the difference is what the
owner sees. Every rule here was found by photographing and measuring the running admin.

**A CARD'S TITLE OUTRANKS WHAT IS INSIDE IT.** 15 / 14 / 13 at 600 / 500 / 400 — heading,
label, note. Since 2026-08-29 `Card panel` imports `SECTION` rather than typing a size; a
hand-typed size is how a scale stops being one.

**A two-column band is two STACKS, and their heights get re-measured.** Cards go into explicit
column stacks, never straight into the grid — a grid lays its children out in rows, so a short
card beside a tall one is stretched and the next card cannot start until both have finished.
Which card goes on which side is re-measured when a page is reported uneven, and the
heights are written beside the assignment where the next person will check them.

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

**A field is as tall as the button beside it.** `CONTROL` is `min-h-9 px-3 py-1.5`, the same
36px as `ui/Button`'s `md`, so a Copy-next-to-a-token or Choose-image-next-to-a-filename row
sits level. `ui/Input.tsx` IMPORTS `CONTROL`
rather than declaring a matching copy, which is what its comment used to promise and nothing
enforced — as do the ten settings fields that had each drawn their own at 38px, an 8px radius,
no focus ring and no placeholder shade. One with a measured size of its own takes `CONTROL_CHROME`.

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
which lives in the URL and so cannot be a `<Tabs>` with an `onChange`). `sm` has one
modifier, `dense` (2026-08-17): tighter padding for the write pane's row of five, whose
labels are the pane's own deliberately short `scope*` strings so five words share one line
in all eleven languages — the row may not wrap.

**Two stat shapes, one empty state.** `StatCard` (`analytics-kit.tsx`) and `StatTile`
(`stat-band.tsx`) are the two, and a third is a copy. `EmptyState` existed and two files used it while
five hand-rolled a message in three styles.

**An empty state is a picture, a state, a sentence and a way out.** `EmptyState` takes a
`glyph` — a NAME from `GLYPHS` in `src/icons.ts`, not a node — drawn at 96px two ink steps
below the text. The prop is closed to a name on purpose: it took an arbitrary `icon` node
before 2026-09-07 and nothing ever passed one, so thirteen empty states in eleven files each
showed a single grey sentence in the middle of a large blank card, which is what a page that
FAILED to load also looks like. `GLYPHS` is its own 48-unit board because the icon set's 1.8-of-24 stroke renders
at 7.2px this size, and because a mark drawn to survive at 20px throws away what a 96px
picture has room for — `page` carries ruled lines, `blankPage` carries none, and the second
one is the whole message. The two dead ends, the admin 404 and the empty Write sheet, also
carry `RecentPieces`: the three pieces touched last, read off the same `useWritingItems` sort
the write pane uses, so both screens name the same piece first.

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
reworded so its own rule stops matching — which is how `check:css` came to report a
tick against two sheets it had never read. A signature only catches a COPY, so three rules
match an idea: a raised white surface, a named typeface, a field drawing its own focus.

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
- **`inline` is the one variation, and it is for a SHORT ANSWER** — a boolean, a two-digit
  number, a short list; the ORDER is unchanged. It was booleans only, and ten settings paid
  for it: a number under a label and a sentence is three stacked rows to say "10", reported
  2026-08-29 as wasted space and hard on the eyes. **`ui/Input`
  decides it for `type="number"`**, from the same test that gave a number `FIELD_W.short`: a
  field as wide as its answer needs no row of its own. `inline={false}` opts out.
- **`FIELD_GAP`** is the space between a setting's words and the control under them. It was
  8px in `ui/Input` and 10px in `Setting`, so a field and a picker in one card sat two pixels
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
- **One control style per kind.** `ui/Tick` is the box — a real `input[type=checkbox]` under
  `appearance-none`, drawn, since `accent-` colours a fill and leaves the platform's border.

