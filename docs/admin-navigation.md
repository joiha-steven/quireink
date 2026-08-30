# Getting from one screen to the next

What the admin does BETWEEN screens: how a route change is committed, what says it is
happening, and what happens when the file a screen needs is not there any more. Split out of
[`admin-design.md`](./admin-design.md) on 2026-08-28, when the stale-build recovery put that
file over its 400-line cap.

The seam is the same one that produced [`admin-editor.md`](./admin-editor.md): the file next
door is a VISUAL contract, and every rule here is about time rather than appearance. A
transition, a 300ms throttle, a preload that starts before React runs, a tab that is older
than the server it is talking to — none of those are decisions about how a screen looks, and
reading them among the radius scale and the colour rule is what made both files harder to
use. Read this one before touching `router.tsx`, `App.tsx`, `ui/TopProgress.tsx` or
`ui/stale-build.ts`.

## The cost of a first click

Measured in headless Chromium against a throwaway instance seeded to the size of the real
blog (70 posts, 40,000 analytics events).

**The first click on any admin route cost 330-390ms; the same route clicked again cost
23-35ms.** The difference was not data and not work: the CPU was idle for ~300ms of it and
the page's own fetch had not started. Every page is a `lazy()` import, so a first visit
suspends; outside a transition React answers a suspension with the Suspense fallback and then
throttles putting real content back by a fixed 300ms.

- **Route changes run inside `startTransition`** (`router.tsx`). The current page stays on
  screen until the new one is ready, so no fallback is shown and there is no reveal to
  throttle. The Suspense boundary in `App.tsx` is reached on the FIRST paint only.
- **Scrolling to the top belongs after the commit.** During a transition the old page is
  still the one being looked at.
- **A navigation must show it is happening.** `ui/TopProgress.tsx` is the only signal a click
  did anything. It covers the router's `pending` and every in-flight `useView`, through the
  counter in `pending.ts`.
- **One navigation, ONE sweep — and the cold load is the case that broke it.** The bar is a
  CSS animation, and `[data-done] { animation: none }` means UN-marking a finished bar runs
  the keyframes again from the left edge: the same element, drawn twice, which is why
  counting elements found nothing while the owner kept seeing it. A cold load is two requests
  that cannot overlap (the shell answers with the site's language, and only the commit after
  that mounts a page which asks for its own data); measured at 6x CPU with 150ms latency, the
  gap was 179–206ms on four screens, against a 120ms tolerance. An in-app navigation has no
  such gap, because the transition holds `pending` true across it — hence "sometimes".
  `BOOT_SEAM_MS` (400) is spent on the first run only, and `progress-seam.test.ts` pins the
  floor against a future tidy-up back to one constant.
- ⚠️ **`/admin/media` reports nothing to the counter** and shows its own "Loading…" line
  inside the sheet instead: both libraries fetch their own rows and predate the bar. It is
  the one screen where a click draws no bar at all.
- **The bar never claims a percentage.** Nothing here knows how far along a fetch is. It
  eases toward an edge it never reaches, then snaps closed, and honours `data-motion`.
- **The entry preloads the current route's chunk** before React runs (`main.tsx`).
- **A tab older than the server heals itself.** Chunk filenames carry a content hash, so an
  update DELETES the file an already-open admin is about to ask for: every screen the owner
  had visited keeps working and the next one they touch fails to load. `ui/stale-build.ts`
  catches that one error and reloads, once, guarded by a mark in `sessionStorage` — without
  the mark a genuinely missing file would spin the tab forever, so a browser that cannot
  write one does not get the reload. Only the routed `lazy()` pages are wrapped; the hover
  preload is not, because a tab that reloaded under a passing pointer would be worse than
  the bug. Reported on the demo 2026-08-28, and proved by deploying under a live tab.

After: Content 355 → 49ms, Media 336 → 59ms, Comments 348 → 43ms, Settings 346 → 45ms,
Analytics 418 → 83ms. Cold load of `/admin` 501 → 329ms.

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

