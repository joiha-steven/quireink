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
    for (const plan of exportPlan(conn, kind)) {
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
  const plan = exportPlan(live(kind), kind).find((p) => p.name === table)
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

/** The tables a table's foreign keys point at, read from its own `create table` statement. */
function parentsOf(conn: Connection, table: string): string[] {
  const sql = conn.one<{ sql: string | null }>(`select sql from sqlite_master where type = 'table' and name = ?`, table)?.sql ?? ''
  return [...sql.matchAll(/\breferences\s+"?(\w+)"?/gi)].map((m) => m[1]!).filter((t) => t !== table)
}

const STAGE = (name: string) => `__load_${name}`

/**
 * Begin a load. The tables a fresh install filled are emptied first, so the archive's rows take
 * their place.
 *
 * ⚠️ A TABLE WITH FOREIGN KEYS IS LOADED INTO A STAGING COPY, then moved in `finish`. Tables arrive
 * in name order — `post_terms` before `posts`, `recovery_codes` before `users` — and the plan was to
 * switch foreign keys off for the load. A Durable Object accepts `pragma foreign_keys = OFF` and
 * ignores it (measured in workerd 2026-10-03: the pragma still reads 1 and a child row before its
 * parent is refused), so a blog with one tag could not be restored on Cloudflare. A staging table
 * (`create table … as select … where 0`: the columns, no constraints) takes the rows in any order;
 * `finish` copies them over once every parent is in, which is the same on both runtimes.
 */
export function beginLiveLoad(): LiveLoad {
  const touched: { kind: Kind; name: string }[] = []
  const staged: { kind: Kind; name: string; columns: string[] }[] = []
  for (const kind of KINDS) {
    const conn = live(kind)
    conn.transaction(() => {
      for (const plan of exportPlan(conn, kind)) {
        if (!FRESH_TABLES.has(plan.name)) continue
        conn.run(`delete from ${ident(plan.name)}`)
        touched.push({ kind, name: plan.name })
      }
    })
  }
  const dropStaged = (): void => {
    for (const st of staged.splice(0)) live(st.kind).exec(`drop table if exists ${ident(STAGE(st.name))}`)
  }
  const emptyAll = (): void => {
    dropStaged()
    for (const kind of KINDS) {
      const conn = live(kind)
      const names = new Set(touched.filter((t) => t.kind === kind).map((t) => t.name))
      // Children first, so emptying a parent never trips a reference on the way.
      const order = [...names].sort((a, b) => parentsOf(conn, b).length - parentsOf(conn, a).length)
      conn.transaction(() => { for (const name of order) conn.run(`delete from ${ident(name)}`) })
    }
  }
  return {
    table: async (kind, name, columns, lines) => {
      if (name === LEDGER[kind]) return null
      touched.push({ kind, name })
      const conn = live(kind)
      if (parentsOf(conn, name).length === 0) return loadTable(conn, name, columns, lines, { replace: true })
      conn.exec(`drop table if exists ${ident(STAGE(name))}; create table ${ident(STAGE(name))} as select ${columns.map(ident).join(', ')} from ${ident(name)} where 0`)
      staged.push({ kind, name, columns })
      return loadTable(conn, STAGE(name), columns, lines, { replace: false })
    },
    finish: () => {
      // Every parent is in now; the staged children follow, each in one transaction.
      for (const st of staged) {
        const conn = live(st.kind)
        const cols = st.columns.map(ident).join(', ')
        conn.transaction(() => conn.run(`insert or replace into ${ident(st.name)} (${cols}) select ${cols} from ${ident(STAGE(st.name))}`))
      }
      dropStaged()
      for (const kind of KINDS) {
        const conn = live(kind)
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
