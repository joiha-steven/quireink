// The settings screen, MOUNTED, against the typed view contract.
//
// The props are declared as `ViewPayloads['settings']` — the contract views.ts added on
// 2026-08-29 — imported as a TYPE ONLY. A value import of `@/web/admin/views` would drag
// the whole server (bun:sqlite included) into a DOM test, and `check:bundle` polices the
// same line in the shipped bundle; the fixture below is therefore built BY HAND from the
// pure-data modules (`themes`, `settings-sanitize`, `ink-palette`), which the compiler then
// checks against the contract. `DEFAULT_SETTINGS` itself lives in `content/settings.ts`,
// whose imports reach the store — that is why it is replicated rather than imported.
//
// What is asserted: all eight tabs exist by their printed names, switching tabs swaps the
// cards, and editing the title then pressing Save PUTs the edited value to /api/settings.

import { describe, expect, it, beforeAll, afterAll, afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { ViewPayloads } from '@/web/admin/views'
import type { SiteSettings } from '@/types'
import {
  ALL_PALETTE_IDS, DEFAULT_CHROME_FONT, DEFAULT_FONT, DEFAULT_FONT_PRESET, DEFAULT_PRESET_ID,
  THEME_PRESETS, defaultThemes, getFontPreset,
} from '@/content/themes'
import { DEFAULT_FIGURE, DEFAULT_GALLERY, DEFAULT_HOME } from '@/content/settings-sanitize'
import { DEFAULT_INKS } from '@/render/ink-palette'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const restores: (() => void)[] = []
afterEach(() => { for (const r of restores.splice(0)) r() })

/** DEFAULT_SETTINGS' shape, rebuilt from the store-free modules (see the header). */
function settingsFixture(): SiteSettings {
  return {
    language: 'en',
    title: 'Quire Ink',
    description: '',
    siteUrl: '',
    logoUrl: '', logoWidth: 120, logoRenderUrl: '', logoEmailUrl: '', logoRenderHeight: 0,
    logoDarkUrl: '', logoDarkRenderUrl: '', logoDarkRenderHeight: 0,
    showLogo: false,
    showDescription: true,
    fontPreset: DEFAULT_FONT_PRESET,
    chromeFont: DEFAULT_CHROME_FONT,
    faviconUrl: '',
    appIconUrl: '',
    autosaveSeconds: 120,
    maxUploadMb: 0,
    storageQuotaGb: 0,
    firstRunDone: true,
    timezone: '',
    updateCheck: true,
    contentWidth: 672,
    postsPerPage: 10,
    relatedCount: 3,
    excerptLength: 50,
    ideChrome: false,
    customCss: '',
    footer: '© {year} {title}',
    menu: [],
    featured: [],
    mostViewedCount: 3,
    sidebarLayout: 'single',
    defaultScheme: 'system',
    themePreset: DEFAULT_PRESET_ID,
    enabledPalettes: ALL_PALETTE_IDS,
    themes: defaultThemes(),
    typography: getFontPreset(DEFAULT_FONT_PRESET).typography,
    customFont: DEFAULT_FONT,
    home: DEFAULT_HOME,
    figure: DEFAULT_FIGURE,
    gallery: DEFAULT_GALLERY,
    seo: { autoSchema: true, sitemap: true, llms: true, robots: true, rss: true, ogImage: true, ogFallbackImage: '' },
    features: {
      search: true, toc: true, related: true, readingTime: true, progressBar: true,
      activityLog: true, sidebar: true, sidebarSeries: true, leadPost: true,
      categoryLabel: true, deck: true, penUnderline: true, penRing: true, bookText: false,
      bookMode: true, readNext: true, resume: true, infiniteScroll: false, gridView: true,
    },
    comments: { enabled: false, turnstile: false, googleAuth: false },
    mcp: { enabled: false },
    ai: { altText: true, excerpt: true, commentGuard: true },
    inks: { ...DEFAULT_INKS },
    motion: { enabled: true, keys: 'woody', keyVolume: 60 },
    cache: { enabled: true },
    backups: { enabled: true, intervalDays: 4, keep: 4 },
  }
}

/** The full prop set the settings view endpoint would return, type-checked against it. */
function payload(): ViewPayloads['settings'] {
  return {
    settings: settingsFixture(),
    presets: THEME_PRESETS,
    commentEnv: { turnstileConfigured: false, googleConfigured: false, turnstileSiteKey: '' },
    integrations: {
      turnstileConfigured: false, turnstileSiteKey: '',
      cloudflareConfigured: false, cloudflareZoneId: '', purgeWebhookConfigured: false,
      offsiteConfigured: false, s3Bucket: '',
      googleConfigured: false,
      aiConfigured: false, aiProvider: '', aiModel: '',
    },
    posts: [{ slug: 'hello-world', title: 'Hello world' }],
    pages: [{ slug: 'about', title: 'About' }],
    categories: ['essays'],
    update: { blockedBy: null, update: { state: 'unknown' } },
  }
}

describe('SettingsView, mounted', () => {
  it('shows all eight tabs and opens on Site', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { SettingsView } = await import('@/admin/components/SettingsView')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: true }))
    restores.push(fetchMock.restore)

    const m = await mountAdmin(<SettingsView {...payload()} />)
    for (const label of [
      t.tabSite, t.tabLayout, t.tabReading, t.tabAppearance,
      t.tabSeo, t.tabConnections, t.tabAi, t.tabSystem,
    ]) expect(m.button(label)).toBeTruthy()
    // The Site tab's card is on screen; a card from another tab is not.
    expect(m.text()).toContain(t.cardGeneral)
    expect(m.text()).not.toContain(t.cardLayout)
    // Rendering asked the server for nothing: every prop arrived through the view payload.
    expect(fetchMock.calls.length).toBe(0)
    await m.unmount()
  })

  it('switching to Layout swaps the cards', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { SettingsView } = await import('@/admin/components/SettingsView')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: true }))
    restores.push(fetchMock.restore)

    const m = await mountAdmin(<SettingsView {...payload()} />)
    await m.click(m.button(t.tabLayout))
    expect(m.text()).toContain(t.cardLayout)
    expect(m.text()).not.toContain(t.cardGeneral)
    await m.unmount()
  })

  it('editing the title and saving PUTs the edited value to /api/settings', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { SettingsView } = await import('@/admin/components/SettingsView')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: true, data: settingsFixture() }))
    restores.push(fetchMock.restore)

    const m = await mountAdmin(<SettingsView {...payload()} />)
    // The title field is the input SiteFields renders with the product-name placeholder.
    const title = m.container.querySelector('input[placeholder="Quire Ink"]')
    expect(title).not.toBeNull()
    await m.type(title as Element, 'My Field Notes')
    await m.click(m.button(t.saveSettings))
    await m.flush()

    const put = fetchMock.calls.find((c) => c.method === 'PUT' && c.url === '/api/settings')
    expect(put).toBeDefined()
    // The body is the WHOLE settings object with the one edit applied — the endpoint
    // merges, but the client always sends the full state it holds.
    const body = put?.body as SiteSettings
    expect(body.title).toBe('My Field Notes')
    expect(body.postsPerPage).toBe(10)
    expect(m.text()).toContain(t.savedSettings) // the toast — the save's only confirmation
    await m.unmount()
  })

  it('a rejected save reports failure and keeps the edit on screen', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { SettingsView } = await import('@/admin/components/SettingsView')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: false, error: 'nope' }))
    restores.push(fetchMock.restore)

    const m = await mountAdmin(<SettingsView {...payload()} />)
    const title = m.container.querySelector('input[placeholder="Quire Ink"]')
    await m.type(title as Element, 'Unsaved edit')
    await m.click(m.button(t.saveSettings))
    await m.flush()
    expect(m.text()).toContain(t.saveFailed)
    expect((title as HTMLInputElement).value).toBe('Unsaved edit')
    await m.unmount()
  })
})
