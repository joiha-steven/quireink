# The editor leaves React, step by step

The log of ADR 0054's step 5 — [`decisions/0054-the-admin-is-pages-again.md`](./decisions/0054-the-admin-is-pages-again.md),
which holds the decision and the order. This file holds what each piece of the editor cost and
what it found, because a conversion's findings outlive the conversion and an ADR that grows a
running commentary stops being readable as a decision.

⚠️ **The editor is an APPLICATION, not a page**, which is decision 3 of that ADR and the reason
this step looks different from the other thirteen. The other screens became HTML the server
draws; the editor's own chrome is built in TypeScript by the editor, because it only exists
while ProseMirror is running. That is also what lets it convert one control at a time while the
sheet around it is still React's.

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
first.** On the maths node it made the formula uneditable: the click that selects an atom never
reached ProseMirror, selecting is what swaps the rendered formula for its source, so a formula
could be read and never corrected. **Every unit test passed** — a node's attributes, its
serializer and its input rules are all reachable without a pointer. Found by clicking one. The
rule is that only the CHROME's events are the view's: the toolbar, and the field you type a
caption or a formula into.

⚠️ **AND THE COMMIT MESSAGE FOR `92c9fb4c` OVERSTATES THAT: it says the fault "shipped", and it
did not.** No commit ever carried an uneditable formula — `MathNode.ts` exists in exactly one
commit and that commit has the fix. The hour it stood was an hour in a working tree. What DID
reach a commit is the same `stopEvent(): true` on the video node (`f797d5fd`), where it was
harmless only by accident: that node lays a transparent sheet over the player and selects itself
from it, so the swallowed click was being replaced by an explicit one. Both were tightened in
`92c9fb4c`. The distinction is worth writing down because "shipped" is the word that decides
whether a reader has to go and check production.

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

⚠️ **AND `check:admin-css` WAS BLIND IN THREE PLACES, ALL FOUND IN ONE DAY.** That guard proves
every class the admin writes has a rule behind it, and it reads them by looking at what follows
a `className`. It could not see:

1. a class list passed as a bare positional argument to an element builder — a whole file's
   chrome, gone from its view, the count down by one and the check still green;
2. the body of a `className={…}` expression, as opposed to the literals inside its `${…}` holes
   — the commonest form in the React admin, and **51 classes that had never been checked**;
3. the continuation of `className = 'a b' + ' c d'`, which is how a long list is written when it
   has to fit a line limit.

Each was found the same way: plant a class with no rule, watch the check pass. Each showed the
same symptom, and it is the one worth remembering — **a number that did not move**. A guard is
worth what its last deliberate failure proved, so the count it prints is a measurement and
should be read as one.

### The editor's own chrome, and a number that did not move

The editor is an APPLICATION rather than a page (decision 3 above), so its furniture is built in
TypeScript by the editor itself rather than rendered by the server like the other thirteen
screens. That is what lets it convert one control at a time while the sheet around it is still
React's. The button strip went first: 210 lines of JSX for twenty-five keys, six of which wear a
pressed state and five of which appear only while the caret is in a table.

⚠️ **AND IT BOUGHT NOTHING IN SPEED, WHICH IS WORTH WRITING DOWN BECAUSE IT WAS EXPECTED TO.**
The strip asked twenty-one `isActive` questions on every render and the editor was set to
re-render on every transaction to keep those answers live, so the obvious story is that every
keystroke rebuilt a React tree to decide whether Bold looks pressed. Measured on 2026-09-15, two
builds on one seeded database, eighty keystrokes each after a discarded warm-up:

| | old (React) | new |
|---|---|---|
| a keystroke, synchronous, 6,397 words | 0.4 ms | **0.4 ms** |
| the same, to paint | 16.8 ms | **16.6 ms** |
| the worst frame | 20.7 ms | **17.7 ms** |

16.6 ms is one frame at 60 Hz: the cost was already under the budget and a writer could not feel
it. The honest claim for this step is that React is out of the toolbar, which is what this ADR is
about — 0053's question is which LAYER the product depends on, and the ADR says plainly that the
megabytes "do not matter for speed on the owner's machine and were never the argument". A
performance story invented for a change made for a different reason is how the next person comes
to believe something false about this codebase.

