# Delivery

What happens between a request arriving and bytes going out: the render cache, the switch
that turns it off, the CDN purge behind it, and compression.

Split out of [`performance.md`](performance.md), which is the resource-loading law — what a
BROWSER fetches and in what order. This is the other half: what the SERVER does before it
answers. The two are read at different times and neither needed the other's detail.

## Rendering — the body cache and the warm

**Measured 2026-07-29, on the live server against a copy of the real database.** The design
assumed a re-render cost a fraction of a millisecond, which is why `clearCache()` throws
away every page on any write (Invariant 1) without a second thought. It does not:

| | |
|---|---|
| Cold article render | **92–383 ms** across the archive |
| An 85,000-character post | **364 ms**, of which `renderPostContent` is **359 ms** |
| Inside that, `marked.parse` | **360 ms** — marked itself, not our renderer or our options: a plain `Marked` with no configuration measures 375 ms on the same input |

So the rendered body is cached in `render_cache` alongside the highlighter, keyed by the
**build commit + the media facts + the markdown**. Nothing invalidates it: a change is a
different key. See `docs/spec/01-schema.md` §4 for why the argument against it was wrong.

Measured after, same server, same post: **383 ms → 1 ms** with the page cache cold and the
body cache warm, and the full 74-page warm sweep **3,948 ms → 203 ms**.

**Three rules for this cache:**

- **The build commit is in the key.** A deploy that changes any transform in
  `post-content.ts` must not serve yesterday's HTML out of a cache that cannot tell. A
  hand-maintained version constant would have been free and would eventually be forgotten.
- **It is never load-bearing.** A read that throws returns null and the page renders the
  slow way. Tested with the table dropped.
- **`clearCache()` does not touch it.** It is content-addressed; a stale row is inert.

### The switch

Both layers can be turned off together in **Settings → System → Cache**
(`settings.cache.enabled`), for the hour you are changing the design and want to see what
you changed. Off means:

- `cached()` neither reads nor **writes** the page cache. Filling it while it is off would
  hand back an hour-old page the moment it was switched back on.
- Public HTML goes out `public, no-store` instead of `s-maxage=60`. `no-store`, not
  `no-cache`: Cloudflare treats `no-cache` as "keep it, revalidate" and keeps answering
  from the edge, so a switch that sent it would look broken from outside.
- The warmer returns immediately instead of rendering the archive into a cache nobody reads.

Nothing about Invariant 1 changes: when the cache is on, a write still empties all of it.
The switch decides whether there is a cache at all, not how it is invalidated. Pinned by
`src/web/app.test.ts` ("switched off in Settings").

### `/sw.js` and the edge

The service worker ([ADR 0039](decisions/0039-the-blog-reads-without-the-network.md)) is the
one script whose staleness a reader cannot fix by reloading — a browser keeps serving from
the worker it already has. It leaves the origin `no-cache`, and the build rides in
`?v=<hash>`, which is what protects it at the edge: Cloudflare's standard cache level keys on
the query string, so a deploy asks for a URL nothing has ever cached. **If a `sw.js` is ever
seen surviving a deploy, look at the cache key before looking at the worker.**

### The warm, and the CDN purge

`clearCache()` carries a hook list, and `src/index.ts` registers a debounced
warm-then-purge (`server/warm.ts`). Warm FIRST, purge second, so the edge refetches into a
warm origin. It runs on boot too, which is what makes a deploy clear the edge without
anyone remembering to.

**The hooks are registered from the entry point, never from inside `clearCache()`.** A test
suite flushes several hundred times and must get a plain `Map.clear()`; a CLI must not be
left holding a timer open.

`purgeEdge()` (`server/edge-cache.ts`) uses `cloudflareApiToken` + `cloudflareZoneId` from
`integration_keys`. Those keys have been in the schema and in the Admin UI since the import
and **nothing in 2.0 ever read them** — the port dropped the call and kept the panel.
Measured through the CDN before writing any code, because a gap has to be real first:
`cf-cache-status: HIT`, `Age: 165` against `s-maxage=60, stale-while-revalidate=600`.
Unconfigured is a no-op, which is the normal state of a self-hosted install.

