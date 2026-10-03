// A backup's rows, loaded into the running blog — only while it is still empty (ADR 0067 rule 4).
//
// "Empty" is checked against the database rather than a flag: no account, and nothing in any
// table but the few a fresh install fills by itself before anybody has done anything (below).
// Those are replaced by the archive's own rows, since they describe an install nobody has used;
// everything else must be empty, so nothing anybody wrote is ever overwritten. That keeps ADR
// 0035's reason standing: the application still cannot replace a database it already holds.
//
// Through the live connections and the `Connection` contract, so the same code loads a blog on
// Bun and in a Durable Object. Rows go in `LOAD_ROWS` at a time, each batch a transaction; a load
// that fails part-way empties every table it touched again, so the blog is left as it was found.
import type { Connection } from '@/runtime/ports'
import { analyticsDb, db, LEDGER, type Kind } from './db'
import { exportPlan, ident, ledgerNames, loadTable } from './rows'

const KINDS: readonly Kind[] = ['content', 'analytics']

/**
 * What a fresh install writes before anyone has claimed it, and so what an empty blog may hold:
 * the settings row a language pick on the setup screen makes, the salts minted on first use, the
 * activity and sessions of nobody, the update check, the replay guard, and readers visiting a
 * blog with nothing on it. The ledgers are not here: they are compared, never replaced.
 */
const FRESH_TABLES: ReadonlySet<string> = new Set([
  'settings', 'server_secrets', 'activity_log', 'sessions', 'update_check', 'mcp_used_codes',
  'render_cache', 'body_cache', 'analytics_events', 'analytics_scroll',
])

const live = (kind: Kind): Connection => (kind === 'content' ? db() : analyticsDb())

const count = (conn: Connection, table: string): number =>
  conn.one<{ n: number }>(`select count(*) as n from ${ident(table)}`)?.n ?? 0

/** The first table that holds something a person made, or null when the blog is empty. */
export function firstNonEmptyTable(): string | null {
  for (const kind of KINDS) {
    const conn = live(kind)
    for (const plan of exportPlan(conn)) {
      if (plan.name === LEDGER[kind] || FRESH_TABLES.has(plan.name)) continue
      if (count(conn, plan.name) > 0) return plan.name
    }
  }
  return null
}

/** The migrations each live database has recorded. */
export function liveLedgers(): Record<Kind, string[]> {
  return { content: ledgerNames(db(), LEDGER.content), analytics: ledgerNames(analyticsDb(), LEDGER.analytics) }
}

/** The live table's columns in order, or null when this blog has no such table. */
export function liveColumns(kind: Kind, table: string): string[] | null {
  const plan = exportPlan(live(kind)).find((p) => p.name === table)
  return plan ? plan.columns : null
}

export type LiveLoad = {
  /** Load one table's lines; the ledger is skipped (compared before the load began). */
  table: (kind: Kind, name: string, columns: string[], lines: AsyncIterable<Uint8Array>) => Promise<{ rows: number; sha256: string } | null>
  /** Foreign keys back on and checked. Throws if a row points at nothing. */
  finish: () => void
  /** Empty everything this load touched, and put foreign keys back on. */
  abort: () => void
}

/**
 * Begin a load. The tables a fresh install filled are emptied first, so the archive's rows take
 * their place; foreign keys stay off until `finish`, because tables arrive in name order and not
 * in the order their references need.
 */
export function beginLiveLoad(): LiveLoad {
  const touched: { kind: Kind; name: string }[] = []
  for (const kind of KINDS) {
    const conn = live(kind)
    conn.exec('pragma foreign_keys = OFF')
    conn.transaction(() => {
      for (const plan of exportPlan(conn)) {
        if (!FRESH_TABLES.has(plan.name)) continue
        conn.run(`delete from ${ident(plan.name)}`)
        touched.push({ kind, name: plan.name })
      }
    })
  }
  const emptyAll = (): void => {
    for (const kind of KINDS) {
      const conn = live(kind)
      const names = new Set(touched.filter((t) => t.kind === kind).map((t) => t.name))
      conn.transaction(() => { for (const name of names) conn.run(`delete from ${ident(name)}`) })
      conn.exec('pragma foreign_keys = ON')
    }
  }
  return {
    table: async (kind, name, columns, lines) => {
      if (name === LEDGER[kind]) return null
      touched.push({ kind, name })
      return loadTable(live(kind), name, columns, lines, { replace: true })
    },
    finish: () => {
      for (const kind of KINDS) {
        const conn = live(kind)
        conn.exec('pragma foreign_keys = ON')
        const broken = conn.all<{ table: string }>('pragma foreign_key_check')
        if (broken.length > 0) {
          emptyAll()
          throw new Error(`${broken.length} row(s) point at a row that is not there (first in ${broken[0]!.table})`)
        }
      }
    },
    abort: emptyAll,
  }
}