**Four states are identical, measured rather than assumed**: at rest, with the caret in a bold
run, with a heading selected, and with the caret in a table — 48, 48, 63 and 53 controls, every
label, every pressed state and every box the same. The table row is the one that matters most,
because it is the only control here that changes the DOM's shape rather than a colour.

⚠️ **AND `check:admin-css` CRIED WOLF, WHICH IS THE OPPOSITE FAULT TO THE THREE ABOVE.** This
project quotes identifiers in backticks, and a backtick-quoted identifier inside a class table's
comment is indistinguishable from a template literal to a regex. The guard reported a missing
rule for the words `check:admin-kit` — a sentence, not a class. Comments are stripped before the
literals are read now. A guard that cries wolf gets its complaint dismissed, and the next
complaint with it.

### The floating bar and the "/" menu

The bubble bar's BODY had stayed React after its positioning became a ProseMirror plugin; now the
buttons are built too, and `EditorMenus.tsx` goes with the slash menu. Both are the editor's own
furniture rather than the sheet's: the bar is placed by the plugin, and the menu is
`position: fixed` at coordinates the editor measured when the key was pressed. Neither was ever
really part of the page's markup.

⚠️ **`title` IS THE NAME; `aria-label` IS THE NAME PLUS ITS CHORD** — and the first cut had them
the wrong way round, which put the chord in the tooltip where it is noise and took it out of the
one place a keyboard user would hear it. Caught by comparing the two builds' controls: the
tooltip read "Bold (⌘B)" where it had read "Bold". `aria-pressed` is written only where the React
bar wrote it, on the three headings and the five inks; a bar where twenty-five keys all announce
"not pressed" is noise.

**Two differences are deliberate and both are smaller than a pixel:**

- **The heading keys are 0.02px narrower each.** `H{level}` in JSX is TWO text nodes, "H" and
  "2", and a browser shapes them separately — so the kern pair between them was being lost. One
  string shapes as one word. The bar measures 486.234 against 486.281, and rounds to 486 on both.
- **"Remove link" is drawn and hidden rather than absent.** `display: none`, so it is not a flex
  item, takes no gap and is out of the tab order: 17 laid-out children on both builds, 18 nodes
  on the new one.

**Measured identical otherwise**, at rest, with the caret in a bold run, with a heading selected
and with the caret in a table: 48, 48, 63 and 53 controls, and the bar lands on the same pixels
from the first line of a piece and from the middle of it.

### The find strip, the Markdown view, and a bug that shipped

`FindBar.tsx` and `MarkdownSource.tsx` were the last two React components inside the editor.
Both are plain modules now; `mark` and `withHits` were always pure and are untouched.

⚠️ **AND THE MARKDOWN VIEW LOST THE PAPER, ON PRODUCTION, FOR THREE COMMITS.**

The writing surface is rendered only in the rich view, so switching to the Markdown source
REMOVES the element it lives in and takes the surface with it. `EditorContent` handled that: on
the way out it parked the surface in a detached div, and on the way in it put it back, every
time. The fifteen hand-written lines that replaced it on 2026-09-15 moved it in ONCE — the
effect was keyed on the editor instance, which never changes. Switching to Markdown and back
left an empty sheet, with the document intact in an editor nobody could see.

**It shipped.** `check:all` was green, 3,516 tests; the tour was green, 159 flows. Nothing
toggles a view in a unit test, and the tour's Markdown flow went one way and stopped.

⚠️ **AND THE COMPARISON COULD NOT SEE IT EITHER, WHICH IS THE LESSON WORTH KEEPING.** The
harness builds the previous commit and runs it beside the new one — and by then the previous
commit already carried the fault. Both sides agreed, perfectly, on the wrong answer. The
baseline for a conversion is the last build the OWNER had, not the last commit: `BASE=` had to
be walked back four commits before the two sides disagreed, and the moment they did the cause
was obvious.

Found by pressing the key twice. Pinned by a flow that presses it twice, and that flow was
proved to go red against the broken build before it was kept.

