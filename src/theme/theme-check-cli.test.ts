// `bun run theme:check` (scripts/theme-check.ts): a directory and its zip must read the same,
// and the exit code must say what happened.
import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { checkThemePath } from '../../scripts/theme-check'
import { CSS, MANIFEST, testZip, themeFiles, themeZip } from '@/theme/test-zip'

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

  it('refuses a hidden file, as a zip of the folder carries it too', async () => {
    const out = await checkThemePath(themeDir('hidden', { '.DS_Store': 'x' }))
    expect(out.code).toBe(1)
    expect(out.lines[0]).toBe('A3 · .DS_Store · .DS_Store')
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
