-- Quire Ink 2.0 content database (`quire.db`). Applied at boot, inside a transaction.
--
-- Translated from the Postgres schema (`../../v1/scripts/schema.sql`, 612 lines) per
-- docs/spec/01-schema.md. Read that document before changing anything here; it records why
-- each choice was made and what was rejected.
--
-- Conventions, applied everywhere without further comment:
--   * Timestamps are INTEGER MILLISECONDS since epoch, UTC. NULL stays NULL. There is no
--     DEFAULT: the application supplies every timestamp, because SQLite's own clock
--     functions would write text and silently break every comparison.
--   * Booleans are INTEGER 0/1, pinned by a CHECK.
--   * Identity columns are INTEGER PRIMARY KEY AUTOINCREMENT. AUTOINCREMENT is REQUIRED,
--     not stylistic: see `comments` below.
--   * Row-level security is gone. It existed only to neuter the anon key, an artifact of
--     the Supabase origin. SQLite is in-process and has no second client.
--
-- Analytics lives in a separate file (`schema-analytics.sql`) so a pageview write never
-- queues behind a post save and the precious file stays small.

-- ----- migration ledger ------------------------------------------------------
-- The Postgres migrations are not reused; this ledger started empty because every instance
-- arrived through `import-v1`, which targets this schema directly. There IS a Quire Ink 2.0 in
-- the wild now, so steps that move an existing database to the shape below live in
-- `migrations.sql` and are named here as they are applied.
create table if not exists schema_migrations (
  name       text primary key,
  applied_at integer not null
);

-- ----- posts -----------------------------------------------------------------
create table if not exists posts (
  slug             text primary key,
  title            text not null default '',
  date             integer not null,
  status           text not null default 'draft' check (status in ('draft','published')),
  featured_image   text,
  excerpt          text,
  reading_minutes  integer,
  content          text not null default '',
  series           text,
  series_order     integer not null default 0,
  meta_title       text,
  meta_description text,
  cover_image      text,
  broadcast_at     integer,
  created_at       integer not null,
  updated_at       integer not null,
  -- Soft delete (Invariant 6): NULL = live, a timestamp = in Trash.
  deleted_at       integer
);
create index if not exists posts_status_date_idx on posts (status, date desc);
create index if not exists posts_deleted_at_idx  on posts (deleted_at);
create index if not exists posts_series_idx      on posts (series);

-- `posts.categories`/`tags` were Postgres `text[]` with GIN indexes. SQLite has no array
-- type, and a JSON column would turn every taxonomy page into a full scan with a
-- correlated json_each. A junction table makes /category/{slug} an index seek, turns
-- getCategories into one GROUP BY, and reduces `updateTerm` (rename across every post,
-- merging on collision) from a read-modify-write over the whole index to one UPDATE.
-- WITHOUT ROWID is correct here: the table is all key and no payload.
create table if not exists post_terms (
  post_slug text not null references posts(slug) on delete cascade,
  kind      text not null check (kind in ('category','tag')),
  term      text not null,
  primary key (post_slug, kind, term)
) without rowid;
create index if not exists post_terms_lookup on post_terms (kind, term, post_slug);

-- Replaces the `search` tsvector. `remove_diacritics 2` folds diacritics IN THE INDEX, so
-- "lap trinh" matches "lập trình" natively and the accent-insensitive layer the /search
-- route bolts on disappears. Verified against bun:sqlite (SQLite 3.53) before this was
-- written. Vietnamese is space-separated at the syllable level, so unicode61 tokenizes it
-- correctly with no segmenter. Ranking changes from none to bm25(): parity exception 2.
create virtual table if not exists posts_fts using fts5(
  title,
  content,
  content = 'posts',
  content_rowid = 'rowid',
  tokenize = "unicode61 remove_diacritics 2"
);

-- Standard external-content triggers. Without all three the index silently drifts from
-- the table, which shows up as a post that cannot be found rather than as an error.
create trigger if not exists posts_fts_ai after insert on posts begin
  insert into posts_fts(rowid, title, content) values (new.rowid, new.title, new.content);
