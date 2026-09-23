> Read when a Postgres-shaped feature of 1.x is in question: the array columns, the
> `tsvector` search, and the six SQL functions. For the schema as it stands today, and for
> anything you are about to CHANGE, read [01-schema.md](01-schema.md) first.

# Schema: what the Postgres features became

Split out of [01-schema.md](01-schema.md) on 2026-09-19, when that file reached its 400-line
ceiling. The seam is not the line count. Everything left there describes the database this blog
HAS — its conventions, its tables, its migration ledger — and everything here describes how three
Postgres features were translated on the way to SQLite. The two are read by different people at
different moments: the first by somebody adding a column, this one by somebody wondering why a
category is a JSON array and where `analytics_summary` went.

Nothing here is a proposal. All three shipped, and the code each section names is live.

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
  in `src/content/posts.ts`.
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
matches `lập trình` natively. Vietnamese is space-separated at the syllable level, so
`unicode61` tokenizes it correctly without a segmenter.

The application layer does not disappear entirely, and assuming it did was a bug for a
year: a folded index cannot tell `lề` from `lệ`, `lê` or `lẻ`, which are four words.
`src/accent.ts` keeps the index as the thing that finds candidates and narrows them after
with the accents the person typed — per word, so an unaccented word still asks the wide
question, and it asks for a WHOLE word: as a substring `lê` sits inside `lên` and filtered
nothing. No second index and nothing to reindex.

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
`src/content/search-owner.test.ts`.

---

## 3. The six SQL functions

The Postgres schema and its analytics migrations defined six plpgsql functions (Postgres
only: 2.0 keeps this logic in TypeScript, never in SQL):
`analytics_summary`, `analytics_page`, `analytics_totals`, `analytics_channel`,
`analytics_facet`, `restore_tables`. All six move into `src/analytics` and
`src/store`. The first three carry the weight; the next two are helpers of them.

### `analytics_channel(host)` -> `analytics/channel.ts`

A pure function over host patterns (search engines, social networks, else referral,
with empty host meaning direct). Trivially portable, trivially testable. The port copied
the regex literals verbatim; since 2026-09-10 every pattern is anchored to a label boundary
and the end of the host, plus a small table for `android-app://` package names.

### `analytics_facet` -> a generic helper

`select col, count(distinct visitor) ... where col is not null group by 1
order by 2 desc limit ?` over one of `device`, `browser`, `os`. A NULL is a row imported
before the column existed and is skipped, not labelled. The column name comes
from a fixed lookup table, never interpolated from input. This is the one place allowed to
assemble SQL from a variable **on the request path**, and the allowlist is the reason.

There is one other site in the codebase, found by a sweep on 2026-08-22 while this
paragraph still said "the one place": `server/backup.ts` builds `vacuum into '<path>'`.
SQLite accepts no bound parameter for that filename, so there is no parameterised form to
reach for; the path is one this process just made with `mkdtemp`, never a request or a
setting, and its quotes are doubled. `store/upgrade.ts` (ADR 0063) became a second on
2026-09-22, the same way, with a path derived from the data directory. `store/db.ts` interpolates two `pragma` statements as
well, and those are inside the rule already — a module constant and a closed `'FULL' |
'NORMAL'` union, both fixed identifiers rather than values.

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
