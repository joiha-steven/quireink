// What a page says about the theme it wears, driven through real requests (ADR 0072): the
// attributes on <html>, the sheet it links, and the switches the registry hands the renderer.
// The old markup is pinned too, because custom CSS in the wild selects on it.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { savePost } from '@/content/posts'
import { getSettings, resetSettingsCache, saveSettings } from '@/content/settings'
import { BUILTIN_THEMES } from '@/content/themes-builtin'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-theme-page'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<string> => (await app.request(path)).text()
const htmlTag = (page: string): string => /<html[^>]*>/.exec(page)?.[0] ?? ''
const inlineStyle = (page: string): string => /<style>([\s\S]*?)<\/style>/.exec(page)?.[1] ?? ''

const wear = async (patch: Record<string, unknown>): Promise<void> => {
  await saveSettings({ ...patch, menu: [{ label: 'Colophon', href: '/colophon' }] })
  clearCache()
}

beforeEach(async () => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'settings']) db().run(`delete from ${t}`)
  await savePost({ title: 'A post', slug: 'a-post', status: 'published', date: '2025-06-01T12:00:00.000Z',
    content: '![A plate](/uploads/media/a.jpg "A caption")\n\n| a | b |\n|---|---|\n| 1 | 2 |\n' })
})

describe('the theme on <html>', () => {
  it('names the theme on every theme, plain included, and keeps data-look as it was', async () => {
    for (const { id } of BUILTIN_THEMES) {
      await wear({ theme: id })
      for (const path of ['/', '/a-post']) {
        const tag = htmlTag(await get(path))
        expect(tag).toContain(` data-theme="${id}"`)
        if (id === 'plain') expect(tag).not.toContain('data-look')
        else expect(tag).toContain(` data-look="${id}"`)
      }
    }
  })

  it('links the theme sheet only on the theme that has one', async () => {
    await wear({ theme: 'plain' })
    expect(await get('/')).not.toContain('/assets/look-')
    await wear({ theme: 'notes' })
    const page = await get('/')
    expect(page).toMatch(/<link rel="stylesheet" href="\/assets\/look-notes\.[a-z0-9]+\.css">/)
    expect(page).not.toContain('/assets/look-code')
  })

  it('a theme this build does not ship is kept in settings and drawn as plain', async () => {
    await wear({ theme: 'paper' })
    db().run(`update settings set data = json_set(data, '$.theme', 'broadsheet', '$.look', 'paper') where id = 1`)
    clearCache()
    resetSettingsCache()
    expect((await getSettings()).theme).toBe('broadsheet')
    for (const path of ['/', '/a-post']) {
      const page = await get(path)
      expect(htmlTag(page)).toContain(' data-theme="plain"')
      expect(htmlTag(page)).not.toContain('data-look')
      expect(page).not.toContain('/assets/look-')
    }
    // The admin draws its picker with no tile pressed, rather than failing.
    const { lookPicker } = await import('@/web/admin/screens/settings-appearance-look')
    const { adminT } = await import('@/i18n/admin-i18n')
    const picker = lookPicker(adminT('en'), await getSettings())
    expect(picker).not.toContain('aria-pressed="true"')
    expect(picker).toContain('data-k="theme" data-was=""')
  })
})

describe('the switches', () => {
  it('declares the label words and the display face on every theme', async () => {
    for (const { id, display } of BUILTIN_THEMES) {
      await wear({ theme: id, language: 'vi' })
      const css = inlineStyle(await get('/a-post'))
      expect(css).toContain(':root{--l-figure:"Hình";--l-table:"Bảng"}')
      expect(css).toContain(`--font-display:${display ? display.stack : 'var(--font-reading)'}}`)
    }
  })

  it('preloads and declares the headline face only where the theme has one', async () => {
    await wear({ theme: 'paper' })
    const paper = await get('/a-post')
    expect(paper).toContain('<link rel="preload" href="/fonts/sourceserif-latin.woff2"')
    expect(inlineStyle(paper)).toContain("font-family:'Source Serif 4'")
    await wear({ theme: 'code' })
    const code = await get('/a-post')
    expect(code).not.toContain('sourceserif')
  })

  it('puts the menu in the masthead where the theme says header, and in the rail otherwise', async () => {
    const menuInHeader = (page: string): boolean =>
      /<header class="site[^"]*"[\s\S]*?Colophon[\s\S]*?<\/header>/.test(page)
    await wear({ theme: 'paper' })
    expect(menuInHeader(await get('/a-post'))).toBe(true)
    expect(menuInHeader(await get('/'))).toBe(true)
    await wear({ theme: 'code' })
    expect(menuInHeader(await get('/a-post'))).toBe(false)
  })

  it("keys the mono chrome's tracking on the chrome font, the source-code theme included", async () => {
    // That theme forced its chrome into the monospace through 2.2.19 and carried a tracking
    // block of its own; it draws the owner's chrome font now, so the font's block is the one.
    await wear({ theme: 'code', chromeFont: 'jetbrains-mono' })
    expect(inlineStyle(await get('/'))).toContain('html[data-chrome-font="jetbrains-mono"] body')
    expect(inlineStyle(await get('/'))).not.toContain('data-theme=')
    await wear({ theme: 'code', chromeFont: 'inter' })
    expect(inlineStyle(await get('/'))).not.toContain('letter-spacing:-0.05em')
  })
  it("deepens the meta ink straight behind the sheet of a theme that asks, and nowhere else", async () => {
    // Where the notebook's own sheet carried it until a theme was barred from setting an engine
    // variable, so the cascade is the one it was.
    await wear({ theme: 'notes' })
    const page = await get('/a-post')
    // In the theme's layer, as the sheet is (`web/css-layers.ts`).
    expect(page).toMatch(/look-notes\.[0-9a-f]+\.css"><style data-meta-ink>@layer theme\{html\[data-theme="notes"\]\{--meta-deepened:/)
    expect(page.indexOf('data-meta-ink')).toBeLessThan(page.indexOf('<style>'))
    // The sign-in pages wear no theme, so they keep the palette's own ink.
    const { loginShell } = await import('@/web/login-page')
    expect(loginShell(await getSettings(), 'Sign in', '<p>x</p>')).not.toContain('--meta-deepened')
    for (const theme of ['plain', 'code', 'paper']) {
      await wear({ theme })
      expect(await get('/a-post')).not.toContain('data-meta-ink')
    }
  })
})