The seam worth guarding is that both the restore and the band set the same piece of state. If
they ever live in two effects, the deferred microtask in the restore path makes which one wins
a coin flip. They are folded into one effect, and `narrow-rail.test.ts` counts the assignments
so a split shows up as a failure rather than as an intermittent bug.

## ⌘K — the answer to "which tab is it on"

[ADR 0011](./decisions/0011-settings-regrouped-into-seven.md) split five tangled settings tabs
into seven defined ones. Two weeks later the tabs were still reported as confusing, with no way
to tell which one held a given setting, and `settings-index.ts` was written that day with the
conclusion in its header: **no grouping makes a person remember which of eight boxes holds one
of a hundred things, and what makes the grouping stop mattering is being able to type a word.**

That index drove exactly one search box on one screen for two weeks. `CommandPalette.tsx` is
the same index reached from anywhere, with the screens, the two actions and the writing beside
it — so "make the text bigger", "go to the trash" and "write something" are one gesture.

- **It REPLACES nothing.** The rail, the eight tabs and the settings search all stay. A palette
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
- It lives outside the canvas and outside the error boundary, because it is how you leave a
  screen that has gone wrong.
- **The rail carries a search control, and printing the chord on it is the point.** ⌘K cannot be
  discovered; a palette you must already know about is a lock rather than a door. Clicking it
  opens the palette and shows `⌘K` beside itself, which is how a mouse teaches a keyboard: use
  it once, read what it says, and the second time your hands do it without the mouse.
  It sits on the WORDMARK ROW, beside the collapse control — chrome next to chrome. It was a
  full-width row above the rule first, which worked and spent a line of the rail on a thing
  that is not a destination, next to nine that are. Up there the rail is a list of places
  again. Collapsed, and on a phone, the glyph is the whole control and the chord moves into the
  tooltip — there is no ⌘ to print on a phone.
  ⚠️ The rule and the spacing of a control belong to a WRAPPER. On the button itself, `pb-2`
  sat inside its own `h-8` box: the hover ground kept the full height while the label was
  pushed up out of the middle of it, so the one row with a border was the one row whose hover
  looked broken. A control's hover ground must be the control.
  The chord is one row in `editorKeys.ts` like the rest, so the button, the Help sheet and the
  handler cannot drift apart. `tour-flows-pane.ts` presses the BUTTON and checks the palette
  opens: a control that prints a shortcut it does not perform teaches something false.

## The write pane belongs to the SHELL, not to the pages

The list beside the paper appears on three routes — `/admin/content` and the two editors — and
was rendered by each of them. That made a click inside it destroy it: the route changes, the
page component is swapped, `ErrorBoundary` is keyed by path, and the whole subtree goes with
it. The list came back looking identical and scrolled back to the top, on the one screen whose
entire job is picking something out of a list. It read as a page reload.

`WriteLayout` in `App.tsx` draws it once for the whole writing session, outside the route and
outside the error boundary — outside the boundary because the pane is how you LEAVE a page
that has thrown.

- **`activeSlug` comes from the PATH**, not from a payload, so the open row moves the instant
  the click lands rather than after a round trip.
- **The taxonomy and series drawers moved into `WritePane`.** They hung off the Write screen and
  were handed down as a `tools` prop, which was the last thing tying the pane to a page. They
  manage the categories and series of the list standing right there.
- **`useView` seeds from the last answer it got**, keyed by the refresh epoch so
  `router.refresh()` still costs a real fetch. Without it every remount started at `null` and
  every page shell rendered a centred ellipsis first.
- **A changed view key drops the old data** in the same render. `data` used to survive a query
  change, so clicking post B rendered post A's editor until the fetch landed — and anything
  typed in that window went into A's document and was discarded on the remount.
- `tour-flows-pane.ts` asserts the pane's IDENTITY across the click, not its presence: a
  replacement that looks the same is exactly the bug.
