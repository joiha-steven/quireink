// `bun run upgrade` — move a source install to a newer release, and back if it does not come up
// (ADR 0065). It replaces the four commands `docs/self-host.md` §9 used to ask for:
//
//   1. find the release: the one named on the command line, or the newest tag on the remote;
//   2. remember where the checkout is now, then check the release out;
//   3. `bun install --frozen-lockfile --production` and the two builds the server reads from disk;
//   4. restart the blog: QUIREINK_RESTART if set, else systemd when it can be asked, else the
//      person running this is told the command and the script waits for them;
//   5. wait for /api/health to report the new version;
//   6. if any step fails: the old checkout, rebuilt, restarted, and the copy of the database
//      taken before any migration ran (ADR 0063) named, so nothing is guessed on a bad day.
//
// Run it from the checkout, as the user the blog runs as:  bun run upgrade [2.2.17]
//
// Options (environment, or the blog's own .env, which Bun reads):
//   QUIREINK_RESTART="cmd"     how to restart the blog, e.g. "sudo systemctl restart quire"
//   QUIREINK_SERVICE=quire     the systemd unit to restart when no command is given
//   QUIREINK_HEALTH_URL=       where to ask; defaults to http://127.0.0.1:$PORT/api/health
//   QUIREINK_HEALTH_TIMEOUT=   seconds to wait after the restart (default 120; 600 when the
//                              person running this has to restart it by hand)
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const cwd = process.cwd()
const BUN = process.env.QUIREINK_BUN || process.execPath
const startedAt = Date.now()

function say(text: string): void { console.log(`\n\x1b[1m${text}\x1b[0m`) }
function step(text: string): void { console.log(`  ${text}`) }
function stop(text: string): never {
  console.error(`\n\x1b[31mStopped:\x1b[0m ${text}\n`)
  process.exit(1)
}

function run(cmd: string, args: string[], quiet = false): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: quiet ? 'pipe' : ['ignore', 'inherit', 'inherit'] })
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() }
}
const git = (...args: string[]) => run('git', args, true)

/** Numeric, field by field. A pre-release is never chosen by default, so it never has to be compared. */
export function newer(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  return false
}

export function newestRelease(lsRemote: string): string | null {
  const versions = [...lsRemote.matchAll(/refs\/tags\/v(\d+\.\d+\.\d+)$/gm)].map((m) => m[1]!)
  return versions.reduce<string | null>((best, v) => (best === null || newer(v, best) ? v : best), null)
}

const versionOf = (): string => {
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) as { version: string }
  return pkg.version
}

// --production for the reason `install.sh` gives beside its own install: the devDependencies are
// the workshop (wrangler alone brings 125 MB of workerd), and neither build reads them.
function build(): boolean {
  return run(BUN, ['install', '--frozen-lockfile', '--production']).ok
    && run(BUN, ['run', 'build:assets']).ok
    && run(BUN, ['run', 'build:admin']).ok
}

/** 'ran' when a restart was issued, 'manual' when the person running this has to do it. */
function restart(): 'ran' | 'manual' | 'failed' {
  const custom = process.env.QUIREINK_RESTART
  if (custom) return spawnSync('sh', ['-c', custom], { cwd, stdio: 'inherit' }).status === 0 ? 'ran' : 'failed'
  const unit = process.env.QUIREINK_SERVICE || 'quire'
  const hasSystemd = spawnSync('systemctl', ['cat', unit], { stdio: 'ignore' }).status === 0
  if (hasSystemd) {
    const asRoot = process.getuid?.() === 0
    const r = asRoot
      ? spawnSync('systemctl', ['restart', unit], { stdio: 'inherit' })
      : spawnSync('sudo', ['-n', 'systemctl', 'restart', unit], { stdio: 'inherit' })
    if (r.status === 0) return 'ran'
  }
  step(`Restart the blog now, the way you always do${hasSystemd ? ` (sudo systemctl restart ${unit})` : ''}.`)
  step('This waits for it, and gives up after ten minutes.')
  return 'manual'
}

