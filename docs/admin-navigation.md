# Getting from one screen to the next

What the admin does BETWEEN screens: what a click costs, what says it is happening, and what
happens when a file the page needs is not there any more. Everything here is about time, not
appearance ([`admin-design.md`](./admin-design.md) has the look). Read this one before touching
[`src/admin/island/rail.ts`](../src/admin/island/rail.ts) or
[`src/web/admin/rail.ts`](../src/web/admin/rail.ts).

## The cost of a click

⚠️ **There is no router here any more.** Every admin address is a page the server draws, so a
click on a rail row is a browser navigation: the old document goes, a new one arrives, and the
island the new page needs is named in its own markup. ADR 0054's step 6 finished that, and this
section used to describe the opposite arrangement in detail. What it found is kept below,
because the numbers are the reason the arrangement changed.

**What a navigation costs now**, measured in headless Chromium against a throwaway instance
seeded to the size of the real blog (70 posts, 40,000 analytics events), two builds on one
database:

| | React, routed | pages |
|---|---|---|
| the write list | 79 ms | **85 ms** |
| opening a post, first time | 346 ms | **107 ms** |
| opening the next post | **12 ms** | 373 ms → 107 ms |
| JavaScript before the first frame | 297 KB | **22 KB** |

The warm click is what a page load costs and it is not coming back: the write column was
mounted outside the router precisely so it would survive a route change, and nothing survives a
navigation. The first open is more than three times faster, which is the trade this ADR was
made for.

**The signal that a click did something is the browser's own.** There was a top progress bar
(`ui/TopProgress.tsx`, and about forty lines of CSS that outlived it by one commit), and it
existed because of a number that no longer exists: **the first click on any admin route cost
330-390ms, of which ~300ms was the CPU sitting idle.** Every page was a `lazy()` import, a
first visit suspended, and outside a transition React answers a suspension with the Suspense
fallback and then throttles putting real content back by a fixed 300ms. A click that does
nothing visible for a third of a second has to be covered by something. A navigation is not
silent in the same way — the browser spins its own tab — so the bar went with the router.

Two findings from that bar are worth keeping, because both are about drawing rather than about
React: **a CSS animation replayed from the left when a finished element was un-finished**, which
is one element drawn twice and is invisible to anything that counts elements; and **a bar whose
only transform lived in its keyframes sat off screen for anyone on reduced motion**, because the
foot of the sheet sets `animation: none` for both motion gates.

⚠️ **A TAB OLDER THAN THE SERVER, and what is left of that problem.** Chunk filenames carry a
content hash, so an update DELETES the file an already-open admin is about to ask for. Under the
router that was fourteen lazy routes: every screen the owner had visited kept working and the
next one they touched failed to load, which is why `ui/stale-build.ts` existed and reloaded the
tab once, guarded by a mark in `sessionStorage`.

A navigation always fetches markup naming the current build, so thirteen of those fourteen cases
cannot happen any more. **Two are left**, and both are fetched on demand from a page that is
already open: arrange mode, and the media picker.

- **Both say so, and neither reloads by itself.** `isChunkGone` in
  [`island/lib/chunk-gone.ts`](../src/admin/island/lib/chunk-gone.ts) matches each browser's own wording verbatim —
  Chrome, Firefox and Safari word it differently and there is no shared type to match on — and a
  failure toast has no timer, so the sentence waits as long as it takes to be read. The reload is
  the toast's action, not something this code does: the rail is on every admin page INCLUDING the
  editor, and a reload started here would be a reload of somebody's half-written post, begun
  because they pressed "Arrange the menu".
- **Anything that is not the missing file is rethrown.** A pattern broad enough to cover all
  three browsers would also swallow ordinary network failures, and those mean something else.
- The picker answers `null` as well as speaking, because a screen waiting on a callback that
  never comes is worse than a picker that closed.

## How wide the rail is, and who decides

Two questions, answered a day apart, and it helps to keep them apart.

**Whether a rail is on screen at all** was settled on 2026-08-28 by measuring content width on
the Settings screen. Below 1024px it is not: a 768px tablet was left 560px for the form, and a
folded-open phone at 673px had more room than the tablet did. The admin is forms and tables,
so content width is the product. Under `lg` the destinations live in a drawer behind the
hamburger.

**How wide it should be** was asked on 2026-08-29, and between 1024 and 1279 the answer
differs from the answer above it. There the rail arrives already shut: 72px of icons instead
of 208px of words hands the form back 136px, on exactly the screens that sit in that band, an
iPad in landscape and a foldable opened and turned. From 1280 up, the owner's own choice
applies again.

⚠️ The band **forces** the rail shut and never **saves** that. A width is not a preference:
the value in `localStorage` is the owner saying what they want, and a window that happens to
be 1100px wide is not them saying anything. Leaving the band restores their choice untouched.
Clicking the control inside the band does persist, because that is them changing their mind.

⚠️ **THE BAND IS ASKED IN TWO PLACES, and that is what ADR 0054 changed here.** The width has
to be right in the FIRST frame or the rail is drawn open and snaps shut while being looked at,
and a page cannot wait for its island to load to know how wide its own left edge is. So the
boot script the server puts in the head reads the band, and the island reads it again for every
resize afterwards. [`narrow-rail.test.ts`](../src/admin/components/narrow-rail.test.ts) holds
both copies to the same rule, because a rule enforced in one of two copies is the copy nobody
reads — and it pins the media query itself against the `lg` the rail is drawn at, so a band that
starts one pixel off cannot slip in.

