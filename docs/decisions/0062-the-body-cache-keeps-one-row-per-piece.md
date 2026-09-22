# 0062 — The body cache keeps one row per piece

Date: 2026-09-22
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## The problem

Measured on the two production blogs, 2026-09-22, read-only against the live files:

| | manhhung.me | edcmeo.com |
|---|---|---|
| `quire.db` | 618,434,560 B | 577,773,568 B |
| `render_cache` | 20,001 rows, **501,981,656 B** of HTML | 24,367 rows, **487,550,599 B** |
| Everything else in the file — posts, revisions, FTS, settings, log | **about 8 MB** | comparable |
| Distinct pieces of content in that cache | **208 sizes, 5,585,093 B** | 385 sizes, 22,325,398 B |
| Pieces written | 93 posts | 71 posts |

So half a gigabyte holds about five megabytes of distinct HTML. One rendered body of 88,084
characters is in there **204 times**, byte for byte; the next one 204 times; a third 251
times. Two blogs are spending 1.2 GB of disk to hold something under 30 MB.

The sweep is not broken: the oldest row is exactly 30 days old, which is what
`RENDER_CACHE_MAX_AGE_MS` promises. The generations are the problem. `buildSha` is part of
the body key, so **every deploy makes every cached body unreachable and none of them go
away** — they age out 30 days later. At the measured rate of about seven deploys a day, that
is 200 dead generations resident at any moment.

It is not only disk. Every snapshot `VACUUM INTO`s the whole 618 MB, then deletes the cache
rows from the copy, then `VACUUM`s it again down to about 8 MB: 600 MB of writes to produce
an 8 MB database, hourly. That cost has already been paid once in public — on 2026-09-13 the
owner tried to download a backup and could not, because the archive had grown past what the
button could carry (`server/backup.ts`, `dropRenderCache`).

## Why the design could not clean up after itself

`render_cache` has one column that identifies anything, and it is a hash:

```sql
key text primary key   -- sha256(build sha || media facts || markdown)
```

Nothing in a row says which piece it belongs to. So when a new render is stored there is no
question "which row does this replace" to ask — **the old row is not addressable**. The only
collector that can exist against that shape is age.

That was a deliberate trade and it bought something real: no invalidation graph, no way to
serve yesterday's HTML, a cache that is never load-bearing, and `clearCache()` (Invariant 1)
never has to reason about it. What it did not buy, and what nobody wrote down, is that
**nothing ever supersedes anything**.

## The decision

The rendered body gets a table of its own, keyed by the piece rather than by the render:

```sql
create table body_cache (
  slot       text primary key,   -- 'post:<slug>', 'page:<slug>', 'note:<slug>', 'preview:<slug>'
  key        text not null,      -- the same hash as before, now a COLUMN
  html       text not null,
  created_at integer not null
) without rowid;
```

Read by `slot`, compare the stored `key` with the computed one, use the row when they match.
On a miss, render and `insert … on conflict(slot) do update`. **The hash still decides hit
from miss, on exactly the inputs it decided on before**, so the bytes a reader receives are
unchanged; what changes is that a piece owns one row and a new render takes that row.

The size of the table becomes the number of pieces. It does not grow with deploys, with
edits, or with time.

**Highlighting stays content-addressed in `render_cache`, unchanged.** A code block is shared
between pieces and has no slot to belong to, it is small, and age is the right collector for
it. That producer is untouched by this decision.

Slots are the piece's primary key, which is its slug. A preview renders under its own
`preview:` slot: it is the owner refreshing a draft, so it deserves a cache, and it must not
be able to take the row the published page is using.

## Consequences

- **A reader sees nothing.** Same bytes, same hit, same miss. The first read of each piece
  after this ships is a re-render — which is what every deploy already does, seven times a
  day, absorbed by the warmer (`server/warm.ts`) before a reader arrives.
- **Rolling back is safe without doing anything.** Old code reads `render_cache`, which still
  exists and is merely empty, and `readRendered` returns null on anything it cannot read.
  A rolled-back build serves correctly and uncached.
- **The migration empties `render_cache`.** Bodies and highlights are indistinguishable in
  there, so the bodies cannot be deleted selectively. The cache is self-healing; emptying it
  is what a deploy does anyway.
- **`quire.db` does not shrink by itself.** The freed pages go to the freelist and are reused;
  the file keeps its high-water mark until something vacuums it. `VACUUM INTO` skips free
  pages, so every snapshot is small immediately.
- **Renaming a slug orphans one row.** The age sweep collects it. That is the sweep's job now:
  a safety net for the rare leftover, not the only collector for the whole table.
- **Backups must empty both tables.** `dropRenderCache` becomes two statements, and the guard
  that counts tables in `restore-check.ts` sees one more.

## What would make us change our mind

**One input in the body key varying per reader.** A slot is correct because a piece has
exactly one valid rendering at a time: `bodyKey` today is build sha, image variants, image
dimensions, card facts and markdown — every one of them server-global or piece-global. Put a
theme, a locale, a device or a per-reader flag into that key and two renderings of one piece
become valid at once, the slot starts thrashing between them, and content-addressing is the
right shape again. Anyone adding an input to `bodyKey` has to ask which kind it is.
