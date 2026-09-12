# IDE chrome — one switch, `settings.ideChrome` (HARD RULES)

The furniture around the article reads as source code; the reading column stays analogue.
The contrast is the point, and because it is a taste it is a switch (Admin → Settings →
Account → This admin), server-rendered as `<html data-ide-chrome="on">` so the first paint is right
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
  article, so the toggle moves nothing but the gutter. The line numbers are rings sitting ON the
  rail's divider out past the text, so they cost the rail no width. An earlier pass ranged
  the rail left to put a gutter column where an editor puts it, and it was rejected.
  **The ring is CENTRED on that divider**: the line is 1px at 13px past the rail's edge, so
  its middle is 12.5 and an 18px ring centred there ends at 21.5. It ended at 23 until
  2026-09-12, which left the hairline meeting every ring 1.5px off its diameter.
- **In the band (60rem to the rail breakpoint) there is no gutter, so there are no line
  numbers on the menu.** A ring there lands INSIDE the 24px between two menu words, three
  pixels from each, and the row reads as one run-on string. The index keeps its numbers,
  because there each entry is a line of its own and the number falls at the end of it. The
  band's own invented heading — the menu has none in the markup and takes one from its
  `aria-label` — carries the comment marker like any other chrome heading; it cannot get it
  from this sheet (it is not an `h2`, and its `::before` is already the label), so
  `render/rail-css.ts` restates it and `render/rail-css.test.ts` holds it.
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
