// The theme matrix: every look x every kind of public page x three widths x light and dark,
// photographed whole, and a pixel comparison of two such sets.
//
// WHY: the three appearance sheets are rewritten against a bar of "same pixels as before".
// That bar needs a baseline taken from the code as it stands and a comparison that counts
// pixels, because a person looking at two screenshots does not see a 2px shift.
//
//   bun scripts/theme-matrix.ts capture <outDir> [--port 3411] [--force] [--look-settings <file.json>]
//   bun scripts/theme-matrix.ts compare <dirA> <dirB> [--out <diffDir>]     (exit 1 on any difference)
//
// <outDir> must be under <repo>/.tmp/ (it is emptied first); one that already holds PNGs is refused
// unless --force. --look-settings is a JSON object keyed by look whose values are extra settings
// for that look, e.g. {"code":{"chromeFont":"jetbrains-mono"}}; each is read back after saving.
// capture exits 1 on any warning (wrong HTTP status, broken image) and keeps the server log of the
// cell in <outDir>/logs/. It writes <outDir>/COMMIT (HEAD, uncommitted changes or not, overrides);
// compare prints both COMMITs and refuses a side whose NOTES.txt is not "no warnings".
//
// capture seeds its own instance (the tour's seeder, `seed-showcase.ts`, plus one all-blocks
// post) under .tmp/theme-matrix-<port>/, serves it on the given port (refuses a busy port), and
// deletes it afterwards. One server per cell of settings, each started from a pristine copy of
// the seeded data, so a page view or a cache from one cell can never leak into the next.
//
// DETERMINISM, in the order it matters:
//  - Clock. The seeder and the server run under `theme-matrix-clock.ts` (`bun --preload`), a clock
//    that starts at CLOCK_ISO and then ticks; the browser's `Date` is frozen at CLOCK_ISO by a
//    script injected before any page script. "N days ago" and every window from now read the same
//    on every run, on any day.
//  - Dark mode. The instance keeps the shipped `defaultScheme: 'system'`, and the browser answers
//    `prefers-color-scheme` through CDP `Emulation.setEmulatedMedia`: the reader's real path.
//  - Motion. `prefers-reduced-motion: reduce` is emulated the same way; the caret is hidden.
//  - Loading. Lazy images are made eager, then `document.fonts.ready` and every image decode are awaited.
//  - Analytics. The headless user agent is classified as a bot and never recorded, so a shot
//    cannot change what a later shot's "most viewed" row shows.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { Browser } from './theme-matrix-browser'
import { compareDirs } from './theme-matrix-compare'

const CLOCK_ISO = '2026-07-30T17:00:00.000Z'
const LOOKS = ['plain', 'code', 'paper', 'notes'] as const
const WIDTHS = [375, 768, 1440] as const
const SCHEMES = ['light', 'dark'] as const

/** A page, and the home-page settings it needs. `front` pages only exist when the home is composed. */
type Page = { id: string; path: string; home: 'list' | 'front-image' | 'front-text' }
const PAGES: Page[] = [
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
]

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const USAGE = 'usage:\n  bun scripts/theme-matrix.ts capture <outDir> [--port 3411] [--force] [--look-settings <file.json>]\n'
  + '  bun scripts/theme-matrix.ts compare <dirA> <dirB> [--out <diffDir>]'

/** Runs a child to completion; a failure throws with its output. */
function run(cmd: string[], env: Record<string, string>): void {
  const p = Bun.spawnSync(cmd, { env: { ...process.env, ...env }, stdout: 'pipe', stderr: 'pipe' })
  if (p.exitCode !== 0) {
    throw new Error(`${cmd.join(' ')} failed (${p.exitCode})\n${p.stdout}\n${p.stderr}`)
  }
}

function git(...gitArgs: string[]): string {
  const p = Bun.spawnSync(['git', ...gitArgs], { stdout: 'pipe', stderr: 'pipe' })
  if (p.exitCode !== 0) throw new Error(`git ${gitArgs.join(' ')} failed: ${p.stderr}`)
  return p.stdout.toString().trim()
}

