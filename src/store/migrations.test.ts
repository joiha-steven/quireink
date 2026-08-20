// Migrations exist for exactly one situation that no other test can reach: a database
// created BEFORE a column existed. So this file builds one by hand and boots against it.
import { expect, test, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { openDatabases, closeDatabases, parseMigrations } from './db'
import migrations from './migrations.sql' with { type: 'text' }

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
  const old = new Database(join(dir, 'quire.db'), { create: true })
  old.run(`create table integration_keys (
             id integer primary key check (id = 1),
             turnstile_site_key text, turnstile_secret_key text,
             cloudflare_api_token text, cloudflare_zone_id text)`)
  old.run(`insert into integration_keys (id, turnstile_site_key) values (1, 'keep-me')`)
  old.run(`create table subscribers (
             id integer primary key autoincrement,
             email text not null unique,
             status text not null default 'pending',
             token text not null, created_at integer not null, confirmed_at integer)`)
  old.run(`insert into subscribers (email, status, token, created_at)
           values ('keep@example.com', 'confirmed', 'tok', 1)`)
  old.close()

  const { db } = openDatabases(dir)
  expect(columns(db, 'integration_keys')).toContain('google_client_id')
  expect(columns(db, 'integration_keys')).toContain('google_client_secret')
  expect(applied(db)).toContain('001-google-comment-keys')
  expect(columns(db, 'subscribers')).toContain('deleted_at')
  expect(columns(db, 'subscribers')).toContain('confirm_sent_at')
  // The existing rows survive, which is the entire difference between a migration and a
  // reinstall.
  expect(db.query<{ turnstile_site_key: string }, []>(
    `select turnstile_site_key from integration_keys where id = 1`,
  ).get()!.turnstile_site_key).toBe('keep-me')
  expect(db.query<{ email: string; deleted_at: number | null }, []>(
    `select email, deleted_at from subscribers`,
  ).get()).toEqual({ email: 'keep@example.com', deleted_at: null })

  // Booting the same database again must not try to add the columns a second time.
  expect(() => openDatabases(dir)).not.toThrow()
  closeDatabases()
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
})
