// The public site wearing a theme installed from a zip (ADR 0072, T2b), through the real router:
// the owner installs it and chooses it as the admin would, and a reader's request gets plain's
// markup with the package's sheet, switches, fonts and palette on it. Versions, removal and a
// broken row are `theme-render-versions.test.ts`.
import { describe, expect, it } from 'bun:test'
import { getSettings } from '@/content/settings'
import { tableToCss } from '@/content/settings-table'
import { getPreset } from '@/content/themes'
import { emailBrand } from '@/news/email-brand'
import { db } from '@/test/sqlite'
import { themeZip } from '@/theme/test-zip'
import { NEWSPRINT, RICH, htmlTag, inlineStyle, sheetLink, themeBlog } from '@/test/installed-theme'

const { app, asOwner, install, save, page } = themeBlog('./.tmp/test-theme-render')

const rich = () => install(themeZip({ 'theme.json': RICH }))
const menuInHeader = (html: string): boolean => /<header class="site[^"]*"[\s\S]*?Colophon[\s\S]*?<\/header>/.test(html)

describe('choosing an installed theme', () => {
  it('draws the list, the front page and a post as plain with the theme sheet after the base sheet', async () => {
    const hash = await install(themeZip())
    expect((await save({ theme: 'broadsheet' })).status).toBe(200)
    expect((await getSettings()).theme).toBe('broadsheet')
    const check = async (path: string) => {
      const { status, html } = await page(path)
      expect(status).toBe(200)
      expect(htmlTag(html)).toContain(' data-theme="broadsheet"')
      expect(htmlTag(html)).not.toContain('data-look')
      // Straight after site.css, before the settings block, so the cascade reads base, theme, owner.
      expect(html).toMatch(new RegExp(`/assets/site\\.[a-z0-9]+\\.css">${sheetLink(hash).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`))
      expect(html.indexOf(sheetLink(hash))).toBeLessThan(html.indexOf('<style>'))
      expect(html).not.toContain('/assets/look-')
    }
    await check('/')
    await check('/a-post')
    expect((await save({ home: { mode: 'front' } })).status).toBe(200)
    await check('/')
    // The link it carries answers, in the layer the engine puts a theme in.
    const sheet = await app.request(`/themes/${hash}/theme.css`)
    expect(sheet.status).toBe(200)
    expect(await sheet.text()).toStartWith('@layer theme{')
  })

  it('ignores a write naming a theme that is neither built in nor installed', async () => {
    await install(themeZip())
    await save({ theme: 'broadsheet' })
    for (const theme of ['gazette', 'Broadsheet', "broad'sheet", 42]) {
      expect((await save({ theme })).status).toBe(200)
      expect((await getSettings()).theme).toBe('broadsheet')
    }
    expect(htmlTag((await page('/')).html)).toContain(' data-theme="broadsheet"')
  })

  it('cannot be chosen by a request without the owner, which changes nothing', async () => {
    await install(themeZip())
    const res = await app.request('/api/settings', {
      method: 'PUT', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify({ theme: 'broadsheet' }),
    })
    expect(res.status).toBe(401)
    expect((await getSettings()).theme).not.toBe('broadsheet')
    expect((await page('/')).html).not.toContain('/themes/')
  })

  it('keeps the chosen theme through a save that does not name it', async () => {
    await install(themeZip())
    await save({ theme: 'broadsheet' })
    await save({ title: 'Another title' })
    const s = await getSettings()
    expect(s.theme).toBe('broadsheet')
    expect(s.title).toBe('Another title')
    const stored = JSON.parse((db().query('select data from settings where id = 1').get() as { data: string }).data)
    // `look` is what a build from before themes reads: plain, the one it can draw for this.
    expect(stored).toMatchObject({ theme: 'broadsheet', look: 'plain' })
  })
})

