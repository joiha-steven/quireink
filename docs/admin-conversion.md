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
