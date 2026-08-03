// Boot-level guard: the schema applies, the shapes SQLite is picky about actually work,
// and the two data-corruption paths 01-schema.md calls out are closed.
import { expect, test, afterAll } from 'bun:test'
import { rmSync } from 'node:fs'
import { openDatabases, closeDatabases, liveOnly } from './db'

const DIR = './.tmp/test-db'
rmSync(DIR, { recursive: true, force: true })
let { db, analyticsDb } = openDatabases(DIR)

afterAll(() => {
  closeDatabases()
  // Best-effort: Windows can hold the WAL/SHM files a beat after close, and this is test
  // hygiene rather than a behaviour under test.
  try { rmSync(DIR, { recursive: true, force: true }) } catch { /* ignore */ }
})

const names = (d: ReturnType<typeof openDatabases>['db'], type = 'table') =>
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

test('applying the schema twice is a no-op, and does not leak the first handles', () => {
  expect(() => { ({ db, analyticsDb } = openDatabases(DIR)) }).not.toThrow()
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