/** A tour on a busy port tours somebody else's instance; refuse instead (see `scripts/ops/tour.sh`). */
function assertPortFree(port: number): void {
  try {
    Bun.serve({ port, hostname: '127.0.0.1', fetch: () => new Response('') }).stop(true)
  } catch {
    throw new Error(`port ${port} is in use. Stop what is on it or pass --port <free port>.`)
  }
}

/** Where a Chrome for Testing headless shell was unpacked outside the repo, when CHROME is not set. */
function defaultBrowser(): void {
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
function checkedOut(out: string, force: boolean): string {
  const abs = resolve(out)
  const root = resolve('.tmp')
  const under = abs.toLowerCase().startsWith((root + sep).toLowerCase()) && abs.length > root.length + 1
  if (!under) throw new Error(`refusing ${abs}: the output directory must be inside ${root}`)
  const holdsPngs = existsSync(abs) && readdirSync(abs).some((f) => f.endsWith('.png'))
  if (holdsPngs && !force) throw new Error(`refusing ${abs}: it already holds screenshots. Pass --force to replace them.`)
  return abs
}

function loadLookSettings(file: string | undefined): Record<string, Record<string, unknown>> {
  if (!file) return {}
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error(`${file}: expected an object keyed by look`)
  for (const [look, value] of Object.entries(parsed)) {
    if (!(LOOKS as readonly string[]).includes(look)) throw new Error(`${file}: "${look}" is not a look`)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${file}: "${look}" must be an object of settings`)
  }
  return parsed as Record<string, Record<string, unknown>>
}

async function waitHealthy(base: string): Promise<void> {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return } catch { /* not up yet */ }
    await Bun.sleep(250)
  }
  throw new Error(`the server did not answer ${base}/api/health in 30s`)
}

async function capture(outArg: string, port: number): Promise<number> {
  defaultBrowser()
  const out = checkedOut(outArg, args.includes('--force'))
  const overridesByLook = loadLookSettings(flag('--look-settings'))
  assertPortFree(port)
  const started = Date.now()
  // Per port, so two captures on two ports never delete each other's seeded data.
  const work = resolve(`.tmp/theme-matrix-${port}`)
  const bun = process.execPath
  const clock = resolve('scripts/theme-matrix-clock.ts')
  // CRON_INTERNAL=0: the in-process scheduler (`src/server/tick.ts`) would otherwise publish or
  // purge on its own timer while shots are being taken.
  const env = { THEME_MATRIX_NOW: CLOCK_ISO, STORAGE_LOCAL_DIR: join(work, 'uploads'), UPDATE_CHECK: '0', CRON_INTERNAL: '0' }

  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })

  const head = git('rev-parse', 'HEAD')
  const dirty = git('status', '--porcelain') !== ''
  writeFileSync(join(out, 'COMMIT'), `${head}\ndirty=${dirty ? 'yes' : 'no'}\nclock=${CLOCK_ISO}\n`
    + `look-settings=${JSON.stringify(overridesByLook)}\n`)

  const base = `http://127.0.0.1:${port}`
  const notes: string[] = []
  let count = 0
  let browser: Browser | undefined
  try {
    // The server reads the island bundles off disk; a stale build photographs the last change.
    run([bun, 'run', 'build:assets'], {})
    run([bun, 'run', 'build:admin'], {})

    const pristine = join(work, 'pristine')
    run([bun, '--preload', clock, 'scripts/seed-showcase.ts', pristine, 'text', 'list'], { ...env, SEED_NOW: CLOCK_ISO })
    run([bun, '--preload', clock, 'scripts/theme-matrix-setup.ts', 'fixture'], { ...env, DATA_DIR: pristine })

    browser = await Browser.open(CLOCK_ISO)
    for (const look of LOOKS) {
      for (const home of ['list', 'front-image', 'front-text'] as const) {
        const data = join(work, 'cell')
        const log = join(work, 'server.log')
        const cell = `${look}-${home}`
        const notesBefore = notes.length
        rmSync(data, { recursive: true, force: true })
        cpSync(pristine, data, { recursive: true })
        const [mode, kind] = home === 'list' ? ['list', 'text'] : ['front', home.slice('front-'.length)]
        run([bun, '--preload', clock, 'scripts/theme-matrix-setup.ts', 'cell', look, mode!, kind!],
          { ...env, DATA_DIR: data, THEME_MATRIX_OVERRIDES: JSON.stringify(overridesByLook[look] ?? {}) })

        const server = Bun.spawn([bun, '--preload', clock, 'src/index.ts'], {
          env: { ...process.env, ...env, DATA_DIR: data, PORT: String(port), SITE_URL: base },
          stdout: Bun.file(log), stderr: Bun.file(log),
        })
        let failed = false
        try {
          await waitHealthy(base)
          for (const page of PAGES.filter((p) => p.home === home)) {
            for (const width of WIDTHS) {
              for (const scheme of SCHEMES) {
                await browser.setup(width, scheme)
                const shot = await browser.shoot(base + page.path)
                const expected = page.id === 'not-found' ? 404 : 200
                const name = `${look}__${page.id}__${width}__${scheme}.png`
                if (shot.look !== look) throw new Error(`${name}: the page says look "${shot.look}", the cell is "${look}"`)
                if (shot.status !== expected) notes.push(`${name}: HTTP ${shot.status}, expected ${expected}`)
                if (shot.broken.length) notes.push(`${name}: ${shot.broken.length} image(s) did not load: ${shot.broken.slice(0, 2).join(' ')}`)
                await Bun.write(join(out, name), shot.png)
                count++
              }
            }
          }
        } catch (error) {
          failed = true
          throw error
        } finally {
          server.kill()
          await server.exited
          // The log of a cell that went wrong is the only record of why; the work dir is deleted at the end.
          if ((failed || notes.length > notesBefore) && existsSync(log)) {
            mkdirSync(join(out, 'logs'), { recursive: true })
            cpSync(log, join(out, 'logs', `${cell}.server.log`))
          }
        }
      }
    }
  } finally {
    await browser?.close()
    rmSync(work, { recursive: true, force: true })
  }
  writeFileSync(join(out, 'NOTES.txt'), notes.length ? notes.join('\n') + '\n' : 'no warnings\n')
  console.log(`captured ${count} images into ${out} in ${((Date.now() - started) / 1000).toFixed(0)}s (${head.slice(0, 10)}${dirty ? ', uncommitted changes' : ''})`)
  if (notes.length) {
    console.error(`${notes.length} warning(s), see ${join(out, 'NOTES.txt')}:\n  ${notes.slice(0, 8).join('\n  ')}`)
    return 1
  }
  return 0
}

const readSide = (dir: string, file: string): string => {
  const p = join(dir, file)
  return existsSync(p) ? readFileSync(p, 'utf8').trim() : '(missing)'
}

/** Both sides' provenance first; a side captured with warnings cannot be a reference. */
async function compare(a: string, b: string, diffDir: string | null): Promise<number> {
  for (const [label, dir] of [['A', a], ['B', b]] as const) {
    console.log(`${label} ${dir}\n  ${readSide(dir, 'COMMIT').replace(/\n/g, '\n  ')}`)
  }
  for (const [label, dir] of [['A', a], ['B', b]] as const) {
    const notes = readSide(dir, 'NOTES.txt')
    if (notes !== 'no warnings') {
      console.error(`compare: refusing, ${label} (${dir}) was not captured clean (NOTES.txt: ${notes.split('\n')[0]})`)
      return 1
    }
  }
  return compareDirs(a, b, diffDir)
}

const [command, a, b] = args
try {
  if (command === 'capture' && a) process.exitCode = await capture(a, Number(flag('--port') ?? 3411))
  else if (command === 'compare' && a && b) process.exitCode = await compare(a, b, flag('--out') ?? null)
  else { console.error(USAGE); process.exitCode = 2 }
} catch (error) {
  console.error(`theme-matrix: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
