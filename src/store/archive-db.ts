// The two databases as the backup archive carries them (ADR 0067): a schema and one JSON Lines
// stream per table each, described in the manifest before a row of them is written.
//
// Here and not in `server/archive.ts`, because this is the part that holds the connections, and
// outside `src/store/` nothing does (`check:sql`, rule 3). The archive asks for entries; it never
// sees a connection.
import { createHash } from 'node:crypto'
import { consistentCopy } from '@/runtime/impl/snapshot'
import type { Connection } from '@/runtime/ports'
import { join } from 'node:path'
import { analyticsDb, dataDir, db, LEDGER, type Kind } from './db'
import { exportPlan, ledgerNames, schemaScript, tablePages, type TableDigest, type TablePlan } from './rows'

export const KINDS: readonly Kind[] = ['content', 'analytics']

/** What the manifest says of one database. */
export type DatabaseSection = {
  /** The migration names its ledger records: the shape these rows were written against. */
  ledger: string[]
  tables: Omit<TableDigest, 'bytes'>[]
}

/** A file inside the archive: a name, its exact size, and its bytes as they are made. */
export type ArchivePart = { name: string; size: number; body: Uint8Array | AsyncIterable<Uint8Array> }

export type ArchiveSource = {
  sections: Record<Kind, DatabaseSection>
  /** Both databases' files in archive order. Read it once. */
  parts: () => AsyncGenerator<ArchivePart>
  dispose: () => void
}

const enc = new TextEncoder()

/** Hand the event loop back now and then, so a long read does not stall every request with it. */
const breathe = (): Promise<void> => new Promise((done) => setTimeout(done, 0))

async function digest(conn: Connection, plan: TablePlan): Promise<TableDigest> {
  const hash = createHash('sha256')
  let rows = 0
  let bytes = 0
  let pages = 0
  for (const page of tablePages(conn, plan)) {
    hash.update(page.bytes)
    rows += page.rows
    bytes += page.bytes.length
    if (++pages % 20 === 0) await breathe()
  }
  return { name: plan.name, columns: plan.columns, rows, bytes, sha256: hash.digest('hex') }
}

/**
 * A table's bytes, read a second time and checked against the first. Two passes because a tar
 * header states a size before its bytes and the manifest states every table before any of them,
 * and holding a table to learn its size is what this format exists not to do. On Bun both passes
 * read inside one read transaction, which cannot change between them; anywhere the rows could, a
 * difference is an error rather than an archive whose manifest describes some other set of rows.
 */
async function* replay(conn: Connection, plan: TablePlan, expected: TableDigest): AsyncGenerator<Uint8Array> {
  const hash = createHash('sha256')
  let pages = 0
  for (const page of tablePages(conn, plan)) {
    hash.update(page.bytes)
    yield page.bytes
    if (++pages % 20 === 0) await breathe()
  }
  if (hash.digest('hex') !== expected.sha256) {
    throw new Error(`archive: ${plan.name} changed while it was being written; take the backup again`)
  }
}

/**
 * Open both databases for the archive: a consistent view of each where the runtime makes one
 * (`SnapshotPort.consistentCopy`), then one pass over every table to describe it. Call `dispose`
 * when the rows are written, or the archive failed.
 */
export async function openArchiveSource(): Promise<ArchiveSource> {
  const live: Record<Kind, Connection> = { content: db(), analytics: analyticsDb() }
  const copies: { dispose: () => void }[] = []
  const conns = {} as Record<Kind, Connection>
  const plans = {} as Record<Kind, { plan: TablePlan; digest: TableDigest }[]>
  const sections = {} as Record<Kind, DatabaseSection>
  try {
    for (const kind of KINDS) {
      const copy = consistentCopy(live[kind], join(dataDir(), kind === 'content' ? 'quire.db' : 'analytics.db'))
      if (copy) copies.push(copy)
      conns[kind] = copy?.conn ?? live[kind]
      const described = []
      for (const plan of exportPlan(conns[kind])) described.push({ plan, digest: await digest(conns[kind], plan) })
      plans[kind] = described
      sections[kind] = {
        ledger: ledgerNames(conns[kind], LEDGER[kind]),
        tables: described.map(({ digest: d }) => ({ name: d.name, columns: d.columns, rows: d.rows, sha256: d.sha256 })),
      }
    }
  } catch (error) {
    for (const c of copies) c.dispose()
    throw error
  }
  return {
    sections,
    parts: async function* () {
      for (const kind of KINDS) {
        const schema = enc.encode(schemaScript(conns[kind]))
        yield { name: `${kind}/schema.sql`, size: schema.length, body: schema }
        for (const { plan, digest: d } of plans[kind]) {
          yield { name: `${kind}/${plan.name}.jsonl`, size: d.bytes, body: replay(conns[kind], plan, d) }
        }
      }
    },
    // Twice is harmless: the archive ends the read as soon as the rows are written, and again on
    // its way out in case it never got that far.
    dispose: () => { for (const c of copies) c.dispose() },
  }
}