end;
create trigger if not exists posts_fts_ad after delete on posts begin
  insert into posts_fts(posts_fts, rowid, title, content) values ('delete', old.rowid, old.title, old.content);
end;
create trigger if not exists posts_fts_au after update of title, content on posts begin
  insert into posts_fts(posts_fts, rowid, title, content) values ('delete', old.rowid, old.title, old.content);
  insert into posts_fts(rowid, title, content) values (new.rowid, new.title, new.content);
end;

-- ----- pages (share the /{slug} namespace with posts, Invariant 2) -----------
create table if not exists pages (
  slug           text primary key,
  title          text not null default '',
  status         text not null default 'draft' check (status in ('draft','published')),
  featured_image text,
  content        text not null default '',
  created_at     integer not null,
  updated_at     integer not null,
  deleted_at     integer
);
create index if not exists pages_deleted_at_idx on pages (deleted_at);

-- Pages are searched the same way posts are, by the same index shape, because the admin's
-- one list holds both (ADR 0024) and a second mechanism for eleven rows would be a second
-- thing to keep in sync. `remove_diacritics 2` matters here for the same reason: the owner
-- types "gioi thieu" and means "Giới thiệu".
create virtual table if not exists pages_fts using fts5(
  title,
  content,
  content = 'pages',
  content_rowid = 'rowid',
  tokenize = "unicode61 remove_diacritics 2"
);

-- All three, for the reason posts_fts documents: two of them leave the index drifting, and
-- drift shows up as a page nobody can find rather than as an error.
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

-- ----- post_revisions (time machine: last 3 per post) ------------------------
create table if not exists post_revisions (
  id       integer primary key autoincrement,
  slug     text not null,
  data     text not null,          -- was jsonb; stored verbatim as JSON text
  saved_at integer not null
);
create index if not exists post_revisions_slug_idx on post_revisions (slug, saved_at desc);

-- ----- media (image metadata; binaries on disk) ------------------------------
create table if not exists media (
  path        text primary key,
  filename    text not null,
  size        integer not null default 0,
  uploaded_at integer not null,
  width       integer,
  height      integer,
  thumb       text,
  variants    integer not null default 0 check (variants in (0,1)),
  -- Soft delete KEEPS the blob, so a published post linking a trashed image keeps
  -- rendering. The bytes go only on purge.
  deleted_at  integer
);
create index if not exists media_uploaded_at_idx on media (uploaded_at desc);
create index if not exists media_deleted_at_idx  on media (deleted_at);

-- ----- files (attachments, site icons, custom fonts) -------------------------
create table if not exists files (
  url          text primary key,
  filename     text not null,
  size         integer not null default 0,
  content_type text not null default '',
  uploaded_at  integer not null,
  deleted_at   integer
);
create index if not exists files_uploaded_at_idx on files (uploaded_at desc);
create index if not exists files_deleted_at_idx  on files (deleted_at);

-- ----- comments --------------------------------------------------------------
-- `parent_id` is a deliberate FK-LESS self-reference: purging one comment must never
-- cascade into live replies. The tree is rebuilt in the application, which re-roots an
-- orphan and renders a deleted-but-still-replied node as a tombstone.
--
-- AUTOINCREMENT is load-bearing HERE. Plain rowid assignment REUSES the highest freed id,
-- so purging comment 42 and creating a new one could reissue 42, and the orphaned replies
-- pointing at 42 would silently re-parent onto an unrelated comment. That is a real
-- data-corruption path, not a theoretical one.
create table if not exists comments (
  id             integer primary key autoincrement,
  post_slug      text not null,
  parent_id      integer,
  depth          integer not null default 0 check (depth between 0 and 2),
  author_name    text not null default '',
  author_email   text not null default '',   -- admin-only; NEVER sent to the public client
  author_website text,
  author_ip      text,                       -- admin-only
  author_country text,                       -- admin-only
  provider       text not null default 'manual' check (provider in ('manual','google','facebook')),
  content        text not null default '',   -- limited markdown source, <= 1000 chars
  created_at     integer not null,
  deleted_at     integer
);
create index if not exists comments_post_idx       on comments (post_slug, deleted_at, created_at);
create index if not exists comments_parent_idx     on comments (parent_id);
create index if not exists comments_deleted_at_idx on comments (deleted_at);

