// Boot-level guard: the schema applies, the shapes SQLite is picky about actually work,
// and the two data-corruption paths 01-schema.md calls out are closed.
import { expect, test, afterAll } from 'bun:test'
import { rmSync } from 'node:fs'
import { Database } from 'bun:sqlite'
import { wrap } from '@/runtime/bun/db'
import { openSqlite } from '@/test/sqlite'
import { openDatabases, closeDatabases, liveOnly, isEmpty, renameAnalyticsLedger } from './db'

const DIR = './.tmp/test-db'
rmSync(DIR, { recursive: true, force: true })
let { db, analyticsDb } = openSqlite(DIR)

afterAll(() => {
  closeDatabases()
  // Best-effort: Windows can hold the WAL/SHM files a beat after close, and this is test
  // hygiene rather than a behaviour under test.
  try { rmSync(DIR, { recursive: true, force: true }) } catch { /* ignore */ }
})

const names = (d: Database, type = 'table') =>
  d.query<{ name: string }, []>(`select name from sqlite_master where type='${type}' order by name`)
    .all().map((r) => r.name)

test('content schema creates every table', () => {
  const t = names(db)
  for (const want of ['posts', 'pages', 'post_terms', 'comments', 'settings', 'redirects',
    'render_cache', 'users', 'sessions', 'recovery_codes', 'mcp_tokens', 'subscribers']) {
    expect(t).toContain(want)
  }
})

test('analytics schema is a SEPARATE file, not the content one', () => {
  const t = names(analyticsDb)
  expect(t).toContain('analytics_events')
  expect(t).not.toContain('posts')
  expect(names(db)).not.toContain('analytics_events')
})

test('each database keeps its own ledger, under its own name', () => {
  expect(names(db)).toContain('schema_migrations')
  expect(names(analyticsDb)).toContain('analytics_schema_migrations')
  expect(names(analyticsDb)).not.toContain('schema_migrations')
})

// ADR 0066: on Cloudflare both databases share one file, beside a table the platform makes.
test('a table that is not ours does not make a new database look old', () => {
  const d = new Database(':memory:')
  d.run('create table _cf_KV (key text primary key, value blob)')
  d.run('create table __miniflare_do_name (name text)')
  expect(isEmpty(wrap(d), 'content')).toBe(true)
  expect(isEmpty(wrap(d), 'analytics')).toBe(true)
  d.run('create table posts (id integer)')
  expect(isEmpty(wrap(d), 'content')).toBe(false)
  expect(isEmpty(wrap(d), 'analytics')).toBe(true) // the content tables are not analytics' own
  d.run('create table analytics_events (id integer)')
  expect(isEmpty(wrap(d), 'analytics')).toBe(false)
  d.close()
})

// ADR 0066: on Cloudflare one file holds both databases, and there `schema_migrations` is CONTENT's.
test('a shared file keeps the content ledger under its own name', () => {
  const d = new Database(':memory:')
  d.run('create table schema_migrations (name text primary key, applied_at integer not null)')
  d.run('create table posts (id integer)')
  d.run("insert into schema_migrations values ('001-content', 1)")
  renameAnalyticsLedger(wrap(d))
  const tables = d.query<{ name: string }, []>("select name from sqlite_master where type = 'table'").all().map((r) => r.name)
  expect(tables).toContain('schema_migrations')
  expect(tables).not.toContain('analytics_schema_migrations')
  d.close()
})

test('an analytics.db with the old ledger name keeps every row under the new one', () => {
  const dir = './.tmp/test-db-ledger'
  rmSync(dir, { recursive: true, force: true })
  openDatabases(dir)
  closeDatabases()
  const file = new Database(`${dir}/analytics.db`)
  const before = file.query<{ n: number }, []>('select count(*) as n from analytics_schema_migrations').get()!.n
  file.run('alter table analytics_schema_migrations rename to schema_migrations') // as every install before 2026-10-03 has it
  file.close()
  const reopened = openSqlite(dir)
  const after = reopened.analyticsDb.query<{ n: number }, []>('select count(*) as n from analytics_schema_migrations').get()!.n
  expect(after).toBe(before)
  expect(names(reopened.analyticsDb)).not.toContain('schema_migrations')
  closeDatabases()
  rmSync(dir, { recursive: true, force: true })
  ;({ db, analyticsDb } = openSqlite(DIR))
})

