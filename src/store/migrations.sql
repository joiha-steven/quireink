-- Changes to an EXISTING content database. Applied at boot, after `schema.sql`, in order,
-- each inside its own transaction, each recorded in `schema_migrations`.
--
-- `schema.sql` states the FINAL shape and is what a fresh database is built from, so a
-- fresh database records every migration here as applied WITHOUT running it (see
-- `applyMigrations` in db.ts). That is the whole reason this file can hold plain
-- `alter table ... add column` statements: SQLite has no `if not exists` for a column, and
-- running one twice is an error rather than a no-op.
--
-- So a schema change is TWO edits, always: the new shape in `schema.sql`, and the step that
-- gets an existing database there from here. Doing only the first leaves the live instance
-- behind; doing only the second leaves a fresh install without the column.
--
-- Format: `-- migration: <name>` opens a step, everything until the next header is its SQL.
-- Names are ordered and never reused — the ledger keys on them.

-- migration: 001-google-comment-keys
-- Google sign-in for COMMENTERS (ADR 0013). The client id is public, the secret is not;
-- both sit with the other owner-pasted keys rather than in the environment, so they can be
-- entered in the admin like every other integration.
alter table integration_keys add column google_client_id text;
alter table integration_keys add column google_client_secret text;

-- migration: 002-pages-fts
-- The admin's one list searches pages as well as posts (ADR 0024), so pages get the index
-- posts have had since the port. The virtual table and its triggers are copied verbatim
-- from `schema.sql`; the last statement is the part a fresh database does NOT need, because
-- there the table is created before any page exists — an existing instance has pages already
-- and an empty index is indistinguishable from a page that cannot be found.
create virtual table if not exists pages_fts using fts5(
  title,
  content,
  content = 'pages',
  content_rowid = 'rowid',
  tokenize = "unicode61 remove_diacritics 2"
);
create trigger if not exists pages_fts_ai after insert on pages begin
  insert into pages_fts(rowid, title, content) values (new.rowid, new.title, new.content);
end;
create trigger if not exists pages_fts_ad after delete on pages begin
  insert into pages_fts(pages_fts, rowid, title, content) values ('delete', old.rowid, old.title, old.content);
end;
create trigger if not exists pages_fts_au after update of title, content on pages begin
  insert into pages_fts(pages_fts, rowid, title, content) values ('delete', old.rowid, old.title, old.content);
  insert into pages_fts(rowid, title, content) values (new.rowid, new.title, new.content);
end;
insert into pages_fts(rowid, title, content) select rowid, title, content from pages;

-- migration: 003-subscriber-hygiene
-- Subscribers join Invariant 6: deleting one is a soft delete into the Trash's new
-- Subscribers tab (`deleted_at`), where it can be restored or purged for real. And the
-- confirm email gets a per-address cooldown (`confirm_sent_at`): re-posting the same
-- address used to send another confirmation every time, which is the amplifier in a
-- subscription-bombing run — the rate limit bounds an IP, this bounds the victim.
alter table subscribers add column deleted_at integer;
alter table subscribers add column confirm_sent_at integer;

-- migration: 004-ai-alt-text
-- The optional AI describer: an alt column on media (NULL = never described, '' = the
-- owner cleared it on purpose), and the provider/key/model trio beside the other
-- owner-pasted secrets. The check constraint is not carried here: SQLite cannot add a
-- CHECK via alter table, and the writer (`integration-keys.ts`) only offers the three
-- values anyway.
alter table media add column alt text;
alter table integration_keys add column ai_provider text;
alter table integration_keys add column ai_api_key text;
alter table integration_keys add column ai_model text;

-- migration: 005-purge-webhook
-- Purging the edge stopped being a Cloudflare-only idea (ADR 0033). One URL the blog POSTs
-- to when it flushes, so an install behind Bunny, Fastly or a script in front of nginx has
-- the same "an edit is live without a manual purge" that a Cloudflare install has had.
alter table integration_keys add column purge_webhook_url text;

-- migration: 006-offsite-s3
-- A snapshot that lives beside the thing it copies does not survive the disk (ADR 0035).
-- Any S3-compatible bucket — R2, S3, MinIO — receives each scheduled snapshot; restore
-- stays a shell act on purpose.
alter table integration_keys add column s3_endpoint text;
alter table integration_keys add column s3_region text;
alter table integration_keys add column s3_bucket text;
alter table integration_keys add column s3_prefix text;
alter table integration_keys add column s3_access_key_id text;
alter table integration_keys add column s3_secret_access_key text;

-- migration: 007-variant-set-version
-- `media.variants` stopped being a yes/no. It says WHICH set of display widths is on disk,
-- because a third (512) joined 1024/1600 and a `<picture>` naming a file that is not there
-- fails outright rather than falling back — so the renderer has to know, per image, what it
-- may offer. An install finalised before this keeps its two widths and is upgraded by the
-- ordinary sweep; nothing has to be re-uploaded and nothing is re-encoded twice.
--
-- A REBUILD, because SQLite cannot alter a CHECK. The twelve-step dance in one transaction:
-- new table, copy, drop, rename, indexes back. `media` is small, has no triggers, and
-- nothing references it — which is what makes this the cheap option rather than adding a
-- second column that would mean almost the same thing as the first.
create table media_new (
  path        text primary key,
  filename    text not null,
  size        integer not null default 0,
  uploaded_at integer not null,
  width       integer,
  height      integer,
  thumb       text,
  variants    integer not null default 0 check (variants >= 0),
  alt         text,
  deleted_at  integer
);
insert into media_new (path, filename, size, uploaded_at, width, height, thumb, variants, alt, deleted_at)
  select path, filename, size, uploaded_at, width, height, thumb, variants, alt, deleted_at from media;
drop table media;
alter table media_new rename to media;
create index if not exists media_uploaded_at_idx on media (uploaded_at desc);
create index if not exists media_deleted_at_idx  on media (deleted_at);

-- migration: 008-mcp-token-scope
-- A leaked token used to be the whole blog: one scope, 'full', for every connector — the
-- reader that only summarises posts held the same key as the writer that publishes them.
-- 'read' tokens now exist; the default stays 'full' so every token already in someone's
-- connector keeps doing exactly what it did. SQLite CAN add a column with a CHECK, so no
-- rebuild this time.
alter table mcp_tokens add column scope text not null default 'full' check (scope in ('full', 'read'));
