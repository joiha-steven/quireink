// `bun run theme:tiles`: the pictures on the built-in theme tiles (Settings → Appearance → Theme,
// and the first-run look step), photographed from the themes themselves.
//
// The tiles used to carry drawings of bars, which read as placeholders beside an installed theme's
// real `screenshot.webp`. These are the same kind of picture: the front page of the showcase blog,
// top of the page, wearing each built-in theme, once light and once dark.
//
// Same instance as `theme:matrix` and `theme:preview` (`theme-matrix-instance.ts`): the tour's
// seeder plus the matrix's fixture post, under the pinned clock, so "N days ago" and every other
// moving part reads the same on every run. Each theme is chosen through the settings writer with
// the chrome font it suggests applied, because pressing the tile applies it (`data-suggests`), and
// the engine's default chrome font when it suggests none.
//
// Output, ready to commit: `src/assets/static/theme-shots/<id>-<light|dark>.webp` and
// `versions.json` beside them, the first characters of each file's SHA-256. The server puts that
// in the URL (`web/theme-shots.ts`), so a regenerated picture is a new URL under a year-long
// `immutable`, and `theme-shots.test.ts` fails when a file and its version disagree.
//
//   bun run theme:tiles [--port <n>]
//
// Rerun after a change to a built-in theme's sheet, the showcase seed or the base sheet that moves
// the front page. Exit 0 written · 1 the run failed or a picture is over budget · 2 bad usage.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { DEFAULT_CHROME_FONT } from '@/content/fonts'
import { BUILTIN_THEMES } from '@/content/themes-builtin'
import { Browser } from './theme-matrix-browser'
import {
  assertPortFree, CLOCK_ISO, CLOCK_PRELOAD, defaultBrowser, freePort, instanceEnv, run, seedPristine,
  startServer, waitHealthy,
} from './theme-matrix-instance'

/** The window the page is drawn in: a laptop's width, cut to the tile's 5:3 from the top. */
const VIEW = { width: 1200, height: 720 }
/** The file: the tile's art box (240 x 144 at its widest, 1440) at twice its pixels. */
const FILE = { width: 480, height: 288 }
/** Bytes per picture. Quality steps down from the first until the file fits. */
const BUDGET = 20 * 1024
const QUALITIES = [82, 76, 70, 64, 58] as const
const SCHEMES = ['light', 'dark'] as const

const SHOTS_DIR = resolve('src/assets/static/theme-shots')

const args = process.argv.slice(2)
const portArg = args[0] === '--port' ? Number(args[1]) : null
const argsOk = args.length === 0 || (args.length === 2 && Number.isInteger(portArg) && portArg! > 0)
if (!argsOk) {
  console.error('usage: bun run theme:tiles [--port <n>]')
  process.exit(2)
}

/** The smallest-loss WebP of `png` that fits the budget, cropped and scaled to the tile. */
async function encode(png: Buffer): Promise<{ bytes: Buffer; quality: number }> {
  const scaled = await sharp(png).extract({ left: 0, top: 0, ...VIEW }).resize(FILE.width, FILE.height).png().toBuffer()
  for (const quality of QUALITIES) {
    const bytes = await sharp(scaled).webp({ quality, effort: 6, smartSubsample: true }).toBuffer()
    if (bytes.length <= BUDGET) return { bytes, quality }
  }
  throw new Error(`no quality down to ${QUALITIES.at(-1)} fits ${BUDGET} bytes`)
}

const version = (bytes: Buffer): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex').slice(0, 12)

async function main(): Promise<number> {
  defaultBrowser()
  const port = portArg ?? freePort()
  assertPortFree(port)
  const work = resolve(`.tmp/theme-tiles-${port}`)
  const env = instanceEnv(work)
  const base = `http://127.0.0.1:${port}`
  const versions: Record<string, string> = {}
  const lines: string[] = []
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  mkdirSync(SHOTS_DIR, { recursive: true })
  let browser: Browser | undefined
  try {
    const pristine = join(work, 'pristine')
    seedPristine(pristine, env)
    browser = await Browser.open(CLOCK_ISO)
    for (const theme of BUILTIN_THEMES) {
      const data = join(work, 'cell')
      rmSync(data, { recursive: true, force: true })
      cpSync(pristine, data, { recursive: true })
      // The seed sets its chrome in JetBrains Mono; a theme that suggests no face is shown in the
      // engine's default, which is what a new blog wearing it looks like.
      const overrides = { chromeFont: theme.suggests.chromeFont ?? DEFAULT_CHROME_FONT }
      run([process.execPath, '--preload', CLOCK_PRELOAD, 'scripts/theme-matrix-setup.ts', 'cell', theme.id, 'list', 'text'],
        { ...env, DATA_DIR: data, THEME_MATRIX_OVERRIDES: JSON.stringify(overrides) })
      const server = startServer(data, port, join(work, `${theme.id}.server.log`), env)
      try {
        await waitHealthy(base)
        for (const scheme of SCHEMES) {
          await browser.setup(VIEW.width, scheme)
          const shot = await browser.shoot(`${base}/`)
          const name = `${theme.id}-${scheme}`
          if (shot.status !== 200) throw new Error(`${name}: the front page answered ${shot.status}`)
          if (shot.look !== theme.id) throw new Error(`${name}: the page wears "${shot.look}"`)
          if (shot.broken.length) throw new Error(`${name}: ${shot.broken.length} image(s) did not load: ${shot.broken[0]}`)
          const { bytes, quality } = await encode(shot.png)
          writeFileSync(join(SHOTS_DIR, `${name}.webp`), bytes)
          versions[name] = version(bytes)
          lines.push(`${name}.webp  ${bytes.length} bytes  q${quality}`)
        }
      } finally {
        await server.stop()
      }
    }
  } finally {
    await browser?.close()
    rmSync(work, { recursive: true, force: true })
  }
  writeFileSync(join(SHOTS_DIR, 'versions.json'), JSON.stringify(versions, null, 2) + '\n')
  console.log(`${lines.join('\n')}\nwrote ${lines.length} pictures and versions.json to ${SHOTS_DIR}`)
  return 0
}

try {
  process.exitCode = await main()
} catch (error) {
  console.error(`theme:tiles: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