**And any other CDN** ([ADR 0033](decisions/0033-purging-an-edge-that-is-not-cloudflare.md)):
`purgeWebhookUrl` is one URL the blog POSTs `{"purge":"everything","source":"quireink"}` to
on the same occasions. Both fire when both are set, because they are two edges in front of
one blog rather than two names for one edge. It is not a provider list on purpose — Bunny,
Fastly and a script in front of nginx differ in the URL and the header and agree on
answering a POST — and the URL is treated as a secret and never logged, because a purge
endpoint usually carries its own token.

It is the **only** purge path: the scheduled sweep, `/api/cron?purge=1` and the admin cache
button all call it. They used to call a second, ported implementation (`server/cdn.ts`)
that purged the same zone with no request timeout and logged Cloudflare's response body on
failure — a body that echoes what was sent. That file is deleted; two ways to do one thing
means the weaker one keeps being reached for.

## Compression

`Bun.serve` sends exactly what a handler returns and nothing set `content-encoding`, so the
stylesheet, every page and every feed left the origin raw. `web/compress.ts` gzips text
responses over 1 KB when the client asked, and sets `Vary: Accept-Encoding`.

Measured at the origin when it shipped, on the un-minified sheet: **61,241 → 19,513 bytes**;
the minifier above took it to **30,811 raw / 6,519 compressed** (2026-07-30), and ADR 0027 has since moved the pen's ink out of it again — `site.css` measured **7.6 KB gzipped** on 2026-08-21, but the ratio is
the point. On the hashed immutable assets a reader sees this DIRECTLY, because a CDN passes
the origin's encoding straight through on them (measured below); on HTML the CDN re-compresses,
so what this buys there is the origin-to-edge fetch, on every cache miss and on every purge
above. An install with no CDN in front of it sees all of it, everywhere. Binary bodies are left alone: an image
or a font is already compressed and gzipping it spends CPU to add bytes.

### The same bytes are only gzipped once

The middleware runs OUTSIDE the page cache, which stores HTML strings — so a cache hit still
paid a full gzip, and `/assets/site.<hash>.css`, which cannot change for the life of a build,
paid one on every single request. Requests per second on a warm local instance:

| | off | on, re-gzipping | on, memoised |
|---|---:|---:|---:|
| Front page | 5,510 | 3,325 | **4,445** |
| Article | 4,897 | 3,509 | **4,943** |
| `site.<hash>.css` | 11,216 | 3,652 | **8,139** |

Compressed bodies are kept in a map keyed by the CONTENT — the byte length and a `Bun.hash`
of the body — rather than by path. Same bytes in, same bytes out, so a write that empties the
page cache has nothing to invalidate here, which is what makes the map safe to keep at all.
Hashing costs 0.006 ms on a 31 KB page against 0.090 ms to gzip it.

### Brotli first, gzip behind it

This said **not Brotli** until 2026-09-01, on two grounds. Both were re-measured and neither
held.

The first was that brotli saves about 3%. True at quality 4, which is the worst rung on the
ladder. The whole sweep, on one article page against its own gzip:

| brotli q | bytes | ms | vs gzip-6 |
|---:|---:|---:|---:|
| 4 | 7,766 | 0.7 | −1.4% |
| **5** | **7,275** | **0.5** | **−7.7%** |
| 9 | 7,238 | 0.8 | −8.1% |
| **11** | **6,494** | **23.4** | **−17.6%** |

q5 is both better and faster than q4. And on the sheets, which are SVG data-URIs by the
hundred, a wide window changes the answer entirely:

| | gzip-6 | brotli-11 | zstd-19 |
|---|---:|---:|---:|
| `site.css` | 10,907 | **9,681** (−11%) | 10,300 |
| `pen-marks.css` | 11,838 | **5,928** (−50%) | 6,732 |
| `pen-lines.css` | 8,664 | **5,368** (−38%) | 6,236 |
| `core.js` | 4,153 | **3,556** (−14%) | 4,068 |
| `post.js` | 6,519 | **5,690** (−13%) | 6,371 |
| One article page | 7,879 | **6,494** (−18%) | 7,502 |
| **A cold visit** | **49,960** | **36,717 (−27%)** | 41,209 (−18%) |

The second ground was that the CDN re-compresses anyway. Half true, and the wrong half.
Measured against a live install behind Cloudflare: the HTML came back `content-encoding:
zstd`, so that hop is re-done — but `/assets/site.<hash>.css` came back `cf-cache-status:
HIT, content-encoding: gzip, content-length: 10907`, byte for byte the origin's own gzip,
passed straight through. **The hashed immutable assets keep whatever the origin gave them**,
and they are precisely what every first-time reader downloads. An install with no CDN in
front of it kept the worse encoding for everything.

