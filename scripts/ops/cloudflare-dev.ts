// The install smoke on the Cloudflare build, locally (ADR 0066, G2.6 and G4.4): a blog moved from
// Bun to workerd by the door a person moving a blog uses, checked the way every other package is
// checked, backed up there, and moved back to a fresh Bun blog to prove nothing was lost on the way.
//
//   bun run build && bun run build:worker
//   bun scripts/ops/cloudflare-dev.ts
//
//   1. seed a throwaway Bun blog with the showcase, serve it, and take its archive as its owner;
//   2. start the real worker under `wrangler dev --local` with a SETUP_CODE, empty;
//   3. load the archive through `/setup/restore` — as the form posts it, or in parts past the size
//      the page would switch at — and crawl both (`scripts/parity.ts`): every page the same, before
//      anything writes to either;
//   4. `smoke.ts` against workerd as package `cloudflare`, with the owner session the archive
//      carried: health, the twelve smoke flows, restore-check and MCP;
//   5. a snapshot on the worker, copied off-site to a bucket this script serves, then downloaded:
//      the three must be the same bytes, with workerd's memory read while it happens;
//   6. the worker's own archive, taken as its owner, pushed IN PARTS into a fresh, empty Bun blog
//      (`server/restore-push.ts`, what "Move to Cloudflare" will use the other way), and held to
//      the original Bun blog: no table with fewer rows, every upload byte-identical.
//
// restore-check compares an archive with the files of the instance it came from, and a Durable
// Object has none — so it is handed the BUN blog's files, which is the stronger question anyway:
// Bun → archive → Cloudflare → archive → restore must give back what Bun had. Step 6 asks it once
// more without restore.ts in the way: Bun → Cloudflare → Bun, through the door a person uses.
//
// Everything lives under `.tmp/cloudflare-dev/` and goes when it ends. KEEP=1 leaves the state on
// disk for a look afterwards; FULL_TOUR=1 also drives every flow of the tour against the worker
// before the smoke. BIG=<MB> adds that many megabytes of random uploads to the Bun blog first
// (BIG=1 means 120), so the archive is past Cloudflare's 100 MB request limit and steps 3, 5 and 6
// prove the parts, the stream and the multipart copy at a size the isolate could not hold twice.
// Ports: BUN_PORT, CF_PORT, BACK_PORT / S3_PORT (the two after BUN_PORT), INSPECT_PORT (after CF_PORT).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { APP_VERSION } from '../../src/version'
import { CHUNK_ABOVE_BYTES } from '../../src/server/restore-parts'
import { pushArchive } from '../../src/server/restore-push'
import { fakeBucket, isolateHeap, measured, said, sameBlog } from './cloudflare-dev-kit'

const ROOT = resolve(import.meta.dir, '..', '..')
const WORK = join(ROOT, '.tmp', 'cloudflare-dev')
const BUN_PORT = Number(process.env.BUN_PORT || 3571)
const CF_PORT = Number(process.env.CF_PORT || 8790)
const bunUrl = `http://127.0.0.1:${BUN_PORT}`
const cfUrl = `http://127.0.0.1:${CF_PORT}`
const data = join(WORK, 'bun', 'data')
const uploads = join(WORK, 'bun', 'uploads')
const code = randomBytes(18).toString('base64url')
const BACK_PORT = Number(process.env.BACK_PORT || BUN_PORT + 1)
const S3_PORT = Number(process.env.S3_PORT || BUN_PORT + 2)
const INSPECT_PORT = Number(process.env.INSPECT_PORT || CF_PORT + 1)
const BIG_MB = process.env.BIG === '1' ? 120 : Number(process.env.BIG || 0)
const MB = 1024 * 1024
const t0 = performance.now()
const since = (): string => `${((performance.now() - t0) / 1000).toFixed(0)} s`

const children: ChildProcess[] = []
const stopAll = () => { for (const c of children) { try { c.kill('SIGTERM') } catch { /* gone */ } } }
process.on('exit', stopAll)
const fail = (why: string): never => {
  console.error(`✗ cloudflare-dev: ${why}`)
  stopAll()
  process.exit(1)
}

/**
 * A response body to a file, hashed on the way. By hand: `Bun.write(path, response)` on Bun 1.3.14
 * took the headers of a 124 MB export from the worker and then wrote nothing for ten minutes, where
 * reading the same body chunk by chunk took 6 s (2026-10-03).
 */
