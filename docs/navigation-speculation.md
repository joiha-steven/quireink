# Navigation — prefetch every link, prerender on hover, zero runtime JS

Split out of [`performance.md`](./performance.md) on 2026-09-14, when that file reached its
400-line cap and a new rule about inline script had to go in. The seam is real: everything here
is about the journey BETWEEN pages, and everything left there is about what one page loads.

Every public HTML response carries a `Speculation-Rules` header pointing at
`/speculation-rules.json` ([`src/web/speculation.ts`](../src/web/speculation.ts), set in
[`src/web/cache-headers.ts`](../src/web/cache-headers.ts)). Two rules, because the two
speculations do not cost the same thing:

| Rule | Eagerness | Trigger | Cost |
|---|---|---|---|
| `prefetch` | `eager` | every matching link on the page | ~20 KB gzipped of HTML, no render |
| `prerender` | `moderate` | pointer rests on a link ~200ms | a full document plus its JavaScript |

**Why prefetch was added on 2026-07-31.** `moderate` alone starts its work only after a
200ms hover dwell, which on a normal hover-and-click leaves no time at all: measured from a
Vietnamese home connection that day, TTFB through the CDN is **~145ms on an edge HIT and
~185ms on a miss** (against ~65ms straight to the origin, which is in Vietnam — the CDN
routes VN readers to the `HKG` PoP). The prerender was still in flight when the click landed,
so readers waited out the whole round trip and the feature looked broken. Prefetch pays that
round trip *before* the reader decides.

`prerender` stays on `moderate` for the reason it always was: at `eager` a reader who scrolls
past ten cards has paid for ten full renders. Hover earns that cost; being in the viewport
does not. The honest cost of `eager` prefetch is a listing pulling ~400 KB it may never use;
Chrome caps prefetch at fifty documents and drops them under Save-Data.

**Chromium only.** Safari and Firefox ignore Speculation Rules entirely and navigate cold.
There is no fallback and deliberately so: the only ones available are a JS pjax layer or a
service worker, and both cost more than the 80ms they would recover here. What helps those
browsers is shortening the round trip itself, not speculating over it.

**A header, not an inline `<script type="speculationrules">`.** The frozen tree used the
inline form. 2.0 ships no inline script on the public site, which is what lets the
recommended CSP omit `unsafe-inline` from `script-src`, and an inline speculationrules block
is governed by `script-src` like any other. The header keeps both.

> ⚠️ **AND NONE IN THE ADMIN EITHER, SINCE 2026-09-14.** Its boot script was inline until prod
> reported *"Executing inline script violates … 'script-src 'self''"* on three of the four
> public instances, where it had therefore never run. It is `/admin/assets/boot.<hash>.js` now,
> a classic script with no `defer`, measured at 500 KB/s as **321ms to the heading against
> 338ms inline** — no cost, it is fetched beside the stylesheet that blocks paint anyway. The
> rule is now **no inline script anywhere**; the account is in `web/admin/spa.ts`.

Excluded from BOTH rules: `/admin/*`, `/api/*`, `/uploads/*`, `/preview/*`, `/og*`, `/search*`, plus
`[rel~=nofollow]` and `[download]` links. A prefetch of `/preview` burns a token exactly as a
prerender does. The header itself is only set on a public HTML 200, so the owner's surfaces
never offer it at all.

> Shipped 2026-07-29; `whenActivated` predates it.

> **RULE: a prerendered page runs its JavaScript at speculation time.** Any island that
> writes, measures time, or beacons **on mount** must be wrapped in `whenActivated()`
> (`src/assets/js/activation.ts`), which defers it to the `prerenderingchange` event. A
> discarded prerender never activates, so the work never happens.
>
> The tracking beacon and the dwell timer are already wrapped: without it, one hover would
> record a pageview for a page nobody opened, and the dwell timer would count the
> speculation wait as reading time. Analytics rows are kept forever, so this class of bug
> is not self-correcting. Adding a new on-mount side effect? Wrap it.
