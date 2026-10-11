// An installed theme's palette and fonts, from the Appearance screen to the page a reader gets
// (ADR 0072, T2c part 2), through the real router: the owner's settings page offers them, marked as
// the theme's; the save the form makes when they are picked (`admin/island/theme-offers.test.ts`
// proves that is exactly what the form sends) is stored and drawn; and the admin's own document
// sets the editor in the theme's reading face. In a real browser the tour does the same by hand
// (`scripts/tour-flows-themes.ts`): pick the palette, save, read the public page's ground.
//
// Two files because the halves cannot share one: the island is typed against the DOM, the router
// against Bun's own `Response`, and one program holding both does not compile.
import { describe, expect, it } from 'bun:test'
import { getSettings } from '@/content/settings'
import { themeZip } from '@/theme/test-zip'
import { NEWSPRINT, RICH, inlineStyle, themeBlog } from '@/test/installed-theme'

const { asOwner, install, save, page } = themeBlog('./.tmp/test-theme-offers-save')

/** The admin's own `<style>`: the first one in the document. */
const adminStyle = (html: string): string => /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? ''
/** The opening tag of the element carrying `attr`. */
const tagWith = (html: string, attr: string): string => new RegExp(`<[a-z]+[^>]*${attr}[^>]*>`).exec(html)?.[0] ?? ''

/** What the form sends with the theme pressed and its palette and two fonts picked. */
const PICKED = { theme: 'broadsheet', themePreset: 'newsprint', fontPreset: 'body-serif', chromeFont: 'ui-face' }

describe('a theme palette and fonts, from the admin to the page', () => {
  it('the settings page offers them, marked as the theme’s, hidden until its tile is pressed', async () => {
    await install(themeZip({ 'theme.json': RICH }))
    const res = await asOwner('/admin/settings?tab=appearance')
    expect(res.status).toBe(200)
    const html = await res.text()
    for (const attr of ['data-palette-card="newsprint"', 'data-choice="body-serif"', 'data-choice="ui-face"']) {
      const tag = tagWith(html, attr)
      expect(tag).toContain('data-theme-option="broadsheet"')
      expect(tag).toMatch(/ hidden[ >]/)
    }
    expect(html).not.toContain('data-choice="headline"')
    expect(html).toContain('from Broadsheet')
    expect(tagWith(html, 'data-choice="broadsheet"')).toContain(`data-owns="${'[&quot;table.head&quot;]'}"`)
  })

  it('picked and saved, they are what a reader’s page is drawn in', async () => {
    await install(themeZip({ 'theme.json': RICH }))
    expect((await save(PICKED)).status).toBe(200)
    expect(await getSettings()).toMatchObject(PICKED)
    const css = inlineStyle((await page('/')).html)
    expect(css).toContain(`:root{color-scheme:light;--c-bg:${NEWSPRINT.light.bg}`)
    expect(css).toContain(`--font-reading:'theme-body-serif'`)
    expect(css).toContain(`--font-sans:'theme-ui-face'`)
    // And the settings page opens on them, pressed, with nothing unsaved.
    const html = await (await asOwner('/admin/settings?tab=appearance')).text()
    expect(tagWith(html, 'data-choice="body-serif"')).toContain('aria-pressed="true"')
    expect(tagWith(html, 'data-k="fontPreset"')).toContain('data-was="body-serif"')
    expect(tagWith(html, 'data-k="themePreset"')).toContain('value="newsprint"')
  })

  it('the admin document sets the editor in the theme’s reading face and palette, never its chrome font', async () => {
    const hash = await install(themeZip({ 'theme.json': RICH }))
    expect((await save(PICKED)).status).toBe(200)
    const css = adminStyle(await (await asOwner('/admin')).text())
    expect(css).toContain(`@font-face{font-family:'theme-body-serif'`)
    expect(css).toContain(`url('/themes/${hash}/fonts/body.woff2')`)
    expect(css).toContain(`--font-reading:'theme-body-serif'`)
    expect(css).toContain(`--c-bg:${NEWSPRINT.light.bg}`)
    expect(css).not.toContain(`--font-sans:'theme-ui-face'`)
    // Under another theme the stored ids are not on offer, and the editor draws what the page draws.
    expect((await save({ theme: 'plain' })).status).toBe(200)
    const after = adminStyle(await (await asOwner('/admin')).text())
    expect(after).not.toContain('theme-body-serif')
    expect(after).not.toContain(NEWSPRINT.light.bg)
  })
})

/** A second palette of the same theme, its ground unlike every other palette's. */
const STOCK = { ...NEWSPRINT, id: 'stock', name: 'Stock', light: { ...NEWSPRINT.light, bg: '#f4f0ff' } }
const TWO = { ...RICH, palettes: [NEWSPRINT, STOCK] }
const menuOf = (html: string): string => /data-palettes="([^"]*)"/.exec(html)?.[1] ?? ''

describe('a theme’s palettes in the reader’s menu', () => {
  it('two enabled: the menu lists both by name, and the page’s CSS defines both', async () => {
    await install(themeZip({ 'theme.json': TWO }))
    expect((await save({ theme: 'broadsheet', enabledPalettes: ['mono', 'newsprint', 'stock'] })).status).toBe(200)
    expect((await getSettings()).enabledPalettes).toEqual(['mono', 'newsprint', 'stock'])
    const { html } = await page('/')
    expect(menuOf(html)).toBe('mono:Mono|newsprint:Newsprint|stock:Stock')
    const css = inlineStyle(html)
    expect(css).toContain(`[data-palette="newsprint"]{--c-bg:${NEWSPRINT.light.bg};`)
    expect(css).toContain(`[data-palette="stock"]{--c-bg:${STOCK.light.bg};`)
  })

  it('under another theme they stay in the row, are not drawn, and come back with their theme', async () => {
    await install(themeZip({ 'theme.json': TWO }))
    await save({ theme: 'broadsheet', enabledPalettes: ['mono', 'sepia', 'newsprint', 'stock'] })
    // The admin form sends the built-in ticks it shows, and nothing of a theme that is not pressed.
    expect((await save({ theme: 'plain', enabledPalettes: ['mono'] })).status).toBe(200)
    expect((await getSettings()).enabledPalettes).toEqual(['mono', 'newsprint', 'stock'])
    const away = await page('/')
    expect(menuOf(away.html)).toBe('')
    expect(inlineStyle(away.html)).not.toContain('[data-palette="stock"]')
    await save({ theme: 'broadsheet' })
    expect(menuOf((await page('/')).html)).toBe('mono:Mono|newsprint:Newsprint|stock:Stock')
  })

  it('a write naming a theme’s palette while another theme stays chosen does not store it', async () => {
    await install(themeZip({ 'theme.json': TWO }))
    expect((await save({ theme: 'plain', enabledPalettes: ['mono', 'sepia', 'newsprint'] })).status).toBe(200)
    expect((await getSettings()).enabledPalettes).toEqual(['mono', 'sepia'])
    expect(menuOf((await page('/')).html)).toBe('mono:Mono|sepia:Sepia')
  })
})
