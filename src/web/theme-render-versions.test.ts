// An installed theme's page across its life (ADR 0072, T2b): a new version and a rollback change
// the sheet on the very next render, a removal and every kind of broken row draw plain with a 200,
// and the ids a manifest carries are held to the shape the CSS they reach needs.
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { getSettings, resetSettingsCache } from '@/content/settings'
import { checkThemeManifest } from '@/theme'
import { db } from '@/test/sqlite'
import { clearCache } from '@/server/cache'
import { MANIFEST, themeZip } from '@/theme/test-zip'
import { RICH, NEWSPRINT, htmlTag, sheetLink, themeBlog } from '@/test/installed-theme'

const { asOwner, install, save, page } = themeBlog('./.tmp/test-theme-render-versions')

let warnings: string[] = []
let warn: ReturnType<typeof spyOn> | null = null
beforeEach(() => {
  warnings = []
  warn = spyOn(console, 'warn').mockImplementation((...args: unknown[]) => { warnings.push(args.map(String).join(' ')) })
})
afterEach(() => warn?.mockRestore())

/** The page is plain: no installed sheet, no data-look, the plain id on <html>, and a 200. */
const expectPlain = async (path: string) => {
  const { status, html } = await page(path)
  expect(status).toBe(200)
  expect(htmlTag(html)).toContain(' data-theme="plain"')
  expect(html).not.toContain('/themes/')
  expect(html).not.toContain('data-meta-ink')
}

describe('a new version, a rollback and a removal show on the next render', () => {
  it('links the new version as soon as it is installed, and the old one again after a rollback', async () => {
    const v1 = await install(themeZip())
    await save({ theme: 'broadsheet' })
    // Rendered once, so the page cache holds it and the renderer keeps the version it read.
    expect((await page('/')).html).toContain(sheetLink(v1))
    expect((await page('/a-post')).html).toContain(sheetLink(v1))

    const v2 = await install(themeZip({ 'theme.json': { ...MANIFEST, version: '1.1.0' } }))
    expect(v2).not.toBe(v1)
    for (const path of ['/', '/a-post']) {
      const { html } = await page(path)
      expect(html).toContain(sheetLink(v2))
      expect(html).not.toContain(sheetLink(v1))
    }

    expect((await asOwner('/api/themes/broadsheet/rollback', { method: 'POST' })).status).toBe(200)
    for (const path of ['/', '/a-post']) {
      const { html } = await page(path)
      expect(html).toContain(sheetLink(v1))
      expect(html).not.toContain(sheetLink(v2))
    }
  })

  it('draws plain after the theme is removed', async () => {
    await install(themeZip({ 'theme.json': RICH }))
    await save({ theme: 'broadsheet' })
    expect((await page('/')).html).toContain('/themes/')
    expect((await asOwner('/api/themes/broadsheet', { method: 'DELETE' })).status).toBe(200)
    await expectPlain('/')
    await expectPlain('/a-post')
  })

  it("does not change the page of a blog wearing another theme when one is installed or removed", async () => {
    await save({ theme: 'code' })
    const before = (await page('/a-post')).html
    await install(themeZip({ 'theme.json': RICH }))
    expect((await page('/a-post')).html).toBe(before)
    expect((await asOwner('/api/themes/broadsheet', { method: 'DELETE' })).status).toBe(200)
    expect((await page('/a-post')).html).toBe(before)
  })
})