**One more thing the browser caught here.** The source view's textarea is built once at the
first render rather than when the switch is thrown, because `useRawView` restores the caret into
it from an effect declared above — a box that does not exist at that moment is a caret that
lands at the end of the document. The first cut let a second writer set the value afterwards,
which sends a textarea's caret to the end: measured at 152 of 152 instead of 97. One writer now,
inside the effect that does the restoring.

### The sheet around the paper, and the end of the React admin's routes

The last step, and the largest: the three writing addresses stopped being a React application
with a server-drawn frame and became a page with an editor built into it. What moved is
everything that is not the writing — the action line, the title, the attributes panel, the time
machine's dialog — and it moved as markup, drawn by `screens/sheet*.ts` and wired by
`island/sheet.ts` with its eight libraries. Three React forms of 384, 339 and 340 lines became
one renderer and one island: what differs between a post, a page and a note is DATA now.

**The piece travels in the HTML.** The React editor booted, then fetched
`/api/admin/view/editor` for a post the server had been holding while it wrote the page — a
blank sheet for as long as that took. The body, every attribute and the taxonomy lists are in
the page.

**One language, and a named subset of it.** `SHEET_WORD_KEYS` is 121 keys, 1.7 KB gzipped,
against a whole admin dictionary's 1,258 keys and 25 KB — most of it for screens this one cannot
reach. The list is named once; the TYPE and the picker are both derived from it, which is the
only arrangement in which a subset cannot drift from what reads it.

⚠️ **THE WORD COUNT NEVER APPEARED, AND THE FIRST EXPLANATION OF WHY WAS WRONG.** It is a
SENTENCE the island writes or leaves empty, and it also carries `hidden sm:inline` — the
breakpoint's answer to a different question. It shipped with a `hidden` ATTRIBUTE as well, which
nothing ever removed, so it was hidden at every width. Caught by diffing the sheet's text against
the build the owner was running.

The fix was one word of markup. What went with it, and had to be taken back out, was a CSS rule
written on a belief this repository states twice in `admin.css`: that "a `hidden` attribute
against a display utility is a tie the utility wins, because preflight writes
`[hidden]{display:none}` first". **It is not true in this build.** `utilities.css` line 248 is
the only `!important` in the entire sheet and it is on `[hidden]`, so the attribute beats `flex`,
`contents` and `inline-block` outright — which is exactly why every drawn-and-hidden part of this
sheet works with no rule at all. Both comments now say so, with the line number, because a belief
that is wrong and written down twice is how a third copy gets written.

**The panel's five own shapes were four pixels out of step with the six around them.** A set of
terms, a series name, a picture, a date and the draft/published pair are drawn here; the slug,
the excerpt and the SEO pair are drawn by `fields.ts`. The first cut wrote its own captions —
14px/500 in neutral-700 over a 6px gap, where every other field in the same stack is
`SETTING_LABEL` in neutral-800 over 8. All eleven are `settingRow` now. The old panel had the
same drift and had had it for longer: the note editor's status label and its quote box were both
hand-copied class lists that no longer matched the control they were copied from.

**Measured against the build the owner was running** (`BASE=4d692b6b`, not `HEAD` — see the
Markdown-view entry above for why that distinction is load-bearing): on all three addresses the
sheet's text is identical, the control set is identical — 102/103 controls at rest, 109/112/174
with the panel open, the same 53 tag offers — and every control lands on the same pixel except
the deliberate correction above. The toolbar is identical in all four states it can be in. The
date field, the find strip, the Markdown round trip and a driven save all answer the same on
both.

⚠️ **AND THE NUMBER THIS STEP WAS FOR.** Opening a post, to the moment there is a writing
surface to type into, three readings each on one seeded database:

| | old (React) | new |
|---|---|---|
| ready to type | 394 / 396 / 402 ms | **106 / 107 / 108 ms** |
| JavaScript fetched | 363 KB, 21 files | **357 KB, 18 files** |

The bytes barely move and the wait falls by a factor of 3.7, which is the shape the write
column's entry predicted: almost all of the old number was React and Tiptap booting from
nothing on every open. What is still downloaded of React — 63 KB of the admin bundle and 29 KB
of the entry — is the four overlays, and it leaves with them in the step after this one.

