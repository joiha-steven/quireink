// A backup loaded into an EMPTY blog through its first setup screen, on a real second instance
// (ADR 0067 rule 4). `restore-check.ts` proves the archive restores on the command line; this
// proves the other door: what a person moving a blog does, end to end, over HTTP.
//
//   1. take the archive from the instance under test, as its owner would download it
//   2. boot a SECOND, brand-new instance beside it, with its own empty data and uploads
//   3. load the archive through `/setup/restore` with the setup code, as the form posts it
//   4. it must answer with the sign-in, refuse to load twice, and hold every row and upload
//
// Run by `scripts/ops/tour.sh` after restore-check, with the same environment:
//
//   bun scripts/setup-restore-check.ts http://127.0.0.1:3399
//
// Env: QUIRE_SESSION, DATA_DIR, STORAGE_LOCAL_DIR (the instance under test), and
// QUIRE_BACKUP_IDENTITY when its archives are sealed.
import { Database } from 'bun:sqlite'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'
import { randomBytes } from 'node:crypto'

const BASE = process.argv[2] ?? 'http://127.0.0.1:3399'
const COOKIE = `__Host-quire_session=${process.env.QUIRE_SESSION ?? ''}`
const DATA_DIR = process.env.DATA_DIR ?? 'data'
const UPLOADS = process.env.STORAGE_LOCAL_DIR ?? 'uploads'
const WORK = '.tmp/setup-restore-check'

const failures: string[] = []
const say = (ok: boolean, line: string) => {
  console.log(`${ok ? '✓' : '✗'} ${line}`)
  if (!ok) failures.push(line)
}

/** Tables a minute of ordinary running changes by itself, or that the load replaces on purpose. */
const SKIP = /^(sqlite_|.*_fts($|_))|^(render_cache|body_cache|sessions|update_check|mcp_used_codes|ap_queue|activity_log|analytics_events|analytics_scroll)$/

function counts(path: string): Record<string, number> {
  const db = new Database(path, { readonly: true })
  try {
    const names = (db.query(`select name from sqlite_master where type = 'table'`).all() as { name: string }[])
      .map((r) => r.name).filter((n) => !SKIP.test(n))
    // A name from this database's own schema, never a request's.
    return Object.fromEntries(names.map((n) => [n, (db.query(`select count(*) as n from "${n}"`).get() as { n: number }).n]))
  } finally {
    db.close()
  }
}

function files(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile() && !/\.[0-9a-f]{12}\.part$/.test(e.name)) out.push(relative(root, p))
    }
  }
  walk(root)
  return out.sort()
}

/** A port nothing is listening on, found by asking the system for one. */
function freePort(): number {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() })
  const port = probe.port as number
  probe.stop(true)
  return port
}

rmSync(WORK, { recursive: true, force: true })

// ----- 1. the archive --------------------------------------------------------------------------

const before = counts(join(DATA_DIR, 'quire.db'))
const uploadsBefore = files(UPLOADS)
const res = await fetch(`${BASE}/api/backup/export`, { headers: { cookie: COOKIE } })
if (!res.ok) {
  console.log(`✗ /api/backup/export answered ${res.status} — no archive to load`)
  process.exit(1)
}
const archive = new Uint8Array(await res.arrayBuffer())
say(true, `took the archive from ${BASE} (${Math.round(archive.length / 1024)} KB)`)

// ----- 2. a second, empty instance -------------------------------------------------------------

const port = freePort()
const second = `http://127.0.0.1:${port}`
const code = randomBytes(18).toString('base64url')
const data = join(WORK, 'data')
const uploads = join(WORK, 'uploads')
const server = Bun.spawn(['bun', 'src/index.ts'], {
  env: { ...process.env, DATA_DIR: data, STORAGE_LOCAL_DIR: uploads, PORT: String(port), UPDATE_CHECK: '0', SETUP_CODE: code, SITE_URL: second, BACKUP_DIR: join(WORK, 'backups') },
  stdout: 'ignore', stderr: 'pipe',
})
let up = false
for (let i = 0; i < 80 && !up; i++) {
  up = await fetch(`${second}/api/health`).then((r) => r.ok).catch(() => false)
  if (!up) await Bun.sleep(250)
}

try {
  say(up, up ? `a fresh instance answers on ${second}` : 'the second instance never came up')
  if (!up) throw new Error('no second instance')

  const unclaimed = await (await fetch(`${second}/setup`)).text()
  say(unclaimed.includes('href="/setup/restore"'), 'its setup screen offers Start from a backup')

  // ----- 3. through the form, as a browser posts it --------------------------------------------

  const post = (token: string) => {
    const form = new FormData()
    form.set('token', token)
    form.set('identity', process.env.QUIRE_BACKUP_IDENTITY ?? '')
    form.set('passphrase', '')
    form.set('archive', new File([archive], 'quire-backup.tar.gz'))
    return fetch(`${second}/setup/restore`, { method: 'POST', body: form, redirect: 'manual' })
  }
  const wrong = await post('not-the-setup-code-at-all')
  say(wrong.status === 403, `a wrong setup code is refused (${wrong.status})`)
  const loaded = await post(code)
  say(loaded.status === 303 && loaded.headers.get('location') === '/login',
    `the archive loads and hands over to the sign-in (${loaded.status} → ${loaded.headers.get('location')})`)
  const again = await post(code)
  say(again.status === 409, `a second load into the now-claimed blog is refused (${again.status})`)
  say((await fetch(`${second}/setup`)).status === 404, 'its setup screen now says the blog has an owner')

  // ----- 4. what arrived -----------------------------------------------------------------------

  const after = counts(join(data, 'quire.db'))
  const lost = Object.keys(before).filter((t) => (after[t] ?? 0) < before[t]!)
  say(lost.length === 0, lost.length === 0
    ? `every row arrived (${Object.keys(before).length} tables, posts ${after.posts}, users ${after.users})`
    : `rows missing: ${lost.map((t) => `${t} ${before[t]}→${after[t] ?? 0}`).join(', ')}`)
  const arrived = files(uploads)
  const missing = uploadsBefore.filter((f) => !arrived.includes(f))
  say(missing.length === 0, missing.length === 0
    ? `all ${uploadsBefore.length} upload(s) arrived`
    : `${missing.length} upload(s) missing: ${missing.slice(0, 5).join(', ')}`)
} catch (error) {
  if ((error as Error).message !== 'no second instance') say(false, `the check itself failed: ${(error as Error).message}`)
} finally {
  server.kill()
  await server.exited
  rmSync(WORK, { recursive: true, force: true })
}

console.log('')
if (failures.length) {
  console.log(`${failures.length} setup-restore check(s) failed`)
  process.exit(1)
}
console.log('a backup goes into an empty blog through its setup screen, whole')
