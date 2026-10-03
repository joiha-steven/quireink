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
import { dirname, join } from 'node:path'
import { compactIfMostlyFree, copyBeforeMigrating } from './upgrade'

// Imported as text so both files compile into the standalone executable. A schema the
// binary cannot find is a boot failure on a machine that has no repository checkout.
import contentSchema from './schema.sql' with { type: 'text' }
import analyticsSchema from './schema-analytics.sql' with { type: 'text' }
import contentMigrations from './migrations.sql' with { type: 'text' }
import analyticsMigrations from './migrations-analytics.sql' with { type: 'text' }

export type Db = Database

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
const PRAGMAS = [
  'journal_mode = WAL',
  'busy_timeout = 5000',
  'foreign_keys = ON',
  'cache_size = -16000', // 16 MB page cache per connection, measured above
  'temp_store = MEMORY',
] as const

let content: Database | null = null
let analytics: Database | null = null
/** Where the content database lives, for exactly as long as `content` is open. See `dataDir`. */
let directory: string | null = null

/**
 * Which of the two databases a connection is. Each keeps its own ledger of migrations, and each
 * decides "is this new?" by its OWN tables — which matters once both live in one SQLite file, as
 * they do in a Cloudflare Durable Object (ADR 0066), where the content tables would otherwise make
 * a brand-new analytics schema look old and run a migration against columns it already has.
 */
export type Kind = 'content' | 'analytics'

/** Each database's own ledger. Analytics' was `schema_migrations` too until 2026-10-03. */
export const LEDGER: Record<Kind, string> = { content: 'schema_migrations', analytics: 'analytics_schema_migrations' }

function open(
  path: string, schema: string, synchronous: 'FULL' | 'NORMAL', migrations: string, kind: Kind,
): { db: Database; fresh: boolean } {
  const db = new Database(path, { create: true, strict: true })
  for (const p of PRAGMAS) db.run(`pragma ${p};`)
  // Content is worth an fsync per commit; analytics is not. Losing a day of pageviews is
  // an annoyance, losing a day of posts is a disaster.
  db.run(`pragma synchronous = ${synchronous};`)
  if (kind === 'analytics') renameAnalyticsLedger(db)
  // Whether this file already held tables decides what migrations mean for it, and the
  // only moment that is knowable is BEFORE the schema is applied.
  const fresh = isEmpty(db, kind)
  // And this is the other thing only knowable here: what the operator had before this boot
  // changed anything. The copy is taken ahead of the schema as well as the migrations —
  // `schema.sql` only ever adds what is missing, but a copy of "before" that was taken after
  // something is not a copy of before (ADR 0063).
  if (!fresh) {
    const step = firstPending(db, migrations, LEDGER[kind])
    if (step) copyBeforeMigrating(db, path, step)
  }
  db.transaction(() => db.run(schema))()
  return { db, fresh }
}

/**
 * The first step this database has not recorded, or null when it is up to date.
 *
 * A database old enough to have no ledger AT ALL answers with the first step of the file: the
 * query throws, and every step is pending by definition. Guessing the other way would skip
 * the copy on the oldest database anybody could be holding, which is the one most worth
 * copying.
 */
function firstPending(db: Database, source: string, ledger: string): string | null {
  let applied: Set<string>
  try {
    applied = new Set(
      db.query<{ name: string }, []>(`select name from ${ledger}`).all().map((r) => r.name),
    )
  } catch {
    applied = new Set()
  }
  return parseMigrations(source).find((step) => !applied.has(step.name))?.name ?? null
}

/**
 * None of THIS database's tables yet — one this process is about to create rather than open.
 *
 * Tables that are not ours do not count: SQLite's own (`sqlite_…`), the ones a Cloudflare Durable
 * Object creates beside ours (`_cf_KV`, the moment its key-value API is touched) and the one its
 * local emulator adds (`__miniflare…`). Measured 2026-10-03: counting `_cf_KV` made a brand-new
 * blog look like an old one, so the boot went looking for a database to copy before migrating and
 * died on it. And the other database's tables do not count either, for when both share a file.
 * `_` is a LIKE wildcard, hence the escapes.
 */
