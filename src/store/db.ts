// The two SQLite connections, their PRAGMAs, and schema application at boot.
//
// `bun:sqlite` is SYNCHRONOUS and the runtime is single-threaded, so there is exactly one
// writer by construction: a statement cannot interleave with another request. No pool, no
// mutex, no SQLITE_BUSY retry loop. That is the largest simplification 2.0 gets over the
// Go design, which had to build all three.
//
// The cost to respect: a slow query blocks every request. Keep the request path indexed,
// and run anything unbounded (the analytics dashboard, a backup export) against
// `analytics.db` or off the request path entirely.
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Imported as text so both files compile into the standalone executable. A schema the
// binary cannot find is a boot failure on a machine that has no repository checkout.
import contentSchema from './schema.sql' with { type: 'text' }
import analyticsSchema from './schema-analytics.sql' with { type: 'text' }
import contentMigrations from './migrations.sql' with { type: 'text' }
import analyticsMigrations from './migrations-analytics.sql' with { type: 'text' }

export type Db = Database

// Set on EVERY connection. WAL lets readers never block the writer; NORMAL is safe under
// WAL; foreign_keys is OFF by default in SQLite and has to be asked for.
const PRAGMAS = [
  'journal_mode = WAL',
  'busy_timeout = 5000',
  'foreign_keys = ON',
  'cache_size = -64000', // 64 MB page cache
  'temp_store = MEMORY',
] as const

let content: Database | null = null
let analytics: Database | null = null

function open(
  path: string, schema: string, synchronous: 'FULL' | 'NORMAL',
): { db: Database; fresh: boolean } {
  const db = new Database(path, { create: true, strict: true })
  for (const p of PRAGMAS) db.run(`pragma ${p};`)
  // Content is worth an fsync per commit; analytics is not. Losing a day of pageviews is
  // an annoyance, losing a day of posts is a disaster.
  db.run(`pragma synchronous = ${synchronous};`)
  // Whether this file already held tables decides what migrations mean for it, and the
  // only moment that is knowable is BEFORE the schema is applied.
  const fresh = isEmpty(db)
  db.transaction(() => db.run(schema))()
  return { db, fresh }
}

/** No tables at all — a database this process is about to create rather than open. */
function isEmpty(db: Database): boolean {
  const row = db.query<{ n: number }, []>(
    `select count(*) as n from sqlite_master where type = 'table' and name not like 'sqlite_%'`,
  ).get()
  return (row?.n ?? 0) === 0
}

type Migration = { name: string; sql: string }

/**
 * Split `migrations.sql` on its `-- migration: <name>` headers.
 *
 * Exported for the test, which is the only way to prove the parser agrees with the file:
 * a step whose header is malformed would otherwise be silently folded into the one before
 * it and never run on its own.
 */
export function parseMigrations(source: string): Migration[] {
  const steps: Migration[] = []
  for (const line of source.split('\n')) {
    const header = /^--\s*migration:\s*(\S+)\s*$/.exec(line)
    if (header) steps.push({ name: header[1]!, sql: '' })
    else if (steps.length) steps[steps.length - 1]!.sql += `${line}\n`
  }
  return steps.filter((s) => s.sql.trim().length > 0)
}

/**
 * Bring an existing database up to the shape `schema.sql` already states.
 *
 * `fresh` is the whole subtlety. A database built from `schema.sql` a moment ago is ALREADY
 * at the final shape, so its migrations are recorded as applied without being run — running
 * them would fail on a duplicate column. An existing database runs the ones it has not seen.
 * Each step is its own transaction, so a failure leaves the steps before it applied and the
 * ledger honest about where it stopped.
 */
function applyMigrations(db: Database, source: string, fresh: boolean): void {
  const applied = new Set(
    db.query<{ name: string }, []>(`select name from schema_migrations`).all().map((r) => r.name),
  )
  const record = db.query<never, [string, number]>(
    `insert or ignore into schema_migrations (name, applied_at) values (?, ?)`,
  )
  for (const step of parseMigrations(source)) {
    if (applied.has(step.name)) continue
    db.transaction(() => {
      if (!fresh) db.run(step.sql)
      record.run(step.name, Date.now())
    })()
  }
}

/**
 * Open both databases under `dir`, applying each schema inside a transaction. Idempotent:
 * every statement in the schema files is `if not exists`, so a second call against an
 * existing database is a no-op rather than an error.
 */
export function openDatabases(dir: string): { db: Database; analyticsDb: Database } {
  // Close any prior pair first. Without this a second call leaks the first pair's file
  // handles, which on Windows makes the files undeletable and on Linux leaks descriptors
  // silently until something runs out. Found by the boot test, which calls this twice on
  // purpose to prove the schema is idempotent.
  closeDatabases()
  mkdirSync(dir, { recursive: true })
  const opened = open(join(dir, 'quire.db'), contentSchema, 'FULL')
  content = opened.db
  applyMigrations(content, contentMigrations, opened.fresh)
  const openedAnalytics = open(join(dir, 'analytics.db'), analyticsSchema, 'NORMAL')
  analytics = openedAnalytics.db
  // Analytics has its own ledger and its own steps. It went without one until 2026-08-29,
  // which was fine while the table never changed shape and stopped being fine the moment
  // it did: `if not exists` cannot add a column to a table that already exists.
  applyMigrations(analytics, analyticsMigrations, openedAnalytics.fresh)
  // Only `analytics_totals` (the Views column on the admin content tables) needs to join
  // across the two files. ATTACH once here rather than per query.
  content.run(`attach database ? as analytics;`, [join(dir, 'analytics.db')])
  return { db: content, analyticsDb: analytics }
}

export function db(): Database {
  if (!content) throw new Error('db() before openDatabases(): call it once at boot')
  return content
}

export function analyticsDb(): Database {
  if (!analytics) throw new Error('analyticsDb() before openDatabases(): call it once at boot')
  return analytics
}

export function closeDatabases(): void {
  content?.close()
  analytics?.close()
  content = analytics = null
}

/**
 * Invariant 6: every delete is a soft delete, and EVERY live read filters trashed rows.
 * The predicate is defined ONCE, here, so a new query cannot quietly disagree with the
 * rest of the codebase. Trash reads the complement.
 *
 * Usage: `select ... from posts where ${liveOnly('posts')} and ...`
 */
export function liveOnly(table: string): string {
  return `${table}.deleted_at is null`
}

/**
 * Timestamps are INTEGER milliseconds since epoch, UTC, everywhere. This exists so no call
 * site invents its own convention, and so a search for "Date.now()" in the data layer finds
 * nothing. A `toDate` counterpart sat here unused: nothing in the data layer wants a Date
 * object, because the timezone logic lives in TypeScript and takes the integer.
 */
export const nowMs = (): number => Date.now()

/**
 * The public types (`Post.date`, `MediaItem.uploadedAt`, ...) carry ISO 8601 strings and
 * keep doing so: they cross into JSON payloads and templates unchanged. Only the storage
 * representation changed, so the conversion belongs here and at no call site.
 *
 * `fromIso` throws rather than yielding NaN. Postgres rejected an unparseable timestamp;
 * SQLite would happily bind NaN and store a wrong number, turning a loud failure into a
 * post dated 1970.
 */
export const toIso = (ms: number): string => new Date(ms).toISOString()

export function fromIso(iso: string): number {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) throw new Error(`fromIso: unparseable timestamp ${JSON.stringify(iso)}`)
  return ms
}
