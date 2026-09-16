-- Quire Ink 2.0 analytics database (`analytics.db`). Separate file on purpose, see
-- v2/docs/01-schema.md:
--
--   * Write patterns differ by orders of magnitude. A pageview must not queue behind a
--     post save, and a post save must never wait on an analytics flush.
--   * Backup value differs. Losing a day of analytics is an annoyance; losing a day of
--     posts is a disaster. That justifies different `synchronous` settings per file.
--   * This file grows without bound by design ("kept FOREVER"). Keeping it out of the
--     content database keeps the precious file small and its backups fast.
--
-- Joined to `quire.db` with ATTACH where needed, which is only `analytics_totals` (the
-- Views column on the admin content tables).
--
-- No PII: `visitor` is a salted hash of IP + user agent, and the device/browser/os columns
-- are COARSE buckets parsed at insert. The raw user agent is never stored.

-- This file gained migrations on 2026-08-29, for the same reason `quire.db` has them:
-- there are installs in the wild, and `create table if not exists` cannot add a column to a
-- table that already exists. Steps live in `migrations-analytics.sql` and run through the
-- same `applyMigrations` the content database uses.
create table if not exists schema_migrations (
  name       text primary key,
  applied_at integer not null
);

create table if not exists analytics_events (
  id            integer primary key autoincrement,
  path          text not null,
  visitor       text not null,
  referrer_host text,                          -- external host only; NULL = direct/internal
  country       text,                          -- ISO 3166-1 alpha-2 from the edge
  device        text,                          -- desktop | mobile | tablet
  browser       text,                          -- Chrome | Safari | Firefox | ...
  os            text,                          -- Windows | macOS | iOS | Android | ...
  created_at    integer not null
);
create index if not exists analytics_events_created_idx on analytics_events (created_at);
create index if not exists analytics_events_path_idx    on analytics_events (path);
-- ⚠️ NO INDEX ON `device` ALONE, and taking it off made the one query that reads that column
-- eight times faster. Measured 2026-09-16 on 200,000 events over three years: with it, SQLite
-- drove the facet off `device` and walked the whole history evaluating the 30-day bound as a
-- filter, 48.30ms; without it, the plan is the same `created_at` seek its two identical
-- siblings `browser` and `os` already get, 6.00ms. A facet reads a WINDOW and groups by the
-- column; it never seeks by it.
-- Not in the Postgres original. Every dashboard query groups by a time bucket and then by
-- path or visitor; the single-column created_at index makes the engine walk the table for
-- the second half of that.
create index if not exists analytics_events_created_path_idx    on analytics_events (created_at, path);
create index if not exists analytics_events_created_visitor_idx on analytics_events (created_at, visitor);
-- VISITOR FIRST, which none of the others are. "How many of this window's readers had been
-- here before" asks `not exists (... where visitor = ? and created_at < ?)`, and with no index
-- leading on `visitor` SQLite built a transient one on every dashboard load: the plan said
-- AUTOMATIC PARTIAL COVERING INDEX, and the build is proportional to everything older than the
-- window. Measured on the same 200,000 rows: 98.77ms to 4.85ms.
create index if not exists analytics_events_visitor_created_idx on analytics_events (visitor, created_at);

-- One sample per VISIT: a reader on a page, within half an hour. A later leave from the
-- same tab updates the row (deepest point, dwell total) rather than adding a second one;
-- see `analytics/buffer.ts`. `bytes` sits here beside `dwell_ms` rather than on the view row
-- because both are only knowable at the end: a view is recorded the moment the page
-- activates, when its stylesheets, fonts and pictures are still arriving, so bytes counted
-- then would always be short.
create table if not exists analytics_scroll (
  id         integer primary key autoincrement,
  path       text not null,
  depth      integer not null,
  dwell_ms   integer,                          -- NULL if not measured
  -- What the READER's browser reported downloading for this visit (Navigation + Resource
  -- Timing). NULL means not measured, never zero. It is not server egress and must never be
  -- labelled as such: a bot or a feed reader downloads bytes and reports none of them.
  bytes      integer,
  visitor    text not null,
  created_at integer not null
);
create index if not exists analytics_scroll_created_idx on analytics_scroll (created_at);
create index if not exists analytics_scroll_path_idx    on analytics_scroll (path);
create index if not exists analytics_scroll_dwell_idx   on analytics_scroll (dwell_ms);
-- THE MERGE ON THE WRITE PATH, and it is the one index here that a reader pays for. A leave
-- sample looks for this visitor's last row on this path inside half an hour; the only
-- candidate was `(path)`, so SQLite read every row ever recorded for that path, sorted them in
-- a temp B-tree and kept one. Measured 2026-09-16 on 100,000 rows: 1.83ms to 0.00ms, the plan
-- becoming a covering seek. `buffer.ts` runs a whole flush in one synchronous transaction, so
-- at 100 scroll rows that was roughly 180ms of blocked event loop, growing with how popular
-- the path is.
create index if not exists analytics_scroll_visitor_path_created_idx
  on analytics_scroll (visitor, path, created_at);
