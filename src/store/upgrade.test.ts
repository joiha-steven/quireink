// An upgrade copies before it changes, and gives the space back after (ADR 0063).
import { expect, test, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { openDatabases, closeDatabases } from './db'
import { compactIfMostlyFree, copyBeforeMigrating } from './upgrade'

const DIR = './.tmp/test-upgrade'

afterEach(() => {
  closeDatabases()
  try { rmSync(DIR, { recursive: true, force: true }) } catch { /* ignore */ }
})

/**
 * A database as it stands one release BEFORE this one: everything the product ships, minus
 * the step this release adds.
 *
 * Built by making a current one and winding it back, rather than by hand. A hand-written
 * fixture has to carry the OLD shape of every table any migration alters — `migrations.test.ts`
 * does exactly that, and its header explains what it costs — and none of that detail is what
 * this file is about. What this file needs is a database that EXISTS and has one step pending.
 */
function aDatabaseOneReleaseBehind(): string {
  rmSync(DIR, { recursive: true, force: true })
  openDatabases(DIR)
  closeDatabases()
  const wound = new Database(join(DIR, 'quire.db'))
  wound.run(`insert into posts (slug, title, date, content, created_at, updated_at)
             values ('kept', 'Kept', 1, 'the words', 1, 1)`)
  wound.run(`delete from schema_migrations where name = '019-body-cache'`)
  wound.run(`drop table body_cache`)
  wound.close()
  rmSync(join(DIR, 'backups'), { recursive: true, force: true })
  return join(DIR, 'backups')
}

const copies = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).filter((n) => n.startsWith('pre-')).sort() : []

test('an existing database is copied before a migration touches it', () => {
  const backups = aDatabaseOneReleaseBehind()
  openDatabases(DIR)
  const made = copies(backups)
  expect(made).toHaveLength(1)
  // Named for the step it was taken ahead of, so the file says what it is a copy of.
  expect(made[0]).toMatch(/^pre-\d{3}-[a-z0-9-]+-\d{8}T\d{6}-quire\.db$/)

  // And it is a database holding what the operator had, not an empty file.
  const copy = new Database(join(backups, made[0]!), { readonly: true })
  expect(copy.query(`select content from posts where slug = 'kept'`).get())
    .toEqual({ content: 'the words' })
  // The copy is of BEFORE: the tables this release adds are not in it.
  expect(copy.query(`select count(*) as n from sqlite_master where name = 'body_cache'`).get())
    .toEqual({ n: 0 })
  copy.close()
})

test('a fresh install copies nothing, having nothing to protect', () => {
  rmSync(DIR, { recursive: true, force: true })
  openDatabases(DIR)
  expect(copies(join(DIR, 'backups'))).toHaveLength(0)
})

test('a database with nothing pending is not copied again on every boot', () => {
  aDatabaseOneReleaseBehind()
  openDatabases(DIR)
  closeDatabases()
  expect(copies(join(DIR, 'backups'))).toHaveLength(1)
  openDatabases(DIR)
  expect(copies(join(DIR, 'backups'))).toHaveLength(1)
})

test('two copies are kept, and the older ones go', () => {
  const backups = aDatabaseOneReleaseBehind()
  const db = new Database(join(DIR, 'quire.db'))
  for (const step of ['001-one', '002-two', '003-three']) {
    copyBeforeMigrating(db, join(DIR, 'quire.db'), step)
    // mtime is the ordering, and three copies inside one millisecond would tie.
    Bun.sleepSync(5)
  }
  const kept = copies(backups)
  expect(kept).toHaveLength(2)
  expect(kept.some((n) => n.includes('003-three'))).toBe(true)
  expect(kept.some((n) => n.includes('001-one'))).toBe(false)
  db.close()
})