test('applying the schema twice is a no-op, and does not leak the first handles', () => {
  expect(() => { ({ db, analyticsDb } = openSqlite(DIR)) }).not.toThrow()
  expect(names(db)).toContain('posts')
})

test('FTS5 folds diacritics, so "lap trinh" finds "lập trình" (parity exception 2)', () => {
  const t = Date.now()
  db.run(`insert into posts (slug,title,content,date,created_at,updated_at,status)
          values ('a','Lập trình hằng ngày','viết blog mười năm',?,?,?,'published')`, [t, t, t])
  const hit = db.query<{ slug: string }, [string]>(
    `select p.slug from posts_fts f join posts p on p.rowid = f.rowid where posts_fts match ?`
  ).all(`"lap trinh"`)
  expect(hit.map((r) => r.slug)).toEqual(['a'])
})

test('the FTS index follows an update and a delete', () => {
  const find = (q: string) =>
    db.query<{ n: number }, [string]>(`select count(*) n from posts_fts where posts_fts match ?`).get(q)!.n
  db.run(`update posts set title = 'Chuyện khác' where slug = 'a'`)
  expect(find(`"lap trinh"`)).toBe(0)
  expect(find(`"chuyen khac"`)).toBe(1)
  db.run(`delete from posts where slug = 'a'`)
  expect(find(`"chuyen khac"`)).toBe(0)
})

test('comment ids are never reused, so orphaned replies cannot re-parent', () => {
  const t = Date.now()
  const add = () => db.query<{ id: number }, []>(
    `insert into comments (post_slug,content,created_at) values ('p','x',${t}) returning id`).get()!.id
  const first = add()
  db.run(`delete from comments where id = ?`, [first])
  expect(add()).toBeGreaterThan(first)
})

test('post_terms cascade with their post, so a purge leaves no orphan term', () => {
  const t = Date.now()
  db.run(`insert into posts (slug,title,content,date,created_at,updated_at) values ('b','B','',?,?,?)`, [t, t, t])
  db.run(`insert into post_terms values ('b','category','Ghi chép')`)
  expect(db.query<{ n: number }, []>(`select count(*) n from post_terms`).get()!.n).toBe(1)
  db.run(`delete from posts where slug = 'b'`)
  expect(db.query<{ n: number }, []>(`select count(*) n from post_terms`).get()!.n).toBe(0)
})

test('liveOnly is one predicate, used by every live read (Invariant 6)', () => {
  expect(liveOnly('posts')).toBe('posts.deleted_at is null')
})

// The migration path is not the install path: a fresh database RECORDS every step without
// running it, so `002-pages-fts` only ever executes against a database that already holds
// somebody's pages — which is every live instance and none of the other tests. It is also
// the first migration with more than one statement AND a backfill, so what is proved here is
// that the runner executes all five and that the index is not left empty behind them.
test('002-pages-fts runs against an EXISTING database, and backfills the pages already in it', () => {
  const t = Date.now()
  db.run(`insert into pages (slug,title,content,created_at,updated_at) values ('gioi-thieu','Giới thiệu','một chỗ để viết',?,?)`, [t, t])

  // Rewind this database to before the migration: drop what schema.sql created and forget
  // the ledger row, which is exactly the shape an instance running 2.0.3 has on disk.
  for (const trigger of ['pages_fts_ai', 'pages_fts_ad', 'pages_fts_au']) db.run(`drop trigger if exists ${trigger}`)
  db.run(`drop table if exists pages_fts`)
  db.run(`delete from schema_migrations where name = '002-pages-fts'`)
  expect(names(db)).not.toContain('pages_fts')

  ;({ db, analyticsDb } = openSqlite(DIR))

  expect(names(db)).toContain('pages_fts')
  const found = db.query<{ slug: string }, [string]>(
    `select g.slug from pages_fts f join pages g on g.rowid = f.rowid where pages_fts match ?`,
  ).all(`"gioi thieu"`)
  expect(found.map((r) => r.slug)).toEqual(['gioi-thieu'])

  // And the triggers came back with it: a page saved after the migration is findable too.
  db.run(`insert into pages (slug,title,content,created_at,updated_at) values ('lien-he','Liên hệ','thư từ gửi về đây',?,?)`, [t, t])
  const after = db.query<{ n: number }, [string]>(`select count(*) n from pages_fts where pages_fts match ?`).get(`"thu tu"`)!.n
  expect(after).toBe(1)
})
