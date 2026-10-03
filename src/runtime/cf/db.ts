// Cloudflare: the `Connection` contract over a Durable Object's SQLite (`ctx.storage.sql`). Both of
// the store's databases live in the object's one file — each keeps its own ledger and decides "is
// this new?" by its own tables (`store/db.ts`), so `path` is a name here and nothing more.
//
// What a Durable Object does differently, and how each is met (measured 2026-10-03, G0):
//   - it binds `?` only: one object of named values is turned into an ordered list (`namedOrder`);
//   - a boolean is bound as 1/0, a bigint as a number, a `Uint8Array` as its ArrayBuffer, and a blob
//     comes back as an ArrayBuffer, which is handed out as a `Uint8Array`;
//   - one statement per call: `exec` splits a script (`store/sql-split.ts`);
//   - no BEGIN or SAVEPOINT: `transactionSync`, which nests, an inner throw undoing only the inner part;
//   - no changes/last-insert-rowid on the cursor: one more `select` asks SQLite for them.
import type { Connection, DbPort, SqlParams, SqlValue } from '@/runtime/ports'
import { bound } from './bindings'
import { namedOrder, splitSql } from '@/store/sql-split'

type Bindable = string | number | null | ArrayBuffer

function toArg(v: SqlValue | undefined): Bindable {
  if (v === undefined || v === null) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'bigint') return Number(v)
  if (v instanceof Uint8Array) return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) as ArrayBuffer
  return v
}

function args(sql: string, params: SqlParams): Bindable[] {
  const first = params[0]
  if (params.length === 1 && first !== null && typeof first === 'object' && !(first instanceof Uint8Array)) {
    const named = first as Record<string, SqlValue>
    return namedOrder(sql).map((k) => toArg(named[k]))
  }
  return (params as SqlValue[]).map(toArg)
}

function row<T>(r: Record<string, SqlStorageValue>): T {
  const out: Record<string, unknown> = {}
  for (const k in r) {
    const v = r[k]
    out[k] = v instanceof ArrayBuffer ? new Uint8Array(v) : v
  }
  return out as T
}

export const open: DbPort['open'] = () => {
  const { ctx } = bound()
  const sql = ctx.storage.sql
  const exec = (q: string, params: SqlParams) => sql.exec(q, ...args(q, params))
  return {
    all: <T>(q: string, ...params: SqlParams): T[] => exec(q, params).toArray().map((r) => row<T>(r)),
    one: <T>(q: string, ...params: SqlParams): T | null => {
      const rows = exec(q, params).toArray()
      return rows.length ? row<T>(rows[0]!) : null
    },
    run: (q: string, ...params: SqlParams) => {
      exec(q, params)
      const r = sql.exec('select changes() as c, last_insert_rowid() as id').one() as { c: number; id: number }
      return { changes: r.c, lastInsertRowid: r.id }
    },
    exec: (script: string) => {
      for (const statement of splitSql(script)) sql.exec(statement)
    },
    transaction: <T>(body: () => T): T => ctx.storage.transactionSync(body),
    // The object owns its storage for its whole life; there is nothing to close.
    close: () => {},
  } satisfies Connection
}
