// A backup nobody has restored is not a backup.
//
// `bun run tour` proves the archive BUILDS — it reads two bytes and confirms a gzip member.
// That is the cheap half. It cannot tell you the databases inside open, that they hold the
// owner's rows, or that the uploads tree came along, and every one of those has failed
// somewhere in this project's history: a snapshot taken as a file copy captures a torn
// write-ahead log that only reveals itself on restore, and the uploads directory has been read
// from one path and written to another for months with no test going red.
//
// So this opens the archive and checks what a restore would actually get:
//
//   1. the three members are there                — an archive missing uploads/ looks fine
//   2. `pragma integrity_check` on both databases — a torn snapshot fails here and nowhere else
//   3. every row count matches the live instance  — a VACUUM INTO that raced a write does not
//   4. every upload is byte-identical             — the failure mode that has actually bitten
//
// Run against a THROWAWAY instance, which `scripts/ops/tour.sh` hands it. It only reads: live
// databases are opened read-only and the extraction goes under `.tmp/`.
//
//   bun scripts/restore-check.ts http://127.0.0.1:3399
//
// Env: QUIRE_SESSION, DATA_DIR and STORAGE_LOCAL_DIR — the same values the instance under test
// was started with, because the comparison is against ITS files.

import { Database } from 'bun:sqlite'
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const BASE = process.argv[2] ?? 'http://127.0.0.1:3399'
const SESSION = process.env.QUIRE_SESSION ?? ''
const DATA_DIR = process.env.DATA_DIR ?? 'data'
const UPLOADS = process.env.STORAGE_LOCAL_DIR ?? 'uploads'
const WORK = '.tmp/restore-check'

// The cookie is `__Host-` prefixed, which is a browser rule about Secure and Path, not a
// server one — the name still has to match exactly or the request is anonymous and the
// export answers 401 rather than failing loudly.
const COOKIE = `__Host-quire_session=${SESSION}`

const failures: string[] = []
const say = (ok: boolean, line: string) => {
  console.log(`${ok ? '✓' : '✗'} ${line}`)
  if (!ok) failures.push(line)
}

/** Rows the owner would notice missing. Analytics is counted separately, in its own file. */
const TABLES = [
  'posts', 'pages', 'post_revisions', 'media', 'files', 'comments', 'redirects',
  'subscribers', 'newsletter_sends', 'settings', 'users', 'activity_log',
] as const

const ANALYTICS_TABLES = ['analytics_events', 'analytics_scroll'] as const

function counts(dbPath: string, tables: readonly string[]): Record<string, number> {
  // Read-only: this opens the LIVE database of a running server, and a stray write here
  // would be this script corrupting the thing it exists to reassure people about.
  const db = new Database(dbPath, { readonly: true, strict: true })
  try {
    const out: Record<string, number> = {}
    for (const t of tables) {
      // `t` is from the module constant above and never from a request — the one form of
      // interpolation CLAUDE.md allows.
      const row = db.query(`select count(*) as n from ${t}`).get() as { n: number } | null
      out[t] = row?.n ?? 0
    }
    return out
  } finally {
    db.close()
  }
}

function filesUnder(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) walk(p)
      else if (entry.isFile()) out.push(relative(root, p))
    }
  }
  walk(root)
  return out.sort()
}

// ----- 0. make sure there is something to lose --------------------------------------------

/**
 * Put one real image through the upload route before the snapshot, and take it out after.
 *
 * Without this the uploads assertion is vacuous exactly where it matters: the seeder writes
 * `media` ROWS but no files, and the tour deletes the image it uploads, so by the time this
 * runs the tree is empty and "all 0 upload(s) are in the archive" passes forever. An empty
 * assertion is worse than none — it reads as coverage.
 *
 * A 1×1 PNG rather than a stub: the media route derives variants and a thumbnail from it, so
 * this leaves the same SHAPE on disk that a real upload does, which is the shape that has
 * gone missing before.
 */
const PROBE = 'restore-check-probe.png'
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function putProbe(): Promise<string | null> {
  const bytes = Uint8Array.from(atob(PNG_1PX), (c) => c.charCodeAt(0))
  const form = new FormData()
  form.append('file', new File([bytes], PROBE, { type: 'image/png' }), PROBE)
  // `Origin` is not politeness: the owner routes refuse a cross-site write, so without it
  // this is a 403 and the script would report an empty uploads tree as a pass.
  const r = await fetch(`${BASE}/api/media/upload`, {
    method: 'POST', headers: { cookie: COOKIE, origin: BASE }, body: form,
  })
  if (!r.ok) return null
  const body = await r.json().catch(() => null) as { data?: { url?: string }[] } | null
  return body?.data?.[0]?.url ?? null
}

/**
 * Two calls, because one is not a delete.
 *
 * `/api/media/delete` sets `deleted_at` and KEEPS the bytes on purpose — a published post
 * linking a trashed image has to keep rendering ([`src/store/schema.sql`](../src/store/schema.sql),
 * `media`). Stopping there leaves the probe's six files on disk, which is how a check starts
 * changing what the next run measures. The purge is the second call.
 */
async function removeProbe(url: string): Promise<void> {
  const json = { cookie: COOKIE, origin: BASE, 'content-type': 'application/json' }
  await fetch(`${BASE}/api/media/delete`, {
    method: 'POST', headers: json, body: JSON.stringify({ urls: [url] }),
  }).catch(() => undefined)
  await fetch(`${BASE}/api/trash`, {
    method: 'POST', headers: json,
    body: JSON.stringify({ kind: 'media', action: 'purge', ids: [url], force: true }),
  }).catch(() => undefined)
}

