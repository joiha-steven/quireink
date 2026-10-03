// A database as rows and back, without the archive around it: the part with a format.
//
// Every shape the schema has is here on purpose — a rowid table, a WITHOUT ROWID table keyed on
// two columns, a blob, a NULL, a full-text index filled by triggers — because each is a different
// way for a row to come back other than it went in.
import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { open } from '@/runtime/bun/db'
import type { Connection } from '@/runtime/ports'
import { digestTable, exportPlan, ledgerNames, loadTable, planFor, schemaScript, tablePages } from '@/store/rows'

const DIR = './.tmp/test-rows'
rmSync(DIR, { recursive: true, force: true })
mkdirSync(DIR, { recursive: true })
afterAll(() => rmSync(DIR, { recursive: true, force: true }))

const SCHEMA = `
create table ledger (name text primary key, applied_at integer not null);
create table posts (id integer primary key, slug text not null unique, title text, body text, cover blob, score real);
create table terms (slug text not null, term text not null, primary key (slug, term)) without rowid;
create table plain (a text, b integer);
create table render_cache (key text primary key, html text) without rowid;
create virtual table posts_fts using fts5(title, body, content='posts', content_rowid='id');
create trigger posts_fts_ai after insert on posts begin
  insert into posts_fts(rowid, title, body) values (new.id, new.title, new.body);
end;
create index posts_title_idx on posts (title);
`

function seeded(name: string, rows = 1234): Connection {
  const conn = open(join(DIR, name), 'NORMAL')
  conn.exec(SCHEMA)
  conn.transaction(() => {
    conn.run(`insert into ledger values ('001-a', 1), ('002-b', 2)`)
    for (let i = 1; i <= rows; i++) {
      conn.run('insert into posts (id, slug, title, body, cover, score) values (?, ?, ?, ?, ?, ?)',
        i * 3, `post-${i}`, i % 7 === 0 ? null : `Tiêu đề ${i}`, `body "${i}"\nline two`,
        i % 5 === 0 ? new Uint8Array([0, 255, i % 256]) : null, i / 4)
      conn.run('insert into terms values (?, ?), (?, ?)', `post-${i}`, 'b', `post-${i}`, 'a')
    }
    conn.run(`insert into plain values ('x', 1), ('y', null), ('x', 1)`)
    conn.run(`insert into render_cache values ('k', '<p>derived</p>')`)
  })
  return conn
}

const lines = async function* (conn: Connection, table: string): AsyncGenerator<Uint8Array> {
  const plan = exportPlan(conn).find((p) => p.name === table)!
  for (const page of tablePages(conn, plan)) {
    // Split across chunk edges in awkward places, the way a stream hands them over.
    for (let at = 0; at < page.bytes.length; at += 777) yield page.bytes.subarray(at, at + 777)
  }
}

describe('the export plan', () => {
  const conn = seeded('plan.db', 3)
  it('carries every table but the caches and the full-text shadows, and reads WITHOUT ROWID by its key', () => {
    const plans = exportPlan(conn)
    expect(plans.map((p) => p.name)).toEqual(['ledger', 'plain', 'posts', 'terms'])
    expect(plans.find((p) => p.name === 'terms')!.order).toEqual(['slug', 'term'])
    expect(plans.find((p) => p.name === 'posts')!.order).toEqual(['rowid'])
    expect(ledgerNames(conn, 'ledger')).toEqual(['001-a', '002-b'])
    expect(ledgerNames(conn, 'nope')).toEqual([])
  })

  it('writes a schema that builds the same shape in an empty file, triggers last', () => {
    const script = schemaScript(conn)
    expect(script).not.toContain('posts_fts_data')
    expect(script.indexOf('CREATE TRIGGER')).toBeGreaterThan(script.indexOf('CREATE VIRTUAL TABLE'))
    const fresh = open(join(DIR, 'fresh.db'), 'NORMAL')
    fresh.exec(script)
    expect(schemaScript(fresh)).toBe(script)
    fresh.close()
  })

  it('refuses a name it would have to quote its way around', () => {
    expect(() => planFor(conn, 'x"; drop table posts; --', false)).toThrow('plain name')
  })
})

describe('rows out and back', () => {
  it('pages a table by its key and gets every row exactly once', () => {
    const conn = seeded('pages.db', 1234)
    const plan = exportPlan(conn).find((p) => p.name === 'terms')!
    let rows = 0
    for (const page of tablePages(conn, plan, 100)) rows += page.rows
    expect(rows).toBe(2468)
    expect(digestTable(conn, plan).rows).toBe(2468)
  })

  it('restores identical rows, the same digest, and a full-text index the triggers filled', async () => {
    const from = seeded('from.db')
    const to = open(join(DIR, 'to.db'), 'NORMAL')
    to.exec(schemaScript(from))
    for (const plan of exportPlan(from)) {
      const want = digestTable(from, plan)
      const got = await loadTable(to, plan.name, plan.columns, lines(from, plan.name))
      expect(got).toEqual({ rows: want.rows, sha256: want.sha256 })
      // Dumped again from the restored file, byte for byte the same.
      expect(digestTable(to, planFor(to, plan.name, plan.order[0] !== 'rowid')).sha256).toBe(want.sha256)
    }
    const blob = to.one<{ cover: Uint8Array }>('select cover from posts where id = ?', 15)!
    expect([...blob.cover]).toEqual([0, 255, 5])
    expect(to.one<{ n: number }>(`select count(*) as n from posts_fts where posts_fts match 'Tiêu'`)!.n).toBeGreaterThan(1000)
    expect(to.one<{ n: number }>('select count(*) as n from render_cache')!.n).toBe(0)
  })

  it('refuses a line that has the wrong number of columns', async () => {
    const to = open(join(DIR, 'bad.db'), 'NORMAL')
    to.exec('create table t (a, b)')
    const bad = (async function* () { yield new TextEncoder().encode('[1,2]\n[1]\n') })()
    await expect(loadTable(to, 't', ['a', 'b'], bad)).rejects.toThrow('2 columns')
  })
})

describe('two databases in one file, as in a Durable Object', () => {
  // ⚠️ Found 2026-10-03 loading a backup into a brand-new blog on `wrangler dev`: both databases
  // share one SQLite file there, every table was listed for both, and the content pass found
  // analytics' ledger and called the blog occupied. Each pass must see its own tables only.
  const conn = seeded('shared.db', 2)
  conn.exec(`create table analytics_schema_migrations (name text primary key, applied_at integer not null);
    create table analytics_events (id integer primary key, path text not null);
    create index analytics_events_path on analytics_events (path);
    insert into analytics_schema_migrations values ('a001', 1);`)

  it('lists each table under its own database, and everything when no database is named', () => {
    expect(exportPlan(conn, 'content').map((p) => p.name)).toEqual(['ledger', 'plain', 'posts', 'terms'])
    expect(exportPlan(conn, 'analytics').map((p) => p.name)).toEqual(['analytics_events', 'analytics_schema_migrations'])
    expect(exportPlan(conn).length).toBe(6)
  })

  it('writes each database the shape of its own tables, indexes and triggers', () => {
    const content = schemaScript(conn, 'content')
    const analytics = schemaScript(conn, 'analytics')
    expect(content).toContain('posts_fts_ai')
    expect(content).not.toContain('analytics_')
    expect(analytics).toContain('analytics_events_path')
    expect(analytics).not.toContain('posts')
  })
})
