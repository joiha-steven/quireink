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
create index if not exists analytics_events_device_idx  on analytics_events (device);
-- Not in the Postgres original. Every dashboard query groups by a time bucket and then by
-- path or visitor; the single-column created_at index makes the engine walk the table for
-- the second half of that.
create index if not exists analytics_events_created_path_idx    on analytics_events (created_at, path);
create index if not exists analytics_events_created_visitor_idx on analytics_events (created_at, visitor);

-- One sample per LEAVE. `bytes` sits here beside `dwell_ms` rather than on the view row
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
