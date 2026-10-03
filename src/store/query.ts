// Three primitives over `bun:sqlite`, so a data-layer module reads as SQL plus a mapper
// rather than as statement plumbing.
//
// This is deliberately NOT a query builder. The frozen tree used PostgREST's builder and
// the chains grew hard to read the moment a query stopped being trivial; a literal with
// bound parameters says exactly what runs. The hard rule in CLAUDE.md ("no SQL string
// building") is enforceable precisely because nothing here concatenates.
//
// Everything is synchronous, because `bun:sqlite` is. Modules that expose these keep
// their `async` signatures: their callers already await them, and changing that would
// turn a data-layer port into an edit of every route and component.
import type { SQLQueryBindings } from 'bun:sqlite'
import { db, analyticsDb, type Db } from './db'

type Primitives = {
  /**
   * Rows for a query. Pass parameters positionally (`?`), or pass ONE object for named
   * parameters (`$name` in the SQL, bare keys in the object, since the connection is
   * opened `strict: true`) — which is what the wide inserts use, where counting seventeen
   * question marks is how a column ends up in the wrong place.
   */
  all: <T>(sql: string, ...params: SQLQueryBindings[]) => T[]
  /** First row, or null. The `.maybeSingle()` of the frozen tree. */
  one: <T>(sql: string, ...params: SQLQueryBindings[]) => T | null
  /** A write. `changes` is the affected row count, which several call sites report. */
  run: (sql: string, ...params: SQLQueryBindings[]) => { changes: number }
  /**
   * A script, with NO bound parameters: for the one statement SQLite gives no bound form,
   * `VACUUM INTO` a filename (`server/backup.ts`, which says why its path may be quoted).
   * Everything else goes through `run`.
   */
  exec: (script: string) => void
  /**
   * Run `body` in one transaction. There is exactly one writer (single-threaded runtime,
   * synchronous driver), so this is about atomicity, not locking: a multi-statement write
   * either lands whole or not at all.
   *
   * `body` must be synchronous. An async body would commit at the first await, before its
   * own later statements run, which is the failure mode this exists to prevent.
   */
  tx: <T>(body: () => T) => T
}

// `get` is a function, not a Database: the connections are opened at boot and replaced
// wholesale by the tests, so capturing one here would pin a closed handle.
function bind(get: () => Db): Primitives {
  return {
    all: <T>(sql: string, ...params: SQLQueryBindings[]): T[] =>
      get().query<T, SQLQueryBindings[]>(sql).all(...params),
    one: <T>(sql: string, ...params: SQLQueryBindings[]): T | null =>
      get().query<T, SQLQueryBindings[]>(sql).get(...params),
    run: (sql: string, ...params: SQLQueryBindings[]) => {
      // Via `query().run()` rather than `db().run()`: the latter types its rest parameter
      // as an array OF binding arrays, which no spread of plain values satisfies.
      const result = get().query<unknown, SQLQueryBindings[]>(sql).run(...params)
      return { changes: result.changes }
    },
    exec: (script: string) => { get().exec(script) },
    tx: <T>(body: () => T): T => get().transaction(body)(),
  }
}

export const { all, one, run, exec, tx } = bind(db)

/**
 * The same primitives against `analytics.db`. It is a SEPARATE connection on purpose: a
 * pageview must not queue behind a post save, and the two files carry different
 * `synchronous` settings because losing a day of analytics is an annoyance and losing a
 * day of posts is a disaster.
 */
export const analyticsQuery = bind(analyticsDb)
