// `bun run theme:preview` (scripts/theme-preview.ts): its command line, the output directories it
// refuses, and the exits that come before any instance is started. The run itself, with a browser,
// is `theme-preview-e2e.test.ts`.
import { afterAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { checkedOut } from '../../scripts/theme-matrix-instance'
import { cellsFor, fontsOf, parseArgs, PREVIEW_PAGES, shotName } from '../../scripts/theme-preview-plan'
import { MANIFEST, themeFiles } from '@/theme/test-zip'
import type { ThemeManifest } from '@/theme'

const REPO = resolve(import.meta.dir, '../..')
const SCRIPT = join(REPO, 'scripts/theme-preview.ts')
const root = mkdtempSync(join(tmpdir(), 'theme-preview-'))
// Under the repository's own .tmp/, the only place the command writes.
mkdirSync(join(REPO, '.tmp'), { recursive: true })
const repoTmp = mkdtempSync(join(REPO, '.tmp', 'theme-preview-cli-'))
afterAll(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(repoTmp, { recursive: true, force: true })
})

function themeDir(name: string, over: Parameters<typeof themeFiles>[0] = {}): string {
  const dir = join(root, name)
  for (const f of themeFiles(over)) {
    mkdirSync(dirname(join(dir, f.name)), { recursive: true })
    writeFileSync(join(dir, f.name), f.data)
  }
  return dir
}

const cli = (...args: string[]) => {
  const p = Bun.spawnSync([process.execPath, SCRIPT, ...args], { cwd: REPO, stdout: 'pipe', stderr: 'pipe' })
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() }
}

describe('parseArgs', () => {
  it('takes a theme and defaults to every page at 375, 768 and 1440', () => {
    const p = parseArgs(['my-theme'])
    expect(p).toEqual({ ok: true, args: { theme: 'my-theme', out: null, widths: [375, 768, 1440], pages: PREVIEW_PAGES, port: null, force: false } })
  })

  it('reads --out, --widths, --pages, --port and --force, pages in the contact sheet order', () => {
    const p = parseArgs(['t.zip', '--widths', '1440,375', '--pages', 'tag,home-list', '--out', '.tmp/x', '--port', '3500', '--force'])
    if (!p.ok) throw new Error(p.message)
    expect(p.args.widths).toEqual([1440, 375])
    expect(p.args.pages.map((x) => x.id)).toEqual(['home-list', 'tag'])
    expect(p.args).toMatchObject({ theme: 't.zip', out: '.tmp/x', port: 3500, force: true })
  })

  it.each([
    [[], 'no theme given'],
    [['a', 'b'], 'one theme at a time'],
    [['a', '--widths'], '--widths needs a value'],
    [['a', '--widths', '--force'], '--widths needs a value'],
    [['a', '--widths', '375,abc'], '"abc" is not a width'],
    [['a', '--widths', '100'], '"100" is not a width'],
    [['a', '--pages', 'home-list,nope'], 'no page nope'],
    [['a', '--port', '80'], 'is not a port'],
    [['a', '--out', 'x', '--out', 'y'], '--out is given twice'],
    [['a', '--colour'], 'unknown option --colour'],
  ] as [string[], string][])('refuses %j', (argv, message) => {
    const p = parseArgs(argv)
    expect(p.ok).toBe(false)
    if (!p.ok) expect(p.message).toContain(message)
  })

  it('covers every kind of page a reader reaches, the matrix pages and the four it lacks', () => {
    const ids = PREVIEW_PAGES.map((p) => p.id)
    for (const id of ['home-list', 'home-page-2', 'front-image', 'front-text', 'post-all-blocks', 'post-untitled',
      'post-book', 'page', 'category', 'tag', 'series', 'archive', 'search', 'notes', 'note', 'not-found']) {
      expect(ids).toContain(id)
    }
  })
})