export function isEmpty(db: Database, kind: Kind = 'content'): boolean {
  const ours = kind === 'analytics' ? `name like 'analytics\\_%' escape '\\'` : `name not like 'analytics\\_%' escape '\\'`
  const row = db.query<{ n: number }, []>(
    `select count(*) as n from sqlite_master where type = 'table'
       and name not like 'sqlite\\_%' escape '\\' and name not like '\\_cf\\_%' escape '\\'
       and name not like '\\_\\_miniflare%' escape '\\' and ${ours}`,
  ).get()
  return (row?.n ?? 0) === 0
}

/**
 * Analytics' ledger was called `schema_migrations`, the same name as the content database's. Fine
 * while each had its own file; impossible once both share one, as on Cloudflare. Renamed once, in
 * place, on an `analytics.db` that still has the old name — every row it holds kept.
 */
function renameAnalyticsLedger(db: Database): void {
  const has = (name: string) => db.query<{ n: number }, [string]>(
    `select count(*) as n from sqlite_master where type = 'table' and name = ?`,
  ).get(name)!.n > 0
  if (has('schema_migrations') && !has(LEDGER.analytics)) {
    db.run(`alter table schema_migrations rename to ${LEDGER.analytics}`)
  }
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
 *
 * Returns whether anything RAN, which is not the same as whether anything was recorded: a
 * fresh database records every step and runs none, and has nothing to compact afterwards.
 */
function applyMigrations(db: Database, source: string, fresh: boolean, ledger: string): boolean {
  const applied = new Set(
    db.query<{ name: string }, []>(`select name from ${ledger}`).all().map((r) => r.name),
  )
  const record = db.query<never, [string, number]>(
    `insert or ignore into ${ledger} (name, applied_at) values (?, ?)`,
  )
  let ran = false
  for (const step of parseMigrations(source)) {
    if (applied.has(step.name)) continue
    db.transaction(() => {
      if (!fresh) db.run(step.sql)
      record.run(step.name, Date.now())
    })()
    ran = ran || !fresh
  }
  return ran
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
  const contentPath = join(dir, 'quire.db')
  const opened = open(contentPath, contentSchema, 'FULL', contentMigrations, 'content')
  content = opened.db
  directory = dirname(contentPath)
  if (applyMigrations(content, contentMigrations, opened.fresh, LEDGER.content)
      && compactIfMostlyFree(content, contentPath)) {
    // The compaction closed it and replaced the file underneath. Opening it again runs a
    // schema of `if not exists` against the shape it already has, and finds nothing pending.
    content = open(contentPath, contentSchema, 'FULL', contentMigrations, 'content').db
  }
  const openedAnalytics = open(join(dir, 'analytics.db'), analyticsSchema, 'NORMAL', analyticsMigrations, 'analytics')
  analytics = openedAnalytics.db
  // Analytics has its own ledger and its own steps. It went without one until 2026-08-29,
  // which was fine while the table never changed shape and stopped being fine the moment
  // it did: `if not exists` cannot add a column to a table that already exists.
  applyMigrations(analytics, analyticsMigrations, openedAnalytics.fresh, LEDGER.analytics)
  // NO ATTACH since 2026-10-03. It was there for one cross-file join, `analytics_totals`, which no
  // query has used for a long time (nothing in `src/` names an `analytics.` table), and a
  // Durable Object refuses `ATTACH` outright. Each database is reached through its own connection.
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

/**
 * The directory the two databases live in, for a file kept BESIDE them (the copy of an
 * unreadable settings row). Asked of the store rather than of a connection, because a
 * connection on Cloudflare has no file and so no directory to ask it for.
 */
export function dataDir(): string {
  if (!directory) throw new Error('dataDir() before openDatabases(): call it once at boot')
  return directory
}

export function closeDatabases(): void {
  content?.close()
  analytics?.close()
  content = analytics = null
  directory = null
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
