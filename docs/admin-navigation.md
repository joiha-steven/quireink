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