describe('cells, fonts and names', () => {
  const m: ThemeManifest = { ...MANIFEST }
  const pal = (id: string) => ({ id, name: id, light: {} as never, dark: {} as never })

  it('is one cell per home with the default palette when the theme declares none', () => {
    expect(cellsFor(m, PREVIEW_PAGES)).toEqual([
      { home: 'list', palette: null }, { home: 'front-image', palette: null }, { home: 'front-text', palette: null },
    ])
  })

  it('is one cell per palette declared, and only the homes the chosen pages need', () => {
    const pages = PREVIEW_PAGES.filter((p) => p.id === 'tag')
    expect(cellsFor({ ...m, palettes: [pal('ink'), pal('sepia')] }, pages)).toEqual([
      { home: 'list', palette: 'ink' }, { home: 'list', palette: 'sepia' },
    ])
  })

  it('draws the suggested fonts, else the first of each role', () => {
    const face = [{ file: 'fonts/a.woff2', weight: 400, style: 'normal' as const }]
    const fonts = [
      { id: 'r1', name: 'R1', role: 'reading' as const, faces: face },
      { id: 'r2', name: 'R2', role: 'reading' as const, faces: face },
      { id: 'c1', name: 'C1', role: 'chrome' as const, faces: face },
    ]
    expect(fontsOf({ ...m, fonts })).toEqual({ reading: 'r1', chrome: 'c1' })
    expect(fontsOf({ ...m, fonts, suggests: { readingFont: 'r2' } })).toEqual({ reading: 'r2', chrome: 'c1' })
    expect(fontsOf(m)).toEqual({ reading: null, chrome: null })
  })

  it('names a shot by page, palette, width and scheme', () => {
    expect(shotName('tag', null, 375, 'dark')).toBe('tag__default__375__dark.png')
    expect(shotName('tag', 'ink', 1440, 'light')).toBe('tag__ink__1440__light.png')
  })
})

describe('checkedOut, the rule theme:matrix keeps', () => {
  const tmp = join(root, '.tmp')
  mkdirSync(tmp, { recursive: true })

  it('takes a directory strictly inside .tmp/', () => {
    expect(checkedOut(join(tmp, 'preview', 'broadsheet'), false, tmp)).toBe(join(tmp, 'preview', 'broadsheet'))
  })

  it('refuses .tmp itself and anything outside it, a sibling that starts with the same letters included', () => {
    expect(() => checkedOut(tmp, false, tmp)).toThrow('must be inside')
    expect(() => checkedOut(join(root, 'elsewhere'), false, tmp)).toThrow('must be inside')
    expect(() => checkedOut(`${tmp}-other`, false, tmp)).toThrow('must be inside')
    expect(() => checkedOut(join(tmp, '..', 'escape'), false, tmp)).toThrow('must be inside')
  })

  it('refuses a directory holding shots unless forced', () => {
    const held = join(tmp, 'held')
    mkdirSync(held, { recursive: true })
    writeFileSync(join(held, 'home-list__default__375__light.png'), 'x')
    expect(() => checkedOut(held, false, tmp)).toThrow('already holds screenshots')
    expect(checkedOut(held, true, tmp)).toBe(held)
  })
})

describe('theme:preview exits before starting anything', () => {
  it('exits 2 with the usage line when called wrong', () => {
    const r = cli('--widths', '10')
    expect(r.code).toBe(2)
    expect(r.err).toContain('usage: bun run theme:preview')
    expect(r.err).not.toMatch(/^\s+at /m)
  })

  it('exits 1 on a refused theme, printing the findings, and starts no instance', () => {
    const before = readdirSync(join(REPO, '.tmp')).filter((f) => f.startsWith('theme-preview-work-')).length
    const r = cli(themeDir('bad', { 'theme.css': '.prose{color:#ff0000}\n.front{color:var(--c-text)}' }), '--out', join(repoTmp, 'bad'))
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/^C1 · theme\.css:1:\d+ · /m)
    expect(r.err).toContain('Nothing was installed')
    expect(r.out).not.toContain('seeding')
    expect(existsSync(join(repoTmp, 'bad'))).toBe(false)
    expect(readdirSync(join(REPO, '.tmp')).filter((f) => f.startsWith('theme-preview-work-')).length).toBe(before)
  })

  it('exits 2 on an output directory outside .tmp/, and on one holding files it did not make, --force or not', () => {
    const ok = themeDir('ok')
    const outside = cli(ok, '--out', join(root, 'not-under-tmp'))
    expect(outside.code).toBe(2)
    expect(outside.err).toContain('must be inside')
    const held = join(repoTmp, 'held')
    mkdirSync(held, { recursive: true })
    mkdirSync(join(held, 'nested'), { recursive: true })
    writeFileSync(join(held, 'nested', 'old.png'), 'x')
    const again = cli(ok, '--out', held)
    expect(again.code).toBe(2)
    expect(again.err).toContain('not empty')
    const forced = cli(ok, '--out', held, '--force')
    expect(forced.code).toBe(2)
    expect(forced.err).toContain('did not make it')
    expect(existsSync(join(held, 'nested', 'old.png'))).toBe(true)
  })

  it('exits 2 on a theme path that is not there', () => {
    const r = cli(join(root, 'no-such-theme'))
    expect(r.code).toBe(2)
    expect(r.err).toContain('no such file or directory')
  })
})
