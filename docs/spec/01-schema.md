# SQLite schema and the Postgres mapping

Source of truth for the current shape: [`src/store/schema.sql`](../../src/store/schema.sql).
The Postgres original (612 lines) is in git history at tag `v1-final`,
`v1/scripts/schema.sql`. This document records every decision needed to express it in
SQLite, and why.

## Global conventions

### Timestamps: INTEGER milliseconds since epoch, UTC

Postgres `timestamptz` has no SQLite equivalent. Options were ISO-8601 TEXT or
INTEGER epoch. Chosen: **INTEGER milliseconds**.

- Unambiguous. No parsing, no format drift, no accidental local-time storage.
- Cheap to compare and index, which matters for `analytics_events`.
- All timezone logic already has to move into application code (see "The five RPCs"
  below), so keeping ISO strings for the sake of SQLite's date functions buys nothing.

Cost: hand-inspecting the DB is less pleasant. Mitigated by a `quire db` CLI
subcommand that renders timestamps for humans.

NULL stays NULL for optional timestamps (`deleted_at`, `confirmed_at`, `opened_at`).

### Booleans: INTEGER 0/1

`media.variants`, `redirects.permanent`, `newsletter_sends.ok`,
`integration_keys.smtp_secure`. CHECK constraints pin them to (0,1).

### Identity columns: INTEGER PRIMARY KEY AUTOINCREMENT

`AUTOINCREMENT` (not the bare `INTEGER PRIMARY KEY`) is required for `comments`.

Rationale: `comments.parent_id` is a deliberate FK-less self-reference so purging a
comment never cascades into live replies. Plain rowid assignment **reuses** the
highest freed id. Without `AUTOINCREMENT`, purging comment 42 and then creating a new
comment could reissue id 42, and the orphaned replies pointing at 42 would silently
re-parent onto an unrelated comment. That is a real data-corruption path, not a
theoretical one.

Applied to every identity table for consistency.

### Row-level security: removed

Postgres RLS exists here purely to make the anon key useless, an artifact of the
Supabase origin. SQLite is in-process; there is no second client and no network
listener. Nothing replaces it.

### Confirmed against the runtime, 2026-07-27

Checked on `bun:sqlite` (Bun 1.3.14, SQLite 3.53.0) before any code was written:

| Assumption | Result |
|---|---|
| FTS5 `remove_diacritics 2` folds Vietnamese | ✅ `"lap trinh"` matches `Lập trình` |
| `Bun.password` is argon2id | ✅ hash + verify round-trip |
| `generate_series` is available | ❌ **not compiled in.** Do not reach for it |