describe("the manifest's switches", () => {
  it("moves the menu into the masthead when the manifest says header, as the newspaper's does", async () => {
    await install(themeZip())
    await save({ theme: 'broadsheet' })
    expect(menuInHeader((await page('/a-post')).html)).toBe(false)
    await rich()
    expect(menuInHeader((await page('/a-post')).html)).toBe(true)
    expect(menuInHeader((await page('/')).html)).toBe(true)
  })

  it('deepens the meta ink straight behind the theme sheet, keyed on the installed id', async () => {
    const hash = await rich()
    await save({ theme: 'broadsheet' })
    const { html } = await page('/a-post')
    expect(html).toContain(`${sheetLink(hash)}<style data-meta-ink>@layer theme{html[data-theme="broadsheet"]{--meta-deepened:`)
  })

  it("draws the page without the saved value of a setting the theme owns, and keeps that value", async () => {
    await rich()
    await save({ table: { head: 'ink', grid: 'none' } })
    const saved = (await getSettings()).table
    expect(inlineStyle((await page('/a-post')).html)).toContain(tableToCss(saved))
    await save({ theme: 'broadsheet' })
    const css = inlineStyle((await page('/a-post')).html)
    expect(css).toContain(tableToCss(saved, ['table.head']))
    expect(css).not.toContain(tableToCss(saved))
    expect((await getSettings()).table).toMatchObject({ head: 'ink', grid: 'none' })
  })
})

describe("the theme's fonts", () => {
  it('declares every face from the package and names the display face in --font-display', async () => {
    const hash = await rich()
    await save({ theme: 'broadsheet' })
    const css = inlineStyle((await page('/a-post')).html)
    for (const [id, weight] of [['body-serif', 400], ['ui-face', 500], ['headline', 700]] as const) {
      expect(css).toContain(`@font-face{font-family:'theme-${id}';font-style:normal;font-weight:${weight};`
        + `font-display:swap;src:url('/themes/${hash}/fonts/body.woff2') format('woff2')}`)
    }
    expect(css).toContain("--font-display:'theme-headline', var(--font-reading)}")
  })

  it('takes its reading and chrome fonts as the two font settings while it is chosen', async () => {
    await rich()
    // Not on offer under another theme: ignored, the stored values stay.
    await save({ fontPreset: 'body-serif', chromeFont: 'ui-face' })
    expect(await getSettings()).toMatchObject({ fontPreset: 'literata', chromeFont: 'inter' })
    await save({ theme: 'broadsheet', fontPreset: 'body-serif', chromeFont: 'ui-face' })
    expect(await getSettings()).toMatchObject({ fontPreset: 'body-serif', chromeFont: 'ui-face' })
    // A font of the wrong role is not a choice for the other setting.
    await save({ fontPreset: 'headline', chromeFont: 'body-serif' })
    expect(await getSettings()).toMatchObject({ fontPreset: 'body-serif', chromeFont: 'ui-face' })

    const { html } = await page('/a-post')
    const css = inlineStyle(html)
    expect(css).toContain(":root{--font-reading:'theme-body-serif', 'Literata'")
    expect(css).toContain("--font-sans:'theme-ui-face', 'Inter'")
    expect(htmlTag(html)).toContain(' data-chrome-font="ui-face"')
    // A whole woff2 is not preloaded (docs/performance.md), and the built-in reading face it
    // replaces is neither preloaded nor declared, or the fallback paint would fetch it.
    expect(html).not.toContain('rel="preload"')
    expect(css).not.toContain("@font-face{font-family:'Literata'")
  })

  it('leads the CJK reading stacks of a zh, ja or ko site with the theme family', async () => {
    await rich()
    await save({ language: 'ja' })
    const plain = inlineStyle((await page('/a-post')).html)
    expect(plain).toContain(":lang(ja){--font-reading:'Literata', ")
    await save({ theme: 'broadsheet', fontPreset: 'body-serif' })
    const css = inlineStyle((await page('/a-post')).html)
    for (const lang of ['zh', 'ja', 'ko']) {
      expect(css).toContain(`:lang(${lang}){--font-reading:'theme-body-serif', 'Literata', `)
    }
    expect(css).not.toContain(":lang(ja){--font-reading:'Literata'")
  })

  it('draws the default fonts once the theme is gone, and keeps the stored ids', async () => {
    await rich()
    await save({ theme: 'broadsheet', fontPreset: 'body-serif', chromeFont: 'ui-face' })
    await save({ theme: 'code' })
    const { html } = await page('/a-post')
    expect(inlineStyle(html)).not.toContain('theme-body-serif')
    expect(htmlTag(html)).toContain(' data-chrome-font="inter"')
    expect(html).toContain('<link rel="preload" href="/fonts/literata-latin.woff2"')
    expect(await getSettings()).toMatchObject({ fontPreset: 'body-serif', chromeFont: 'ui-face' })
  })
})