const waitSeconds = (how: 'ran' | 'manual'): number =>
  Number(process.env.QUIREINK_HEALTH_TIMEOUT) || (how === 'manual' ? 600 : 120)

async function waitFor(version: string, seconds: number): Promise<boolean> {
  const url = process.env.QUIREINK_HEALTH_URL || `http://127.0.0.1:${process.env.PORT || 3000}/api/health`
  const deadline = Date.now() + seconds * 1000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      const body = (await res.json()) as { status?: string; version?: string }
      if (res.ok && body.status === 'ok' && body.version === version) return true
    } catch {
      // Not up yet, or still the old process going down. Ask again.
    }
    await Bun.sleep(1000)
  }
  return false
}

/** The copies of the database the new version took before migrating, if it got that far. */
function copiesSinceStart(): string[] {
  const dir = join(resolve(cwd, process.env.DATA_DIR || './data'), 'backups')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((n) => n.startsWith('pre-') && statSync(join(dir, n)).mtimeMs >= startedAt)
    .map((n) => join(dir, n))
}

async function main(): Promise<void> {
  if (!existsSync(join(cwd, '.git')) || !existsSync(join(cwd, 'package.json'))) {
    stop('run this from the Quire Ink checkout, the directory install.sh made.')
  }
  const pkg = process.env.QUIREINK_PACKAGE || 'source'
  if (pkg === 'docker') stop('this blog runs from the image. Upgrade it with: docker compose pull && docker compose up -d')
  if (pkg === 'cloudflare') stop('this blog runs on Cloudflare. Upgrade it from the admin, or sync your fork on GitHub.')
  if (git('status', '--porcelain', '--untracked-files=no').out !== '') {
    stop('files that came with Quire Ink have been edited here. An upgrade would overwrite them, so it will not start. `git status` shows which.')
  }

  const have = versionOf()
  const asked = process.argv[2]?.replace(/^v/, '')
  const want = asked || newestRelease(git('ls-remote', '--tags', '--refs', 'origin', 'v*').out)
  if (!want) stop('could not list the releases on the remote. Is there a network?')
  if (!asked && !newer(want, have)) {
    say(`Already on the newest release, ${have}.`)
    return
  }
  if (asked && !newer(want, have)) stop(`this blog runs ${have}; ${want} is not newer. An upgrade never goes back.`)

  const from = git('rev-parse', 'HEAD').out
  say(`Upgrading ${have} -> ${want}`)
  if (!git('fetch', '--quiet', '--depth', '1', 'origin', `refs/tags/v${want}:refs/tags/v${want}`).ok) stop(`there is no release ${want}.`)
  git('checkout', '--quiet', '--detach', `v${want}`)

  const back = async (why: string): Promise<never> => {
    say(`${why} Going back to ${have}.`)
    git('checkout', '--quiet', '--detach', from)
    const rebuilt = build()
    const restarted = rebuilt ? restart() : 'failed'
    const up = restarted !== 'failed' && await waitFor(have, waitSeconds(restarted))
    const copies = copiesSinceStart()
    if (copies.length) {
      step('The new version changed the database before it failed. The copy taken first:')
      for (const c of copies) step(`  ${c}`)
      step('Restore it with the blog stopped, as docs/backups.md "Restoring" shows.')
    }
    stop(up ? `${want} did not come up, and ${have} is running again.` : `${want} did not come up, and ${have} has not answered yet either. Check the log.`)
  }

  say('Installing and building')
  if (!build()) return back('The build failed.')

  say('Restarting')
  const how = restart()
  if (how === 'failed') return back('The restart command failed.')
  const timeout = waitSeconds(how)
  if (!await waitFor(want, timeout)) return back(`It did not report ${want} within ${timeout} s.`)

  say(`Done: ${want} is running.`)
}

if (import.meta.main) await main()
