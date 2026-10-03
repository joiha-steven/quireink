// Walking a `quire-rows/1` archive, entry by entry, for whoever is putting it back (ADR 0067).
//
// Two callers put an archive back and they differ in WHERE the rows go: `scripts/restore.ts`
// builds two new database files from the archive's own schema, and the first setup screen loads
// into the running blog's empty tables. What they share is everything else — the order, which
// entry is which, and the rule that every table's rows must hash to what the manifest says before
// anybody calls the restore done — and that is here, once. The caller supplies the three verbs;
// this module never holds a connection or a path.
import { ArchiveFault, textOf } from '@/server/archive-open'
import type { Manifest } from '@/server/archive'
import type { TarItem } from '@/server/tar'
import type { Kind } from '@/store/db'
import { splitSql } from '@/store/sql-split'

export type TableEntry = Manifest['databases'][Kind]['tables'][number]

export type RowsTarget = {
  /** The SQL that recreates one database's shape. A target loading into tables that exist ignores it. */
  schema: (kind: Kind, sql: string) => void | Promise<void>
  /**
   * Put one table's JSON Lines somewhere and say what arrived, or null when this target skips the
   * table — it must still read `lines` to the end, or not at all.
   */
  table: (kind: Kind, entry: TableEntry, lines: AsyncIterable<Uint8Array>) => Promise<{ rows: number; sha256: string } | null>
  /** One file of the blob store, `pathname` relative to it and already checked for `..`. */
  upload: (pathname: string, size: number, body: AsyncIterable<Uint8Array>) => Promise<void>
}

export type RowsReport = { tables: { kind: Kind; name: string; rows: number }[]; uploads: number; bytes: number }

const KINDS: readonly Kind[] = ['content', 'analytics']

/**
 * A blob-store path as the archive names it, refused if it could land anywhere but inside the
 * store: the archive may have come from anywhere, and a `../` in a tar is the oldest trick there is.
 */
export function uploadPath(name: string): string | null {
  if (!name.startsWith('uploads/')) return null
  const path = name.slice('uploads/'.length)
  if (path === '' || path.startsWith('/') || path.split('/').some((p) => p === '..' || p === '.' || p === '')) {
    throw new ArchiveFault(`unsafe-path: ${name}`)
  }
  return path
}

/**
 * A statement that only builds a shape: a table, an index, a trigger, a view, or an fts5 index.
 * `temp` falls outside it, which is the point — a temporary table is not part of any schema.
 */
const SHAPE = /^create\s+(?:(?:unique\s+)?index|table|trigger|view|virtual\s+table\s+(?:if\s+not\s+exists\s+)?(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|\w+)\s+using\s+fts5\b)/i

/**
 * The archive's `schema.sql`, refused unless every statement in it is a `SHAPE`.
 *
 * ⚠️ `scripts/restore.ts` RUNS THIS TEXT, and the archive may have come from anywhere. What this
 * code writes is `sqlite_master`'s own `CREATE …` lines and nothing else, so anything else in the
 * file was put there by somebody: an `ATTACH` makes a database file at any path the restoring user
 * can write — which is root's, under `docker exec` — and a `PRAGMA` changes how the rows that
 * follow are checked. The setup screen ignores the schema (it loads into this release's own), so
 * this matters to the command line; it runs for both, so a bad archive fails the same way in each.
 */
export function checkedSchema(sql: string): string {
  for (const statement of splitSql(sql)) {
    const head = statement.replace(/^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, '')
    if (!SHAPE.test(head)) throw new ArchiveFault(`bad-schema: ${head.slice(0, 60).replace(/\s+/g, ' ')}`)
  }
  return sql
}

/** Everything after the manifest, in order, into `target`. Throws on the first thing that is wrong. */
export async function readRows(items: AsyncGenerator<TarItem>, manifest: Manifest, target: RowsTarget): Promise<RowsReport> {
  const report: RowsReport = { tables: [], uploads: 0, bytes: 0 }
  const expected = new Map<string, TableEntry>()
  for (const kind of KINDS) for (const t of manifest.databases[kind].tables) expected.set(`${kind}/${t.name}.jsonl`, t)
  const seenSchema = new Set<Kind>()
  for await (const item of items) {
    const name = item.name.replace(/^\.\//, '')
    if (item.kind === 'dir') continue
    const kind = KINDS.find((k) => name.startsWith(`${k}/`))
    if (kind && name === `${kind}/schema.sql`) {
      await target.schema(kind, checkedSchema(await textOf(item)))
      seenSchema.add(kind)
      continue
    }
    const table = expected.get(name)
    if (kind && table) {
      if (!seenSchema.has(kind)) throw new ArchiveFault(`out-of-order: ${name} before ${kind}/schema.sql`)
      const got = await target.table(kind, table, item.body())
      expected.delete(name)
      if (got === null) continue
      if (got.rows !== table.rows || got.sha256 !== table.sha256) {
        throw new ArchiveFault(`mismatch: ${name} came back as ${got.rows} rows, the manifest says ${table.rows}`
          + (got.rows === table.rows ? ' with different bytes' : ''))
      }
      report.tables.push({ kind, name: table.name, rows: got.rows })
      continue
    }
    const path = uploadPath(name)
    if (path !== null && item.kind === 'file') {
      await target.upload(path, item.size, item.body())
      report.uploads++
      report.bytes += item.size
      continue
    }
    throw new ArchiveFault(`unexpected-entry: ${name}`)
  }
  // A table the manifest promised and the archive never delivered is a truncated archive, and
  // this is the only place that can tell.
  if (expected.size > 0) throw new ArchiveFault(`truncated: ${[...expected.keys()][0]} is missing`)
  return report
}
