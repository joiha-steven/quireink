// `bun run theme:preview <theme dir|zip>`: a theme author's look at their theme on every kind of
// page a reader can reach, before anyone installs it (ADR 0072, T3).
//
// 1. The theme goes through `theme:check` first; a refused one prints the findings and stops.
// 2. A throwaway instance is seeded exactly as `theme:matrix` seeds one (same seeder, fixture post
//    and pinned clock, `theme-matrix-instance.ts`), plus a post with no title. The theme is
//    installed by the function `POST /api/themes` calls and chosen through the settings writer.
// 3. Every page in `theme-preview-plan.ts` at each width, light and dark, once per palette the
//    theme declares, photographed whole by the matrix's browser, and measured for layout faults
//    (`theme-preview-layout.ts`). Before the pages, every declaration of theme.css is put to the
//    same browser, and each it drops is a finding (`theme-preview-dropped.ts`).
// 4. Shots, REPORT.txt and index.html (a contact sheet by page) go to `.tmp/theme-preview/<id>/`,
//    with `screenshot.webp`: the tile's picture, made from the front page at 1440 in the light,
//    ready to copy into the theme. Stock macOS cannot write a WebP (`sips -s format webp` writes
//    nothing and exits 0), so an author had no way to make the one file every theme needs.
// A folder with no `screenshot.webp` yet is previewed with a blank one in its place, so a theme
// started from nothing can be looked at before it has a picture; the check still refuses it.
//
// exit 0 captured with no finding · 1 refused, a dropped declaration, a layout finding, or the run failed ·
// 2 bad usage (arguments, an output directory that is not allowed, a busy --port).
// The instance and the browser are stopped on every way out, Ctrl-C included. A run killed outright
// leaves its instance directory; the next run deletes it once its owner process is gone
// (`theme-preview-work.ts`), never by whether a port is free.
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import sharp from 'sharp'
import { SCREENSHOT_SIZE, THEME_LIMITS } from '@/theme'
import { leftOutOfFolder, loadThemePath } from './theme-check'
import { Browser, OPEN_BOOK } from './theme-matrix-browser'
import {
  assertPortFree, CLOCK_ISO, CLOCK_PRELOAD, defaultBrowser, freePort, instanceEnv, run, seedPristine,
  startServer, waitHealthy,
} from './theme-matrix-instance'
import { droppedIn, isMistake, type DroppedFinding } from './theme-preview-dropped'
import { asMeasurement, layoutFindings, MEASURE, type LayoutFinding } from './theme-preview-layout'
import { cellsFor, fontsOf, parseArgs, SCHEMES, shotName, USAGE } from './theme-preview-plan'
import { indexHtml, reportText, type ShotRecord } from './theme-preview-report'
import { briefChildOutput, checkedPreviewOut, createWork, MARKER, RunResources, sweepStaleWork } from './theme-preview-work'

/** A mistake in how the command was called: exit 2, the message and the usage line. */
class UsageError extends Error {}

/** What has to be stopped or deleted when the run ends, however it ends (Ctrl-C included). */
const live = new RunResources()

const say = (line: string) => console.log(line)

/** The window the tile's picture is cut from: 1440 wide, 4:3 from the top, scaled to 1200 x 900. */
const TILE_CROP = { left: 0, top: 0, width: 1440, height: 1080 } as const
const TILE_QUALITIES = [86, 80, 72, 64] as const

/** `screenshot.webp` from a whole-page shot: the top of it, at exactly the size the install asks for. */
export async function tilePicture(png: Uint8Array): Promise<Buffer> {
  const meta = await sharp(png).metadata()
  const crop = { ...TILE_CROP, height: Math.min(TILE_CROP.height, meta.height ?? TILE_CROP.height) }
  const scaled = await sharp(png).extract(crop)
    .resize(SCREENSHOT_SIZE.width, SCREENSHOT_SIZE.height, { fit: 'cover', position: 'top' }).png().toBuffer()
  for (const quality of TILE_QUALITIES) {
    const bytes = await sharp(scaled).webp({ quality, effort: 5 }).toBuffer()
    if (bytes.length <= THEME_LIMITS.imageBytes) return bytes
  }
  throw new Error('no WebP of the front page fits the 1 MiB a screenshot may have')
}

