// The contract every `Connection` keeps (`src/runtime/ports.ts`), as cases any test runner can run.
//
// One suite, run against each runtime's `db.ts`: `src/runtime/bun/db.test.ts` hands it Bun's, and
// the Cloudflare side hands it a Durable Object's. A behaviour the store leans on and only one
// driver happens to have is how the second runtime would break on the first request that needs it,
// so each case here is something a call site in `src/` actually does.
//
// It imports no test runner: `bun:test` would not load under the Cloudflare one and the reverse.
// The caller passes its own `test`; a case fails by throwing.
import type { Connection } from '@/runtime/ports'

type Register = (name: string, body: () => void) => void

/** A comparable form: a blob becomes its bytes, so two equal blobs compare equal. */
const plain = (value: unknown): unknown => {
  if (value instanceof Uint8Array) return { blob: [...value] }
  if (Array.isArray(value)) return value.map(plain)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]))
  }
  return value
}

function same(actual: unknown, expected: unknown, what: string): void {
  const a = JSON.stringify(plain(actual))
  const e = JSON.stringify(plain(expected))
  if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`)
}

function throws(body: () => unknown, what: string): unknown {
  try {
    body()
  } catch (error) {
    return error
  }
  throw new Error(`${what}: expected a throw, and nothing threw`)
}

/** Every case, each against a connection of its own from `connect`, closed after. */
export function dbContract(test: Register, connect: () => Connection): void {
  const withConnection = (name: string, body: (conn: Connection) => void) =>
    test(name, () => {
      const conn = connect()
      try {
        body(conn)
      } finally {
        conn.close()
      }
    })

  withConnection('positional parameters bind in order, and `one` is null when no row matches', (conn) => {
    conn.exec('create table t (id integer primary key, name text, n integer)')
    conn.run('insert into t (name, n) values (?, ?)', 'a', 1)
    conn.run('insert into t (name, n) values (?, ?)', 'b', 2)
    same(conn.all('select name, n from t where n >= ? order by n', 1), [{ name: 'a', n: 1 }, { name: 'b', n: 2 }], 'all')
    same(conn.one('select name from t where n = ?', 2), { name: 'b' }, 'one')
    same(conn.one('select name from t where n = ?', 3), null, 'one, no row')
    same(conn.all('select name from t where n = ?', 3), [], 'all, no row')
  })

  withConnection('named parameters take bare keys, and one name may appear twice', (conn) => {
    conn.exec('create table t (slug text primary key, title text, body text)')
    conn.run('insert into t (slug, title, body) values ($slug, $title, $title)', { slug: 's', title: 'T' })
    same(conn.one('select title, body from t where slug = $slug', { slug: 's' }), { title: 'T', body: 'T' }, 'named')
  })

  withConnection('a boolean, a bigint, null and a blob go in and come back', (conn) => {
    conn.exec('create table t (b integer, f integer, big integer, z text, blob blob, s text, x real)')
    conn.run('insert into t values (?, ?, ?, ?, ?, ?, ?)',
      true, false, 9007199254740991n, null, new Uint8Array([0, 1, 255]), 'Lập trình ✓', 1.5)
    const row = conn.one<{ blob: unknown }>('select * from t')
    same(row, { b: 1, f: 0, big: 9007199254740991, z: null, blob: new Uint8Array([0, 1, 255]), s: 'Lập trình ✓', x: 1.5 }, 'round trip')
    if (!(row?.blob instanceof Uint8Array)) throw new Error('round trip: a blob must come back as a Uint8Array')
  })

  // `analytics/chunked.ts` cuts a window into visitor ranges whose last one ends at an empty
  // blob. That covers every visitor only because SQLite orders every TEXT before every BLOB, and
  // only if the blob reaches SQLite as a blob — which on a Durable Object means an ArrayBuffer.
  withConnection('an empty blob is an upper bound above every text, through an index', (conn) => {
    conn.exec('create table t (v text not null); create index t_v on t (v)')
    for (const v of ['', '0', 'ffff', 'zzz', '~', 'ÿ', '\u{10FFFF}']) conn.run('insert into t values (?)', v)
    same(conn.one('select count(*) as n from t where v >= $lo and v < $hi', { lo: '', hi: new Uint8Array(0) }), { n: 7 }, 'all of them')
    same(conn.one('select count(*) as n from t where v >= $lo and v < $hi', { lo: 'ffff', hi: new Uint8Array(0) }), { n: 5 }, 'the top range')
  })

  withConnection('`run` reports the rows it changed and the rowid it inserted', (conn) => {
    conn.exec('create table t (id integer primary key, n integer)')
    same(conn.run('insert into t (n) values (?)', 1), { changes: 1, lastInsertRowid: 1 }, 'first insert')
    same(conn.run('insert into t (id, n) values (?, ?)', 40, 1), { changes: 1, lastInsertRowid: 40 }, 'explicit id')
    same(conn.run('update t set n = ? where n = ?', 2, 1).changes, 2, 'update')
    same(conn.run('delete from t where n = ?', 9).changes, 0, 'delete of nothing')
  })

  withConnection('a transaction returns what its body returns, and a throw undoes all of it', (conn) => {
    conn.exec('create table t (n integer)')
    same(conn.transaction(() => { conn.run('insert into t values (?)', 1); return 'kept' }), 'kept', 'return value')
    const boom = new Error('boom')
    const thrown = throws(() => conn.transaction(() => {
      conn.run('insert into t values (?)', 2)
      conn.run('insert into t values (?)', 3)
      throw boom
    }), 'throwing body')
    if (thrown !== boom) throw new Error('a transaction must rethrow the body\'s own error')
    same(conn.all('select n from t order by n'), [{ n: 1 }], 'after rollback')
  })

  withConnection('a nested transaction that throws undoes only itself when the outer one catches', (conn) => {
    conn.exec('create table t (n integer)')
    conn.transaction(() => {
      conn.run('insert into t values (?)', 1)
      throws(() => conn.transaction(() => { conn.run('insert into t values (?)', 2); throw new Error('inner') }), 'inner')
      conn.run('insert into t values (?)', 3)
    })
    same(conn.all('select n from t order by n'), [{ n: 1 }, { n: 3 }], 'inner rolled back')
    throws(() => conn.transaction(() => {
      conn.transaction(() => { conn.run('insert into t values (?)', 4) })
      throw new Error('outer')
    }), 'outer')
    same(conn.all('select n from t order by n'), [{ n: 1 }, { n: 3 }], 'outer rolled back, inner with it')
  })

  withConnection('`exec` runs a script of several statements, a trigger body included', (conn) => {
    conn.exec(`
      create table t (id integer primary key, n integer);
      create table log (id integer, what text);
      create trigger t_ai after insert on t begin
        insert into log (id, what) values (new.id, 'added');
        insert into log (id, what) values (new.id, 'twice');
      end;
      insert into t (n) values (7);
    `)
    same(conn.all('select id, what from log order by what'), [{ id: 1, what: 'added' }, { id: 1, what: 'twice' }], 'trigger fired')
  })

  withConnection('FTS5 folds diacritics with `remove_diacritics 2`', (conn) => {
    conn.exec(`create virtual table f using fts5(title, tokenize = "unicode61 remove_diacritics 2")`)
    conn.run('insert into f (rowid, title) values (?, ?)', 1, 'Lập trình hằng ngày')
    conn.run('insert into f (rowid, title) values (?, ?)', 2, 'Chuyện khác')
    same(conn.all('select rowid as id from f where f match ?', '"lap trinh"'), [{ id: 1 }], 'folded match')
  })
}