-- ----- settings (single row) --------------------------------------------------
create table if not exists settings (
  id   integer primary key check (id = 1),
  data text not null                        -- was jsonb; verbatim JSON, never reshaped
);

-- ----- MCP -------------------------------------------------------------------
-- Only the SHA-256 hash is stored; the plaintext is shown once. The hash format must be
-- preserved across cutover or AI publishing stops silently (docs/spec/00-rationale.md, parity exception #4).
create table if not exists mcp_tokens (
  id           integer primary key autoincrement,
  name         text not null default '',
  token_hash   text not null unique,
  prefix       text not null default '',
  created_at   integer not null,
  expires_at   integer not null,
  last_used_at integer
);
create index if not exists mcp_tokens_hash_idx on mcp_tokens (token_hash);

create table if not exists mcp_clients (
  client_id     text primary key,
  redirect_uris text not null default '[]',   -- was text[]; JSON array
  created_at    integer not null
);

-- Single-use authorization codes. The PRIMARY KEY is the replay guard.
create table if not exists mcp_used_codes (
  jti        text primary key,
  expires_at integer not null
);
create index if not exists mcp_used_codes_expires_idx on mcp_used_codes (expires_at);

-- ----- backup_state -----------------------------------------------------------
-- Google Drive backup is gone from the application (parity exception 1); what replaced it
-- is operational and lives outside this schema, in docs/backups.md. The row survives the
-- import with its token nulled so `last_run_at` history is not lost.
create table if not exists backup_state (
  id            integer primary key check (id = 1),
  refresh_token text,
  folder_id     text,
  last_run_at   integer,
  last_status   text,
  last_error    text,
  last_size     integer
);

-- ----- integration_keys (server-only secrets) ---------------------------------
-- NEVER read into settings.data or any client-bound payload.
create table if not exists integration_keys (
  id                   integer primary key check (id = 1),
  turnstile_site_key   text,
  turnstile_secret_key text,
  cloudflare_api_token text,
  cloudflare_zone_id   text,
  google_client_id     text,   -- comment sign-in; public half, still pasted by the owner
  google_client_secret text,
  smtp_host            text,
  smtp_port            integer,
  smtp_user            text,
  smtp_pass            text,
  smtp_from            text,
  -- NULLABLE on purpose. NULL means "not chosen", and the caller falls back to
  -- `port === 465`, which is how the frozen tree behaved. A NOT NULL DEFAULT 1 here would
  -- silently force implicit TLS on any install that had ever saved an unrelated key on
  -- this row, and a port-587 STARTTLS server would stop accepting mail with no setting
  -- having been touched. Found while porting mail.ts.
  smtp_secure          integer check (smtp_secure in (0,1))
);

-- ----- newsletter -------------------------------------------------------------
create table if not exists subscribers (
  id           integer primary key autoincrement,
  email        text not null unique,
  status       text not null default 'pending' check (status in ('pending','confirmed','unsubscribed')),
  token        text not null,                -- secret, serves BOTH confirm and unsubscribe
  created_at   integer not null,
  confirmed_at integer
);
create index if not exists subscribers_status_idx on subscribers (status);

-- One row per outgoing email, success or failure, every kind. Keyed by ADDRESS and not a
-- subscriber FK, because reply notifications go to commenters who never subscribed.
create table if not exists newsletter_sends (
  id         integer primary key autoincrement,
  email      text not null,
  kind       text not null check (kind in ('confirm','broadcast','reply','test')),
  post_slug  text,
  sent_at    integer not null,
  ok         integer not null check (ok in (0,1)),
  error      text,
  open_token text unique,
  opened_at  integer
);
create index if not exists newsletter_sends_email_idx on newsletter_sends (email);
create index if not exists newsletter_sends_post_idx  on newsletter_sends (post_slug) where post_slug is not null;

-- ----- activity_log -----------------------------------------------------------
create table if not exists activity_log (
  id     integer primary key autoincrement,
  at     integer not null,
  action text not null,
  detail text not null default ''
);
create index if not exists activity_log_at_idx on activity_log (at desc);

-- ----- redirects --------------------------------------------------------------
create table if not exists redirects (
  id          integer primary key autoincrement,
  source      text not null unique,           -- normalized path, e.g. '/old-slug'
  destination text not null,                   -- path or absolute URL
  permanent   integer not null default 1 check (permanent in (0,1)),
  created_at  integer not null
);

-- ----- render_cache (content-addressed rendering) ------------------------------
-- NEW in 2.0. Everything expensive on the read path that is a PURE FUNCTION OF ITS OWN
-- INPUT lives here, keyed by that input: there is no invalidation problem, because a change
-- is simply a different key and stale rows are inert. A read miss re-renders and stores, so
-- a cold database renders correctly and merely slower. Not emptied by `clearCache()`.
--
-- Two producers:
--   • Shiki highlighting, keyed by lang + theme pair + code.
--   • The rendered post BODY, keyed by build commit + media facts + markdown.
--
-- This comment used to say the body was deliberately NOT cached, because it "would have to
-- key on media variants, theme and locale". Two thirds of that was wrong — the theme is CSS
-- and never reaches the body HTML, and neither does the locale — and the third is in the
-- key rather than invalidated out of it. Measured on the live site 2026-07-29: `marked`
-- alone took 360ms on an 85,000-character post, and every write anywhere made the next
-- reader pay it again.
create table if not exists render_cache (
  key        text primary key,                -- sha256 of the NUL-joined inputs
  html       text not null,
  created_at integer not null
) without rowid;

-- ----- server_secrets ---------------------------------------------------------
-- Values the SERVER generates for itself, as opposed to `integration_keys`, which holds
-- what the owner pastes in. Generated on first use and never shown in any UI, so a
-- self-hoster has one less environment variable to set and cannot set it badly.
--
-- This exists because `AUTH_SECRET` leaves with next-auth (06-auth.md) and the analytics
-- visitor hash was salted with it, falling back to the literal 'quire' when unset. A
-- constant salt makes a salted hash of IP + user agent reversible by anyone holding the
-- database, which is the one property that hash exists to deny.
create table if not exists server_secrets (
  name  text primary key,
  value text not null
) without rowid;

-- ----- auth (new in 2.0; see v2/docs/06-auth.md) ------------------------------
-- One owner, but a one-row table costs nothing and a hard-coded singleton costs a rewrite.
-- `password_hash` and `totp_secret` are secrets and never reach a client-bound payload.
create table if not exists users (
  id             integer primary key autoincrement,
  username       text not null unique,
  email          text not null,
  password_hash  text not null,               -- argon2id, via Bun.password
  totp_secret    text,                        -- base32, NULL until enrolled
  totp_last_step integer,                     -- replay guard: reject any step <= this
  created_at     integer not null,
  updated_at     integer not null
);

-- The cookie carries the raw token; only its hash is stored, so a database leak yields no
-- live session.
create table if not exists sessions (
  id           text primary key,              -- sha256 of the cookie token
  user_id      integer not null references users(id) on delete cascade,
  created_at   integer not null,
  last_seen_at integer not null,
  expires_at   integer not null,
  user_agent   text,                          -- coarse bucket only, never the raw UA
  ip_hash      text                           -- salted hash, same stance as analytics
);
create index if not exists sessions_user_idx    on sessions (user_id);
create index if not exists sessions_expires_idx on sessions (expires_at);

create table if not exists recovery_codes (
  user_id   integer not null references users(id) on delete cascade,
  code_hash text not null,                    -- argon2id
  used_at   integer,                          -- NULL until spent; single use
  primary key (user_id, code_hash)
) without rowid;
