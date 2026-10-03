// `bun run deploy`: build Quire Ink for Cloudflare and hand it to `wrangler deploy` (ADR 0066).
//
// The same script runs on a laptop and on Cloudflare's own build machine. The Deploy to Cloudflare
// button, and every later push to the copy it made, run it there: Workers Builds pre-fills its
// deploy command from the `deploy` entry in package.json. Two things are different on that machine,
// and they are why this is a script and not one line in package.json:
//
//   1. **Its Bun is 1.2.15** (the build image's default, developers.cloudflare.com/workers/ci-cd/
//      builds/build-image/), older than the 1.3 this project needs and not the 1.3.14 that CI
//      builds and tests every release with. Measured 2026-10-03 from a clean clone: 1.2.15 does
//      build it, but its bundler writes a different worker and admin, so a button install would run
//      a build no release was ever tested as. On Workers Builds (`WORKERS_CI=1`) the script therefore
//      runs itself again under exactly BUILD_BUN, fetched by `bun x` from the npm registry the
//      dependencies came from a minute earlier: no setting for the owner to find, and no machine of
//      this project in the path. On a laptop, any Bun from 1.3 is used as it is.
//   2. **The build has to happen here.** `wrangler.jsonc` deliberately has no `build` field —
//      `wrangler dev` reruns it on every change, and `bun run build` empties src/admin/dist while it
//      does — and Workers Builds ignores that field anyway ("does not honor the configurations set
//      in Custom Builds", developers.cloudflare.com/workers/ci-cd/builds/configuration/). Workers
//      Builds may also run `bun run build` first, as its build command; that is harmless, and this
//      builds everything again from the start so the result never depends on it.
//
// Anything after `--` goes to `wrangler deploy`: `bun run deploy -- --dry-run` builds and checks
// without uploading.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'

/** The Bun every release is built and tested with — the `bun-version` in .github/workflows/ci.yml. */
export const BUILD_BUN = '1.3.14'
/** The oldest Bun a person's own machine may build with (package.json `engines`). */
const MIN_BUN = '1.3.0'
const AGAIN = 'QUIREINK_DEPLOY_BUN'

const ROOT = resolve(import.meta.dir, '..')
const onWorkersBuilds = process.env.WORKERS_CI === '1'
const args = process.argv.slice(2)

const wrongBun = onWorkersBuilds ? Bun.version !== BUILD_BUN : Bun.semver.order(Bun.version, MIN_BUN) < 0
if (wrongBun) {
  if (process.env[AGAIN]) {
    console.error(`✗ deploy: still on Bun ${Bun.version} after asking for ${BUILD_BUN}`)
    process.exit(1)
  }
  console.log(`deploy: Bun ${Bun.version} here, building with Bun ${BUILD_BUN}`)
  const again = spawnSync(process.execPath, ['x', `bun@${BUILD_BUN}`, import.meta.path, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, [AGAIN]: '1' },
  })
  process.exit(again.status ?? 1)
}

// Run again under `bun x`, this process is the right Bun but `bun` on PATH is still the old one,
// and `bun run build` calls `bun run build:assets` by name. A directory holding a `bun` that is
// this process goes first on PATH for everything below.
const env = { ...process.env }
let shim: string | null = null
if (process.env[AGAIN] && process.platform !== 'win32') {
  shim = mkdtempSync(join(tmpdir(), 'quireink-bun-'))
  symlinkSync(process.execPath, join(shim, 'bun'))
  env.PATH = `${shim}${delimiter}${env.PATH ?? ''}`
}

function step(what: string, argv: string[]): void {
  const r = spawnSync(process.execPath, argv, { cwd: ROOT, stdio: 'inherit', env })
  if (r.status !== 0) {
    console.error(`✗ deploy: ${what} failed`)
    if (shim) rmSync(shim, { recursive: true, force: true })
    process.exit(r.status ?? 1)
  }
}

console.log(`deploy: building with Bun ${Bun.version}`)
step('the islands and the admin', ['run', 'build'])
step('the Worker', ['run', 'build:worker'])
// `bun x` finds the wrangler in node_modules first: the version package.json pins, which is also
// the one Workers Builds says it uses.
// How this blog takes a newer release, for the update card in Settings: `git` when Workers Builds
// deploys a copy of the repository (the button), `cli` when a person ran this on their machine.
step('wrangler deploy', ['x', 'wrangler', 'deploy', '--var', `QUIREINK_UPDATES:${onWorkersBuilds ? 'git' : 'cli'}`, ...args])
if (shim) rmSync(shim, { recursive: true, force: true })
