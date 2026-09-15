# 0054 — The admin is pages again, and the editor is the only client left

Date: 2026-09-14
Status: accepted · replaces [0006](0006-admin-stays-react-spa.md)
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

[0006](0006-admin-stays-react-spa.md) kept the admin as a React SPA during the port, and it was
right to. It also wrote down, in its own Consequences, the bill that this ADR is paying:

> **Cost accepted:** React idiom has a high ten-year mortality, so this code will need
> rewriting eventually. That is the right trade, because the cost of rewriting it later is
> falling faster than the risk of keeping it is rising.

Four things have moved since 2026-07-27.

**The deadline it was written under is discharged.** The port shipped at
[0012](0012-flatten-repo-after-cutover.md).

**The intent is now on the record.** [0053](0053-a-dependency-is-a-decision.md) makes writing it
here the default and a dependency the exception. React and the Tiptap wrapper are in its tier C.

**The harness 0006 asked for exists, and is four times the size it asked for.** That ADR made
the admin's lack of parity coverage a condition and required "a scripted headless tour of at
least 30 flows". `bun run tour` runs **127**, in a real browser, and asserts geometry and
contrast as well as behaviour. A screen-by-screen rewrite is measurable in a way it was not.

**The other half of the product already works this way.** The reading site is Hono rendering
HTML with small islands of plain JavaScript in `src/assets/js/`, and it has been since
[0008](0008-hand-written-css-no-tailwind-public.md). The admin being a different kind of program
means every rule about pages has two answers.

What is being carried:

| | |
|:--|:--|
| Admin TypeScript, tests and build output excluded | **29,509 lines** |
| `.tsx` components | **176** |
| Hook call sites | **731** (321 `useState`, 143 `useEffect`, 135 `useRef`, 64 `useCallback`, 40 `useMemo`) |
| JavaScript the owner's browser downloads | **2,420 KB** |
| API endpoints the admin calls | **51** |

## Decision

**The admin becomes server-rendered HTML with islands, the same shape as the reading site.
React and `react-dom` go. The editor stays a client-side application, on ProseMirror directly.**

Four things follow from that, and each is a decision in its own right.

**1. Navigation is the browser's again.** The client router goes and each admin screen becomes a
Hono route that renders HTML. Moving between screens is a page load. For a program one person
opens, that is not a regression — it is what the reading site does, and it removes the router,
the route-level code splitting and every loading state that exists only because navigation was
being simulated.

**2. The eleven admin dictionaries stop shipping.** They are translated strings picked at render
time, so the server picks them and the browser is sent one language: the words, already chosen,
inside the HTML. That alone is most of a megabyte.

**3. The editor is the exception, and stays one.** ProseMirror is an application, not a page, and
[the pen](0049-the-pen-answers-the-hand.md), the maths nodes, find-and-replace and the Markdown
bridge are all built on it. Only the wrapper leaves: `@tiptap/*` is a convenience layer over
ProseMirror, and 15 of this repository's import sites already reach through it to
`@tiptap/pm/*`, which IS ProseMirror re-exported.

**4. ProseMirror becomes a direct dependency, in tier B of [0053](0053-a-dependency-is-a-decision.md).**
It arrives today underneath Tiptap; after this it is named. That is an addition, so it is stated
here rather than made quietly: `prosemirror-state`, `-view`, `-model`, `-transform`, `-commands`,
`-keymap`, `-history`, `-inputrules`, `-schema-list`, `-dropcursor`, `-gapcursor`, `-tables`.
The reason it is an exception and not tier C is the one 0006 gave and that has not weakened in
seven weeks: **Vietnamese IME with Telex**, across four browsers, in the program its owner writes
in every day. `key-feedback.ts` already carries the scar tissue of handling one composition
event. ProseMirror is ten years of the rest.

### The order, and why it is this one

Cheapest first, and the editor last, so that the hardest screen is converted by someone who has
already converted fifteen others.

1. **The screens that are forms.** Settings, and the first-run steps. Mostly inputs that POST.
2. **The screens that are lists.** Posts, pages, notes, comments, subscribers, redirects.
3. **The library.** Uploads, with the one real island: the drop target and its progress.
4. **The dashboard and analytics.** Charts, which are islands over data the server already has.
5. **The editor.** Last, and on its own, and in two steps: `@tiptap/react` first (the three React
   node views become plain ProseMirror ones), then Tiptap itself.