/** The shot the tile is made from: the front page with pictures, else the post list, at 1440 in the light. */
function tileSource(shots: readonly ShotRecord[]): ShotRecord | undefined {
  const at = (id: string) => shots.find((s) => s.page.id === id && s.width === 1440 && s.scheme === 'light')
  return at('front-image') ?? at('home-list')
}

/**
 * A copy of a theme folder with a blank `screenshot.webp` in it, when the folder has none; null
 * when it has one or is a zip. The copy leaves out what the check leaves out, and is the caller's
 * to delete.
 */
async function withStandInPicture(theme: string): Promise<string | null> {
  const dir = resolve(theme)
  let isDir = false
  try {
    isDir = statSync(dir).isDirectory()
  } catch {
    return null
  }
  if (!isDir || existsSync(join(dir, 'screenshot.webp'))) return null
  mkdirSync(resolve('.tmp'), { recursive: true })
  const copy = mkdtempSync(join(resolve('.tmp'), 'theme-preview-src-'))
  cpSync(dir, copy, { recursive: true, filter: (src) => src === dir || !leftOutOfFolder(basename(src)) })
  const blank = await sharp({ create: { ...SCREENSHOT_SIZE, channels: 3, background: { r: 200, g: 200, b: 200 } } }).webp().toBuffer()
  writeFileSync(join(copy, 'screenshot.webp'), blank)
  return copy
}

