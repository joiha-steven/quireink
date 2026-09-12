# Looks — four dialects, one setting (`settings.look`)

The public site can be dressed in one of four dialects: **plain** (no sheet at all),
**code**, **paper** and **notes**. The admin calls the setting "Looks like" and never
"theme": a theme store would multiply the surface every guard and every tour flow has to
cover, and each dialect here has to earn its place by reaching a group of writers who would
otherwise not use this software. Four is the ceiling.

## What every dialect must obey

- **Its own sheet, linked only when it is worn** (`web/assets.ts`, `lookSheet`). `plain`
  links nothing, so a blog wearing no dialect is byte-for-byte what it was before looks
  existed. The source-code sheet used to ride inside `PUBLIC_CSS` and charged every blog on
  earth 20 KB for a look that was off by default.
- **One attribute selector, `html[data-look=<id>]`, on every rule.** Switching away leaves
  no trace: the attribute goes and the sheet stops being linked. Tested.
- **Colour from theme tokens only.** No hex, ever.
- **No words in `content:`.** A CSS content string cannot be translated. The one place a
  dialect needs language — the newspaper's `Fig.` and `Table` — rides in the per-page
  settings block from `locales/`, not in the cached sheet.
- **The admin never changes.** A look is what a reader sees. Support questions that begin
  "where is that button" must have one answer.

## Which dialect may touch the reading column

**`code` may not** — not `.prose`, `.reading-font`, `.deck`, `.comment-body` or `.fs-*`.
That look's whole argument is the contrast between a technical frame and an analogue text,
so touching the text destroys the thing it is for. Tested.

**`paper` may**, and does: it numbers sections, numbers figures and tables, and moves the
byline under the headline. Its argument is that the whole page is a publication. What it
still never changes is the reading face, the measure, or the words.

⚠️ **The numbers are CSS, so they exist on the page and nowhere else**: not in the feed, not
in the newsletter, not in a search result, and not in what a reader copies. Prose that says
"as section 2.1 showed" is broken everywhere but the page it was written on.

**`notes` may**, for links and the ruling behind paragraphs, and for nothing else.

## code — the source-code dialect (HARD RULES)

The furniture around the article reads as source code; the reading column stays analogue.
The contrast is the point. Chosen in Admin → Settings → Appearance → Looks like, and
server-rendered as `<html data-look="code">` so the first paint is right and no island runs.

- **The monospace belongs to this look**, set on `body` and never on `--font-sans` (a blog
  whose reading font FOLLOWS the chrome font has `--font-reading: var(--font-sans)`, so
  moving that variable would set the article in monospace). Until 2026-09-13 the product's
  DEFAULT chrome font was JetBrains Mono, which meant an untouched blog already read as
  technical and left this dialect with almost nothing to say; the default is Inter now.
- **No filled surfaces.** A tinted sidebar was drawn and rejected, then tinted bars top and
  foot, rejected too: this dialect dresses the chrome, and a filled panel turns furniture
  into a second surface arguing with the words. Two full-width hairlines are what a window
  has that a page does not — and they need `overflow-x: clip` on the root, never `hidden`,
  which would make the root a scroll container and kill every `position: sticky` on the
  page.

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

## code — the header and the index (HARD RULES)

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

## paper — the newspaper dialect