describe("the theme's palettes", () => {
  const vars = (c: typeof NEWSPRINT.light) => `--c-bg:${c.bg};--c-text:${c.text};--c-heading:${c.heading}`

  it("draws a palette of the chosen theme into the palette's variables, light and dark", async () => {
    await rich()
    await save({ themePreset: 'newsprint' })
    expect((await getSettings()).themePreset).toBe('mono')
    await save({ theme: 'broadsheet', themePreset: 'newsprint' })
    expect((await getSettings()).themePreset).toBe('newsprint')
    const { html } = await page('/')
    const css = inlineStyle(html)
    expect(css).toContain(`:root{color-scheme:light;${vars(NEWSPRINT.light)}`)
    expect(css).toContain(`.dark{color-scheme:dark;${vars(NEWSPRINT.dark)}`)
    expect(html).toContain(`<meta name="theme-color" media="(prefers-color-scheme: light)" content="${NEWSPRINT.light.bg}">`)
    // It joins the reader's menu by its own name, so a reader who switches away can come back.
    expect(html).toContain('data-palettes="newsprint:Newsprint|mono:Mono')
    expect(html).toContain('data-palette-default="newsprint"')
    expect(css).toContain(`[data-palette="newsprint"]{${vars(NEWSPRINT.light)}`)
  })

  it('adds no built-in palette on its behalf: chosen alone, the reader has no menu', async () => {
    const storedList = () =>
      JSON.parse((db().query('select data from settings where id = 1').get() as { data: string }).data).enabledPalettes
    await save({ themePreset: 'sepia', enabledPalettes: ['sepia'] })
    expect((await page('/')).html).not.toContain('data-palettes=')
    await rich()
    await save({ theme: 'broadsheet', themePreset: 'newsprint' })
    expect(storedList()).toEqual(['sepia'])
    expect((await getSettings()).enabledPalettes).toEqual(['sepia'])
    expect((await page('/')).html).toContain('data-palettes="newsprint:Newsprint|sepia:Sepia"')
    await save({ enabledPalettes: [] })
    expect(storedList()).toEqual([])
    const alone = await page('/')
    expect(alone.html).not.toContain('data-palettes=')
    expect(inlineStyle(alone.html)).toContain(`:root{color-scheme:light;${vars(NEWSPRINT.light)}`)
    // Not on offer under another theme: the engine's default is drawn, and is the whole list.
    await save({ theme: 'code' })
    const away = await page('/')
    expect(away.html).not.toContain('data-palettes=')
    expect(inlineStyle(away.html)).toContain(`:root{color-scheme:light;${vars(getPreset('mono').theme.light)}`)
    expect(storedList()).toEqual([])
    // ...and beside what the owner did enable, a valid menu that includes it.
    await save({ enabledPalettes: ['sepia'] })
    const menu = (await page('/')).html
    expect(menu).toContain('data-palettes="mono:Mono|sepia:Sepia"')
    expect(menu).toContain('data-palette-default="mono"')
  })

  it('brands the newsletter in the palette the site draws', async () => {
    await rich()
    await save({ theme: 'broadsheet', themePreset: 'newsprint' })
    expect(emailBrand(await getSettings()).theme.bg).toBe(NEWSPRINT.light.bg)
    await save({ theme: 'code' })
    expect(emailBrand(await getSettings()).theme.bg).toBe(getPreset('mono').theme.light.bg)
  })

  it('draws the default palette after the theme is removed, and keeps the stored id', async () => {
    await rich()
    await save({ theme: 'broadsheet', themePreset: 'newsprint' })
    // Without the owner the removal is refused, and nothing moves.
    const refused = await app.request('/api/themes/broadsheet', { method: 'DELETE', headers: { 'sec-fetch-site': 'same-origin' } })
    expect(refused.status).toBe(401)
    expect(inlineStyle((await page('/')).html)).toContain(vars(NEWSPRINT.light))

    expect((await asOwner('/api/themes/broadsheet', { method: 'DELETE' })).status).toBe(200)
    const mono = getPreset('mono').theme
    const after = await page('/')
    expect(after.status).toBe(200)
    expect(inlineStyle(after.html)).toContain(`:root{color-scheme:light;${vars(mono.light)}`)
    expect(after.html).not.toContain('newsprint')
    expect((await getSettings()).themePreset).toBe('newsprint')
    // A save that does not name the palette keeps it too; installing the theme again and choosing
    // it brings the palette back with it.
    await save({ title: 'Still here' })
    expect((await getSettings()).themePreset).toBe('newsprint')
    await rich()
    await save({ theme: 'broadsheet' })
    expect(inlineStyle((await page('/')).html)).toContain(`:root{color-scheme:light;${vars(NEWSPRINT.light)}`)
  })
})
