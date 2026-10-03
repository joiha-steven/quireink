// `bun run test:cf` — the port contracts inside workerd, the runtime Cloudflare runs (ADR 0066).
//
// Builds `scripts/cf-test/worker.ts` with the Cloudflare side of the seam, starts it with
// `wrangler dev --local` on a free port, runs every case of every contract in a Durable Object of its
// own, and prints one line per case. Red if any case fails or the worker does not come up. The Bun
// side runs the same suites under `bun test`.
import { spawn, spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const PORT = Number(process.env.CF_TEST_PORT || 8797)
const STATE = join(ROOT, '.tmp', 'cf-test-state')

const built = spawnSync(process.execPath, ['scripts/build-worker.ts', '--entry', 'scripts/cf-test/worker.ts', '--out', 'dist/cf-test'], { cwd: ROOT, stdio: 'inherit' })
if (built.status !== 0) process.exit(1)

rmSync(STATE, { recursive: true, force: true })
const dev = spawn(join(ROOT, 'node_modules', '.bin', 'wrangler'), ['dev', '--local', '--port', String(PORT), '--persist-to', STATE, '--config', 'scripts/cf-test/wrangler.jsonc'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
let log = ''
dev.stdout.on('data', (d) => { log += d })
dev.stderr.on('data', (d) => { log += d })
const stop = () => { try { dev.kill('SIGTERM') } catch { /* gone */ } }
process.on('exit', stop)

const base = `http://127.0.0.1:${PORT}`
let cases: string[] | null = null
for (let i = 0; i < 90 && !cases; i++) {
  try {
    const res = await fetch(`${base}/cases`)
    if (res.ok) cases = (await res.json()) as string[]
  } catch { /* not up yet */ }
  if (!cases) await Bun.sleep(1000)
}
if (!cases) {
  console.error('✗ test:cf: the contract worker never came up\n' + log.slice(-2000))
  stop()
  process.exit(1)
}

let failed = 0
for (let i = 0; i < cases.length; i++) {
  const result = (await (await fetch(`${base}/run?case=${i}`)).json()) as { name: string; ok: boolean; error?: string }
  if (result.ok) console.log(`  ✓ ${result.name}`)
  else { failed++; console.log(`  ✗ ${result.name} — ${result.error}`) }
}
stop()
console.log(failed ? `✗ test:cf: ${failed} of ${cases.length} failed in workerd` : `✓ test:cf: ${cases.length} case(s) pass in workerd`)
process.exit(failed ? 1 : 0)