export async function preview(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv)
  if (!parsed.ok) {
    console.error(`theme:preview: ${parsed.message}\n${USAGE}`)
    return 2
  }
  const args = parsed.args

  const standIn = await withStandInPicture(args.theme)
  let loaded: Awaited<ReturnType<typeof loadThemePath>>
  try {
    loaded = await loadThemePath(standIn ?? args.theme)
  } finally {
    if (standIn !== null) rmSync(standIn, { recursive: true, force: true })
  }
  if (loaded.outcome.code !== 0 || !loaded.accepted) {
    console.error(loaded.outcome.lines.join('\n'))
    return loaded.outcome.code === 2 ? 2 : 1
  }
  if (standIn !== null) say('no screenshot.webp yet: previewing with a blank one; theme:check refuses the theme until it has one')
  say(loaded.outcome.lines.join('\n'))
  const { zip, manifest, css } = loaded.accepted

  let out: string
  let port: number
  try {
    out = checkedPreviewOut(args.out ?? join('.tmp', 'theme-preview', manifest.id), args.force, resolve('.tmp'))
    if (args.port !== null) assertPortFree(args.port)
    port = args.port ?? freePort()
  } catch (error) {
    throw new UsageError((error as Error).message)
  }

  defaultBrowser()
  for (const dir of sweepStaleWork(resolve('.tmp'))) say(`deleted ${dir}, left by a run that was killed`)
  const started = Date.now()
  const work = createWork(resolve('.tmp'))
  live.work = work
  const env = instanceEnv(work)
  const bun = process.execPath
  const base = `http://127.0.0.1:${port}`
  const cells = cellsFor(manifest, args.pages)
  const fonts = fontsOf(manifest)
  const shots: ShotRecord[] = []
  let dropped: DroppedFinding[] = []

  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, MARKER), 'made by theme:preview; --force may empty this directory.')
  try {
    say('building and seeding a throwaway instance...')
    const pristine = join(work, 'pristine')
    seedPristine(pristine, env, briefChildOutput)
    const zipFile = join(work, 'theme.zip')
    writeFileSync(zipFile, zip)
    run([bun, '--preload', CLOCK_PRELOAD, 'scripts/theme-preview-setup.ts', 'install', zipFile], { ...env, DATA_DIR: pristine }, briefChildOutput)

    const browser = await Browser.open(CLOCK_ISO)
    live.browser = browser
    dropped = await droppedIn(css, (expression) => browser.evaluate(expression))
    const mistakes = dropped.filter(isMistake).length
    if (mistakes > 0) say(`theme.css: the browser drops ${mistakes} declaration${mistakes === 1 ? '' : 's'}; REPORT.txt says which, and what to write instead`)
    for (const [n, cell] of cells.entries()) {
      const data = join(work, 'cell')
      const log = join(work, 'server.log')
      rmSync(data, { recursive: true, force: true })
      cpSync(pristine, data, { recursive: true })
      const [mode, kind] = cell.home === 'list' ? ['list', 'text'] : ['front', cell.home.slice('front-'.length)]
      run([bun, '--preload', CLOCK_PRELOAD, 'scripts/theme-preview-setup.ts', 'cell', manifest.id, mode!, kind!,
        cell.palette ?? '-', fonts.reading ?? '-', fonts.chrome ?? '-'], { ...env, DATA_DIR: data }, briefChildOutput)
      say(`cell ${n + 1}/${cells.length}: home ${cell.home}, palette ${cell.palette ?? 'default'}`)

      // Free between cells, so another program may have taken it; a server that cannot bind would
      // leave the shots to whatever answers there.
      assertPortFree(port)
      live.server = startServer(data, port, log, env)
      let failed = false
      try {
        await waitHealthy(base)
        for (const page of args.pages.filter((p) => p.home === cell.home)) {
          for (const width of args.widths) {
            for (const scheme of SCHEMES) {
              await browser.setup(width, scheme)
              const shot = await browser.shoot(base + page.path, page.then === 'book' ? OPEN_BOOK : undefined)
              const m = asMeasurement(await browser.evaluate(MEASURE))
              const file = shotName(page.id, cell.palette, width, scheme)
              if (m.theme !== manifest.id) throw new Error(`${file}: the page wears "${m.theme || 'a built-in theme'}", not "${manifest.id}"`)
              const findings: LayoutFinding[] = layoutFindings(m)
              const expected = page.id === 'not-found' ? 404 : 200
              if (shot.status !== expected) findings.unshift({ kind: 'http-status', detail: `HTTP ${shot.status}, expected ${expected}` })
              await Bun.write(join(out, file), shot.png)
              shots.push({ file, page, palette: cell.palette, width, scheme, status: shot.status, findings })
            }
          }
        }
      } catch (error) {
        failed = true
        throw error
      } finally {
        await live.server?.stop()
        live.server = undefined
        // The log of a cell that went wrong is the only record of why; the work dir is deleted at the end.
        if (failed && existsSync(log)) {
          mkdirSync(join(out, 'logs'), { recursive: true })
          cpSync(log, join(out, 'logs', `${cell.home}-${cell.palette ?? 'default'}.server.log`))
        }
      }
    }
  } finally {
    await live.release()
  }

  const info = { themeId: manifest.id, version: manifest.version, name: manifest.name, seconds: Math.round((Date.now() - started) / 1000), clock: CLOCK_ISO }
  const text = reportText(info, shots, dropped)
  writeFileSync(join(out, 'REPORT.txt'), text)
  writeFileSync(join(out, 'index.html'), indexHtml(info, shots, dropped))
  say(text.trimEnd().split('\n').slice(0, 40).join('\n'))
  say(`shots, REPORT.txt and index.html in ${out}`)
  const source = tileSource(shots)
  if (source) {
    writeFileSync(join(out, 'screenshot.webp'), await tilePicture(await Bun.file(join(out, source.file)).bytes()))
    say(`screenshot.webp (1200 x 900, from ${source.file}) in ${out}: copy it into the theme folder when it looks right`)
  } else {
    say('no screenshot.webp: it is made from the front page or the post list at 1440 in the light, and this run took neither')
  }
  return dropped.some(isMistake) || shots.some((s) => s.findings.length > 0) ? 1 : 0
}

if (import.meta.main) {
  // Ctrl-C or a kill: stop the server and the browser and delete the instance before leaving.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      console.error(`\ntheme:preview: ${signal}, stopping the instance`)
      void live.release().finally(() => process.exit(130))
    })
  }
  let code: number
  try {
    code = await preview(process.argv.slice(2))
  } catch (error) {
    const usage = error instanceof UsageError
    console.error(`theme:preview: ${error instanceof Error ? error.message : String(error)}${usage ? `\n${USAGE}` : ''}`)
    code = usage ? 2 : 1
  }
  process.exit(code)
}
