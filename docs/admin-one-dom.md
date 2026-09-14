# One DOM per state

The rule the server-rendered admin is built on, and the traps that come with it. Split out of
[`docs/admin-design.md`](./admin-design.md) on 2026-09-14, when the fourth trap arrived and the
visual contract reached its own length cap: this list grows with every screen ADR 0054 converts,
and squeezing it to fit was how the ones already here got shortened into advice nobody acts on.

Adopted 2026-09-14 with ADR 0054, which makes the admin server-rendered HTML with islands.

The server cannot read `localStorage`, so it cannot know whether the rail is collapsed, which
group is open, or which filter a list is under. It draws **every state at once** and an
attribute on `<html>` decides which is shown. Three things follow, and the third is the one
that surprises people:

1. **A toggle is an attribute, not a redraw.** Collapsing the rail sets one character and the
   browser does the rest from CSS it already has. Nothing is rebuilt, so nothing can be
   rebuilt wrongly — and the rail is correct in the first frame, before any script runs.
2. **A filter hides, it does not remove.** The log sends its two hundred rows once, with the
   facts a filter asks about written into each one, and the island sets `hidden`. That is what
   the React version already did in memory; what changed is that the server writes the row.
3. ⚠️ **A hidden thing is still a node.** A folded group still holds a link that says "Trash";
   a switched-off top row is still in the DOM. So anything that searches the page by WORDS, or
   counts `li`, must ask whether the element is VISIBLE — `el.offsetParent !== null`, which is
   null for anything `display:none` and is therefore the same condition that keeps it out of
   the tab order and the accessibility tree. **Six tour flows** have learned this the hard way:
   one found the rail's "Trash" link instead of the editor's button, another counted twelve
   destinations on a rail that shows four, a third clicked the comments queue's "Delete
   selected (0)" — in the markup, hidden until something is ticked — and reported that a
   comment had gone with no way back.

⚠️ **AN ATTRIBUTE THAT PICKS A STATE MUST NOT ALSO MATCH THE ELEMENT IT IS STAMPED ON.** The
dashboard's greeting draws all four parts of the day and the boot script stamps the root, and
the first cut used one name for both: `[data-daypart] { display: none }` matched `<html>`, and
the whole admin rendered as a blank page on every screen. Two names — one for the fact, one for
the candidates — cannot collide. The rail's `data-rail-collapsed` is safe only because nothing
inside it wears that attribute.

⚠️ **A CONVERTED SCREEN'S LINKS ARE REAL NAVIGATIONS**, and there is no fixing that while the
conversion is half done. `router.tsx` declines any `quire:navigate` FROM a server-drawn page,
because React renders no route on one and so has nothing to swap; widening the rail island's
bridge to every `/admin` anchor was tried on 2026-09-14 and reverted as a no-op. Two
consequences: a click costs a page load rather than 4ms until the last screen converts, and
leaving a dirty form now raises the BROWSER's generic warning rather than the product's
three-way question. The second is `useNavigationGuard` working as written — both halves exist
precisely because a real navigation can only ever get the generic one.

4. ⚠️ **A CSS RULE THAT COUNTS POSITION COUNTS HIDDEN NODES TOO.** `:last-child`,
   `:first-child` and `:nth-child` are structural: they see the document, not the screen. The
   analytics piece index sends all forty-one rows and shows ten, so `TROW`'s own
   `last:border-0` — which exists to leave the final row without a rule under it — landed on
   row forty-one, standing hidden, and the ten on screen ended with a hairline the React face
   never drew. The fix is an attribute the server writes and the island moves
   (`tr[data-piece][data-last]`), never `:has()`, which takes Safari down. This one is worse
   than trap 3 because nothing is wrong in the accessibility tree, nothing is wrong in the
   markup, and no flow that counts or clicks can see it: it is one hairline, and it was found
   by diffing the two builds' computed styles.

   **`space-y-*` IS ONE OF THESE, and it is the one that will be hit most.** Tailwind v4 writes
   it as `& > :not(:last-child) { margin-block-end }` — so in a stack that draws every state and
   hides all but one, whichever element is followed by a hidden sibling takes a margin it would
   not have had. The library's grid picked up 20px that way: it sits in a `space-y-5` with two
   hidden empty states after it, so it stopped being `:last-child`. The fix is a WRAPPER — put
   the mutually exclusive states in one box, and the stack has one child again whichever of them
   is showing. Found on 2026-09-14 by the same computed-style diff, which is so far the only
   thing that has ever found one of these.

5. ⚠️ **A STATE ATTRIBUTE READ THROUGH AN ANCESTOR MUST HAVE A NAME NOTHING ELSE WEARS.** The
   assistant's chat rows pick between a delete cross and a delete confirm with
   `[data-ai-chat]:not([data-ai-confirming]) [data-ai-confirm] { display: none }`, i.e. a rule
   that asks about an ancestor. The screen root also said `data-ai-chat` — it meant "the
   conversation this page has open", the row means "this row's id" — so every confirm in the
   column matched through the root as well, which never carries `data-ai-confirming`. The
   confirm could not open on any row, ever.

   Nothing catches this but a browser. The markup is right, the island sets the attribute it
   meant to set, the unit tests pass, and `check:admin-css` is satisfied because every class
   has a rule. It was found by measuring `getComputedStyle().display` on the confirm after a
   click; the fix is `data-ai-open` on the screen and a flow that asserts the screen never
   wears a row's name. **A descendant selector is a contract with every ancestor in the page,**
   so state attributes are named for the thing they are ON and are never reused one level up.
