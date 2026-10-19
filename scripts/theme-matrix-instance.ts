// The seeded, clock-pinned throwaway instance that `theme:matrix` photographs, shared with
// `theme:preview` so the two never disagree about what a page looks like.
//
// What is here and nowhere else: the clock both start from, the pages the matrix knows, the
// seeding (the tour's seeder plus the one all-blocks post), how a server for one cell of settings
// is started and stopped, and the rules for an output directory that is about to be emptied.
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

export const CLOCK_ISO = '2026-07-30T17:00:00.000Z'

/** A page, and the home-page settings it needs. `front` pages only exist when the home is composed. */
export type Page = { id: string; path: string; home: 'list' | 'front-image' | 'front-text'; then?: 'book' }
export const MATRIX_PAGES: Page[] = [
  { id: 'home-list', path: '/', home: 'list' },
  { id: 'front-image', path: '/', home: 'front-image' },
  { id: 'front-text', path: '/', home: 'front-text' },
  { id: 'post-all-blocks', path: '/matrix-every-block', home: 'list' },
  { id: 'post-series-table-footnote', path: '/thirty-six-views-ten-thousand-impressions', home: 'list' },
  { id: 'page', path: '/colophon', home: 'list' },
  { id: 'category', path: '/category/typography', home: 'list' },
  { id: 'tag', path: '/tag/craft', home: 'list' },
  { id: 'archive', path: '/archive', home: 'list' },
  { id: 'search', path: '/search?q=kerning', home: 'list' },
  { id: 'notes', path: '/notes', home: 'list' },
  { id: 'not-found', path: '/no-such-page-in-the-matrix', home: 'list' },
  // Book mode open on the post that carries every block: the spread at 768 and 1440, the scrolled
  // reader at 375. Its own surface, which the pages around it say nothing about.
  { id: 'post-book', path: '/matrix-every-block', home: 'list', then: 'book' },
]

/** Runs a child to completion; a failure throws with its output. */
export function run(cmd: string[], env: Record<string, string>, brief?: (stderr: string, stdout: string) => string): void {
  const p = Bun.spawnSync(cmd, { env: { ...process.env, ...env }, stdout: 'pipe', stderr: 'pipe' })
  if (p.exitCode !== 0) {
    // `brief` for an author, who wants the message; the matrix keeps the whole output and stack.
    if (brief) throw new Error(`${cmd.slice(1).join(' ')} failed (${p.exitCode}):\n${brief(p.stderr.toString(), p.stdout.toString())}`)
    throw new Error(`${cmd.join(' ')} failed (${p.exitCode})\n${p.stdout}\n${p.stderr}`)
  }
}

/** A tour on a busy port tours somebody else's instance; refuse instead (see `scripts/ops/tour.sh`). */
export function assertPortFree(port: number): void {
  try {
    Bun.serve({ port, hostname: '127.0.0.1', fetch: () => new Response('') }).stop(true)
  } catch {
    throw new Error(`port ${port} is in use. Stop what is on it or pass --port <free port>.`)
  }
}

/** A port nothing listens on right now, chosen by the system. */
export function freePort(): number {
  const probe = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response('') })
  const port = probe.port
  probe.stop(true)
  if (port === undefined) throw new Error('the system did not hand out a free port')
  return port
}

/** Where a Chrome for Testing headless shell was unpacked outside the repo, when CHROME is not set. */
export function defaultBrowser(): void {
  if (process.env.CHROME ?? process.env.CHROME_HEADLESS_SHELL) return
  const root = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'chrome-for-testing') : ''
  const exe = join(root, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')
  if (root && existsSync(exe)) process.env.CHROME = exe
}

/**
 * The output directory is emptied before a run, so it must be one nobody types by accident:
 * under `<repo>/.tmp/`, strictly below it, and without PNGs from an earlier run unless --force.
 * Paths are resolved first and compared case-insensitively, which is how Windows sees them.
 */
export function checkedOut(out: string, force: boolean, root: string = resolve('.tmp')): string {
  const abs = resolve(out)
  const under = abs.toLowerCase().startsWith((root + sep).toLowerCase()) && abs.length > root.length + 1
  if (!under) throw new Error(`refusing ${abs}: the output directory must be inside ${root}`)
  const holdsPngs = existsSync(abs) && readdirSync(abs).some((f) => f.endsWith('.png'))
  if (holdsPngs && !force) throw new Error(`refusing ${abs}: it already holds screenshots. Pass --force to replace them.`)
  return abs
}

export async function waitHealthy(base: string): Promise<void> {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return } catch { /* not up yet */ }
    await Bun.sleep(250)
  }
  throw new Error(`the server did not answer ${base}/api/health in 30s`)
}

/** The environment every child of a run gets: the clock, the uploads beside the data, no timers. */
export function instanceEnv(work: string): Record<string, string> {
  // CRON_INTERNAL=0: the in-process scheduler (`src/server/tick.ts`) would otherwise publish or
  // purge on its own timer while shots are being taken.
  return { THEME_MATRIX_NOW: CLOCK_ISO, STORAGE_LOCAL_DIR: join(work, 'uploads'), UPDATE_CHECK: '0', CRON_INTERNAL: '0' }
}

export const CLOCK_PRELOAD = resolve('scripts/theme-matrix-clock.ts')

/**
 * Builds what the server reads off disk, then seeds `pristine` with the showcase and the
 * all-blocks post. Every cell starts from a copy of it.
 */
export function seedPristine(pristine: string, env: Record<string, string>, brief?: Parameters<typeof run>[2]): void {
  const bun = process.execPath
  // The server reads the island bundles off disk; a stale build photographs the last change.
  run([bun, 'run', 'build:assets'], {}, brief)
  run([bun, 'run', 'build:admin'], {}, brief)
  run([bun, '--preload', CLOCK_PRELOAD, 'scripts/seed-showcase.ts', pristine, 'text', 'list'], { ...env, SEED_NOW: CLOCK_ISO }, brief)
  run([bun, '--preload', CLOCK_PRELOAD, 'scripts/theme-matrix-setup.ts', 'fixture'], { ...env, DATA_DIR: pristine }, brief)
}

export type Server = { stop(): Promise<void> }

/** Serves `data` on `port` under the pinned clock, its output in `log`. Not yet known healthy. */
export function startServer(data: string, port: number, log: string, env: Record<string, string>): Server {
  const base = `http://127.0.0.1:${port}`
  const server = Bun.spawn([process.execPath, '--preload', CLOCK_PRELOAD, 'src/index.ts'], {
    env: { ...process.env, ...env, DATA_DIR: data, PORT: String(port), SITE_URL: base },
    stdout: Bun.file(log), stderr: Bun.file(log),
  })
  return {
    async stop() {
      server.kill()
      await server.exited
    },
  }
}