**Quality is chosen per response, and `immutable` is the first half of the signal.** The asset
routes set their own `cache-control` inside the handler, while `cacheHeaders` fills in
everything else after the compression middleware has run — so a response that says immutable
really is one of the hashed artefacts, compressed once on its first request and served from
the map for the life of the process. That makes q11's 41–94 ms a one-off. A page is a new body
on every write, so it gets q5, which is the rung that pays for itself per distinct body.

**The second half is a 192 KB ceiling, and the tour is what found it.** `immutable` was the
whole test to begin with, which was right about the public sheets and wrong about what else
wears the label: the admin's own chunks are hashed and immutable too, and twenty times the
size. `main-<hash>.js` is 644 KB and takes **642 ms** at q11 against 11 ms at q5; `admin.css`
is 375 KB and takes 279 ms. Compression was synchronous then, so the first load of the admin
stalled the entire process for over a second — `check:all` was green through all of it, and
the tour's settings flow failed with *no search box*, which is what a stalled server looks
like from a browser. A reader asking for a page in that window waited exactly as long.

Two things came out of that. **The expensive rung moved off the event loop:** measured with a
10 ms interval running alongside, `brotliCompressSync` on that bundle let 1 tick through and
the async form let 59 through over the same 643 ms. The work costs the same either way; only
one of them bills everybody else for it.

Only q11 goes to the pool, though, and that is a memory decision. A libuv worker that has run
a brotli job keeps its allocator arena afterwards. Physical footprint of one warm instance
after the same 2,000 requests: **gzip only 119 MB, every brotli through the pool 179 MB, only
q11 through it 151 MB.** q5 costs 0.5 ms on an article page, which is worth neither a thread
nor 28 MB. The 32 MB that remains is what brotli costs this process, and it is the price of
the 22% off every cold visit.

And **q11 stopped applying above 192 KB**, which is a
judgement about who pays: q11 buys 12.5% over q5 on that bundle and 14.2% on the admin sheet,
and it spends most of a CPU second on a machine that may only have one, for an artefact one
person downloads once. 192 KB sits above every public asset (the largest is a pen sheet at
138,375 bytes raw) and below every admin chunk. It is a gap, not a knife-edge, and
`qualityFor` is exported so a test pins both ends of it.

The map holds the PROMISE rather than the bytes, which the asynchronous compressor made
necessary: two requests arriving for the same uncompressed body would otherwise each start
their own 600 ms of work.

**zstd is not offered.** On the same six responses it saves 18% against brotli's 27%, and
Safari does not send it at all.

`Accept-Encoding` is parsed rather than substring-matched, because `br;q=0` is how a client
says it would rather not and `includes('br')` reads that as yes.

### A returning reader is answered with nothing

Measured on a warm browser cache: every stylesheet, script and font came back from disk at
zero bytes, and the HTML was fetched again in full — **8,179 bytes per page view** — because
no response carried anything to revalidate against. A page's `cache-control` is
`s-maxage=60, stale-while-revalidate=600`, which is instruction for a shared cache with no
freshness for the browser, so the browser asks every time; without a validator every ask is a
whole page.

Every 200 now carries a strong `ETag`, and `If-None-Match` is answered **304**. It is derived
from the UNCOMPRESSED bytes and then labelled with the encoding, because a strong tag names
one representation: the gzip and the brotli of a page are different byte streams and must not
answer each other's conditional request.

**What makes it work is that pages are byte-stable, and that is not obvious.** The comment
form carries a signed spam challenge with a salt and a timestamp in it, minted when the page
is RENDERED rather than when it is served — so two fetches of one URL from one process are
identical (verified on the front page, a post, a post with galleries, and the feed). A write
re-renders, mints a new salt, and changes the tag, which is correct: the body did change.
There is a test pinning that stability; if it ever goes red the 304 has stopped firing.

A 404 gets no tag: `cacheHeaders` marks it `private, no-store`, so nothing keeps it and
nothing would ever revalidate it.

A **404 is compressed too**, which it was not: it is 19,650 bytes of rendered site shell and
it is deliberately not page-cached, so a crawler walking dead links paid for all of it every
time. A **206 is not**, and must never be: a range response describes a slice of the original,
and compressing the slice makes `content-range` a lie.
