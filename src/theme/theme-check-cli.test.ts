// `bun run theme:check` (scripts/theme-check.ts): a directory and its zip must read the same,
// and the exit code must say what happened.
import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { checkThemePath, ruleAnchors, ZIP_STEP } from '../../scripts/theme-check'
import { CSS, MANIFEST, testZip, themeFiles, themeZip } from '@/theme/test-zip'
import en from '@/locales/admin/en'

const SCRIPT = resolve(import.meta.dir, '../../scripts/theme-check.ts')
const root = mkdtempSync(join(tmpdir(), 'theme-check-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

/** Writes the fixture package to a fresh directory, `over` replacing files as `themeFiles` does. */
function themeDir(name: string, over: Parameters<typeof themeFiles>[0] = {}): string {
  const dir = join(root, name)
  for (const f of themeFiles(over)) {
    mkdirSync(dirname(join(dir, f.name)), { recursive: true })
    writeFileSync(join(dir, f.name), f.data)
  }
  return dir
}


const REPO = resolve(import.meta.dir, '../..')

/** The anchors a markdown page answers to: GitHub's slug of each heading, and every `<a id>`. */
function anchorsOf(doc: string): Set<string> {
  const text = readFileSync(join(REPO, doc), 'utf8')
  const out = new Set<string>()
  for (const m of text.matchAll(/^#{1,6} (.+)$/gm)) out.add(m[1]!.trim().toLowerCase().replace(/[^\p{L}\p{N} -]/gu, '').replace(/ /g, '-'))
  for (const m of text.matchAll(/<a id="([^"]+)">/g)) out.add(m[1]!)
  return out
}

/** `docs/x.md#y` in `line` points at a heading or an `<a id>` that exists. */
function pointsAtSomething(line: string): boolean {
  const m = /(docs\/[\w-]+\.md)#([\w-]+)/.exec(line)
  return m !== null && anchorsOf(m[1]!).has(m[2]!)
}

const X = new TextEncoder().encode('x')
const BAD_CSS = `${CSS}\n.prose a{color:#ff0000}`

describe('theme:check', () => {
  it('passes a valid directory with one line naming id, version and file count', async () => {
    const out = await checkThemePath(themeDir('ok'))
    expect(out).toEqual({ code: 0, lines: ['ok · broadsheet 1.0.0 · 5 files'] })
  })

  it('refuses a hardcoded colour with rule, file:line:col and subject', async () => {
    const out = await checkThemePath(themeDir('bad', { 'theme.css': BAD_CSS }))
    expect(out.code).toBe(1)
    expect(out.lines[0]).toMatch(/^C1 · theme\.css:3:\d+ · /)
    expect(out.lines[0]).toContain('#ff0000')
    expect(out.lines[1]).toContain('Colours come only from palettes')
  })

  it('gives the same answer for the directory and for the same theme zipped', async () => {
    const dir = themeDir('same', { 'theme.css': BAD_CSS })
    const zipPath = join(root, 'same.zip')
    writeFileSync(zipPath, themeZip({ 'theme.css': BAD_CSS }))
    expect(await checkThemePath(zipPath)).toEqual(await checkThemePath(dir))
    const okZip = join(root, 'ok.zip')
    writeFileSync(okZip, themeZip())
    expect(await checkThemePath(okZip)).toEqual(await checkThemePath(themeDir('ok2')))
  })

  it('judges a directory by its deflated zip, as an upload would be: 6 MB of compressible SVG passes', async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2">${'<rect width="1" height="1"/>'.repeat(37000)}</svg>`
    expect(svg.length).toBeLessThan(1048576)
    const big = Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`images/big${n}.svg`, svg]))
    const out = await checkThemePath(themeDir('big', big))
    expect(out).toEqual({ code: 0, lines: ['ok · broadsheet 1.0.0 · 11 files'] })
  })

  it('says a missing required file is missing, with the sentence the admin says for it', async () => {
    const out = await checkThemePath(themeDir('nopicture', { 'screenshot.webp': null }))
    expect(out.code).toBe(1)
    expect(out.lines[0]).toBe('A3 · screenshot.webp · missing')
    expect(out.lines[1]).toBe(`    ${en.themeRules.missing}`)
  })

  it('leaves out of a folder what macOS or Windows added, from the installer\'s own list, and says which', async () => {
    const out = await checkThemePath(themeDir('litter', { '.DS_Store': X, 'fonts/.DS_Store': X, 'Thumbs.db': X, 'desktop.ini': X, 'fonts/._body.woff2': X }))
    expect(out).toEqual({ code: 0, lines: [
      'left out what macOS or Windows add by themselves, as the zip commands in docs/themes.md do: .DS_Store, Thumbs.db, desktop.ini, fonts/.DS_Store, fonts/._body.woff2',
      'ok · broadsheet 1.0.0 · 5 files',
    ] })
  })

  it('leaves any other hidden file out of a folder with a warning that a zip carrying it is refused, as it is', async () => {
    const dir = themeDir('hidden', { '.htaccess': X })
    mkdirSync(join(dir, '.git'))
    writeFileSync(join(dir, '.git', 'HEAD'), 'ref')
    const out = await checkThemePath(dir)
    expect(out).toEqual({ code: 0, lines: [
      'warning: left out .git: the zip commands in docs/themes.md leave hidden files out, but a zip that carries one is refused (A3)',
      'warning: left out .htaccess: the zip commands in docs/themes.md leave hidden files out, but a zip that carries one is refused (A3)',
      'ok · broadsheet 1.0.0 · 5 files',
    ] })
    // What the warning says the install does: the same file in a zip is refused.
    const zipPath = join(root, 'htaccess.zip')
    writeFileSync(zipPath, themeZip({ '.htaccess': X }))
    expect((await checkThemePath(zipPath)).lines[0]).toBe('A3 · .htaccess · .htaccess')
  })

  it('reads a zip of the folder from inside it and leaves out what macOS added, saying both, as the install does', async () => {
    const zipPath = join(root, 'finder.zip')
    const inFolder = themeFiles().map((f) => ({ ...f, name: `My Theme/${f.name}` }))
    writeFileSync(zipPath, testZip([...inFolder, { name: '__MACOSX/My Theme/._theme.css', data: X }, { name: 'My Theme/fonts/.DS_Store', data: X }]))
    expect(await checkThemePath(zipPath)).toEqual({ code: 0, lines: [
      'read from inside the folder "My Theme/", as the install does',
      'left out 2 files macOS or Windows add by themselves (__MACOSX/, .DS_Store, Thumbs.db, desktop.ini), as the install does',
      'ok · broadsheet 1.0.0 · 5 files',
    ] })
  })

  it('says in one line where theme.json is when it is further in than one folder', async () => {
    const zipPath = join(root, 'deep.zip')
    writeFileSync(zipPath, testZip(themeFiles().map((f) => ({ ...f, name: `a/b/${f.name}` }))))
    const out = await checkThemePath(zipPath)
    expect(out.code).toBe(1)
    expect(out.lines[0]).toBe(`hint: theme.json is at "a/b/theme.json". It must be at the top of the zip, or in one folder at the top (${ZIP_STEP}).`)
  })

  it('names the page that explains each rule it reports, once per rule', async () => {
    const out = await checkThemePath(themeDir('explained', { 'theme.css': `${BAD_CSS}\n.deck{color:#00ff00}` }))
    expect(out.lines.filter((l) => l.startsWith('  C1  '))).toEqual(['  C1  docs/themes-css-rules.md#c1-a-colour-is-written-into-the-sheet'])
    expect(out.lines.at(-1)).toStartWith('Refused: 2 findings.')
  })

  // The command prints these; a heading renamed in the docs would leave them pointing nowhere.
  it('points only at anchors that exist: every rule\'s section, and the step that says how to zip', () => {
    const codes = Object.keys(en.themeRules).filter((k) => k !== 'other' && k !== 'missing')
    const anchors = ruleAnchors()
    expect(codes.filter((c) => !anchors.has(c))).toEqual([])
    for (const [code, where] of anchors) expect(pointsAtSomething(where), `${code} → ${where}`).toBe(true)
    expect(pointsAtSomething(ZIP_STEP)).toBe(true)
    const guide = readFileSync(join(REPO, 'docs/themes.md'), 'utf8')
    expect(guide).toMatch(/^5\. \*\*Zip the theme folder\.\*\*/m)
  })

  it('lets an empty subdirectory through, as the installer does with the directory record zip -r writes', async () => {
    const dir = themeDir('emptydir')
    mkdirSync(join(dir, 'extra'))
    const zipPath = join(root, 'emptydir.zip')
    writeFileSync(zipPath, testZip([...themeFiles(), { name: 'extra/', data: new Uint8Array(0) }]))
    const out = await checkThemePath(dir)
    expect(out).toEqual({ code: 0, lines: ['ok · broadsheet 1.0.0 · 5 files'] })
    expect(await checkThemePath(zipPath)).toEqual(out)
  })

  it('refuses a directory record the installer refuses (an unsafe name), through the same zip', async () => {
    const zipPath = join(root, 'dotdir.zip')
    writeFileSync(zipPath, testZip([...themeFiles(), { name: '../x/', data: new Uint8Array(0) }]))
    expect((await checkThemePath(zipPath)).code).toBe(1)
  })

  it('refuses a symlink instead of following it (skipped where the machine cannot make one)', async () => {
    const dir = themeDir('link')
    try {
      symlinkSync(join(dir, 'fonts/body.woff2'), join(dir, 'fonts/alias.woff2'))
    } catch (error) {
      console.warn(`symlink test skipped: ${(error as Error).message}`)
      return
    }
    const out = await checkThemePath(dir)
    expect(out.code).toBe(1)
    expect(out.lines[0]).toBe('A3 · fonts/alias.woff2 · fonts/alias.woff2')
  })

  it('answers A5 from sizes alone for a directory that is too big, without reading it', async () => {
    const dir = themeDir('huge')
    writeFileSync(join(dir, 'images/a.png'), Buffer.alloc(1048577))
    const out = await checkThemePath(dir)
    expect(out.code).toBe(1)
    expect(out.lines[0]).toBe('A5 · images/a.png · 1048577')
  })

  it('answers A5 for a zip past the ceiling, and A3 for a directory with too many entries', async () => {
    const zip = join(root, 'huge.zip')
    writeFileSync(zip, Buffer.alloc(5242881))
    expect((await checkThemePath(zip)).lines[0]).toBe('A5 · 5242881')
    const many = themeDir('many')
    for (let i = 0; i < 70; i++) writeFileSync(join(many, `f${i}.txt`), '')
    expect((await checkThemePath(many)).lines[0]).toBe('A3 · more than 66 entries')
  })

  it('uses the install route options: a built-in theme id is refused', async () => {
    const out = await checkThemePath(themeDir('reserved', { 'theme.json': { ...MANIFEST, id: 'plain' } }))
    expect(out.code).toBe(1)
    expect(out.lines[0]).toBe('A6 · theme.json · id')
  })

  it('exits 2 with the usage line when the path is missing or not given', async () => {
    expect((await checkThemePath(join(root, 'nope'))).code).toBe(2)
    expect((await checkThemePath(undefined)).lines).toEqual(['usage: bun run theme:check <theme directory | theme.zip>'])
  })

  it('sets the process exit code, and prints no stack trace for an expected error', () => {
    const run = (...args: string[]) => Bun.spawnSync(['bun', SCRIPT, ...args], { stdout: 'pipe', stderr: 'pipe' })
    const ok = run(themeDir('p-ok'))
    expect(ok.exitCode).toBe(0)
    expect(ok.stdout.toString()).toContain('ok · broadsheet')
    const bad = run(themeDir('p-bad', { 'theme.css': BAD_CSS }))
    expect(bad.exitCode).toBe(1)
    expect(bad.stderr.toString()).toContain('C1 · theme.css:3:')
    const missing = run(join(root, 'nope'))
    expect(missing.exitCode).toBe(2)
    expect(missing.stderr.toString()).not.toContain(' at ')
  })
})
