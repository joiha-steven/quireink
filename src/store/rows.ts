// A database as rows: what the backup archive carries, and how it is put back (ADR 0067).
//
// The archive held `VACUUM INTO` copies of the two database files. A Durable Object refuses
// `VACUUM` and has no file to copy, so the archive now carries, per database, the SQL that
// recreates its shape (`schema.sql`) and one JSON Lines stream per table, a JSON array per row in
// a fixed column order. Everything here goes through the `Connection` contract, so the same code
// writes and reads it on both runtimes.
//
// THE TABLES ARE READ FROM THE DATABASE, never listed by hand. `restore-check.ts` once counted 14
// of 29 tables from a list somebody had to remember to extend; a table added next year is in the
// archive next year by being in `sqlite_master`.
//
// ⚠️ IDENTIFIERS FROM `sqlite_master` ARE INTERPOLATED, which is the one form CLAUDE.md allows: a
// table or column name is a fixed identifier of this database's own schema, never a value and
// never a request's. Each is still checked against a plain identifier shape and double-quoted,
// so a name that is anything else stops the dump instead of reaching a statement.
import { createHash } from 'node:crypto'
import type { Connection, SqlValue } from '@/runtime/ports'

/** Rebuilt on demand from the Markdown beside them (ADR 0062), so their rows are not carried. */
export const SKIPPED_TABLES: readonly string[] = ['render_cache', 'body_cache']

/**
 * Rows per read. Measured on 200,000 analytics events (2026-10-03), the whole archive built:
 * 50, 100 and 250 rows came to +41, +41 and +44 MB of resident memory, 100 at two thirds of the
 * time 50 took. What a page costs is the allocator's high-water mark, not the page itself.
 */
export const PAGE_ROWS = 100

/**
 * Rows per insert transaction when loading. Larger than a page: each commit of `quire.db` waits
 * for the disk (`synchronous = FULL`), and a thousand rows decoded at once is still small.
 */
export const LOAD_ROWS = 1000

export type TablePlan = {
  name: string
  /** In table order; the JSON array of each row follows it. */
  columns: string[]
  /** The order rows are read in: `rowid`, or a WITHOUT ROWID table's primary key. */
  order: string[]
}

type MasterRow = { type: string; name: string; tbl_name: string; sql: string | null }

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
export function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`rows: refusing an identifier that is not a plain name: ${JSON.stringify(name)}`)
  return `"${name}"`
}

/**
 * Which database a table belongs to: analytics' tables are all named `analytics_…`, content's never
 * are. On Bun each database is a file of its own and this changes nothing. In a Durable Object both
 * share ONE file (2026-10-03): without it every table was listed for both, so an archive carried
 * each one twice and a brand-new blog looked occupied — the content pass found analytics' ledger.
 * An index or a trigger goes with the table it is on (`tbl_name`).
 */
export type RowsKind = 'content' | 'analytics'
export const tableKind = (name: string): RowsKind => (/^analytics_/.test(name) ? 'analytics' : 'content')

/** Not ours: SQLite's own, a Durable Object's `_cf_*`, and the local emulator's (see `db.ts`). */
const foreign = (name: string): boolean => /^(sqlite_|_cf_|__miniflare)/i.test(name)
const isVirtual = (sql: string | null): boolean => /^create\s+virtual\s+table/i.test(sql ?? '')
const withoutRowid = (sql: string | null): boolean => /\)\s*without\s+rowid\s*;?\s*$/i.test(sql ?? '')

/** `kind` keeps one database's rows when two share the file; left out, everything. */
function master(conn: Connection, kind?: RowsKind): MasterRow[] {
  const rows = conn.all<MasterRow>('select type, name, tbl_name, sql from sqlite_master order by name')
  return kind ? rows.filter((r) => tableKind(r.tbl_name) === kind) : rows
}