⚠️ **THE LIBRARY MOVED TO THE END, WITH THE EDITOR.** `/admin/content` looks like step 2 and is
not: `pages/Content.tsx` is 43 lines of empty sheet, and the list on that screen is `WritePane`,
which the shell mounts for the library AND for all three editors so that clicking a row swaps
only the sheet. Converting the library alone would leave that one 399-line pane written twice —
once as HTML for `/admin/content`, once as React for `/admin/editor/*` — and two copies of the
same list is precisely the drift this ADR's markup rules exist to prevent. So the library, the
pane and the editors convert together, and the order above becomes 1, 2 (minus the library), 3,
4, then the library with 5. Decided 2026-09-14, after the assistant.

⚠️ **AND SETTINGS IS NOT STEP 1.** "Mostly inputs that POST" was a guess, and the survey says
otherwise: seven tabs over about 7,400 lines, TWO save protocols on one screen (a page-level
`PUT /api/settings` and a card-level partial of the same route) plus roughly thirty card-owned
endpoints, of which a dozen are irreversible or reach outside the machine. It also holds two
code editors with synced gutters, a palette grid of native colour pickers, a live type
specimen, a keystroke-sound synthesiser, three file dropzones — and three fields that open the
MEDIA PICKER, which the Media screen owns. So Media converts first and brings the picker with
it as the fourth bridge (`quire:pick-media`); Settings is the last screen before the editor.
Groundwork for it — the field vocabulary and the form's diff engine — is written and parked.

### What proves each step

- **The tour's flows for that screen stay green.** They are written against the rendered page and
  not against React, so they do not need rewriting to keep working. A flow that has to change to
  pass is a behaviour that changed, and that is the signal. It has fired once: the analytics
  piece index now sends every row and hides all but ten, so a flow that counted rows compared
  forty-one against forty-one. The behaviour that changed is real and intended — the whole index
  arrives in the first response — and the flow now counts what is VISIBLE
  ([`docs/admin-one-dom.md`](../admin-one-dom.md)). It has fired twice more, both on the
  assistant, and both are improvements the React shape was in the way of:
  - **A conversation is in the address** (`/admin/assistant?chat=12`). The React face opened a
    chat by id rather than routing to it, because a route change would have swapped the page
    component and taken the conversations column with it. There is no component to swap now, so
    what is left is what that cost: a reload lost the conversation you were reading, Back left
    the screen entirely, and switching chats mid-pause could send a verdict naming calls from
    the conversation you had just left.
  - **"New conversation" no longer inserts a row.** It posted a chat the moment it was pressed,
    so pressing it three times left three empty conversations in the list and in the database.
    It is a link to the bare address; a question already opens a chat for itself when there is
    none.

### Settings, and the two rules it forced

**All seven panels ship drawn, and here that is load-bearing.** The Save key stores the WHOLE
form: an owner changes the blog's name on one tab, the front page's shape on another and a
palette on a third, and presses Save once. Drawing one tab and navigating between them would
make every switch a page load, and a page load with unsaved work either loses it or raises the
browser's own two-button warning. Measured: **554 KB of markup, 49 KB gzipped** (the app
brotli-compresses its own HTML, so the wire figure is lower again), 244 controls, 7 panels, 112
search rows. Appearance is 210 KB of the 554 on its own.

**There is no copy of the settings in the page.** What a field WAS is what the browser already
holds for it — `defaultValue` on an input, the `selected` attribute on an option, `data-was` on
the three kinds of control that have neither. So the unsaved count is exact and sixty-three
settings keys do not ride into the browser twice.

⚠️ **THE THREE-WAY LEAVE QUESTION SURVIVED, and it is a fix rather than a port.** This document's
own trap 3 says a converted screen's links are real navigations, so leaving a dirty form would
have raised the browser's generic warning — two buttons, neither of which can save — on the one
screen where leaving without saving throws work away. The island catches the click itself and
asks the product's own question; `beforeunload` stays underneath it for the ways out a click
handler cannot see.

**Six bugs the conversion found, four of which would have saved the wrong thing silently:**

- An **emptied number field** sent `0`. "Posts per page" to none, "upload limit" to zero bytes.
- **Array-shaped keys** (`menu`, `featured`, `home.front.strips`) built objects, so `menu.0.label`
  sent `{menu:{0:{label}}}` and `sanitizeMenu` — which walks an array — stored nothing.
- **A boolean behind a segmented strip** (`figure.ink`) sent the string, and `bool()` discarded it.
- ⚠️ **A hidden field could never look changed.** `input[type=hidden]` keeps `value` and
  `defaultValue` in lockstep, so five settings — both logos, the portrait, `enabledPalettes`,
  `customFont` — would have been chosen in the picker, drawn on screen, and not sent. This is why
  `hiddenField()` writes `data-was` and why a test asserts every hidden field has one.
