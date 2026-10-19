// `bun run theme:preview` for real: a seeded instance, the theme installed and chosen, a browser,
// one page at one width. Slow (a build, a seed, a server and Chrome) and it needs a headless
// Chrome (`scripts/chrome-path.ts`), so it runs only when asked:
//
//   THEME_PREVIEW_E2E=1 bun test src/theme/theme-preview-e2e.test.ts
//
// `theme:matrix` has no automated test of its own; it is run by hand before and after a change to
// the appearance sheets. This test is opt-in for the same reason: `bun test` (and `check:all`)
// must stay fast and browser-free.
import { afterAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { themeFiles } from '@/theme/test-zip'

const REPO = resolve(import.meta.dir, '../..')
const enabled = process.env.THEME_PREVIEW_E2E === '1'

describe.skipIf(!enabled)('theme:preview, end to end', () => {
  if (enabled) mkdirSync(join(REPO, '.tmp'), { recursive: true })
  const work = enabled ? mkdtempSync(join(REPO, '.tmp', 'theme-preview-e2e-')) : ''
  afterAll(() => { if (work) rmSync(work, { recursive: true, force: true }) })

  it('installs a valid theme, photographs one page light and dark, and writes the report and the contact sheet', () => {
    const theme = join(work, 'theme')
    for (const f of themeFiles()) {
      mkdirSync(dirname(join(theme, f.name)), { recursive: true })
      writeFileSync(join(theme, f.name), f.data)
    }
    const out = join(work, 'out')
    const p = Bun.spawnSync([process.execPath, 'scripts/theme-preview.ts', theme, '--pages', 'tag', '--widths', '375', '--out', out],
      { cwd: REPO, stdout: 'pipe', stderr: 'pipe' })
    const said = `${p.stdout}\n${p.stderr}`
    expect(p.exitCode, said).toBe(0)
    expect(readdirSync(out).filter((f) => f.endsWith('.png')).sort()).toEqual(['tag__default__375__dark.png', 'tag__default__375__light.png'])
    // A PNG, and a whole page, not an empty capture.
    const png = readFileSync(join(out, 'tag__default__375__light.png'))
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect(png.length).toBeGreaterThan(10000)
    const report = readFileSync(join(out, 'REPORT.txt'), 'utf8')
    expect(report).toContain('theme:preview broadsheet 1.0.0')
    expect(report).toContain('2 shots')
    expect(report).toContain('no layout findings')
    const html = readFileSync(join(out, 'index.html'), 'utf8')
    expect(html).toContain('<section id="tag">')
    expect(html).toContain('href="tag__default__375__dark.png"')
    // The instance it started is gone.
    expect(readdirSync(join(REPO, '.tmp')).some((f) => f.startsWith('theme-preview-work-'))).toBe(false)
    expect(existsSync(join(out, 'logs'))).toBe(false)
  }, 300000)

  it('stops and deletes what it started when the run fails part way, and says why without a stack trace', () => {
    const theme = join(work, 'theme')
    const count = () => readdirSync(join(REPO, '.tmp')).filter((f) => f.startsWith('theme-preview-work-')).length
    const before = count()
    // Seeded and installed, then no browser: the failure comes after the instance exists.
    const p = Bun.spawnSync([process.execPath, 'scripts/theme-preview.ts', theme, '--pages', 'tag', '--widths', '375', '--out', join(work, 'fails')],
      { cwd: REPO, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, CHROME: join(work, 'no-such-browser.exe') } })
    const said = `${p.stdout}\n${p.stderr}`
    expect(p.exitCode, said).toBe(1)
    expect(p.stdout.toString()).toContain('seeding')
    expect(p.stderr.toString()).toStartWith('theme:preview: ')
    expect(said).not.toMatch(/^\s+at /m)
    expect(count()).toBe(before)
  }, 300000)
})
