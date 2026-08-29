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