/** The shadow tables FTS5 makes for a virtual table, which recreating the table recreates. */
function shadows(rows: MasterRow[]): Set<string> {
  const out = new Set<string>()
  for (const r of rows) {
    if (r.type !== 'table' || !isVirtual(r.sql)) continue
    for (const suffix of ['data', 'idx', 'content', 'docsize', 'config']) out.add(`${r.name}_${suffix}`)
  }
  return out
}

/**
 * The SQL that recreates this database's shape, in an order that runs: tables, then virtual
 * tables, then indexes, then triggers and views (a trigger names the tables it fires on).
 * SQLite stores each statement with `IF NOT EXISTS` already removed, so this builds a file
 * from nothing and refuses to build over one.
 */
export function schemaScript(conn: Connection, kind?: RowsKind): string {
  const rows = master(conn, kind).filter((r) => r.sql !== null && !foreign(r.name))
  const shadow = shadows(rows)
  const rank = (r: MasterRow): number =>
    r.type === 'table' ? (isVirtual(r.sql) ? 1 : 0) : r.type === 'index' ? 2 : 3
  return rows
    .filter((r) => !shadow.has(r.name))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .map((r) => `${r.sql!.trim()};\n`)
    .join('')
}

/** Every table whose rows the archive carries, sorted by name. */
export function exportPlan(conn: Connection, kind?: RowsKind): TablePlan[] {
  const rows = master(conn, kind)
  const shadow = shadows(rows)
  return rows
    .filter((r) => r.type === 'table' && !foreign(r.name) && !isVirtual(r.sql) && !shadow.has(r.name))
    .filter((r) => !SKIPPED_TABLES.includes(r.name))
    .map((r) => planFor(conn, r.name, withoutRowid(r.sql)))
}

export function planFor(conn: Connection, name: string, noRowid: boolean): TablePlan {
  // `pragma_table_info` as a table-valued function takes the name BOUND, not interpolated.
  const info = conn.all<{ name: string; pk: number }>('select name, pk from pragma_table_info(?) order by cid', name)
  const columns = info.map((c) => c.name)
  for (const c of columns) ident(c)
  ident(name)
  const order = noRowid
    ? info.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name)
    : ['rowid']
  return { name, columns, order }
}

/** One row as it is written: blobs as `{"$b64": …}`, everything else as JSON has it. */
const encodeValue = (v: unknown): unknown =>
  v instanceof Uint8Array ? { $b64: Buffer.from(v).toString('base64') } : typeof v === 'bigint' ? Number(v) : v

/** The reverse, for the insert. */
export function decodeValue(v: unknown): SqlValue {
  if (v !== null && typeof v === 'object' && typeof (v as { $b64?: unknown }).$b64 === 'string') {
    return new Uint8Array(Buffer.from((v as { $b64: string }).$b64, 'base64'))
  }
  if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  throw new Error(`rows: a value that is not a column value: ${JSON.stringify(v)}`)
}

const enc = new TextEncoder()

/**
 * A table's rows as JSON Lines, a page at a time, in `plan.order`. Keyset paging rather than
 * OFFSET, so the cost of a page does not grow with how far into the table it is, and nothing but
 * one page is ever held — the point of the format, on a runtime with 128 MB.
 */