## ⌘⇧K: the answer to "which tab is it on"

**No grouping makes a person remember which of seven boxes holds one of a hundred things;
what makes the grouping stop mattering is being able to type a word.** `settings-index.ts` is
that word for Settings, and the command palette is the same index reached from anywhere,
with the screens, the two actions and the writing beside it — so "make the text bigger",
"go to the trash" and "write something" are one gesture.

- **It REPLACES nothing.** The rail, the seven tabs and the settings search all stay. A palette
  that removes the menus it shortcuts has to be discovered before the admin can be used at all,
  which makes it a lock rather than a door. This one is for hands that already know it is there.
- **It navigates; it does not set.** Landing on the tab is honest about what the index knows —
  a label, and where it lives. Changing a value BY NAME is
  [`content/settings-path.ts`](../src/content/settings-path.ts), whose doors are MCP and the
  assistant, where the value can be read back afterwards and reported.
- **The hint on the right is the TAB and only the tab.** A note is a whole sentence, and putting
  one in a `shrink-0` right-hand column took the entire row and squeezed the label it was
  explaining down to nothing. The note is still SEARCHED — people describe a setting rather than
  name it — it is just not printed.
- **It is drawn by the server on every admin page and lives outside the canvas**
  ([`web/admin/overlays.ts`](../src/web/admin/overlays.ts)), because it is how you leave a screen
  that has gone wrong — and a screen that has gone wrong is now one whose island did not wire,
  which leaves the palette's own markup standing and reachable.
- **The rail carries a search control, and printing the chord on it is the point.** ⌘⇧K cannot
  be discovered; a palette you must already know about is a lock rather than a door. Clicking
  it opens the palette, and the control prints `printChord(PALETTE_CHORD, mac)` beside itself,
  which is how a mouse teaches a keyboard: use it once, read what it says, and the second time
  your hands do it without the mouse.
  It sits on the WORDMARK ROW, beside the collapse control — chrome next to chrome. It was a
  full-width row above the rule first, which worked and spent a line of the rail on a thing
  that is not a destination, next to the rows that are. Up there the rail is a list of places
  again. Collapsed, and on a phone, the glyph is the whole control and the chord moves into the
  tooltip — there is no ⌘ to print on a phone.
  ⚠️ The rule and the spacing of a control belong to a WRAPPER. On the button itself, `pb-2`
  sat inside its own `h-8` box: the hover ground kept the full height while the label was
  pushed up out of the middle of it, so the one row with a border was the one row whose hover
  looked broken. A control's hover ground must be the control.
  The chord is one row in `admin-shared/keys.ts` like the rest, so the button, the Help sheet and the
  handler cannot drift apart. `tour-flows-pane.ts` presses the BUTTON and checks the palette
  opens: a control that prints a shortcut it does not perform teaches something false.

## The write column, and what a page load has to give back

The list beside the paper appears on four addresses — `/admin/content` and the three editors —
and it is ONE function, [`screens/content-pane.ts`](../src/web/admin/screens/content-pane.ts),
drawn by the server on each of them. Written twice it would drift, and two copies of the same
list is precisely what ADR 0054's markup rules exist to prevent.

⚠️ **A ROW CLICK IS A REAL NAVIGATION, so the column is destroyed and redrawn on every one.**
Under React it was mounted outside the router for exactly the opposite reason: a click inside
it used to destroy it — the route changed, the page component was swapped, the error boundary
was keyed by path, and the whole subtree went with it. The list came back looking identical and
scrolled back to the top, on the one screen whose entire job is picking something out of a list,
and it read as a page reload. Mounting it in the shell fixed that, and a page load undoes the
fix: the warm click went from 12 ms to a navigation, and nothing brings it back.

**What it gives back, and how.** The scroll position, the search text and the three filters are
in `sessionStorage` ([`island/content.ts`](../src/admin/island/content.ts)) — per tab, cleared
with the tab, never told to the server. They are put back AFTER the filters are applied, because
the scroll height depends on how many rows show. The open row needs nothing put back: the server
knows which address it drew and stamps `aria-current="page"` on it.

⚠️ **TWO MECHANISMS DECIDING ONE `display` IS ONE TOO MANY.** The first cut left kind, status and
"what is missing" to CSS rules against attributes on the column and kept only the search in the
island. It DREW correctly and could not COUNT — `shown` was the number of rows that passed the
search, so a filter hiding all forty-six still reported forty-six and the "nothing matches your
filter" line never appeared. One mechanism now: `hidden`, written by the island, and by the
server for the one filter that arrives in the address
([`admin-one-dom.md`](./admin-one-dom.md)).

- **The taxonomy and series drawers belong to the column**, not to a screen. They manage the
  categories and series of the list standing right there, and they drive the most far-reaching
  pair of writes in the admin: renaming a category rewrites the front matter of every post
  carrying it and merges on collision. Both had no unit test and no flow until step 5.
- `tour-flows-pane.ts` presses the palette's own control and checks the palette opens: a control
  that prints a shortcut it does not perform teaches something false.
