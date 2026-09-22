// Migrations exist for exactly one situation that no other test can reach: a database
// created BEFORE a column existed. So this file builds one by hand and boots against it.
import { expect, test, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { openDatabases, closeDatabases, parseMigrations } from './db'
import migrations from './migrations.sql' with { type: 'text' }
import analyticsMigrations from './migrations-analytics.sql' with { type: 'text' }

const DIR = './.tmp/test-migrations'

afterAll(() => {
  closeDatabases()
  try { rmSync(DIR, { recursive: true, force: true }) } catch { /* ignore */ }
})

const columns = (db: Database, table: string): string[] =>
  db.query<{ name: string }, []>(`pragma table_info(${table})`).all().map((r) => r.name)

const applied = (db: Database): string[] =>
  db.query<{ name: string }, []>(`select name from schema_migrations order by name`)
    .all().map((r) => r.name)

test('every step in migrations.sql parses with a name and a body', () => {
  const steps = parseMigrations(migrations)
  expect(steps.length).toBeGreaterThan(0)
  for (const step of steps) {
    expect(step.name).toMatch(/^\d{3}-[a-z0-9-]+$/)
    expect(step.sql.trim().length).toBeGreaterThan(0)
  }
  // Names key the ledger, so a duplicate would silently skip the second step forever.
  expect(new Set(steps.map((s) => s.name)).size).toBe(steps.length)
})

test('a text before a header is not swallowed into a step', () => {
  const steps = parseMigrations([
    '-- a preamble that belongs to no step',
    '-- migration: 001-one',
    'select 1;',
    '-- migration: 002-two',
    'select 2;',
  ].join('\n'))
  expect(steps.map((s) => s.name)).toEqual(['001-one', '002-two'])
  expect(steps[0]!.sql).toContain('select 1;')
  expect(steps[0]!.sql).not.toContain('select 2;')
})

test('a fresh database records every step WITHOUT running it', () => {
  rmSync(DIR, { recursive: true, force: true })
  const { db } = openDatabases(DIR)
  // schema.sql already states the final shape, so running the steps would fail on a
  // duplicate column. Recording them is what stops that happening on the next boot.
  expect(columns(db, 'integration_keys')).toContain('google_client_id')
  expect(applied(db)).toEqual(parseMigrations(migrations).map((s) => s.name))
  closeDatabases()
})

test('an OLD database gets the columns it was created without', () => {
  const dir = `${DIR}-old`
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })

  // The shape this instance had before Google sign-in existed: no google columns, no
  // ledger rows. Written directly, because there is no other way to get one now.
  //
  // EVERY table a migration alters has to be here in its OLD shape. A table the fixture
  // omits is created by schema.sql at the FINAL shape, and the alter then fails on a
  // duplicate column — which is a fact about this fixture, not about any real database:
  // a real pre-migration instance has the real pre-migration table.
  //
  // The smtp columns are here because they have been in `schema.sql` since its first
  // commit, so every real database of this era HAS them. They were left out while no
  // migration named a column — and the first one that did (010, which rebuilds this table
  // rather than adding to it) failed on a shape no instance has ever had.
  const old = new Database(join(dir, 'quire.db'), { create: true })
  old.run(`create table integration_keys (
             id integer primary key check (id = 1),
             turnstile_site_key text, turnstile_secret_key text,
             cloudflare_api_token text, cloudflare_zone_id text,
             smtp_host text, smtp_port integer, smtp_user text, smtp_pass text,
             smtp_from text, smtp_secure integer check (smtp_secure in (0,1)))`)
  old.run(`insert into integration_keys (id, turnstile_site_key) values (1, 'keep-me')`)
  old.run(`create table subscribers (
             id integer primary key autoincrement,
             email text not null unique,
             status text not null default 'pending',
             token text not null, created_at integer not null, confirmed_at integer)`)
  old.run(`insert into subscribers (email, status, token, created_at)
           values ('keep@example.com', 'confirmed', 'tok', 1)`)
  // The media table as it stood before the AI describer: no alt column.
  old.run(`create table media (
             path text primary key, filename text not null,
             size integer not null default 0, uploaded_at integer not null,
             width integer, height integer, thumb text,
             variants integer not null default 0, deleted_at integer)`)
  old.run(`insert into media (path, filename, size, uploaded_at) values ('media/old.webp', 'old.webp', 5, 1)`)
  // mcp_tokens as it stood before scopes: every token implicitly full.
  old.run(`create table mcp_tokens (
             id integer primary key autoincrement,
             name text not null default '', token_hash text not null unique,
             prefix text not null default '',
             created_at integer not null, expires_at integer not null, last_used_at integer)`)
  old.run(`insert into mcp_tokens (name, token_hash, prefix, created_at, expires_at)
           values ('Old connector', 'hash-1', 'vbmcp_abc', 1, 9999999999999)`)
  // posts and pages as they stood before the editor's server autosave: no side column for
  // the in-progress draft, so the work only ever existed in one browser's localStorage.
  old.run(`create table posts (
             slug text primary key, title text not null default '',
             date integer not null, status text not null default 'draft',
             featured_image text, excerpt text, reading_minutes integer,
             content text not null default '', series text,
             series_order integer not null default 0,
             meta_title text, meta_description text, cover_image text, broadcast_at integer,
             created_at integer not null, updated_at integer not null, deleted_at integer)`)
  old.run(`insert into posts (slug, title, date, content, created_at, updated_at)
           values ('kept-post', 'Kept', 1, 'body', 1, 1)`)
  old.run(`create table pages (
             slug text primary key, title text not null default '',
             status text not null default 'draft', featured_image text,
             content text not null default '',
             created_at integer not null, updated_at integer not null, deleted_at integer)`)
  old.run(`insert into pages (slug, title, content, created_at, updated_at)
           values ('kept-page', 'Kept', 'body', 1, 1)`)
  // The render cache as it stood when it held the bodies as well (before ADR 0062), with a
  // row in it. On the blogs this shipped to that table was HALF A GIGABYTE of renders no
  // reader could reach, and the upgrade is what has to take it away — an upgrade that leaves
  // it behind is an upgrade that did nothing about the thing it was written for.
  old.run(`create table render_cache (key text primary key, html text not null,
             created_at integer not null) without rowid`)
  old.run(`insert into render_cache (key, html, created_at) values ('old-body', '<p>x</p>', 1)`)
  old.close()

  const { db } = openDatabases(dir)
  expect(columns(db, 'integration_keys')).toContain('google_client_id')
  expect(columns(db, 'integration_keys')).toContain('google_client_secret')
  expect(applied(db)).toContain('001-google-comment-keys')
  expect(columns(db, 'subscribers')).toContain('deleted_at')
  expect(columns(db, 'subscribers')).toContain('confirm_sent_at')
  expect(columns(db, 'media')).toContain('alt')
  expect(columns(db, 'integration_keys')).toContain('ai_api_key')
  expect(columns(db, 'mcp_tokens')).toContain('scope')
  for (const table of ['posts', 'pages']) {
    expect(columns(db, table)).toContain('autosave_json')
    expect(columns(db, table)).toContain('autosave_at')
  }
  // The existing rows survive, which is the entire difference between a migration and a
  // reinstall.
  expect(db.query<{ turnstile_site_key: string }, []>(
    `select turnstile_site_key from integration_keys where id = 1`,
  ).get()!.turnstile_site_key).toBe('keep-me')
  expect(db.query<{ email: string; deleted_at: number | null }, []>(
    `select email, deleted_at from subscribers`,
  ).get()).toEqual({ email: 'keep@example.com', deleted_at: null })
  // A token minted before scopes existed is a FULL token, not a broken one.
  expect(db.query<{ scope: string }, []>(
    `select scope from mcp_tokens where name = 'Old connector'`,
  ).get()!.scope).toBe('full')

  // 019: the body cache is a table of its own, and the superseded renders are GONE rather
  // than merely unreachable. ⚠️ Both halves of that step are in one migration, so this also
  // asserts that a step of several statements runs all of them — the create alone would pass
  // every other test in this file while leaving the disk exactly as full as it was.
  expect(columns(db, 'body_cache')).toEqual(['slot', 'key', 'html', 'created_at'])
  expect(db.query<{ n: number }, []>(`select count(*) as n from render_cache`).get()!.n).toBe(0)

  // Booting the same database again must not try to add the columns a second time.
  expect(() => openDatabases(dir)).not.toThrow()
  closeDatabases()
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
})