- **`enabledPalettes` failed in the worst direction**: `sanitizeEnabledPalettes` reads a non-array
  as "turn all six on", so sending the string would have switched on palettes the owner had
  switched off.
- **One switch drawn on two tabs.** The comments master switch is on Posts and on Comments & mail
  — React drew one component twice over one piece of state. Two independent controls do not stay
  in step, so the island mirrors them and the count counts KEYS rather than controls.

**And six more that only a photograph found.** Each one type-checked, passed the suite and the
tour, and would have shipped. They were caught by running the new build and the React build side
by side on one seeded database and comparing the screens by their text, by every element's
computed box, and finally pixel for pixel — which is a check that stops being available the day
the React build is deleted, so what it found is written here and pinned by tests.

- ⚠️ **A LAMP WRAPPER THAT LOST ITS `flex` MADE EVERY CARD WITH A LAMP 7px TALLER.** Without it
  the wrapper is a block holding an inline-block, so it takes a 24px line box for an 8px mark.
  Twenty-two cards on one screen, half of them with lamps, and the header heights no longer
  agreed. Nothing in the markup is wrong to read; it is only wrong to measure.
- **Every select lost its chevron.** The control sets `appearance-none`, which takes the
  platform's own caret away, and the replacement was written as `<svg data-glyph="down"></svg>`
  — an attribute that means something only inside a `Mark` tree. In raw markup nothing fills it,
  so the svg was empty and a dropdown looked exactly like a text box.
- **A slider's readout dropped its unit.** The server printed "60%" from a string the caller
  passed; the island rewrote the box from `value` + `data-unit` and printed "60". Two renderers,
  two answers; `slider()` takes the unit now and both read it.
- **The SMTP card said "Loading..." forever.** It is the one card on the screen whose values are
  not in the site record — they sit behind `GET /api/mail` — and nothing was ever written to ask.
  Every stored SMTP field was invisible on the screen whose job is showing them, and the only
  symptom was a word that is supposed to be brief.
- **Two lamps read grey where they should read amber.** Grey is "switched off", which is a
  settled state somebody chose. A connection with no credentials has no switch, so the only
  thing off could mean there is "never set up" — something to do. React defaulted `enabled` to
  true for exactly this reason.
- **A number field holding one digit was 380px wide,** because the caller asked for the full
  column. A short answer sits in a short field: the width of a field is a claim about how much
  belongs in it.

**Three differences are deliberate, and they are the whole list.** A conversion that changes how
a screen reads is hiding a decision inside a move, so every other difference above was closed:

1. A segmented strip's explanation now sits ABOVE the strip, where every other row in the admin
   has always put it. React made the strip the exception; five rows on Home and Posts move.
2. "Looks like" appears once — as the card's title — where React drew it as the title AND as the
   control's label.
3. The site-language select takes the same width as the timezone select beside it, where React
   sized it to its content. Two dropdowns in one card at two widths was the older answer.

The timezone list also lost its 26 `Etc/GMT±N` entries. In those names the sign is INVERTED
against every other way a person writes an offset — `Etc/GMT+1` is UTC minus one hour — and they
are in the database for POSIX compatibility. The browser leaves them out of `supportedValuesOf`
and this list was the browser's until it moved to the server, where the engine hands back all
26. A stored zone the runtime does not offer is now prepended to its own control, because a
`<select>` whose value matches no option silently shows its first one instead.

### The write column, and the one number this ADR paid for it

The library, the column and the editors were always one conversion (see the correction above).
This step did the first two thirds: `/admin/content` and the three editor addresses are all
server-drawn frames now — rail, write column, sheet — and what is still React is only what goes
IN the sheet. `WritePane.tsx` and its six helpers are gone; `<div id="admin">` moved INSIDE the
paper on those three addresses, and `data-admin-react="sheet"` is the server telling React it
may still draw a route there. Both leave when the editor converts.

⚠️ **A ROW CLICK IS A REAL NAVIGATION NOW, and here is what that cost.** Measured 2026-09-15,
two builds on one seeded database, click to the writing surface:

| | old (React) | new |
|---|---|---|
| the write list itself | 79 ms | **85 ms** |
| opening a post, first time | 346 ms | **373 ms** |
| opening the next post | **12 ms** | 373 ms |

