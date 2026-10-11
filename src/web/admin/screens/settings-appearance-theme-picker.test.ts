// The Appearance tab's theme tiles and the Custom CSS box's name list, as markup (ADR 0072).
// The tiles are the registry's, in its order and words; the CSS names are grouped by the surface
// they appear on, with the group titles from the locale.
import { describe, expect, it } from 'bun:test'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { BUILTIN_THEMES } from '@/content/themes-builtin'
import { PROMISED_SELECTORS } from '@/content/appearance-contract'
import { appearanceTab } from '@/web/admin/screens/settings-appearance'
import { lookPicker } from '@/web/admin/screens/settings-appearance-look'

describe('the theme picker', () => {
  it('draws one tile per built-in theme, in the registry order, saving to `theme`', () => {
    const t = adminT('en')
    const html = lookPicker(t, { ...DEFAULT_SETTINGS, theme: 'paper', look: 'paper' })
    expect(html).toContain('data-k="theme"')
    expect(html).toContain('data-was="paper"')
    const ids = [...html.matchAll(/data-choice="([^"]+)"/g)].map((m) => m[1])
    expect(ids).toEqual(BUILTIN_THEMES.map((theme) => theme.id))
    expect(html).toContain('data-choice="paper" aria-pressed="true"')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    for (const { nameKey } of BUILTIN_THEMES) expect(html).toContain(t[nameKey])
  })

  it('is called Theme on the tab, in English and in Vietnamese', () => {
    expect(adminT('en').lookLabel).toBe('Theme')
    expect(adminT('vi').lookLabel).toBe('Theme')
    expect(appearanceTab(adminT('en'), DEFAULT_SETTINGS, { presets: [] })).toContain('>Theme<')
  })
})

describe('the Custom CSS name list', () => {
  it('groups the selectors under Shared, Blog and Front page, each name once', () => {
    const t = adminT('en')
    const html = appearanceTab(t, DEFAULT_SETTINGS, { presets: [] })
    const box = html.slice(html.indexOf('data-css-names'))
    const at = (title: string): number => box.indexOf(`>${title}</h4>`)
    expect(at(t.cssSurfaceShared)).toBeGreaterThan(-1)
    expect(at(t.cssSurfaceBlog)).toBeGreaterThan(at(t.cssSurfaceShared))
    expect(at(t.cssSurfaceFront)).toBeGreaterThan(at(t.cssSurfaceBlog))
    // A front-page name sits under Front page, a blog name under Blog.
    const front = PROMISED_SELECTORS.find((s) => s.surface === 'front')!
    const blog = PROMISED_SELECTORS.find((s) => s.surface === 'blog')!
    const where = (name: string): number => box.indexOf(`data-css-insert="${name}"`)
    expect(where(front.name)).toBeGreaterThan(at(t.cssSurfaceFront))
    expect(where(blog.name)).toBeGreaterThan(at(t.cssSurfaceBlog))
    expect(where(blog.name)).toBeLessThan(at(t.cssSurfaceFront))
    for (const s of PROMISED_SELECTORS) {
      expect(box.split(`data-css-insert="${s.name}"`)).toHaveLength(2)
    }
  })
})
