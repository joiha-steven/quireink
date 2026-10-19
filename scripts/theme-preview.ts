// `bun run theme:preview <theme dir|zip>`: a theme author's look at their theme on every kind of
// page a reader can reach, before anyone installs it (ADR 0072, T3).
//
// 1. The theme goes through `theme:check` first; a refused one prints the findings and stops.
// 2. A throwaway instance is seeded exactly as `theme:matrix` seeds one (same seeder, fixture post
//    and pinned clock, `theme-matrix-instance.ts`), plus a post with no title. The theme is
//    installed by the function `POST /api/themes` calls and chosen through the settings writer.
// 3. Every page in `theme-preview-plan.ts` at each width, light and dark, once per palette the
//    theme declares, photographed whole by the matrix's browser, and measured for layout faults
//    (`theme-preview-layout.ts`).
// 4. Shots, REPORT.txt and index.html (a contact sheet by page) go to `.tmp/theme-preview/<id>/`.
//
// exit 0 captured with no layout finding · 1 refused, a layout finding, or the run failed ·
// 2 bad usage (arguments, an output directory that is not allowed, a busy --port).
// The instance and the browser are stopped on every way out, Ctrl-C included. A run killed outright
// leaves its instance directory; the next run deletes it once its owner process is gone
// (`theme-preview-work.ts`), never by whether a port is free.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadThemePath } from './theme-check'
import { Browser, OPEN_BOOK } from './theme-matrix-browser'
import {
  assertPortFree, CLOCK_ISO, CLOCK_PRELOAD, defaultBrowser, freePort, instanceEnv, run, seedPristine,
  startServer, waitHealthy,
} from './theme-matrix-instance'
import { asMeasurement, layoutFindings, MEASURE, type LayoutFinding } from './theme-preview-layout'
import { cellsFor, fontsOf, parseArgs, SCHEMES, shotName, USAGE } from './theme-preview-plan'
import { indexHtml, reportText, type ShotRecord } from './theme-preview-report'
import { briefChildOutput, checkedPreviewOut, createWork, MARKER, RunResources, sweepStaleWork } from './theme-preview-work'

/** A mistake in how the command was called: exit 2, the message and the usage line. */
class UsageError extends Error {}

/** What has to be stopped or deleted when the run ends, however it ends (Ctrl-C included). */
const live = new RunResources()

const say = (line: string) => console.log(line)

export async function preview(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv)
  if (!parsed.ok) {
    console.error(`theme:preview: ${parsed.message}\n${USAGE}`)
    return 2
  }
  const args = parsed.args

  const loaded = await loadThemePath(args.theme)
  if (loaded.outcome.code !== 0 || !loaded.accepted) {
    console.error(loaded.outcome.lines.join('\n'))
    return loaded.outcome.code === 2 ? 2 : 1
  }
  say(loaded.outcome.lines.join('\n'))
  const { zip, manifest } = loaded.accepted

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
  const text = reportText(info, shots)
  writeFileSync(join(out, 'REPORT.txt'), text)
  writeFileSync(join(out, 'index.html'), indexHtml(info, shots))
  say(text.trimEnd().split('\n').slice(0, 40).join('\n'))
  say(`shots, REPORT.txt and index.html in ${out}`)
  return shots.some((s) => s.findings.length > 0) ? 1 : 0
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