So the list is unchanged and the first open is unchanged; what went is the warm click. It went
because the column was mounted outside the router precisely so it would survive one, and
nothing survives a page load. 373ms is also the TRANSITIONAL number: almost all of it is React
and Tiptap booting from nothing on every open, which is what step 5 removes.

⚠️ **AND A MEASUREMENT THAT WAS WRONG BY 2.1 SECONDS.** The first reading said 2,512 ms, which
would have been a reason to stop. It was the PROBE's own `sleep(2500)` before evaluating: a
harness that waits and then asks the page for `performance.now()` is told how long it waited,
whatever the page did. Every resource had finished by 571ms. A measurement that cannot say what
it is measuring is worth less than no measurement, because it gets acted on.

**What the column gives back, and how.** Scroll position, the search text and the three filters
are in `sessionStorage` — per tab, cleared with the tab, never told to the server. They are put
back after the filters are applied, because the scroll height depends on how many rows show.

**Two faults this screen taught, both about counting rather than drawing:**

- ⚠️ **TWO MECHANISMS DECIDING ONE `display` IS ONE TOO MANY.** The first cut left kind, status
  and "what is missing" to CSS rules against attributes on the column and kept only the search
  in the island. It DREW correctly and could not COUNT — `shown` was the number of rows that
  passed the search, so a filter hiding all forty-six still reported forty-six and the "nothing
  matches your filter" line never appeared. Found by diffing against the React build, which said
  the sentence. One mechanism now: `hidden`, written by the island, and by the server for the
  one filter that arrives in the address.
- **A lamp in a plain span takes a line box.** 16px of it for an 8px mark, which grew the filter
  row by 8px. The same fault cost every settings card 7px of header height in the step before
  this one. There the fix was `flex` on the wrapper; here it was not having a wrapper — the
  attribute goes on the lamp.

**The drawers had no check at all before this.** `TaxonomyManager.tsx` and `SeriesManager.tsx`
had no unit test and no flow, while driving the most far-reaching pair of writes in the admin:
renaming a category rewrites the front matter of every post carrying it and merges on collision.
Two flows now — one that opens both, counts what they list, and proves the rename ASKS; one that
reorders a series and proves the server kept it.

### The three node views, and what a unit test cannot reach

Step 5's first half: `VideoNode`, `MathNode` and `CaptionedImage` stop being React components.
None of them needed React — between them they held one piece of state, a `draft` string
mirroring the maths node's TeX so its `<input>` could be controlled, and a DOM input holds its
own value. What they needed React FOR was nothing; what they cost was everything, because a node
view is the one piece of the editor that runs INSIDE the document. While any of the three is a
React component, every document this admin can open is a document React has to be mounted to
draw.

**Their words arrive through `configure()`.** A node view has no context and no dictionary, and
the alternative to passing them in is a node view importing all eleven languages to print a
toolbar. Seventeen strings for the picture, two for the video, one for the maths.

⚠️ **`stopEvent` MUST NOT ANSWER `true` FOR EVERYTHING, and all three were written that way
first.** The maths node shipped it: the click that selects an atom never reached ProseMirror,
selecting is what swaps the rendered formula for its source, so a formula could be read and
never corrected. **Every unit test passed** — a node's attributes, its serializer and its input
rules are all reachable without a pointer. Found by clicking one. The rule is that only the
CHROME's events are the view's: the toolbar, and the field you type a caption or a formula into.

⚠️ **AND THE FIRST MEASUREMENT OF THAT BUG WAS WRONG TWICE.** A synthetic `mousedown` on the
wrapper reported the fault as still present after the fix, because ProseMirror reads the position
from the event's own coordinates and wants it on the drawing. Confirmed the other way instead —
`stopEvent: true` put back, box never opens, taken out again — which is the only form of proof
that survives a harness bug.

⚠️ **A GALLERY'S COLUMN COUNT IS A PROPERTY OF THE RUN, AND WAS BEING KEPT PER TILE.** Each React
tile walked the whole document to count its own run, on every keystroke, and ProseMirror does not
redraw a node whose own attributes did not change. Measured 2026-09-15 on the outgoing build:
five tiles at three across, delete one, and the four left stayed 204px at three across while the
published page rendered them 2x2. It is the same fault `galleryCols` was written to fix a year
earlier, surviving in the half nobody measured. It is a ProseMirror decoration now — one walk per
transaction instead of one per tile, and always the whole run.