export function* tablePages(conn: Connection, plan: TablePlan, pageRows = PAGE_ROWS): Generator<{ bytes: Uint8Array; rows: number }> {
  const cols = plan.columns.map(ident).join(', ')
  const keys = plan.order.map((k) => (k === 'rowid' ? 'rowid' : ident(k)))
  const keyList = keys.join(', ')
  const keyAlias = keys.map((k, i) => `${k} as "__k${i}"`).join(', ')
  const from = `select ${keyAlias}, ${cols} from ${ident(plan.name)}`
  const tuple = keys.length === 1 ? keys[0] : `(${keyList})`
  const marks = keys.length === 1 ? '?' : `(${keys.map(() => '?').join(', ')})`
  let last: SqlValue[] | null = null
  for (;;) {
    const page: Record<string, unknown>[] = last === null
      ? conn.all<Record<string, unknown>>(`${from} order by ${keyList} limit ?`, pageRows)
      : conn.all<Record<string, unknown>>(`${from} where ${tuple} > ${marks} order by ${keyList} limit ?`, ...last, pageRows)
    if (page.length === 0) return
    let text = ''
    for (const row of page) text += `${JSON.stringify(plan.columns.map((c) => encodeValue(row[c])))}\n`
    yield { bytes: enc.encode(text), rows: page.length }
    if (page.length < pageRows) return
    const tail = page[page.length - 1]!
    last = keys.map((_, i) => tail[`__k${i}`] as SqlValue)
  }
}

export type TableDigest = { name: string; columns: string[]; rows: number; bytes: number; sha256: string }

/** What a table's JSON Lines come to: rows, bytes and their SHA-256, without keeping any of it. */
export function digestTable(conn: Connection, plan: TablePlan): TableDigest {
  const hash = createHash('sha256')
  let rows = 0
  let bytes = 0
  for (const page of tablePages(conn, plan)) {
    hash.update(page.bytes)
    rows += page.rows
    bytes += page.bytes.length
  }
  return { name: plan.name, columns: plan.columns, rows, bytes, sha256: hash.digest('hex') }
}

/** The migration names a ledger records, sorted. Empty when there is no such table. */
export function ledgerNames(conn: Connection, table: string): string[] {
  const has = conn.one('select 1 as x from sqlite_master where type = ? and name = ?', 'table', table)
  if (!has) return []
  return conn.all<{ name: string }>(`select name from ${ident(table)} order by name`).map((r) => r.name)
}

/**
 * Put JSON Lines back into `table`, `LOAD_ROWS` rows per transaction, and hash the exact bytes
 * as they pass so a damaged archive is caught by the same SHA-256 that described it. Each batch
 * is synchronous, as `transaction` requires; the bytes in between arrive as they arrive.
 *
 * Batches and not one transaction: a single one would have to hold every row of the table in
 * memory before it could begin, which is the thing this format exists not to do.
 *
 * `replace` is for a load into a RUNNING blog, which goes on serving between batches: a reader's
 * pageview flushed mid-load, or a salt minted on a request, can take a key the archive also has,
 * and the archive's row is the one that stays.
 */
export async function loadTable(
  conn: Connection, table: string, columns: string[], lines: AsyncIterable<Uint8Array>,
  opts: { replace?: boolean } = {},
): Promise<{ rows: number; sha256: string }> {
  const insert = `insert ${opts.replace ? 'or replace ' : ''}into ${ident(table)} (${columns.map(ident).join(', ')}) values (${columns.map(() => '?').join(', ')})`
  const hash = createHash('sha256')
  const decoder = new TextDecoder()
  let carry = ''
  let batch: SqlValue[][] = []
  let rows = 0
  const flush = (): void => {
    if (batch.length === 0) return
    const these = batch
    conn.transaction(() => { for (const values of these) conn.run(insert, ...values) })
    rows += these.length
    batch = []
  }
  const take = (line: string): void => {
    if (line === '') return
    const parsed: unknown = JSON.parse(line)
    if (!Array.isArray(parsed) || parsed.length !== columns.length) {
      throw new Error(`rows: a line of ${table} does not have its ${columns.length} columns`)
    }
    batch.push(parsed.map(decodeValue))
    if (batch.length >= LOAD_ROWS) flush()
  }
  for await (const chunk of lines) {
    hash.update(chunk)
    const text = carry + decoder.decode(chunk, { stream: true })
    const parts = text.split('\n')
    carry = parts.pop() ?? ''
    for (const line of parts) take(line)
  }
  take(carry + decoder.decode())
  flush()
  return { rows, sha256: hash.digest('hex') }
}
