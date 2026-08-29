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
//
// Then the three groups added on 2026-08-29 — post pictures, shape, author — each on the tab
// it was filed under, each changing the value the form will SEND rather than only the pixel
// it draws. The hero chooser is asserted to offer exactly two options, because the third one
// (`wide`) was built and measured out again, and a picker is where it would come back.

import { describe, expect, it, beforeAll, afterAll, afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { ViewPayloads } from '@/web/admin/views'
import type { SiteSettings } from '@/types'
import {
  ALL_PALETTE_IDS, DEFAULT_CHROME_FONT, DEFAULT_FONT, DEFAULT_FONT_PRESET, DEFAULT_PRESET_ID,
  THEME_PRESETS, defaultThemes, getFontPreset,
} from '@/content/themes'
import { DEFAULT_FIGURE, DEFAULT_GALLERY, DEFAULT_HOME } from '@/content/settings-sanitize'
import { DEFAULT_POST_IMAGE, DEFAULT_SHAPE, DEFAULT_AUTHOR } from '@/content/settings-shape'
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
    // `settings-shape.ts` is store-free (pure data + two validators), so the real defaults
    // can be imported here rather than transcribed — which is what keeps this fixture from
    // drifting away from the thing it stands in for.
    postImage: DEFAULT_POST_IMAGE,
    shape: DEFAULT_SHAPE,
    author: DEFAULT_AUTHOR,
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

/**
 * The field `ui/Input` / `Textarea` renders under a given label.
 *
 * By LABEL rather than by placeholder or by index: three of the four author fields have no
 * placeholder, and an index into the card's inputs would pass while pointing at the wrong
 * one the day a field is inserted above it.
 */
function fieldByLabel(container: HTMLElement, label: string): HTMLElement {
  const hit = [...container.querySelectorAll('label')].find(
    (l) => l.querySelector('span')?.textContent?.trim() === label,
  )
  const field = hit?.querySelector('input, textarea')
  if (!field) throw new Error(`no field labelled "${label}"`)
  return field as HTMLElement
}

/** Mount, open a tab, and hand back the harness plus the dictionary. */
async function onTab(tab: 'tabSite' | 'tabLayout' | 'tabAppearance') {
  const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
  const { SettingsView } = await import('@/admin/components/SettingsView')
  const { adminT } = await import('@/i18n/admin-i18n')
  const t = adminT('en')
  // The media library asks for a LIST when the portrait picker opens; answering every URL
  // with the settings object would hand it an object where it iterates.
  const fetchMock = installFetchMock((url) =>
    url.startsWith('/api/media')
      ? { success: true, data: [] }
      : { success: true, data: settingsFixture() })
  restores.push(fetchMock.restore)
  const m = await mountAdmin(<SettingsView {...payload()} />)
  await m.click(m.button(t[tab]))
  return { m, t, fetchMock }
}

/** The settings object the form sent, after a Save. */
async function saved(
  m: Awaited<ReturnType<typeof onTab>>['m'],
  t: Awaited<ReturnType<typeof onTab>>['t'],
  fetchMock: Awaited<ReturnType<typeof onTab>>['fetchMock'],
): Promise<SiteSettings> {
  await m.click(m.button(t.saveSettings))
  await m.flush()
  // The LAST one: a test that saves twice would otherwise keep reading the first body and
  // pass no matter what the second edit did.
  const put = fetchMock.calls.filter((c) => c.method === 'PUT' && c.url === '/api/settings').at(-1)
  expect(put).toBeDefined()
  return put?.body as SiteSettings
}

describe('post pictures (Layout)', () => {
  it('arrives with both choosers off, which is what an upgrade must look like', async () => {
    const { m, t } = await onTab('tabLayout')
    expect(m.text()).toContain(t.cardPostImage)
    // `aria-pressed` is the picker's own record of the selection, so this reads the control
    // rather than the state behind it: two `Not shown` buttons, both pressed.
    const off = [...m.container.querySelectorAll('button')]
      .filter((b) => b.textContent?.trim() === t.piOff)
    expect(off.length).toBe(2)
    expect(off.every((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true)
    await m.unmount()
  })

  it('offers the hero TWO widths and no third — `wide` printed over the contents list', async () => {
    const { m, t } = await onTab('tabLayout')
    expect(m.button(t.piHeroInline)).toBeTruthy()
    // The row is the hero's chooser: its options are the two, and nothing else.
    const track = m.button(t.piHeroInline).parentElement
    expect([...(track?.children ?? [])].map((c) => c.textContent?.trim()))
      .toEqual([t.piOff, t.piHeroInline])
    await m.unmount()
  })

  it('turning the hero on sends hero: inline', async () => {
    const { m, t, fetchMock } = await onTab('tabLayout')
    await m.click(m.button(t.piHeroInline))
    const body = await saved(m, t, fetchMock)
    expect(body.postImage.hero).toBe('inline')
    expect(body.postImage.thumb).toBe('none') // the other half is untouched
    await m.unmount()
  })

  it('a thumbnail can sit beside the text or above the title', async () => {
    const { m, t, fetchMock } = await onTab('tabLayout')
    await m.click(m.button(t.piThumbTop))
    expect(await saved(m, t, fetchMock)).toHaveProperty('postImage.thumb', 'top')
    await m.click(m.button(t.piThumbSide))
    const body = await saved(m, t, fetchMock)
    expect(body.postImage.thumb).toBe('side')
    await m.unmount()
  })
})

describe('shape (Appearance)', () => {
  it('opens on the defaults that reproduce today exactly', async () => {
    const { m, t } = await onTab('tabAppearance')
    expect(m.text()).toContain(t.cardShape)
    for (const label of [t.shapeNormal, t.shapeSoft, t.shapeRegular]) {
      expect(m.button(label).getAttribute('aria-pressed')).toBe('true')
    }
    await m.unmount()
  })

  it('sends the three values it was left on, and only those', async () => {
    const { m, t, fetchMock } = await onTab('tabAppearance')
    await m.click(m.button(t.shapeRelaxed))
    await m.click(m.button(t.shapeRound))
    await m.click(m.button(t.shapeBold))
    const body = await saved(m, t, fetchMock)
    expect(body.shape).toEqual({ density: 'relaxed', radius: 'round', headingWeight: 'bold' })
    await m.unmount()
  })
})

describe('author (Site)', () => {
  it('starts empty — an existing blog has no byline and gains none', async () => {
    const { m, t } = await onTab('tabSite')
    expect(m.text()).toContain(t.cardAuthor)
    expect((fieldByLabel(m.container, t.authorName) as HTMLInputElement).value).toBe('')
    // No portrait, so the note stands in for the preview and no Remove is offered.
    expect(m.text()).toContain(t.authorNoAvatar)
    expect(() => m.button(t.removeSelection)).toThrow()
    await m.unmount()
  })

  it('sends the name, the bio and the link', async () => {
    const { m, t, fetchMock } = await onTab('tabSite')
    await m.type(fieldByLabel(m.container, t.authorName), 'Trần Mạnh Hùng')
    await m.type(fieldByLabel(m.container, t.authorBio), 'Writes about keyboards.')
    await m.type(fieldByLabel(m.container, t.authorLink), 'https://example.com/about')
    const body = await saved(m, t, fetchMock)
    expect(body.author).toEqual({
      name: 'Trần Mạnh Hùng',
      bio: 'Writes about keyboards.',
      // The PATH is kept: `sanitizeAuthor` deliberately does not use `sanitizeUrl`, which
      // would trim this back to the bare origin.
      url: 'https://example.com/about',
      avatarUrl: '',
    })
    await m.unmount()
  })

  it('the portrait opens the media library, the same picker the logo uses', async () => {
    const { m, t } = await onTab('tabSite')
    // Two `Choose image` buttons would mean a second picker was hand-rolled here.
    await m.click(m.button(t.chooseImage))
    expect(m.text()).toContain(t.mediaTitle)
    await m.unmount()
  })
})
