// The fixture, the payload and the four helpers the two settings mount-test files share.
//
// Extracted on 2026-08-29, when adding the Tables card put `SettingsView.mount.test.tsx` over
// the 400-line cap. The split is by SUBJECT: `SettingsView.mount.test.tsx` keeps the screen's
// own mechanics — the tabs exist, switching swaps the cards, Save PUTs, a rejected save keeps
// the edit — and `SettingsView.cards.test.tsx` holds the per-card groups. Both need the same
// hand-built settings object, and two copies of a fixture stay in step for about a month.
//
// The fixture is built BY HAND from the pure-data modules rather than imported: a value
// import of `@/web/admin/views` would drag the whole server (bun:sqlite included) into a DOM
// test, and `check:bundle` polices the same line in the shipped bundle. The compiler still
// checks the result against `ViewPayloads['settings']`, which is what keeps it honest.

import type { ViewPayloads } from '@/web/admin/views'
import type { SiteSettings } from '@/types'
import { expect } from 'bun:test'
import {
  ALL_PALETTE_IDS, DEFAULT_CHROME_FONT, DEFAULT_FONT, DEFAULT_FONT_PRESET, DEFAULT_PRESET_ID,
  THEME_PRESETS, defaultThemes, getFontPreset,
} from '@/content/themes'
import { DEFAULT_FIGURE, DEFAULT_GALLERY, DEFAULT_HOME } from '@/content/settings-sanitize'
import { DEFAULT_POST_IMAGE, DEFAULT_SHAPE, DEFAULT_AUTHOR } from '@/content/settings-shape'
import { DEFAULT_TABLE } from '@/content/settings-table'
import { DEFAULT_INKS } from '@/render/ink-palette'

/**
 * The fetch mocks each `onTab` installs, drained by the caller.
 *
 * Owned here rather than in each test file because `onTab` is what installs them: a helper
 * that mocks global fetch and leaves the undoing to whoever remembers is a helper that leaks
 * a mock into the next file the runner picks up.
 */
const restores: (() => void)[] = []

/** Register a mock's undo, for a test that installs its own rather than going through onTab. */
export function trackMock(restore: () => void): void {
  restores.push(restore)
}

/** Undo every mock installed since the last call. Each test file drains this in afterEach. */
export function releaseMocks(): void {
  for (const r of restores.splice(0)) r()
}

/** DEFAULT_SETTINGS' shape, rebuilt from the store-free modules (see the header). */
export function settingsFixture(): SiteSettings {
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
    table: DEFAULT_TABLE,
    author: DEFAULT_AUTHOR,
    seo: { autoSchema: true, sitemap: true, llms: true, robots: true, rss: true, ogImage: true, ogFallbackImage: '' },
    features: {
      search: true, toc: true, related: true, readingTime: true, progressBar: true,
      activityLog: true, transferStats: true, sidebar: true, sidebarSeries: true, leadPost: true,
      sidebarCategories: true, sidebarTags: true, sidebarArchive: true,
      categoryLabel: true, deck: true, penUnderline: true, penRing: true, bookText: false,
      bookMode: true, readNext: true, resume: true, infiniteScroll: false, gridView: true,
      archive: true, offline: false,
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
export function payload(): ViewPayloads['settings'] {
  return {
    settings: settingsFixture(),
    presets: THEME_PRESETS,
    commentEnv: { turnstileConfigured: false, googleConfigured: false, turnstileSiteKey: '' },
    integrations: {
      turnstileConfigured: false, turnstileSiteKey: '',
      cloudflareConfigured: false, cloudflareZoneId: '', purgeWebhookConfigured: false,
      offsiteConfigured: false, s3Bucket: '',
      googleConfigured: false,
      aiConfigured: false, aiProvider: '', aiModel: '', aiSeesImages: false,
    },
    posts: [{ slug: 'hello-world', title: 'Hello world' }],
    pages: [{ slug: 'about', title: 'About' }],
    categories: ['essays'],
    update: { blockedBy: null, update: { state: 'unknown' } },
  }
}

/**
 * The field `ui/Input` / `Textarea` renders under a given label.
 *
 * By LABEL rather than by placeholder or by index: three of the four author fields have no
 * placeholder, and an index into the card's inputs would pass while pointing at the wrong
 * one the day a field is inserted above it.
 */
export function fieldByLabel(container: HTMLElement, label: string): HTMLElement {
  const hit = [...container.querySelectorAll('label')].find(
    (l) => l.querySelector('span')?.textContent?.trim() === label,
  )
  const field = hit?.querySelector('input, textarea')
  if (!field) throw new Error(`no field labelled "${label}"`)
  return field as HTMLElement
}

/**
 * A button by its CARD and its label, for a label the tab prints more than once.
 *
 * `m.button` takes the first match in the DOM, which makes any assertion about a repeated
 * label secretly an assertion about card ORDER — and card order is a layout decision that
 * gets re-measured (see `admin-design.md`, "their heights get re-measured").
 */
export function buttonInCard(container: HTMLElement, cardTitle: string, label: string): HTMLButtonElement {
  const card = [...container.querySelectorAll('section')].find(
    (s) => s.querySelector('h2')?.textContent?.trim() === cardTitle,
  )
  if (!card) throw new Error(`no card titled "${cardTitle}"`)
  const hit = [...card.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
  if (!hit) throw new Error(`no <button> "${label}" inside "${cardTitle}"`)
  return hit
}

/** Mount, open a tab, and hand back the harness plus the dictionary. */
export async function onTab(tab: 'tabSite' | 'tabLayout' | 'tabAppearance') {
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
export async function saved(
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