A masthead, a lead headline, column rules, and a piece printed as an offprint. Three
front-page shapes are dressed, not one: `list`, `grid` (the reader's own toggle) and the
composed `front`.

- **`display:contents` on `.site-bar`** is what lets the masthead interleave the strapline
  with the name and the section menu: those three are inside the bar and the strapline is
  its sibling, so no alignment inside the bar can put one between the others. Dropping the
  bar's box promotes its children into the header itself. The name then needs
  `margin-inline: 0`, because in the bar's own row it carries `margin-right: auto` to push
  the controls right — with the bar's box gone that auto margin ate 917px and pinned the
  name to the left edge under a centred strapline.
- **The header is a GRID of `1fr auto 1fr`, and the controls end the strapline's row.**
  They were absolute at the top right, which on a masthead centred everywhere else left
  them in a corner with nothing opposite and, on an article, alone over 90px of white. A
  column flex cannot pair two children on one line, which is why it is a grid; the outer
  columns stay equal whatever the controls measure, so the strapline keeps the name's axis.
  Place the name as `:is(.title,.site-h1)` — it is a bare anchor on most pages and an `h1`
  wrapping that anchor on a listing whose lead card is off.
- **Under 44rem the controls take their own row, centred**, and give up the `-.625rem`
  optical pull: that exists to line the last glyph up with the rule at the column edge, and
  centred there is no edge to line up with.
- **Never set `display` on `.site-menu` here.** The base sheet hides it under 60rem and
  paints its links only above that width, so a flat `display:flex` outranked the hide and
  put five default-blue underlined links across a phone masthead — beside a drawer button
  that opens the same five.
- **One gutter for every column rule on the page** (`margin-left:-20px;padding-left:20px`
  against a 40px gap), centred IN the gap and never drawn at a card's edge. The card grid
  ships 28px of its own, so this look restates it: the same hairline standing 14px off a
  picture in one place and 20px off words in another reads as a mistake.
- **The section goes over the headline, the date and the byline under it.** That is what a
  paper does, and the web habit of stacking all of it above the title opens the page on
  housekeeping. The two halves are one paragraph in the markup, so the paragraph gives up
  its box with `display: contents` and the header grid then places the section, the
  headline, the standfirst and the facts by hand. The middot between the two halves comes
  from the base sheet (`.post-cat::after`), which is what lets this look drop it; the ONE
  space stays in the markup, or `textContent` reads "TypographySeptember".
- **The series box is a standing box, and nothing here draws a corner radius.** A heavy rule
  over it, the head as small letterspaced capitals on a band of its own, a hairline, then
  the parts. The marker beside the part being read is the margin's change bar in heading
  ink: it was the accent, and in this look the accent is the link blue, so a blue bar beside
  black type said the line was a link.
- **An all-caps label in a ruled band takes `line-height: 1`.** A line box reserves room
  for a descender and for an ascender above the cap, and a caps label uses neither, so at
  inherited leading it sat 2px high between its own rules. This face closes that by itself:
  Inter's ascender less its cap height (0.2413em) is its descender (0.2412em), so at
  leading 1 equal padding centres the ink. Measured: 9px over the cap, 9px under the
  baseline.
- **In grid mode each card takes a rule across its HEAD, not down its side.** A column rule
  does not survive a wrapping grid: the column count changes with the width, and the feed
  wraps each year's entries in their own block, so `nth-child` counts the year marker as the
  first child and the rule landed left of cards already in the first column.
- **The shelf moves inline on a PIECE only.** On a listing it is the navigation: moved
  inline there it landed at y=8167, under thirty-three posts. The hook is structural — on a
  piece the rail sits inside the `<article>`, on a listing it is a sibling of the feed — and
  deliberately not a class, because the first hook tried was the book-typography class,
  which is a SETTING the owner can turn off.

## notes — the notebook dialect

A ruled page lying on a dotted desk.

- **The sheet is `main > article`, never `article`.** A listing's rows are `<article>`
  elements too, and the bare selector drew a bordered card round every entry on the front
  page.
- **One inset on all four sides, and the sheet grows OUTWARD by exactly what it pads**, so
  the first line of the piece stays on the line the shelf and the card start on and not one
  word of the column moves when the dialect is switched. 20px, plus one for the border on
  the top margin. Below 46rem it drops to 12: the only side space there is the page's own
  25px of padding, and a 20px sheet left four pixels of desk showing, which is a near miss
  rather than a margin.
- **The ruling is drawn per paragraph, never across the sheet.** One background on the page
  has one fixed step and the text cannot follow it the way a hand does — a picture is not a
  whole number of lines tall, so the rules drift and start cutting through the text. Per
  paragraph cannot drift; book typography already runs paragraphs together, so a run of
  prose comes out continuously ruled and a heading or a picture interrupts it the way
  pasting something into a notebook does. The rules run the width of the PAGE, not the width
  of the words: at the column's width they read as underlined text.
- **The desk is a tone darker than the page.** Dots alone were too quiet to read at a
  glance: what makes a sheet look like a sheet is that the thing under it is not the same
  colour. Both hairlines in the gutter go with it, and the two dots that hung on them.
- **No arrow on an outbound link.** U+2197 is outside both bundled subsets and fell back to
  a system face; drawn instead as a rotated U+2191 it was its own inline box and broke onto
  the next line by itself at 390px.