async function saved(res: Response, path: string): Promise<{ size: number; sha256: string }> {
  const hash = new Bun.CryptoHasher('sha256')
  const writer = Bun.file(path).writer()
  let size = 0
  for await (const chunk of res.body!) { hash.update(chunk); size += chunk.length; writer.write(chunk) }
  await writer.end()
  return { size, sha256: hash.digest('hex') }
}

async function waitFor(url: string, seconds: number): Promise<boolean> {
  for (let i = 0; i < seconds * 2; i++) {
    if (await fetch(url, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok, () => false)) return true
    await Bun.sleep(500)
  }
  return false
}

rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })

// ----- 1. the Bun blog and its archive ---------------------------------------------------------

const seeded = spawnSync(process.execPath, ['scripts/seed-showcase.ts', data], {
  cwd: ROOT, encoding: 'utf8', env: { ...process.env, STORAGE_LOCAL_DIR: uploads },
})
const session = /^QUIRE_SESSION=(.+)$/m.exec(`${seeded.stdout}\n${seeded.stderr}`)?.[1]?.trim() ?? ''
if (seeded.status !== 0 || !session) fail(`the showcase seeder failed or printed no session\n${seeded.stderr.slice(-800)}`)

// BIG: random bytes, which gzip cannot shrink, in 4 MB files — well under MAX_UPLOAD_MB, so each
// is an ordinary upload on both runtimes, and together past what one request may carry.
for (let i = 0; i < Math.ceil(BIG_MB / 4); i++) {
  mkdirSync(join(uploads, 'big'), { recursive: true })
  writeFileSync(join(uploads, 'big', `noise-${String(i).padStart(3, '0')}.bin`), randomBytes(4 * MB))
}

const bun = spawn(process.execPath, ['src/index.ts'], {
  cwd: ROOT, stdio: 'ignore',
  env: { ...process.env, DATA_DIR: data, STORAGE_LOCAL_DIR: uploads, PORT: String(BUN_PORT), UPDATE_CHECK: '0', SITE_URL: bunUrl, BACKUP_DIR: join(WORK, 'bun', 'backups') },
})
children.push(bun)
if (!(await waitFor(`${bunUrl}/api/health`, 40))) fail(`the Bun blog never answered on ${bunUrl}`)
const owner = { cookie: `__Host-quire_session=${session}` }
const exported = await fetch(`${bunUrl}/api/backup/export`, { headers: owner })
if (!exported.ok) fail(`the Bun blog's /api/backup/export answered ${exported.status}`)
// To disk, not memory: with BIG the archive is past 100 MB, and the push reads it a part at a time.
const archivePath = join(WORK, 'from-bun.tar.gz')
await saved(exported, archivePath)
const archive = Bun.file(archivePath)
console.log(`✓ the showcase on Bun${BIG_MB ? ` with ${BIG_MB} MB of uploads` : ''}, archived (${(archive.size / MB).toFixed(1)} MB) [${since()}]`)

// ----- 2. the worker, empty --------------------------------------------------------------------