/** Every `alter table X add column Y` a migrations file asks for, as pairs. */
const columnsAdded = (sql: string): { table: string; column: string }[] =>
  [...sql.matchAll(/alter\s+table\s+(\w+)\s+add\s+column\s+(\w+)/gi)]
    .map((m) => ({ table: m[1]!, column: m[2]! }))

test('a FRESH database already has every column a migration would add', () => {
  // ⚠️ THE ONE FAILURE THE FIXTURE ABOVE CANNOT SEE, and the one this file's own header
  // warns about: a schema change is TWO edits, and doing only the migration leaves a fresh
  // install without the column. It fails SILENTLY in that direction, because `applyMigrations`
  // records every step as applied on a fresh database without running it — so the column is
  // never added, nothing throws, and the install is simply missing it while every upgraded
  // instance has it.
  //
  // The test above asserts columns by name and is written by hand, so it only knows about the
  // ones somebody remembered to add to it. This one reads the migrations file, which means it
  // cannot go stale: a step added tomorrow is checked tomorrow.
  const fresh = `${DIR}-fresh`
  rmSync(fresh, { recursive: true, force: true })
  const { db, analyticsDb } = openDatabases(fresh)

  const missing: string[] = []
  for (const [file, handle, sql] of [
    ['quire.db', db, migrations],
    ['analytics.db', analyticsDb, analyticsMigrations],
  ] as const) {
    for (const { table, column } of columnsAdded(sql)) {
      if (!columns(handle, table).includes(column)) missing.push(`${file}: ${table}.${column}`)
    }
  }
  expect(missing).toEqual([])

  // A migrations file whose steps nothing reads would pass the line above in silence.
  expect(columnsAdded(migrations).length).toBeGreaterThan(5)
  // And the reader finds what it is looking for.
  expect(columnsAdded('alter table posts add column foo text;'))
    .toEqual([{ table: 'posts', column: 'foo' }])

  closeDatabases()
  try { rmSync(fresh, { recursive: true, force: true }) } catch { /* ignore */ }
})
