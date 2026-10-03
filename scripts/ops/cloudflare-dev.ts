// The install smoke on the Cloudflare build, locally (ADR 0066, G2.6 and the first half of G4.4):
// a blog moved from Bun to workerd by the door a person moving a blog uses, then checked the way
// every other package is checked.
//
//   bun run build && bun run build:worker
//   bun scripts/ops/cloudflare-dev.ts
//
//   1. seed a throwaway Bun blog with the showcase, serve it, and take its archive as its owner;
//   2. start the real worker under `wrangler dev --local` with a SETUP_CODE, empty;
//   3. load the archive through `/setup/restore`, as the form posts it;
//   4. `smoke.ts` against workerd as package `cloudflare`, with the owner session the archive
//      carried: health, the twelve smoke flows, restore-check and MCP.
//
// restore-check compares an archive with the files of the instance it came from, and a Durable
// Object has none — so it is handed the BUN blog's files, which is the stronger question anyway:
// Bun → archive → Cloudflare → archive → restore must give back what Bun had.
//
// Everything lives under `.tmp/cloudflare-dev/` and goes when it ends. KEEP=1 leaves both running
// state on disk for a look afterwards.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { APP_VERSION } from '../../src/version'

const ROOT = resolve(import.meta.dir, '..', '..')
const WORK = join(ROOT, '.tmp', 'cloudflare-dev')
const BUN_PORT = Number(process.env.BUN_PORT || 3571)
const CF_PORT = Number(process.env.CF_PORT || 8790)
const bunUrl = `http://127.0.0.1:${BUN_PORT}`
const cfUrl = `http://127.0.0.1:${CF_PORT}`
const data = join(WORK, 'bun', 'data')
const uploads = join(WORK, 'bun', 'uploads')
const code = randomBytes(18).toString('base64url')

const children: ChildProcess[] = []
const stopAll = () => { for (const c of children) { try { c.kill('SIGTERM') } catch { /* gone */ } } }
process.on('exit', stopAll)
const fail = (why: string): never => {
  console.error(`✗ cloudflare-dev: ${why}`)
  stopAll()
  process.exit(1)
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

const bun = spawn(process.execPath, ['src/index.ts'], {
  cwd: ROOT, stdio: 'ignore',
  env: { ...process.env, DATA_DIR: data, STORAGE_LOCAL_DIR: uploads, PORT: String(BUN_PORT), UPDATE_CHECK: '0', SITE_URL: bunUrl, BACKUP_DIR: join(WORK, 'bun', 'backups') },
})
children.push(bun)
if (!(await waitFor(`${bunUrl}/api/health`, 40))) fail(`the Bun blog never answered on ${bunUrl}`)
const exported = await fetch(`${bunUrl}/api/backup/export`, { headers: { cookie: `__Host-quire_session=${session}` } })
if (!exported.ok) fail(`the Bun blog's /api/backup/export answered ${exported.status}`)
const archive = new Uint8Array(await exported.arrayBuffer())
// Stopped now, so the files restore-check compares against hold still.
bun.kill('SIGTERM')
console.log(`✓ the showcase on Bun, archived (${Math.round(archive.length / 1024)} KB)`)

// ----- 2. the worker, empty --------------------------------------------------------------------

const wrangler = spawn(join(ROOT, 'node_modules', '.bin', 'wrangler'), [
  'dev', '--local', '--port', String(CF_PORT), '--persist-to', join(WORK, 'cf-state'),
  '--var', `SETUP_CODE:${code}`, '--var', `SITE_URL:${cfUrl}`, '--var', 'UPDATE_CHECK:0',
], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
children.push(wrangler)
let log = ''
wrangler.stdout?.on('data', (d) => { log += d })
wrangler.stderr?.on('data', (d) => { log += d })
if (!(await waitFor(`${cfUrl}/api/health`, 90))) fail(`the worker never answered on ${cfUrl}\n${log.slice(-1500)}`)
console.log(`✓ the worker answers on ${cfUrl}`)

// ----- 3. the archive, through the first setup screen ------------------------------------------

const form = new FormData()
form.set('token', code)
form.set('identity', '')
form.set('passphrase', '')
form.set('archive', new File([archive], 'quire-backup.tar.gz'))
const loaded = await fetch(`${cfUrl}/setup/restore`, { method: 'POST', body: form, redirect: 'manual' })
if (loaded.status !== 303 || loaded.headers.get('location') !== '/login') {
  fail(`/setup/restore answered ${loaded.status} → ${loaded.headers.get('location')}\n${(await loaded.text()).slice(0, 600)}\n${log.slice(-1500)}`)
}
console.log('✓ the archive loaded into the empty worker through /setup/restore')

// ----- 4. the same smoke as every package ------------------------------------------------------

const smoke = spawnSync(process.execPath, ['scripts/smoke.ts', cfUrl], {
  cwd: ROOT, stdio: 'inherit',
  env: {
    ...process.env, EXPECT_VERSION: APP_VERSION, EXPECT_PACKAGE: 'cloudflare',
    QUIRE_SESSION: session, DATA_DIR: data, STORAGE_LOCAL_DIR: uploads,
  },
})
stopAll()
if (process.env.KEEP !== '1') rmSync(WORK, { recursive: true, force: true })
if (smoke.status !== 0) {
  console.error(`✗ cloudflare-dev: the smoke failed on workerd\n${log.slice(-2500)}`)
  process.exit(1)
}
console.log('✓ cloudflare-dev: Bun → archive → Cloudflare → smoke, all green')
