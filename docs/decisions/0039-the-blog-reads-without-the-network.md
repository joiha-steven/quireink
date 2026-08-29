# 0039 — The blog reads without the network

Date: 2026-08-30
Status: accepted

## Context

Every reading surface this product has was measured on 2026-08-27 and found close to full:
the screen (progress, contents with scrollspy, book mode, lightbox, hanging punctuation),
paper (`print.css.ts`, 2026-08-24), the way onward and the way back (`readNext`, `resume`).
One was untouched, and `docs/seo-pwa.md` said so in as many words: **no service worker,
offline is out of scope by design**. The manifest makes the site installable, so a reader
could put it on a home screen and get a blank page the moment the train went into a tunnel.

That gap is peculiar to what this product claims. A forty-minute essay is not one sitting,
and the reader who most wants it — the one who opened it on a phone, on a commute — is the
reader most likely to lose the network mid-paragraph. `resume` already assumes the reading
happens over days; nothing made the words survive the gap.

There is one decision nearby that must NOT be read as covering this. `docs/performance.md`
rejects a service worker as a **prefetch** mechanism for Safari and Firefox — "both cost
more than the 80ms they would recover here". That is a judgement about speculation, and it
still holds: nothing here prefetches anything.

## Decision

**A service worker, off by default, that caches what a reader has already read.**

- **`features.offline`, default OFF.** A service worker is installed on the reader's device
  and outlives the page that registered it; putting one on every existing blog's readers
  because the software updated is not the owner's decision being respected, it is it being
  assumed. On is one switch in Settings → Reading.
- **It never prefetches.** Nothing is fetched that the reader did not ask for. A page enters
  the cache because it was read, not because it might be. This site DOES prefetch every safe
  link at `eager` through Speculation Rules, and those requests were measured not to reach
  the worker (2026-08-30: a top-level listing with 133 links, worker in control, zero cache
  entries after six seconds). If that ever changes, a listing would fill the cache with pages
  nobody opened, and the handler needs a `sec-purpose: prefetch` guard.
- **HTML is network-first.** Online, the reader always gets what the server just rendered —
  which is the failure this could most easily cause and the one it is designed out of. The
  cached copy answers only when the network does not.
- **Hashed assets are cache-first**, because `/assets/<hash>.js` is immutable by
  construction: a deploy changes the URL, so a stale answer is not reachable.
- **`/admin`, `/api`, `/preview` and every non-GET are never touched.** Nothing the owner
  does passes through the worker, and nothing private can be left on a shared device.
- **Turning it off uninstalls it.** The island unregisters any worker and drops its caches
  when the flag is off, so the switch means something to readers who already visited. A
  feature that cannot be withdrawn from the devices it reached is not a feature with a
  switch; it is a one-way door.

## Cost

- **A cache on the reader's device**, bounded by count rather than promised in bytes.
- **The stale-content class of bug becomes possible.** Network-first HTML and immutable
  asset URLs are what keep it theoretical; both are load-bearing and neither may be
  "optimised" into cache-first without a new decision here.
- **A permanent piece of surface area.** A service worker is the one thing this product
  ships that keeps running after the tab closes, and a bad one is remembered by the reader's
  browser and not by ours. It is small, it is one file, and it is toured.

This supersedes the "offline is out of scope by design" line in `docs/seo-pwa.md`, and only
that line. The manifest, the icons and the speculation-rules header are unchanged.