// ⚠️ THE PROMISE THIS FEATURE IS: not that the copy usually works, but that a migration does
// not run without one.
test('a copy that cannot be written stops the boot, and the migration does not run', () => {
  aDatabaseOneReleaseBehind()
  // A FILE where the directory has to go: mkdir fails, so the copy fails, on every platform
  // and without depending on what a test process is allowed to chmod.
  writeFileSync(join(DIR, 'backups'), 'not a directory')
  expect(() => openDatabases(DIR)).toThrow(/pre-upgrade copy/)

  rmSync(join(DIR, 'backups'), { force: true })
  const after = new Database(join(DIR, 'quire.db'), { readonly: true })
  // The step did NOT run: the table it creates is still absent and the ledger still does not
  // claim it. And the words are where they were.
  expect(after.query(`select count(*) as n from sqlite_master where name = 'body_cache'`).get())
    .toEqual({ n: 0 })
  expect(after.query(`select count(*) as n from schema_migrations where name = '019-body-cache'`).get())
    .toEqual({ n: 0 })
  expect(after.query(`select content from posts where slug = 'kept'`).get())
    .toEqual({ content: 'the words' })
  after.close()
})

test('a file left mostly empty is compacted, and keeps every row', () => {
  rmSync(DIR, { recursive: true, force: true })
  mkdirSync(DIR, { recursive: true })
  const path = join(DIR, 'plain.db')
  const db = new Database(path, { create: true })
  db.run(`pragma journal_mode = WAL`)
  db.run(`create table t (id integer primary key, blob text)`)
  const insert = db.prepare(`insert into t (blob) values (?)`)
  db.transaction(() => { for (let i = 0; i < 4000; i++) insert.run('x'.repeat(900)) })()
  db.run(`delete from t where id > 10`)
  db.run(`pragma wal_checkpoint(TRUNCATE)`)
  const before = statSync(path).size

  expect(compactIfMostlyFree(db, path, { minShare: 0.25, minBytes: 1 })).toBe(true)
  expect(statSync(path).size).toBeLessThan(before / 2)
  // No temporary left behind, and the rows that were alive still are.
  expect(existsSync(`${path}.compacting`)).toBe(false)
  const reopened = new Database(path, { readonly: true })
  expect(reopened.query(`select count(*) as n from t`).get()).toEqual({ n: 10 })
  expect(reopened.query(`pragma integrity_check`).get()).toEqual({ integrity_check: 'ok' })
  reopened.close()
})

test('a file that is merely in use is left alone', () => {
  rmSync(DIR, { recursive: true, force: true })
  mkdirSync(DIR, { recursive: true })
  const path = join(DIR, 'busy.db')
  const db = new Database(path, { create: true })
  db.run(`create table t (id integer primary key)`)
  db.run(`insert into t (id) values (1)`)
  // The real thresholds: a small blog with a few free pages must not be rewritten at boot.
  expect(compactIfMostlyFree(db, path)).toBe(false)
  expect(db.query(`select count(*) as n from t`).get()).toEqual({ n: 1 })
  db.close()
})

// ⚠️ FOUND IN THE RELEASE REVIEW OF 2026-09-23: `VACUUM INTO` copies every table, and on a blog
// one release behind the render cache WAS most of the file. A 154 MB database migrated to 426 KB
// beside a 154 MB copy of before — the space the upgrade handed back sat in `data/backups/`, and
// a disk without room for a second whole database refused the boot.
test('the copy of before carries the writing, not the cache', () => {
  const backups = aDatabaseOneReleaseBehind()
  const wound = new Database(join(DIR, 'quire.db'))
  const blob = 'x'.repeat(64 * 1024)
  const put = wound.prepare('insert into render_cache (key, html, created_at) values (?, ?, 1)')
  for (let i = 0; i < 160; i++) put.run(`h${i}`, blob)
  wound.close()
  expect(statSync(join(DIR, 'quire.db')).size).toBeGreaterThan(10 * 1024 * 1024)

  openDatabases(DIR)
  closeDatabases()
  const [made] = copies(backups)
  expect(made).toBeDefined()
  const copy = join(backups, made!)
  expect(statSync(copy).size).toBeLessThan(2 * 1024 * 1024)
  const kept = new Database(copy, { readonly: true })
  expect(kept.query("select title from posts where slug = 'kept'").get()).toEqual({ title: 'Kept' })
  kept.close()
})
