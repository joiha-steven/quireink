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
the point. A reader does not see this directly, since the CDN re-compresses on its way out,
but the origin-to-edge fetch does, on every cache miss and on every purge above — and it is
what a reader gets if the CDN is bypassed or removed. Binary bodies are left alone: an image
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

**Not Brotli.** At quality 4: 7.0 → 6.8 KB on an article, 14.5 → 14.3 KB on the admin sheet,
for the same CPU or more; the qualities that do better cost several times as much, to save
bytes the CDN re-compresses anyway.

A **404 is compressed too**, which it was not: it is 19,650 bytes of rendered site shell and
it is deliberately not page-cached, so a crawler walking dead links paid for all of it every
time. A **206 is not**, and must never be: a range response describes a slice of the original,
and compressing the slice makes `content-range` a lie.
