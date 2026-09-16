-- Steps that move an EXISTING `analytics.db` to the shape `schema-analytics.sql` states.
--
-- Same machinery and same rule as `migrations.sql`: a database created from the schema a
-- moment ago is already at the final shape, so its steps are recorded without being run.
-- Split on the `-- migration: <name>` headers by `parseMigrations`.

-- migration: a001-visit-bytes
-- What a reader's browser actually downloaded for one visit, so the owner can see whether a
-- page is cheap without opening a network panel. It goes on the LEAVE sample, beside
-- `dwell_ms`, because both are only knowable at the end: the view row is written while the
-- page's fonts and pictures are still arriving. Nullable on purpose -- every row written
-- before this column existed keeps meaning "not measured" rather than "zero", and the
-- dashboard has to tell those two apart or it will report a busy month as a free one.
alter table analytics_scroll add column bytes integer;

-- migration: a002-index-the-questions-that-are-asked
-- Three index changes, each measured on a synthetic table built from this schema rather than
-- guessed from the SQL. `schema-analytics.sql` carries the full reasoning beside each one.
--
-- `analytics_events (device)` goes. It was the only candidate for the device facet, so SQLite
-- drove off it and walked the whole history for a 30-day question: 48.30ms against 6.00ms for
-- the identical `browser` and `os` facets, which have no such index. An index that makes the
-- one query reading its column eight times slower is worse than no index.
--
-- `analytics_events (visitor, created_at)` arrives because nothing led on `visitor`, so the
-- returning-reader count made SQLite build a transient index on every dashboard load. 98.77ms
-- to 4.85ms.
--
-- `analytics_scroll (visitor, path, created_at)` is the one on the WRITE path, and the only
-- one a reader waits for: the leave-sample merge was reading every row ever recorded for a
-- path and sorting them to keep one. 1.83ms to 0.00ms, and a flush of 100 rows runs in a
-- single synchronous transaction.
drop index if exists analytics_events_device_idx;
create index if not exists analytics_events_visitor_created_idx on analytics_events (visitor, created_at);
create index if not exists analytics_scroll_visitor_path_created_idx on analytics_scroll (visitor, path, created_at);