**What left with this step**: 36 files, including the three forms, the three settings panels,
`Editor.tsx`, `SlideOver`, `TimeMachine`, `MultiSelect`, `Combobox`, `DateField` and the four
editor hooks. The React admin now routes ONE page — the dead end — and keeps only the overlays:
the palette, the shortcut sheet, the confirm dialog and the toast. The temporary
`quire:navigate` bridge between the rail's island and the router went with them, on the date its
own comment set for it.

⚠️ **A toast does not survive a navigation, and the editor's Trash key depended on one.** The
delete is soft and asks nothing, and the whole argument for asking nothing is that the undo is
in the toast — then the piece is gone, the editor has to leave, and the toast goes with the
page. `island/lib/say-across.ts` carries the sentence and the undo's INGREDIENTS across the
load, read once on the other side.

### Step 6: React leaves, and four overlays come with it

The last of it. `react`, `react-dom` and their two type packages are out of `package.json`, `jsx`
is out of `src/admin/tsconfig.json`, the React `Bun.build` block is out of `scripts/build-admin.ts`
and four lines are out of `scripts/checks/deps.ts`. **45 files went**, and the admin stopped being
two kinds of program.

**What was left to convert was not a screen.** Step 5 ended with the React tree routing ONE page —
the dead end — and holding four things that belong to no screen at all: the command palette, the
shortcut sheet, the confirm dialog and the toast. They are [`web/admin/overlays.ts`](../src/web/admin/overlays.ts)
now, drawn by the server on every admin page, wired by five files under
[`island/lib/`](../src/admin/island/lib/) that the rail imports before its own early return —
because the picker, the toast and the confirm dialog are asked for by screens that have nothing to
do with the rail, including the sign-in shell, which draws no rail at all. **A question nobody
hears is a delete that happens in silence.**

⚠️ **AND THE NUMBER THE WHOLE ADR WAS FOR.** What the browser must have before the first frame, on
every admin page:

| | old (React) | new |
|---|---|---|
| before the first frame | 297 KB | **22 KB** |

There is no admin bundle any more. Every island is an entry of its own and a screen links the one
it needs; `check:bundle` measures the RAIL entry, because that is the one every page loads.

**The palette ships its hundred-odd rows as markup.** It is the clearest case of this ADR's second
decision: the rows are a fixed list the server already holds — `settings-index.ts` plus the
screens, the actions and the writing — so drawing them is the server's job and the island's job is
to hide the ones that do not match. It carries **both search lanes** (`data-pal-lower` and
`data-pal-fold`), which is `src/accent.ts`'s rule and not a fold of both sides: an unaccented query
finds every accent and an accented one finds only itself, because five Vietnamese words live inside
one folded spelling.

⚠️ **TEN TOUR FLOWS WENT RED FOR ONE REASON, AND AN ELEVENTH WENT WORSE THAN RED.** React mounted
an overlay the moment something opened it, so `document.querySelector('[role=dialog]')` could only
ever find the one that was open. Four are drawn and hidden on every page now, so that same line
finds the FIRST in the document — the confirm box — whatever is on screen. Three flows counted a
`<form>` that is the confirm dialog's own typed-name box; the picker flows opened the picker and
then measured the confirm box; the palette flows typed into its hidden input and found no rows.

The eleventh is the one worth writing down. **"Staying keeps an unsaved settings change" kept
passing while reaching into the hidden confirm box**, because clicking a hidden button does
nothing, and the page it therefore failed to leave is the page the flow wanted to still be on. A
guard that passes by not working is worth less than one that is red.

[`scripts/tour-ask.ts`](../scripts/tour-ask.ts) holds the answer once — `openDialog()` filters on
`checkVisibility()`, because only the confirm box carries `hidden` itself and the other three are
hidden by the scrim around them, and `offsetParent` is null for all four either way. `screenForms`
names the confirm dialog's form as the one exception, with its reason, rather than scoping the
check to `main`: a form arriving anywhere else must still turn the flow red.

