// Bun: a `Connection` (`src/runtime/ports.ts`) over `bun:sqlite`, one file per database.
//
// `all`, `one` and `run` go through `query()`, which keeps each prepared statement for as long as
// the connection is open, keyed by its SQL text: the store's statements are literals, so each is
// compiled once per boot. `exec` goes through `exec()`, which does NOT keep it, and is for what runs
// once — a schema, a migration step, a `VACUUM INTO` whose SQL carries a fresh filename every time.
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Connection, DbPort, SqlParams } from '@/runtime/ports'

// Set on EVERY connection. WAL lets readers never block the writer; NORMAL is safe under
// WAL; foreign_keys is OFF by default in SQLite and has to be asked for.
//
// ⚠️ `cache_size` WAS -64000, AND 64 MB WAS THE ONE NUMBER HERE NOBODY HAD MEASURED. It is a
// ceiling per CONNECTION and there are two of them, so it promised 128 MB to a process this
// project also ships in a 128 MB container. Measured 2026-09-23 against a 314 MB database,
// 20,000 point lookups, three runs each, in `--memory=128m --cpus=0.5` with the file on
// native container storage:
//
//   -64000   +57.0 / +56.8 / +56.9 MB resident   181 / 189 / 188 ms
//   -16000   +43.1 / +43.0 / +43.3 MB            142 / 146 / 132 ms
//    -8000   +26.4 / +34.5 / +33.8 MB            142 /  81 / 104 ms
//    -2000   +27.4 / +27.5 / +27.5 MB            141 / 126 / 108 ms
//
// 64 MB WAS THE SLOWEST OF THE FOUR, in every run and by about 30%. That is not a paradox:
// inside a cgroup, SQLite's private cache and the kernel's page cache come out of the SAME
// 128 MB, so a big private cache buys a second copy of pages it has just pushed the kernel
// into dropping. On an unconstrained machine the four are indistinguishable (121 / 127 / 120 /
// 121 ms), so nothing is given up on a large box either.
//
// 16 MB rather than the 2 MB that measured just as well: WHAT WAS MEASURED IS POINT LOOKUPS
// BY PRIMARY KEY, and the request path also runs FTS search and taxonomy joins. Those are the shapes a page cache actually helps and none of
// them is in the number above, so the headroom stays until something measures them.
//
// It changes NOTHING for a blog whose database fits under the ceiling, which is every blog
// this project runs: after the 0062 migration the two largest are 11.2 MB and 4.6 MB, so the
// cache holds the whole file at either setting.
//
// A Durable Object refuses every one of these but `foreign_keys` (measured 2026-10-03), which is
// why they live on this side of the seam and not in the store.
const PRAGMAS = [
  'journal_mode = WAL',
  'busy_timeout = 5000',
  'foreign_keys = ON',
  'cache_size = -16000', // 16 MB page cache per connection, measured above
  'temp_store = MEMORY',
] as const

/** The `bun:sqlite` handle under each connection this file made. See `sqliteOf`. */
const handles = new WeakMap<Connection, Database>()

/**
 * A connection over a handle somebody already opened, with whatever PRAGMAs they chose. `open`
 * is the way in for the store; this is for a test that builds a database by hand.
 */
export function wrap(sqlite: Database): Connection {
  const conn: Connection = {
    all: <T>(sql: string, ...params: SqlParams): T[] => sqlite.query<T, SqlParams>(sql).all(...params),
    one: <T>(sql: string, ...params: SqlParams): T | null => sqlite.query<T, SqlParams>(sql).get(...params),
    run: (sql: string, ...params: SqlParams) => {
      const result = sqlite.query<unknown, SqlParams>(sql).run(...params)
      return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) }
    },
    exec: (script: string) => { sqlite.exec(script) },
    transaction: <T>(body: () => T): T => sqlite.transaction(body)(),
    close: () => sqlite.close(),
  }
  handles.set(conn, sqlite)
  return conn
}

/**
 * The `bun:sqlite` handle under a connection, for TESTS ONLY (`src/test/sqlite.ts`), which seed
 * and inspect rows with the raw driver. Nothing that ships may reach for it: there is no such
 * handle on Cloudflare, and `check:sql` fails a shipped file that tries.
 */
export function sqliteOf(conn: Connection): Database {
  const sqlite = handles.get(conn)
  if (!sqlite) throw new Error('sqliteOf: not a connection opened by src/runtime/bun/db.ts')
  return sqlite
}

export const open: DbPort['open'] = (path, synchronous) => {
  mkdirSync(dirname(path), { recursive: true })
  // `strict`: named parameters take bare keys (`{ slug }` for `$slug`), and a statement that
  // names a parameter nobody passed throws instead of binding NULL.
  const sqlite = new Database(path, { create: true, strict: true })
  for (const p of PRAGMAS) sqlite.run(`pragma ${p};`)
  // Content is worth an fsync per commit; analytics is not. Losing a day of pageviews is
  // an annoyance, losing a day of posts is a disaster.
  sqlite.run(`pragma synchronous = ${synchronous};`)
  return wrap(sqlite)
}