**Seven `:has()` selectors left the admin with the picture, which is the real reason that node
went last.** `ReactNodeViewRenderer` wraps every node view in a `.react-renderer` div, and a
gallery tile's width has to live on the element in the flow — so `admin.css` reached the wrapper
through `:has(> figure.img-grid)` and six siblings. `:has()` runs on Safari and does not run
well: WebKit has no de-duplication cache for it, and thirteen of these rules took a product page
from 0.75s to 4.19s and crashed the render process outright on another site. Chrome was unaffected
throughout, which is what makes it easy to ship. The figure is the node view's own element now
and the rules key on it directly. **There is no `:has()` left in the admin.**

**Two differences from the outgoing build are deliberate:**

- **Every segmented key carries `aria-pressed`.** A control whose pressed state is only a
  background colour is a control a screen reader cannot report. The server's own `tabs()` had
  said so for a while; the React node views never did.
- **A "Large" picture is previewed at large.** Until now the editor drew `#wide` exactly like a
  column picture, so the size keys offered a choice the writing surface did not show — the same
  complaint `galleryCols` answers for the column count. It cancels the sheet's own `px-4`, so it
  spans the full sheet at every width and cannot overflow it.

Everything else is identical, measured old against new on one seeded database: the text of the
writing surface, and every figure's box to the pixel on a real gallery post. The escaping tile
toolbar — `position:absolute; bottom:100%`, whose containing block used to be the React wrapper —
lands in the same place to the pixel, because `position: relative` moved onto the figure with it.

⚠️ **AND `check:admin-css` WAS HALF BLIND, TWICE IN ONE DAY.** That guard proves every class the
admin writes has a rule behind it. A node view BUILDS its elements, and the first cut passed the
class list as a bare positional argument — a whole file's chrome vanished from the guard's view,
the count fell by one, and the check stayed green. Fixed by naming `className`, and then the same
question asked again found the larger half: the guard read the literals inside `${…}` holes but
not the body of a `className={…}` expression, which is the commonest form in the React admin.
**51 classes had never been checked.** Both were found by planting a class with no rule and
watching the check pass. A guard is worth what its last deliberate failure proved.

### The fourth bridge: `quire:pick-media`

The first one that answers back. The picker is an overlay island now
([`src/admin/island/lib/media-picker.ts`](../../src/admin/island/lib/media-picker.ts)), opened
by anything that needs a picture — the three editors and two settings cards, all still React —
through a `CustomEvent` carrying the words to say and a callback to answer on. The rail island
is on every admin page and imports the overlay only when that event arrives, so a page that
never opens a picker never downloads one. An unheard ask resolves to "closed", which is the same
rule the confirm bridge follows: nothing happens rather than something unasked-for.

It replaces a `<MediaLibrary mode="picker">` mounted at six call sites, and it arrives with three
things that component never had: `role="dialog"`, Escape, and the focus put back where it came
from.

### One description, two renderers

The assistant is the first screen whose markup is produced twice: by the server for a stored
conversation, and by the island for one still arriving over the wire. Written twice they drift,
and the transcript then reads as two different screens depending on whether you reloaded.

So the SHAPE is data ([`src/admin-shared/markup.ts`](../../src/admin-shared/markup.ts)) and the
two renderers are about twenty lines each: `htmlOf` escapes into a string, `elOf` builds nodes
and sets text as text. Neither can inject markup, because neither is ever handed any — they are
given a tree that already says what every element is.
[`src/admin/island/mark-agreement.test.ts`](../../src/admin/island/mark-agreement.test.ts) holds
them to the same answer, through one serializer, for every state an exchange can be in.
- **`check:admin-css` keeps every class honest**, which is what makes moving markup between files
  safe at all.
- **The editor's own suites**: 2,074 lines and 122 blocks, including the corpus round trip whose
  second law is that a save may not change the reader's page.
- **Telex, by hand, before the editor step ships.** No harness here reaches an IME. This is a
  condition, not a suggestion.

## Consequences

- **The admin stops being a second kind of program.** One way to render a page, one way to write
  an island, one set of conventions.
- **Roughly 2 MB stops being downloaded**, most of it dictionaries and the framework. This does
  not matter for speed on the owner's machine and was never the argument; it matters because it
  is 2 MB of somebody else's decisions.
- **This is the largest single change since the port**, and it is the one with the most ways to
  be quietly wrong. It is deliberately cut into five steps that each ship.
- **`@tiptap/*` leaves; `prosemirror-*` arrives.** The count of packages barely moves. The point
  is which layer this project depends on: the wrapper has a commercial tier and a company behind
  it, and the engine underneath is MIT, one author, and older than this product.
- **0006's parity concern outlives it.** The admin is still the area a type error cannot see.
  The tour is the answer, and every step of this owes it a flow.