**What the React deletion left behind, found by asking which files the island entries can still
reach.** Five modules nobody imported: the fetch layer every React page read its props through,
two re-export shims kept so call sites that no longer exist would not have to change their import,
and the browser's dictionary loader — 45 lines plus a green test, for a job the server does inside
the HTML now. Also 39 lines of CSS for a progress bar nothing draws any more, and **six of the
seven `crash*` strings in eleven languages**: they described a React error boundary, and a page
whose island fails to wire leaves its markup standing rather than going blank.

⚠️ **ONE THING THE ERROR BOUNDARY DID IS STILL NEEDED, and it had gone with it.** Chunk names carry
a content hash, so an update deletes the file an already-open tab is about to ask for. A navigation
always fetches markup naming the current build, so thirteen of the fourteen cases cannot happen any
more — but two things are still fetched on demand from a page that is already open, arrange mode
and the media picker, and one of them had no catch at all: a tab older than the server answered the
press by closing the menu and doing nothing, however often it was pressed, and left an unhandled
rejection where nobody was looking. Both say so now, in one sentence with a reload beside it, and
**neither reloads by itself** — the rail is on every admin page including the editor, and a reload
started there would be a reload of somebody's half-written post, begun because they pressed
"Arrange the menu". Details in [`admin-navigation.md`](./admin-navigation.md).

**What is left of React in this repo is nothing.** What is left of the wrapper around ProseMirror
is step 7.

### Step 7, first stage: the engine is named, and it was in the chunk three times

ADR 0054's last step is `@tiptap/*` out and `prosemirror-*` in — a change of which LAYER this
product depends on, not of what it does: the wrapper has a commercial tier and a company behind
it, and the engine underneath is MIT, one author, and older than this product.

The first stage is the cheapest half and it found the expensive thing. `prosemirror-model`,
`prosemirror-state`, `prosemirror-view` and `prosemirror-transform` are named in
`package.json` and on `check:deps`'s list with their reasons, and the twenty-three imports that
reached them through `@tiptap/pm/*` — which is literally `export * from "prosemirror-view"` —
now name them directly. Nothing about the editor changed.

⚠️ **AND NAMING THEM IS WHAT LET THE DUPLICATES BE SEEN.** Five packages had
`prosemirror-view@1.42.2` nested under them while the hoisted copy was 1.42.3, with ranges the
hoisted one satisfies — a lockfile that had drifted, and nothing in the tree that could say so.
Measured from the built artefact, not from `node_modules`:

| | before | after |
|---|---|---|
| copies of `prosemirror-view` in the editor chunk | **3** | **1** |
| the editor chunk, raw | 1,028 KB | **833 KB** |
| the editor chunk, gzipped | 325 KB | **264 KB** |
| the admin's JavaScript, all entries | 1,170 KB | **976 KB** |
| ready to type, three readings at 1440 | — | 108 / 108 / 115 ms |

Two `overrides` lines and a forced resolve. Ready-to-type does not move, and saying so is the
point: on localhost that number is not paying for parse.

**Two copies of ProseMirror is not merely weight.** Every `PluginKey` is identity-compared,
`instanceof` is how the view decides what a node is, and a second module record makes both
answer wrong — on a schema the two copies agree about, which is why it would surface as
behaviour nobody can reproduce rather than as an error. The repo had already met it as a TYPE
error and written a cast around it with a comment calling it a packaging fact: "when the
duplicate is deduped the cast becomes a no-op rather than a lie". It has been, so the cast is
gone rather than left standing.

**`check:bundle` counts the copies now**, from the artefact, using a string that appears exactly
once per copy of its package — and it fails when a probe stops matching at all, because a string
reworded upstream reads exactly like a clean bill. Both failure modes were proved by breaking
them on purpose. A `bun install` that re-nests a version now gets as far as the next build.

One more thing the sweep turned up: `node_modules/tiptap-markdown` was on disk and **not in
`bun.lock`**, left over from the day `MarkdownBridge.ts` replaced it. It was not shipping —
nothing imports it and a fresh clone never had it — but it was pinning a second
`prosemirror-markdown`. Removed.