const wrangler = spawn(join(ROOT, 'node_modules', '.bin', 'wrangler'), [
  'dev', '--local', '--port', String(CF_PORT), '--inspector-port', String(INSPECT_PORT), '--persist-to', join(WORK, 'cf-state'),
  '--var', `SETUP_CODE:${code}`, '--var', `SITE_URL:${cfUrl}`, '--var', 'UPDATE_CHECK:0',
], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
children.push(wrangler)
let log = ''
wrangler.stdout?.on('data', (d) => { log += d })
wrangler.stderr?.on('data', (d) => { log += d })
if (!(await waitFor(`${cfUrl}/api/health`, 90))) fail(`the worker never answered on ${cfUrl}\n${log.slice(-1500)}`)
console.log(`✓ the worker answers on ${cfUrl}`)

// ----- 3. the archive, through the first setup screen ------------------------------------------

const wranglerPid = wrangler.pid ?? 0
const heap = await isolateHeap(INSPECT_PORT)
if (!heap) console.log(`  (no isolate heap readings: the inspector on ${INSPECT_PORT} did not answer)`)
if (archive.size > CHUNK_ABOVE_BYTES) {
  // Past the size the page switches at: in parts, as the page's script would send it.
  const pushed = await measured(wranglerPid, () => pushArchive(cfUrl, code, archive), heap).catch((error: unknown) =>
    fail(`the archive did not load into the worker in parts: ${(error as Error).message}\n${log.slice(-1500)}`))
  console.log(`✓ the archive loaded into the empty worker in ${pushed.value.parts} parts through /setup/restore/parts (${said(pushed)}) [${since()}]`)
} else {
  const form = new FormData()
  form.set('token', code)
  form.set('identity', '')
  form.set('passphrase', '')
  form.set('archive', new File([await archive.arrayBuffer()], 'quire-backup.tar.gz'))
  const loaded = await fetch(`${cfUrl}/setup/restore`, { method: 'POST', body: form, redirect: 'manual' })
  if (loaded.status !== 303 || loaded.headers.get('location') !== '/login') {
    fail(`/setup/restore answered ${loaded.status} → ${loaded.headers.get('location')}\n${(await loaded.text()).slice(0, 600)}\n${log.slice(-1500)}`)
  }
  console.log('✓ the archive loaded into the empty worker through /setup/restore')
}

// ----- 3½. the same pages from both, before anything writes to either --------------------------

const parity = spawnSync(process.execPath, ['scripts/parity.ts', bunUrl, cfUrl], { cwd: ROOT, stdio: 'inherit' })
// Stopped now, so the files restore-check compares against hold still.
bun.kill('SIGTERM')
if (parity.status !== 0 && process.env.PARITY_SOFT !== '1') fail('the two runtimes serve different pages for the same data')

// ----- 3¾. FULL_TOUR=1: every flow of the tour, not only the smoke's twelve ----------------------

let tourFailed = false
if (process.env.FULL_TOUR === '1') {
  const tour = spawnSync(process.execPath, ['scripts/tour.ts', cfUrl], {
    cwd: ROOT, stdio: 'inherit', env: { ...process.env, QUIRE_SESSION: session },
  })
  tourFailed = tour.status !== 0
}

// ----- 4. the same smoke as every package ------------------------------------------------------

const smoke = spawnSync(process.execPath, ['scripts/smoke.ts', cfUrl], {
  cwd: ROOT, stdio: 'inherit',
  env: {
    ...process.env, EXPECT_VERSION: APP_VERSION, EXPECT_PACKAGE: 'cloudflare',
    QUIRE_SESSION: session, DATA_DIR: data, STORAGE_LOCAL_DIR: uploads,
  },
})
if (tourFailed) console.error('✗ cloudflare-dev: the full tour failed on workerd (above)')
if (smoke.status !== 0 || tourFailed) fail(`the smoke failed on workerd\n${log.slice(-2500)}`)

// ----- 5. a snapshot on the worker: kept, copied off-site, downloaded — the same bytes -----------

const asOwner = { ...owner, origin: cfUrl, 'content-type': 'application/json' }
const bucket = fakeBucket(S3_PORT, join(WORK, 'bucket'))
const keys = await fetch(`${cfUrl}/api/integrations/s3`, {
  method: 'POST', headers: asOwner,
  body: JSON.stringify({ s3Endpoint: `http://127.0.0.1:${S3_PORT}`, s3Region: 'auto', s3Bucket: 'offsite', s3Prefix: 'blog', s3AccessKeyId: 'AKID', s3SecretAccessKey: 'not-a-secret' }),
})
if (!keys.ok) fail(`saving the off-site bucket on the worker answered ${keys.status}`)
const ran = await measured(wranglerPid, async () => {
  const res = await fetch(`${cfUrl}/api/backup/run`, { method: 'POST', headers: asOwner })
  return { status: res.status, body: (await res.json().catch(() => ({}))) as { data?: { snapshot?: { name: string; size: number } } } }
}, heap)
const snapshot = ran.value.body.data?.snapshot
if (ran.value.status !== 200 || !snapshot) fail(`/api/backup/run on the worker answered ${ran.value.status}\n${log.slice(-1500)}`)
const copy = bucket.landed.get(`blog/${snapshot!.name}`)
if (!copy || copy.size !== snapshot!.size) fail(`the off-site copy is ${copy?.size} bytes, the snapshot ${snapshot!.size}`)
console.log(`✓ a snapshot on the worker, ${(snapshot!.size / MB).toFixed(1)} MB, kept and copied off-site in ${copy!.parts} part(s) of at most ${(copy!.largestPart / MB).toFixed(1)} MB (${said(ran)}) [${since()}]`)
const downloadPath = join(WORK, 'downloaded.tar.gz')
const pulled = await measured(wranglerPid, async () => {
  const res = await fetch(`${cfUrl}/api/backup/download?name=${encodeURIComponent(snapshot!.name)}`, { headers: owner })
  if (!res.ok) fail(`/api/backup/download on the worker answered ${res.status}`)
  return { ...(await saved(res, downloadPath)), declared: Number(res.headers.get('content-length')) }
}, heap)
if (pulled.value.size !== snapshot!.size || pulled.value.declared !== snapshot!.size || pulled.value.sha256 !== copy!.sha256) {
  fail(`the download (${pulled.value.size} bytes, declared ${pulled.value.declared}) is not the off-site copy (${copy!.size})`)
}
console.log(`✓ downloaded from the worker as it was copied off-site, byte for byte (${said(pulled)}) [${since()}]`)
bucket.stop()

// ----- 6. Cloudflare → Bun: the worker's archive into a fresh, empty Bun blog, in parts ---------

const back = { data: join(WORK, 'back', 'data'), uploads: join(WORK, 'back', 'uploads') }
const backUrl = `http://127.0.0.1:${BACK_PORT}`
const backCode = randomBytes(18).toString('base64url')
const fresh = spawn(process.execPath, ['src/index.ts'], {
  cwd: ROOT, stdio: 'ignore',
  env: { ...process.env, DATA_DIR: back.data, STORAGE_LOCAL_DIR: back.uploads, PORT: String(BACK_PORT), UPDATE_CHECK: '0', SITE_URL: backUrl, SETUP_CODE: backCode, BACKUP_DIR: join(WORK, 'back', 'backups') },
})
children.push(fresh)
const fromCf = join(WORK, 'from-cloudflare.tar.gz')
const taken = await measured(wranglerPid, async () => {
  const res = await fetch(`${cfUrl}/api/backup/export`, { headers: owner, signal: AbortSignal.timeout(600_000) })
    .catch((error: unknown) => fail(`the worker's /api/backup/export: ${(error as Error).message}\n${log.slice(-3000)}`))
  if (!res.ok) fail(`the worker's /api/backup/export answered ${res.status}\n${log.slice(-1500)}`)
  const declared = Number(res.headers.get('content-length'))
  const { size } = await saved(res, fromCf)
  // workerd drops a Content-Length set beside a stream of unknown length (`cf/archive.ts`).
  if (declared !== size) fail(`the worker's export declared ${declared} bytes and sent ${size}`)
  return size
}, heap)
console.log(`✓ the worker's archive taken as its owner, ${(taken.value / MB).toFixed(1)} MB (${said(taken)}) [${since()}]`)
if (!(await waitFor(`${backUrl}/api/health`, 40))) fail(`the fresh Bun blog never answered on ${backUrl}`)
// Parts of a quarter of the archive at most, so even the small showcase goes up as several.
const archiveBack = Bun.file(fromCf)
const parts = Math.max(64 * 1024, Math.min(16 * MB, Math.ceil(archiveBack.size / 4)))
const t1 = performance.now()
const pushed = await pushArchive(backUrl, backCode, archiveBack, { partBytes: parts }).catch((error: unknown) =>
  fail(`the worker's archive did not load into the fresh Bun blog: ${(error as Error).message}`))
console.log(`✓ loaded into the fresh Bun blog in ${pushed.parts} parts through /setup/restore/parts (${((performance.now() - t1) / 1000).toFixed(1)} s): ${pushed.tables} tables, ${pushed.uploads} uploads`)
const faults = sameBlog({ data, uploads }, back)
if (faults.length) fail(`Bun → Cloudflare → Bun lost something:\n  ${faults.slice(0, 20).join('\n  ')}`)
console.log('✓ Bun → Cloudflare → Bun: no table came back with fewer rows, every upload byte-identical')

heap?.close()
stopAll()
if (process.env.KEEP !== '1') rmSync(WORK, { recursive: true, force: true })
console.log(`✓ cloudflare-dev: Bun → Cloudflare → smoke → backup → Bun, all green [${since()}]`)