The missing `generate_series` costs nothing, because the design already avoids it: bucket
boundaries are computed in TypeScript and inserted into a temp table (see "The six SQL
functions" below). It is recorded here so nobody tries the shorter path and discovers this
halfway through the analytics port.

### PRAGMAs (set on every connection)

```
journal_mode = WAL          readers never block the writer
synchronous  = NORMAL       safe under WAL; FULL only for the content DB if desired
busy_timeout = 5000
foreign_keys = ON
cache_size   = -64000       64 MB page cache
temp_store   = MEMORY
```

### Two database files

| File | Contents | Backup |
|---|---|---|
| `quire.db` | Everything except analytics | `VACUUM INTO` snapshot, in all three copies ([backups.md](../backups.md)) |
| `analytics.db` | `analytics_events`, `analytics_scroll` | same snapshot, same schedule; loss is tolerable |

Reasons for the split:

- Write patterns differ by orders of magnitude. Pageview writes must not queue behind
  a post save, and a post save must never wait on an analytics flush.
- Backup value differs. Losing a day of analytics is an annoyance; losing a day of
  posts is a disaster. Different `synchronous` settings are then defensible.
- `analytics.db` grows without bound by design ("kept FOREVER"). Keeping it out of the
  content file keeps the precious file small and its backups fast.

They are joined where needed with `ATTACH DATABASE`, which SQLite supports in a single
connection with cross-database queries. Only `analytics_totals` (the "Views" column on
the content tables) needs it.

### Connection strategy

One `Database` handle per file, opened at boot. `bun:sqlite` is **synchronous** and the
runtime is single-threaded, so there is exactly one writer by construction: a statement
cannot interleave with another request, and no `SQLITE_BUSY` queue, connection pool or
mutex is needed. This is a genuine simplification over the Go design, which had to build
all three.

The consequence to respect: a slow query blocks every request. Every statement on the
request path must be indexed, and anything unbounded (the analytics dashboard, a backup
export) runs against `analytics.db` or off the request path.

Analytics writes never hit the database from a handler. They append to an in-memory array
flushed by a `setInterval` every 2 seconds or at 200 rows, whichever comes first, in one
transaction. Flush on `SIGTERM` before exit so a deploy does not drop the buffer.

## Table-by-table

Unchanged tables (straight translation, only the type mapping above applies):
`pages`, `post_revisions`, `media`, `files`, `settings`, `mcp_tokens`, `mcp_clients`,
`mcp_used_codes`, `backup_state`, `integration_keys`, `subscribers`,
`newsletter_sends`, `activity_log`, `redirects`, `analytics_scroll`,
`schema_migrations`.

`comments` is unchanged apart from `AUTOINCREMENT` (above) and `smallint` becoming
`INTEGER`.

Three areas need real design work.

---

## 1. `posts.categories` and `posts.tags` (`text[]` + GIN)

SQLite has no array type. Two candidates were considered.

**JSON column + `json_each()`**: keeps a single row per post, but every taxonomy query
(`/category/{slug}`, `/tag/{slug}`, and their paginated variants) degenerates into a
full scan with a correlated `json_each`, and `getCategories` / `getTags` cannot use an
index at all.

**Junction table** (chosen):

```sql
create table post_terms (
  post_slug text not null references posts(slug) on delete cascade,
  kind      text not null check (kind in ('category','tag')),
  term      text not null,
  primary key (post_slug, kind, term)
) without rowid;

create index post_terms_lookup on post_terms (kind, term, post_slug);
```

Consequences:

- `/category/{slug}` becomes an index seek instead of a scan.
- `getCategories` / `getTags` become one `GROUP BY` with counts, which the app
  currently does in memory.
- `updateTerm` (rename across every post, merging on collision; remove across every
  post) becomes one `UPDATE` or one `DELETE` instead of a read-modify-write over the
  whole post index. This is a meaningful simplification of the hardest taxonomy code
  in `lib/posts.ts`.
- Saving a post costs two extra statements (`DELETE` then batch `INSERT`) inside the
  existing transaction.

`WITHOUT ROWID` is correct here: the table is all key, no payload.

The importer flattens the Postgres arrays into this table. Order within a post is not
preserved because it is not preserved today either (the current UI sorts terms).

---

## 2. `posts.search` (`tsvector generated always` + GIN)

Replaced by an FTS5 external-content table:

```sql
create virtual table posts_fts using fts5(
  title,
  content,
  content = 'posts',
  content_rowid = 'rowid',
  tokenize = "unicode61 remove_diacritics 2"
);
```

Kept in sync by three triggers on `posts` (insert, update of title/content, delete),
which is the standard external-content pattern and avoids storing the body twice.

### Deliberate behaviour change

Postgres uses `to_tsvector('simple', ...)`. `simple` means no stemming and, crucially,
**accent sensitive**. The `/search` route compensates with an accent-insensitive layer
in application code.

FTS5 with `remove_diacritics 2` folds diacritics in the index itself, so `lap trinh`
matches `lập trình` natively and the application layer disappears. Vietnamese is
space-separated at the syllable level, so `unicode61` tokenizes it correctly without a
segmenter.

Additional gains, free: `bm25()` ranking (today there is no ranking), and `snippet()`
/ `highlight()` for result excerpts (today the excerpt is derived by hand).

This is parity exception #2 in 00-rationale.md. Search results will be **better** but not
identical, so the golden harness must exclude `/search` from strict comparison and use
a hand-written expectation set instead.

### Query shape

```sql
select p.slug, bm25(posts_fts) as rank
from posts_fts
join posts p on p.rowid = posts_fts.rowid
where posts_fts match ?
  and p.status = 'published' and p.deleted_at is null
order by rank
limit ?;
```

User input must be escaped before it reaches `MATCH`; FTS5 query syntax treats `"`,
`*`, `:`, `^`, `-`, `AND`/`OR`/`NOT` as operators. Wrap each user token in double
quotes and double any internal quote. A test fixture set of hostile queries goes in
`src/content/search.test.ts`.

---

## 3. The six SQL functions

The Postgres schema and its analytics migrations defined six plpgsql functions (Postgres
only: 2.0 keeps this logic in TypeScript, never in SQL):
`analytics_summary`, `analytics_page`, `analytics_totals`, `analytics_channel`,
`analytics_facet`, `restore_tables`. All six move into `src/analytics` and
`src/store`. The first three carry the weight; the next two are helpers of them.

### `analytics_channel(host)` -> `analytics/channel.ts`

A pure function over three regexes (search engines, social networks, else referral,
with empty host meaning direct). Trivially portable, trivially testable. The existing
regex literals are copied verbatim so classification does not shift.

### `analytics_facet` -> a generic helper

`select coalesce(nullif(col,''),'Unknown'), count(distinct visitor) ... group by 1
order by 2 desc limit ?` over one of `device`, `browser`, `os`. The column name comes
from a fixed lookup table, never interpolated from input. This is the **one** place in
the codebase allowed to assemble SQL from a variable, and the allowlist is the reason.

### `analytics_summary` / `analytics_page`

The hard part is not the aggregation, it is this expression:

```sql
date_trunc(bucket, created_at at time zone tz)
```

SQLite cannot do timezone-aware truncation, and a fixed offset is wrong in general
because zones observe DST. (Asia/Ho_Chi_Minh does not, but the setting is
user-facing and must be correct for zones that do.)

**Approach: compute bucket boundaries in TypeScript, then aggregate in SQL.**

```
1. Resolve the IANA zone with Intl.DateTimeFormat(..., {timeZone: tz}) and
   formatToParts, which yields the correct local calendar fields for an instant
   including DST. No dependency, and it is a stable web standard.
2. Walk from `since` to now in the requested bucket (hour/day/week/month),
   producing [lo, hi) pairs in epoch millis. Never compute a bucket by adding a
   fixed number of milliseconds; a DST boundary makes that wrong.
3. Insert those pairs into a temp table, join `analytics_events` against it,
   GROUP BY bucket index.
```

This keeps the counting in SQLite (where the indexes are) while keeping calendar logic
in application code (where it is correct). It also makes the buckets explicit, so empty
periods appear as zero rows instead of missing, which the current implementation has to
patch up in the client.

`ANALYTICS_TZ` keeps its current meaning. **Port the existing timezone test cases before
writing the implementation**; they are the only record of what "correct" means here.

The remaining pieces of `analytics_summary` are ordinary aggregate queries and port
directly: totals, distinct visitors, average depth and dwell, single-page visitors,
top pages with per-path depth and dwell, previous-window counts, returning visitors,
top referrers, top countries, channels, the three facets, depth quartiles.

**Scale note.** The current implementation does all of this in one Postgres call. Here
it becomes roughly twelve queries against `analytics.db`. That is fine at the
present data volume. Measure before optimising: if `analytics_events` passes ~2 million
rows and the dashboard takes more than 300 ms, add a daily rollup table
(`analytics_daily(day, path, views, visitors)`) maintained by the flush goroutine, and
serve everything except drill-down from it. Do not build the rollup up front.

### `restore_tables(payload jsonb, table_names text[])`

The plpgsql version is 40 lines of dynamic SQL wrestling with identity columns,
generated columns, and sequence resetting. In SQLite this is:

```
BEGIN IMMEDIATE
  for each table: DELETE FROM t
  for each table: INSERT the rows verbatim (ids included, no sequence to fix)
COMMIT
```

`posts_fts` is rebuilt afterwards with `INSERT INTO posts_fts(posts_fts) VALUES
('rebuild')`. `post_terms` is repopulated from the restored posts payload.

No identity sequences exist to advance, because SQLite's `AUTOINCREMENT` counter lives
in `sqlite_sequence` and is updated automatically by the inserts. Verify this in a
test: restore, then insert, then assert the new id exceeds the restored maximum.

---

---

## 4. New table: `render_cache` (content-addressed highlighting)

`shiki` is the heaviest dependency on the read path and the only one whose absence a
reader would notice. It moves off that path into a content-addressed cache:

```sql
create table render_cache (
  key        text primary key,     -- sha256(lang || '\0' || theme || '\0' || code)
  html       text not null,
  created_at integer not null
) without rowid;
```

The key **is** the input, so there is no invalidation problem: a changed code block is a
different key, and stale rows are inert. A janitor sweeps rows unreferenced for 90 days.

Read path: look up, use it. On a miss, highlight, store, serve. That makes the cache
self-healing rather than a correctness dependency, so a cold or partially-imported
database renders correctly and merely slower.

Write path: a post save pre-warms every block it contains, so the miss case is rare in
practice and absent after an import.

The rendered **body** is in here too, on the same terms: keyed by the build commit, the
media facts and the markdown. This section used to say the opposite — that only
highlighting is cached, because "`marked` is fast and a body cache would have to key on
media variants, theme and locale". `marked` is not fast: **measured on the live site
2026-07-29 it took 360ms on an 85,000-character post**, which was 359ms of a 364ms page
render, and `clearCache()` made the next reader pay it again after every write anywhere. Of
the three inputs, the theme is CSS and never reaches the body HTML, the locale does not
either, and the media facts are IN the key rather than invalidated out of it — which is the
same trick the highlighter already used and needs no graph.

The build commit is part of the body key so a deploy that changes any transform in
`post-content.ts` cannot serve yesterday's HTML out of a cache with no way to tell. That
costs one re-render per post per deploy, absorbed in the background by the cache warmer
(`server/warm.ts`).

## Migrations

`scripts/migrations/*.sql` and `schema_migrations` carry over as a concept, but the
existing files are Postgres dialect and are **not** reused. Quire 2.0 starts from a
single `src/store/schema.sql` representing the final shape, and its own migration ledger
starting empty.

Rationale: when this was written there was no Quire 2.0 instance in the wild to upgrade,
and the one-shot importer from 1.x targeted the current schema directly. The ledger is
live now, so a schema change ships as a migration.

Schema and migrations are imported as text (`with { type: 'text' }`) so they compile into
the executable, and applied at boot inside a transaction. A failed migration aborts
startup rather than degrading.

**The accepted risk from the frozen tree does not carry over.** There, `schema.sql` was
hand-maintained and the app never ran it, so drift was possible and review-enforced. Here
the app applies this file, so it cannot drift from reality.

## What the schema does NOT need to carry

- Every `alter table ... add column if not exists` back-compat statement (28 of them).
  These exist to upgrade instances in place. A fresh schema states the final shape.
- `enable row level security` on 16 tables.
- The `schema_migrations` seed list of four already-applied Postgres migrations.

Net: the Postgres file is 612 lines. The SQLite equivalent should land around 220.
