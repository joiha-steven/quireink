# The admin kit, one of each

Split from [admin-design.md](./admin-design.md) at its 400-line cap. That file says what
the admin IS; this one says the kit's rules — found by photographing and measuring the
running admin, enforced by `check:admin-kit` and the primitives themselves.

## One of each

The recurring failure is not a wrong design. It is SEVERAL of the same design: the kit says
a thing once, a screen says it again slightly differently, and the difference is what the
owner sees. Every rule here was found by photographing and measuring the running admin.

**A CARD'S TITLE OUTRANKS WHAT IS INSIDE IT.** 15 / 14 / 13 at 600 / 500 / 400 — heading,
label, note. It ran BACKWARDS until 2026-08-29: `Card panel` (every settings card) hard-typed
`text-[13px]` rather than importing `SECTION`, so a heading was smaller than its own labels
and the size of the smallest print on screen. A hand-typed size is how a scale stops being
one.

**A two-column band is two STACKS, and their heights get re-measured.** Cards go into explicit
column stacks, never straight into the grid — a grid lays its children out in rows, so a short
card beside a tall one is stretched and the next card cannot start until both have finished.
That much was already fixed. What was not: which card goes on which side is a decision that
goes stale. The Overview's comment said "traffic is the tall one on its own" and by the time
the page was reported uneven it was the SHORT one — measured at 1440px, 225px against
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
- **`SETTING_GAP`** is the space between two settings in a card. One number.
- **One control style per kind.** `ui/Tick` is the box — a real `input[type=checkbox]` under
  `appearance-none`, drawn, since `accent-` colours a fill and leaves the platform's border.

