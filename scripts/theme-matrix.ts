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
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Browser, OPEN_BOOK } from './theme-matrix-browser'
import { compareDirs } from './theme-matrix-compare'
import {
  assertPortFree, checkedOut, CLOCK_ISO, CLOCK_PRELOAD, defaultBrowser, instanceEnv, MATRIX_PAGES as PAGES,
  run, seedPristine, startServer, waitHealthy,
} from './theme-matrix-instance'

const LOOKS = ['plain', 'code', 'paper', 'notes'] as const
const WIDTHS = [375, 768, 1440] as const
const SCHEMES = ['light', 'dark'] as const

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const USAGE = 'usage:\n  bun scripts/theme-matrix.ts capture <outDir> [--port 3411] [--force] [--look-settings <file.json>]\n'
  + '  bun scripts/theme-matrix.ts compare <dirA> <dirB> [--out <diffDir>]'

function git(...gitArgs: string[]): string {
  const p = Bun.spawnSync(['git', ...gitArgs], { stdout: 'pipe', stderr: 'pipe' })
  if (p.exitCode !== 0) throw new Error(`git ${gitArgs.join(' ')} failed: ${p.stderr}`)
  return p.stdout.toString().trim()
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

async function capture(outArg: string, port: number): Promise<number> {
  defaultBrowser()
  const out = checkedOut(outArg, args.includes('--force'))
  const overridesByLook = loadLookSettings(flag('--look-settings'))
  assertPortFree(port)
  const started = Date.now()
  // Per port, so two captures on two ports never delete each other's seeded data.
  const work = resolve(`.tmp/theme-matrix-${port}`)
  const bun = process.execPath
  const env = instanceEnv(work)

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
    const pristine = join(work, 'pristine')
    seedPristine(pristine, env)

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
        run([bun, '--preload', CLOCK_PRELOAD, 'scripts/theme-matrix-setup.ts', 'cell', look, mode!, kind!],
          { ...env, DATA_DIR: data, THEME_MATRIX_OVERRIDES: JSON.stringify(overridesByLook[look] ?? {}) })

        const server = startServer(data, port, log, env)
        let failed = false
        try {
          await waitHealthy(base)
          for (const page of PAGES.filter((p) => p.home === home)) {
            for (const width of WIDTHS) {
              for (const scheme of SCHEMES) {
                await browser.setup(width, scheme)
                const shot = await browser.shoot(base + page.path, page.then === 'book' ? OPEN_BOOK : undefined)
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
          await server.stop()
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