const probeUrl = await putProbe()
say(probeUrl !== null, probeUrl !== null
  ? 'an image was uploaded, so the uploads tree is not empty'
  : 'the probe image would not upload — the uploads half of this check proves nothing')

// ----- 1. take the archive the owner would download -------------------------------------

rmSync(WORK, { recursive: true, force: true })
await Bun.$`mkdir -p ${WORK}`.quiet()

// Counted BEFORE the export, and the ordering is the whole correctness of step 3.
//
// The snapshot is taken during the request, so anything written after this read is
// legitimately inside the archive and anything written after the snapshot legitimately is
// not. Reading the live side afterwards instead makes the export's own footprint look like
// corruption: exporting writes an `activity_log` row, so the first run of this script
// reported `activity_log 48→47` and the archive was perfectly intact. The assertion that
// survives both races is one-directional — the archive may hold MORE than was there when we
// looked, and may never hold less.
const liveContent = join(DATA_DIR, 'quire.db')
const liveAnalytics = join(DATA_DIR, 'analytics.db')
const before = existsSync(liveContent) ? counts(liveContent, TABLES) : null
const beforeAnalytics = existsSync(liveAnalytics)
  ? counts(liveAnalytics, ANALYTICS_TABLES)
  : null

const res = await fetch(`${BASE}/api/backup/export`, { headers: { cookie: COOKIE } })
if (!res.ok) {
  console.log(`✗ /api/backup/export answered ${res.status} — no archive to check`)
  process.exit(1)
}
const archive = join(WORK, 'backup.tar.gz')
await Bun.write(archive, await res.arrayBuffer())
say(true, `the archive downloaded (${Math.round(statSync(archive).size / 1024)} KB)`)

// BSD tar and GNU tar both extract this; only the deploy's `--transform` needs GNU.
const extract = await Bun.$`tar -xzf ${archive} -C ${WORK}`.quiet().nothrow()
if (extract.exitCode !== 0) {
  console.log(`✗ tar refused the archive: ${extract.stderr.toString().trim()}`)
  process.exit(1)
}

for (const member of ['quire.db', 'analytics.db']) {
  say(existsSync(join(WORK, member)), `the archive carries ${member}`)
}

// ----- 2. the databases open, and are not torn -------------------------------------------

for (const member of ['quire.db', 'analytics.db']) {
  const path = join(WORK, member)
  if (!existsSync(path)) continue
  let verdict = 'unreadable'
  try {
    const db = new Database(path, { readonly: true, strict: true })
    const row = db.query('pragma integrity_check').get() as { integrity_check?: string } | null
    verdict = row?.integrity_check ?? 'no answer'
    db.close()
  } catch (error) {
    verdict = (error as Error).message
  }
  say(verdict === 'ok', `${member} passes integrity_check${verdict === 'ok' ? '' : `: ${verdict}`}`)
}

// ----- 3. the rows the owner would miss ---------------------------------------------------

if (before === null) {
  say(false, `no live database at ${liveContent} to compare against (set DATA_DIR)`)
} else {
  const kept = counts(join(WORK, 'quire.db'), TABLES)
  const lost = TABLES.filter((t) => (kept[t] ?? 0) < (before[t] ?? 0))
  say(lost.length === 0, lost.length === 0
    ? `every row survived (${TABLES.map((t) => `${t} ${kept[t]}`).join(', ')})`
    : `rows lost: ${lost.map((t) => `${t} ${before[t]}→${kept[t]}`).join(', ')}`)
}

if (beforeAnalytics && existsSync(join(WORK, 'analytics.db'))) {
  const kept = counts(join(WORK, 'analytics.db'), ANALYTICS_TABLES)
  const lost = ANALYTICS_TABLES.filter((t) => (kept[t] ?? 0) < (beforeAnalytics[t] ?? 0))
  say(lost.length === 0, lost.length === 0
    ? `analytics survived (events ${kept.analytics_events}, scroll ${kept.analytics_scroll})`
    : `analytics rows lost: ${lost.map((t) => `${t} ${beforeAnalytics[t]}→${kept[t]}`).join(', ')}`)
}

// ----- 4. the uploads, byte for byte ------------------------------------------------------

const liveFiles = filesUnder(UPLOADS)
const keptFiles = filesUnder(join(WORK, 'uploads'))
const missing = liveFiles.filter((f) => !keptFiles.includes(f))
say(missing.length === 0, missing.length === 0
  ? `all ${liveFiles.length} upload(s) are in the archive`
  : `${missing.length} upload(s) missing: ${missing.slice(0, 5).join(', ')}`)

const differing: string[] = []
for (const f of liveFiles) {
  if (missing.includes(f)) continue
  const a = await Bun.file(join(UPLOADS, f)).arrayBuffer()
  const b = await Bun.file(join(WORK, 'uploads', f)).arrayBuffer()
  if (a.byteLength !== b.byteLength || Bun.hash(new Uint8Array(a)) !== Bun.hash(new Uint8Array(b))) {
    differing.push(f)
  }
}
if (liveFiles.length) {
  say(differing.length === 0, differing.length === 0
    ? `every archived upload is byte-identical`
    : `${differing.length} upload(s) differ: ${differing.slice(0, 5).join(', ')}`)
}

// The extraction is scratch and holds a copy of the owner's whole database; it does not
// outlive the run. Neither does the probe image — a check that leaves rows behind changes
// what the next run is testing, which is the rule the tour flows already follow.
rmSync(WORK, { recursive: true, force: true })
if (probeUrl) await removeProbe(probeUrl)

console.log('')
if (failures.length) {
  console.log(`${failures.length} restore check(s) failed`)
  process.exit(1)
}
console.log('the archive restores: databases open, rows match, uploads intact')
