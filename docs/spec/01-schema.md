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
- All timezone logic already has to move into application code (see "The six SQL functions"
  in [01-schema-port.md](01-schema-port.md); this said "five RPCs" until 2026-09-10), so keeping ISO strings for the sake of SQLite's date functions buys nothing.

Cost: hand-inspecting the DB is less pleasant. Mitigated by a `quire db` CLI
subcommand that renders timestamps for humans. (Never built, as of 2026-09-10: `sqlite3`
and `datetime(ms/1000,'unixepoch')` do the job.)

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
functions" in [01-schema-port.md](01-schema-port.md)). It is recorded here so nobody tries the shorter path and discovers this
halfway through the analytics port.

### PRAGMAs (set on every connection)

```
journal_mode = WAL          readers never block the writer
synchronous  = NORMAL       safe under WAL; FULL only for the content DB if desired
busy_timeout = 5000
foreign_keys = ON
cache_size   = -16000       16 MB page cache, PER CONNECTION and there are two
temp_store   = MEMORY
```

`cache_size` was `-64000` until 2026-09-23, when it was measured for the first time: inside a
128 MB container, against a 314 MB database, 64 MB was **the slowest of four settings in every
run** — SQLite's private cache and the kernel's page cache come out of the same allowance, so
the large one buys a second copy of pages it has just pushed the kernel into dropping. The
table and the reason it is 16 rather than 2 are in
[delivery.md](../delivery.md#the-third-ceiling-sqlites-own-cache).

### Two database files

| File | Contents | Backup |
|---|---|---|
| `quire.db` | Everything except analytics | `VACUUM INTO` snapshot, in every copy ([backups.md](../backups.md) counts four since ADR 0035; this said three) |
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
`pages`, `notes` (added 2026-09-09, migration `012-notes` — the notebook, [ADR 0044](../decisions/0044-a-note-is-not-a-post.md): a post's shape less taxonomy, plus `source_url`, `source_title` and `quote` for a clip), `webmentions` (added 2026-09-09, migration `013-webmentions`, [ADR 0046](../decisions/0046-the-notebook-speaks-the-open-standards.md)), `reader_marks` and `reader_keys` (added 2026-09-09, migration `014-reader-marks`, [ADR 0047](../decisions/0047-a-readers-marks-travel-by-a-code.md): a reader's marks per page under an opaque id, and the hashed notebook codes that name a reader), `post_revisions`, `media`, `files`, `settings`, `mcp_tokens` (rebuilt 2026-09-13, migration `015-mcp-admin-scope`, to let `scope` hold `admin` as well: SQLite cannot alter a CHECK constraint), `mcp_clients`,
`mcp_used_codes`, `backup_state`, `integration_keys`, `subscribers`, `link_cards` (added 2026-09-19, migration `017-link-cards`, [ADR 0058](../decisions/0058-a-link-alone-becomes-a-card.md): one row per URL for what a bookmark card says — `fetched_at` NULL is a row a render noted and the minute tick has not read yet, and `ok = 0` after a fetch is one that was tried and yielded nothing, which renders exactly as an unread row does. Its index is PARTIAL, over the pending rows alone, so the tick's "anything to do?" is empty on a blog with nothing waiting),
`newsletter_sends`, `activity_log`, `redirects`, `analytics_scroll`,
`schema_migrations`. The rest are described where they are used: `users`, `sessions`,
`recovery_codes` in [06-auth.md](06-auth.md), `post_terms` and the `*_fts` tables in
[01-schema-port.md](01-schema-port.md), and the `ap_*` tables, `assistant_chats`,
`server_secrets` and `update_check` in the comments of `schema.sql` and `migrations.sql`.

`comments` is unchanged apart from `AUTOINCREMENT` (above) and `smallint` becoming
`INTEGER`.

`posts.lang` / `posts.tr_group` (and the same pair on `pages`) were added 2026-09-19, migration
`016-post-language`, [ADR 0056](../decisions/0056-a-piece-names-its-own-language.md). Both nullable
`TEXT`, neither backfilled (**`lang` NULL means "nobody has said", not English**) and **neither
indexed** — `schema.sql` runs before the migrations, so an index declared there against a column a
migration is about to add fails on boot for every existing install.

`posts.autosave_json` / `posts.autosave_at` (and the same pair on `pages`) are the editor's
server-side autosave, added 2026-08-30. They map straight across — `TEXT` and `BIGINT` — and
the only thing worth carrying into any port is the RULE: **nothing that renders a page may
read them.** `content` is what the reader is served and only an explicit Save moves it; these
two hold the in-progress draft so a dead laptop does not cost the morning, and a real save
clears them. `src/content/autosave.test.ts` asserts both halves.

Three areas needed real design work, now in [01-schema-port.md](01-schema-port.md) §1–3, and
two tables were added for a fourth.

---

## 4. Two new tables: `render_cache` and `body_cache`

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
different key, and stale rows are inert. A janitor sweeps rows older than 30 days, by age
rather than use, since nothing records a read (`render/render-cache.ts`).

Read path: look up, use it. On a miss, highlight, store, serve. That makes the cache
self-healing rather than a correctness dependency, so a cold or partially-imported
database renders correctly and merely slower.

Write path: a post save pre-warms every block it contains, so the miss case is rare in
practice and absent after an import.

The rendered **body** was in here too, on the same terms, and that turned out to be the one
place those terms did not fit — see below. It is keyed by the build commit, the
media facts and the markdown. This section used to say the opposite — that only
highlighting is cached, because "`marked` is fast and a body cache would have to key on
media variants, theme and locale". No renderer is fast at that size, and `marked`, which ran
then, was not: **measured on the live site 2026-07-29 it took 360ms on an 85,000-character post**, which was 359ms of a 364ms page
render, and `clearCache()` made the next reader pay it again after every write anywhere. Of
the three inputs, the theme is CSS and never reaches the body HTML, the locale does not
either, and the media facts are IN the key rather than invalidated out of it — which is the
same trick the highlighter already used and needs no graph.

The build commit is part of the body key so a deploy that changes any transform in
`post-content.ts` cannot serve yesterday's HTML out of a cache with no way to tell. That
costs one re-render per post per deploy, absorbed in the background by the cache warmer
(`server/warm.ts`).

### The body moved out: `body_cache`, one row per piece (ADR 0062)

Content-addressing has no way to say **replace**. The only identifying column is a hash, so
when a render is stored there is no question "which row does this supersede" to ask, and the
answer is that nothing ever superseded anything. With the build commit in the key, every
deploy stranded a full generation of bodies for the 30-day sweep to find — and the blog was
deploying about seven times a day.

Measured on manhhung.me, 2026-09-22: `quire.db` was **618,434,560 B**, of which
`render_cache` was **501,981,656 B** across 20,001 rows, holding about **5.6 MB** of distinct
HTML. One body of 88,084 characters was present **204 times**, byte for byte. Everything
anybody had ever written — 93 posts, revisions, FTS, settings, log — came to **8 MB**.

```sql
create table body_cache (
  slot       text primary key,   -- 'post:<slug>', 'page:<slug>', 'note:<slug>', 'preview:<slug>'
  key        text not null,      -- the same hash, compared rather than looked up
  html       text not null,
  created_at integer not null
) without rowid;
```

Read by slot, compare the key, use the row when it matches; on a miss render and take the
row. **The hash still decides hit from miss on exactly the inputs it decided on before**, so
the bytes a reader receives did not change. The table's size is the number of pieces.
Migration `019-body-cache` created it and emptied `render_cache`, because a body and a
highlighted block are indistinguishable there; `render_cache` holds highlighting alone now.

Highlighting stays where it is: a code block is shared between pieces, has no slot to belong
to, is small, and age is the right collector for it.

⚠️ A slot is correct only while a piece has one valid rendering at a time. Every input in
`bodyKey` is server-global or piece-global; put a theme, a locale or anything the reader
decides into it and content-addressing becomes the right shape again.

## Migrations

`scripts/migrations/*.sql` and `schema_migrations` carry over as a concept, but the
existing files are Postgres dialect and are **not** reused. Quire 2.0 starts from a
single `src/store/schema.sql` representing the final shape, and its own migration ledger
starting empty.

Rationale: when this was written there was no Quire 2.0 instance in the wild to upgrade,
and the one-shot importer from 1.x targeted the current schema directly. The ledger is
live now, so a schema change ships as a migration.

Schema and migrations are imported as text (`with { type: 'text' }`) so they compile into
the executable, and applied at boot inside a transaction. (There is no executable since
[ADR 0022](../decisions/0022-ship-from-source-not-a-compiled-binary.md); the text import
still means the SQL ships with the source and needs no file path at runtime.) A failed migration aborts
startup rather than degrading. Before a pending step touches an existing database,
`store/upgrade.ts` empties `render_cache` and `body_cache` and writes a `VACUUM INTO` copy to
`backups/pre-<step>-<stamp>-<file>` beside it, two kept; if the copy fails, the boot stops
([ADR 0063](../decisions/0063-an-upgrade-copies-first-and-gives-the-space-back.md)).

**The accepted risk from the frozen tree does not carry over.** There, `schema.sql` was
hand-maintained and the app never ran it, so drift was possible and review-enforced. Here
the app applies this file, so it cannot drift from reality.

## What the schema does NOT need to carry

- Every `alter table ... add column if not exists` back-compat statement (28 of them).
  These exist to upgrade instances in place. A fresh schema states the final shape.
- `enable row level security` on 16 tables.
- The `schema_migrations` seed list of four already-applied Postgres migrations.

Net: the Postgres file is 612 lines. The SQLite equivalent should land around 220.