describe('a broken row draws plain, never a 500', () => {
  /** The theme chosen, then its row edited behind the renderer, as a restored backup would leave it. */
  const chooseThenBreak = async (sql: string, ...params: string[]) => {
    db().run('delete from themes')
    clearCache()
    await install(themeZip({ 'theme.json': RICH }))
    await save({ theme: 'broadsheet', themePreset: 'newsprint' })
    expect((await page('/')).html).toContain('/themes/')
    db().query(sql).run(...params)
    // Every write in the product empties the cache on its way out (Invariant 1).
    clearCache()
  }

  it('a row that is gone: settings still name the theme, the page is plain, one warning', async () => {
    await chooseThenBreak(`delete from themes`)
    resetSettingsCache()
    expect((await getSettings()).theme).toBe('broadsheet')
    await expectPlain('/')
    await expectPlain('/a-post')
    // Kept as an answer until the next flush, so it is said once rather than on every request.
    expect(warnings.filter((w) => w.includes('theme broadsheet'))).toHaveLength(1)
    expect(warnings[0]).toContain('no live version')
  })

  it('a manifest that is not JSON', async () => {
    await chooseThenBreak(`update themes set manifest = ?`, '{"api":1,')
    await expectPlain('/')
    await expectPlain('/a-post')
    expect(warnings.some((w) => w.includes('theme broadsheet') && w.includes('unreadable'))).toBe(true)
  })

  it('a manifest whose values could not have passed the checker: a colour, an id, a font file', async () => {
    const bad: [string, unknown][] = [
      ['palettes', [{ ...NEWSPRINT, light: { ...NEWSPRINT.light, bg: 'red}body{color:red' } }]],
      ['palettes', [{ ...NEWSPRINT, id: 'news"]{}' }]],
      ['fonts', [{ id: 'x', name: 'X', role: 'reading', faces: [{ file: "fonts/a.woff2') ;}", weight: 400, style: 'normal' }] }]],
      ['fonts', [{ id: "a'b", name: 'X', role: 'reading', faces: [{ file: 'fonts/body.woff2', weight: 400, style: 'normal' }] }]],
      ['layout', { menu: 'sideways' }],
    ]
    for (const [key, value] of bad) {
      await chooseThenBreak(`update themes set manifest = ?`, JSON.stringify({ ...RICH, [key]: value }))
      const { status, html } = await page('/')
      expect(status).toBe(200)
      expect(html).not.toContain('/themes/')
      expect(html).not.toContain('red}body')
      expect(html).not.toContain('news"]')
    }
  })

  it("a manifest that takes a built-in's id: a palette mono, a font literata, the theme paper", async () => {
    const takes: [string, unknown][] = [
      ['palettes', [{ ...NEWSPRINT, id: 'mono' }]],
      ['fonts', [{ id: 'literata', name: 'X', role: 'reading', faces: [{ file: 'fonts/body.woff2', weight: 400, style: 'normal' }] }]],
      ['id', 'paper'],
    ]
    for (const [key, value] of takes) {
      warnings = []
      await chooseThenBreak(`update themes set manifest = ?`, JSON.stringify({ ...RICH, [key]: value }))
      const { status, html } = await page('/')
      expect(status).toBe(200)
      expect(htmlTag(html)).toContain(' data-theme="plain"')
      expect(html).not.toContain('/themes/')
      // Mono stays Mono: the theme's colours never reach the page under the built-in's name.
      expect(html).not.toContain(NEWSPRINT.light.bg)
      expect(html).not.toContain('theme-literata')
      expect(warnings.filter((w) => w.includes('theme broadsheet') && w.includes('unreadable'))).toHaveLength(1)
    }
  })

  it('an unreadable theme cannot be half chosen: its palette is not a choice', async () => {
    await chooseThenBreak(`update themes set manifest = ?`, 'nonsense')
    await save({ themePreset: 'newsprint', fontPreset: 'body-serif' })
    const s = await getSettings()
    // Still what was stored before it broke; nothing new written.
    expect(s.themePreset).toBe('newsprint')
    expect(s.fontPreset).toBe('literata')
    expect((await page('/')).html).not.toContain(NEWSPRINT.light.bg)
  })
})

describe('the ids a manifest carries are the shape CSS and HTML can take them in', () => {
  const opts = {
    supportedApi: [1], reservedIds: new Set<string>(), reservedPaletteIds: new Set<string>(),
    reservedFontIds: new Set<string>(), packageFiles: new Set(['fonts/body.woff2']),
  }
  const font = (id: string) => ({ id, name: 'X', role: 'reading', faces: [{ file: 'fonts/body.woff2', weight: 400, style: 'normal' }] })
  const refused = (manifest: object): string[] => {
    const out = checkThemeManifest(manifest, opts)
    return out.ok ? [] : out.violations.map((v) => v.subject)
  }

  it('refuses a theme, palette or font id outside [a-z0-9-]', () => {
    for (const id of ['News', 'news print', 'news"', "news'", 'news]', 'news}', 'a/b', 'a\\b', 'é']) {
      expect(refused({ ...MANIFEST, id })).toEqual(['id'])
      expect(refused({ ...MANIFEST, palettes: [{ ...NEWSPRINT, id }] })).toEqual(['palettes[0].id'])
      expect(refused({ ...MANIFEST, fonts: [font(id)] })).toEqual(['fonts[0].id'])
    }
    expect(refused({ ...MANIFEST, id: 'news-print-2', palettes: [{ ...NEWSPRINT, id: 'p-2' }], fonts: [font('f-2')] })).toEqual([])
  })
})
