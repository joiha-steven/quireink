// Settings: a single row (id=1) in Postgres `settings`. Reads fall back to
// defaults on any failure so the header/<title> never crash. Image refs stored
// store-relative, binaries on Blob. Validation/migration lives in settings-sanitize.ts.

import type { SiteSettings } from '@/types'
import { DEFAULT_INKS } from '@/render/ink-palette'
import { collapseBlob, expandBlob, deleteByPathname } from '@/media/blob'
import { renderLogo } from '@/media/files'
import { one, run } from '@/store/query'
import { isSiteLang } from '@/locales/langs'
import { DEFAULT_PRESET_ID, isPresetId, isFontPresetId, defaultThemes, ALL_PALETTE_IDS, DEFAULT_FONT, DEFAULT_FONT_PRESET, isChromeFontId, DEFAULT_CHROME_FONT, isScheme, getFontPreset } from '@/content/themes'
import {
  DEFAULT_HOME, DEFAULT_GALLERY, DEFAULT_FIGURE, sanitizeMenu, migrateThemes, sanitizeThemes, sanitizeEnabledPalettes, sanitizeSeo, sanitizeFeatures, sanitizeHome, sanitizeGallery, sanitizeFigure, sanitizeMcp, sanitizeMotion, sanitizeCache,
  sanitizeBackups, sanitizeComments, sanitizeCss, sanitizeUrl, clampNumber, sanitizeFeatured,
  sanitizeTimezone, sanitizeAi, sanitizeInks,
} from '@/content/settings-sanitize'
import { sanitizeTypography, sanitizeFont } from '@/content/settings-type'
import {
  DEFAULT_POST_IMAGE, DEFAULT_SHAPE, DEFAULT_AUTHOR,
  sanitizePostImage, sanitizeShape, sanitizeAuthor,
} from '@/content/settings-shape'
import { DEFAULT_TABLE, sanitizeTable } from '@/content/settings-table'
import {
  DEFAULT_SEO, DEFAULT_BACKUPS, DEFAULT_FEATURES, DEFAULT_COMMENTS,
} from '@/content/settings-defaults'

// Re-export so existing importers keep working.
export { DEFAULT_THEME, themesToCss, getDefaultTheme, DEFAULT_TYPOGRAPHY, DEFAULT_FONT } from '@/content/themes'
export { resolveSiteUrl, siteUrlIsUnset, resolveAppIcon } from '@/content/settings-resolve'
export { typographyToCss, fontToCss } from '@/content/settings-css'
export { shapeToCss } from '@/content/settings-shape'
export { tableToCss } from '@/content/settings-table'
export {
  DEFAULT_SEO, DEFAULT_BACKUPS, DEFAULT_FEATURES, DEFAULT_COMMENTS,
} from '@/content/settings-defaults'

/**
 * The type numbers a fresh install starts with: the DEFAULT FACE's own, never the neutral
 * `DEFAULT_TYPOGRAPHY`.
 *
 * Each preset carries typography tuned for its face — a serif's secondary text runs a shade
 * larger, its headings drop the sans's negative tracking — so an install defaulting to
 * Literata while holding Inter's numbers is exactly the mismatch `docs/conventions/type.md`
 * records for Reset. One constant because BOTH doors have to agree: `DEFAULT_SETTINGS` (no
 * row in the table) and the `sanitizeTypography` fallback in `fromStored` (a row that names
 * no typography). They did not, and `settings.test.ts` caught it in seven roles.
 */
const INSTALL_TYPOGRAPHY = getFontPreset(DEFAULT_FONT_PRESET).typography

export const DEFAULT_SETTINGS: SiteSettings = {
  language: 'en',
  title: 'Quire Ink',
  description: '',
  siteUrl: '',
  logoUrl: '',
  logoWidth: 120,
  logoRenderUrl: '',
  logoEmailUrl: '',
  logoRenderHeight: 0,
  logoDarkUrl: '',
  logoDarkRenderUrl: '',
  logoDarkRenderHeight: 0,
  showLogo: false,
  showDescription: true,
  fontPreset: DEFAULT_FONT_PRESET,
  chromeFont: DEFAULT_CHROME_FONT,
  faviconUrl: '',
  appIconUrl: '',
  // Two minutes, which is what the owner asked for on 2026-07-30. It was 8 seconds and a
  // constant; the interval is only half the safety net, the flush on hide is the other half.
  autosaveSeconds: 120,
  // 0 = do not narrow the deployment's ceiling. NOT a copy of `MAX_UPLOAD_MB` /
  // `STORAGE_QUOTA_GB`: two places holding one limit is how they disagree (`media/limits.ts`).
  maxUploadMb: 0,
  storageQuotaGb: 0,
  firstRunDone: false,
  // On, and the reason is in `types.ts`. An operator who disagrees has one environment
  // variable; an owner who disagrees has one switch.
  // Empty, not 'UTC': an operator who set ANALYTICS_TZ on an existing install keeps their
  // answer, and a blank field reads as "whatever this server was told" rather than as a
  // choice nobody made.
  timezone: '',
  updateCheck: true,
  contentWidth: 672,
  postsPerPage: 10,
  relatedCount: 3,
  excerptLength: 50,
  ideChrome: false,
  customCss: '',
  // The credit points at the PRODUCT'S HOME, not the repository: a reader who follows it
  // wants to know what Quire Ink is, and the repository answers a different question for a
  // different visitor. The licence accepts either (LICENSE-EXCEPTION.md §2(d)).
  footer: '© {year} {title} · [powered by Quire Ink](https://quireink.com)',
  menu: [],
  featured: [],
  mostViewedCount: 3,
  sidebarLayout: 'single',
  defaultScheme: 'system',
  themePreset: DEFAULT_PRESET_ID,
  enabledPalettes: ALL_PALETTE_IDS,
  themes: defaultThemes(),
  typography: INSTALL_TYPOGRAPHY,
  customFont: DEFAULT_FONT,
  home: DEFAULT_HOME,
  figure: DEFAULT_FIGURE,
  gallery: DEFAULT_GALLERY,
  postImage: DEFAULT_POST_IMAGE,
  shape: DEFAULT_SHAPE,
  table: DEFAULT_TABLE,
  author: DEFAULT_AUTHOR,
  seo: DEFAULT_SEO,
  features: DEFAULT_FEATURES,
  comments: DEFAULT_COMMENTS,
  mcp: { enabled: false },
  ai: { altText: true, excerpt: true, commentGuard: true },
  // Every ink empty: the built-ins are measured values (ADR 0018) and belong in the code
  // where they can still be corrected, not copied into every install's database.
  inks: { ...DEFAULT_INKS },
  // 60, on a scale rebuilt on 2026-08-25 to be much louder than the one before it: measured
  // A-weighted, a letter here is about four times the amplitude of the OLD scale's maximum,
  // and the slider still has forty points left above it.
  motion: { enabled: true, keys: 'woody', keyVolume: 60 },
  // On, because a blog that is fast for readers is the default. The switch exists for the
  // hour you are changing the look and want to see it, not for permanent use.
  cache: { enabled: true },
  backups: DEFAULT_BACKUPS,
}

// Back-compat: the old boolean `fontChromeInter` (true = Inter chrome, false = chrome
// follows the reading font) migrates to the `chromeFont` selector. A stored `chromeFont`
// id wins; a legacy `false` maps to 'reading'; anything else to the Inter default.
function resolveChromeFont(stored: Partial<SiteSettings> & { fontChromeInter?: unknown }): string {
  if (isChromeFontId(stored.chromeFont)) return stored.chromeFont
  if (stored.fontChromeInter === false) return 'reading'
  return DEFAULT_CHROME_FONT
}

// Settings merged over defaults; defaults on any error.
export async function getSettings(): Promise<SiteSettings> {
  try {
    const row = one<{ data: string }>(`select data from settings where id = 1`)
    // `data` is verbatim JSON, never reshaped. A malformed blob throws here and the
    // catch below returns defaults, which is the same "never crash the header" contract
    // the frozen tree had against a failed query.
    const stored = (row ? JSON.parse(row.data) : {}) as Partial<SiteSettings>
    const seo = sanitizeSeo(stored.seo, DEFAULT_SEO)
    // Expand store-relative image refs to absolute Blob URLs.
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      logoUrl: expandBlob(stored.logoUrl ?? DEFAULT_SETTINGS.logoUrl),
      logoRenderUrl: expandBlob(stored.logoRenderUrl ?? DEFAULT_SETTINGS.logoRenderUrl),
      logoEmailUrl: expandBlob(stored.logoEmailUrl ?? DEFAULT_SETTINGS.logoEmailUrl),
      logoDarkUrl: expandBlob(stored.logoDarkUrl ?? DEFAULT_SETTINGS.logoDarkUrl),
      logoDarkRenderUrl: expandBlob(stored.logoDarkRenderUrl ?? DEFAULT_SETTINGS.logoDarkRenderUrl),
      faviconUrl: expandBlob(stored.faviconUrl ?? DEFAULT_SETTINGS.faviconUrl),
      appIconUrl: expandBlob(stored.appIconUrl ?? DEFAULT_SETTINGS.appIconUrl),
      siteUrl: sanitizeUrl(stored.siteUrl),
      relatedCount: clampNumber(stored.relatedCount, 0, 12, DEFAULT_SETTINGS.relatedCount),
      excerptLength: clampNumber(stored.excerptLength, 10, 100, DEFAULT_SETTINGS.excerptLength),
      // Generous upper bound on purpose — these only narrow (`media/limits.ts`), so a number
      // above the deployment's own does nothing. The clamp is against a negative or a NaN
      // landing as 0, which reads as "no cap": the exact bug the setting exists to prevent.
      autosaveSeconds: clampNumber(stored.autosaveSeconds, 15, 600, DEFAULT_SETTINGS.autosaveSeconds),
      maxUploadMb: clampNumber(stored.maxUploadMb, 0, 4096, DEFAULT_SETTINGS.maxUploadMb),
      storageQuotaGb: clampNumber(stored.storageQuotaGb, 0, 4096, DEFAULT_SETTINGS.storageQuotaGb),
      customCss: sanitizeCss(stored.customCss),
      defaultScheme: isScheme(stored.defaultScheme) ? stored.defaultScheme : 'system',
      themePreset: isPresetId(stored.themePreset) ? stored.themePreset : DEFAULT_PRESET_ID,
      fontPreset: isFontPresetId(stored.fontPreset) ? stored.fontPreset : DEFAULT_FONT_PRESET,
      chromeFont: resolveChromeFont(stored),
      ideChrome: stored.ideChrome === true,
      featured: sanitizeFeatured(stored.featured, []),
      mostViewedCount: clampNumber(stored.mostViewedCount, 0, 10, DEFAULT_SETTINGS.mostViewedCount),
      sidebarLayout: stored.sidebarLayout === 'two' ? 'two' : 'single',
      enabledPalettes: sanitizeEnabledPalettes(stored.enabledPalettes, isPresetId(stored.themePreset) ? stored.themePreset : DEFAULT_PRESET_ID),
      themes: sanitizeThemes(stored.themes, migrateThemes(stored as Record<string, unknown>)),
      typography: sanitizeTypography(stored.typography, INSTALL_TYPOGRAPHY),
      customFont: (() => {
        const f = sanitizeFont(stored.customFont, DEFAULT_FONT)
        return { ...f, faces: f.faces.map((x) => ({ ...x, url: expandBlob(x.url) })) }
      })(),
      seo: { ...seo, ogFallbackImage: expandBlob(seo.ogFallbackImage) },
      features: sanitizeFeatures(stored.features, DEFAULT_FEATURES),
      home: sanitizeHome(stored.home, DEFAULT_SETTINGS.home),
      figure: sanitizeFigure(stored.figure, DEFAULT_FIGURE),
      gallery: sanitizeGallery(stored.gallery, DEFAULT_GALLERY),
      postImage: sanitizePostImage(stored.postImage, DEFAULT_POST_IMAGE),
      shape: sanitizeShape(stored.shape, DEFAULT_SHAPE),
      table: sanitizeTable(stored.table, DEFAULT_TABLE),
      author: (() => {
        const a = sanitizeAuthor(stored.author, DEFAULT_AUTHOR)
        // The portrait is an image ref like the logo: stored store-relative, expanded on
        // the way out (Invariant 3).
        return { ...a, avatarUrl: expandBlob(a.avatarUrl) }
      })(),
      comments: sanitizeComments(stored.comments, DEFAULT_COMMENTS),
      mcp: sanitizeMcp(stored.mcp, DEFAULT_SETTINGS.mcp),
      ai: sanitizeAi(stored.ai, DEFAULT_SETTINGS.ai),
      inks: sanitizeInks(stored.inks, DEFAULT_SETTINGS.inks),
      motion: sanitizeMotion(stored.motion, DEFAULT_SETTINGS.motion),
      cache: sanitizeCache(stored.cache, DEFAULT_SETTINGS.cache),
      backups: sanitizeBackups(stored.backups, DEFAULT_BACKUPS),
      // Only an explicit `false` turns it off. A settings blob written before this
      // existed has no key at all, and `=== true` would read that silence as a refusal
      // for every instance that upgraded into this version.
      timezone: sanitizeTimezone(stored.timezone, ''),
      updateCheck: stored.updateCheck !== false,
    }
  } catch (error) {
    console.error(`[ERROR] settings.getSettings: ${(error as Error).message}`)
    return DEFAULT_SETTINGS
  }
}

// Merge a partial update over current settings and persist. Returns the result.
export async function saveSettings(input: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSettings()

  // Logo: keep the original untouched; (re)build the small display WebP when the
  // source/width changes or none exists yet. Delete the prior derived file (one
  // ever exists); clear when logo removed/hidden. Vector/animated → null (served as-is).
  const showLogo = input.showLogo ?? current.showLogo
  const logoUrl = input.logoUrl ?? current.logoUrl
  const logoWidth = clampNumber(input.logoWidth, 24, 600, current.logoWidth)
  let logoRenderUrl = current.logoRenderUrl
  let logoRenderHeight = current.logoRenderHeight
  let logoEmailUrl = current.logoEmailUrl
  // Both derived files are rebuilt and cleaned up together — the email PNG twin must
  // never outlive the logo it was made from, or a stale mark ships in a newsletter.
  const dropDerived = async () => {
    if (current.logoRenderUrl) await deleteByPathname(collapseBlob(current.logoRenderUrl)).catch(() => {})
    if (current.logoEmailUrl) await deleteByPathname(collapseBlob(current.logoEmailUrl)).catch(() => {})
  }
  if (!showLogo || !logoUrl) {
    await dropDerived()
    logoRenderUrl = ''
    logoRenderHeight = 0
    logoEmailUrl = ''
  } else if (logoUrl !== current.logoUrl || logoWidth !== current.logoWidth || !current.logoRenderUrl) {
    const rendered = await renderLogo(logoUrl, logoWidth)
    await dropDerived()
    logoRenderUrl = rendered?.url ?? ''
    logoRenderHeight = rendered?.height ?? 0
    logoEmailUrl = rendered?.emailUrl ?? ''
  }

  // The dark twin, same pipeline and same width so the two marks are interchangeable in
  // the header. It has no email variant: a newsletter has no dark mode to respond to.
  const logoDarkUrl = input.logoDarkUrl ?? current.logoDarkUrl
  let logoDarkRenderUrl = current.logoDarkRenderUrl
  let logoDarkRenderHeight = current.logoDarkRenderHeight
  const dropDark = async () => {
    if (current.logoDarkRenderUrl) {
      await deleteByPathname(collapseBlob(current.logoDarkRenderUrl)).catch(() => {})
    }
  }
  if (!showLogo || !logoDarkUrl) {
    await dropDark()
    logoDarkRenderUrl = ''
    logoDarkRenderHeight = 0
  } else if (
    logoDarkUrl !== current.logoDarkUrl
    || logoWidth !== current.logoWidth
    || !current.logoDarkRenderUrl
  ) {
    const rendered = await renderLogo(logoDarkUrl, logoWidth)
    await dropDark()
    logoDarkRenderUrl = rendered?.url ?? ''
    logoDarkRenderHeight = rendered?.height ?? 0
  }

  // The (possibly new) default palette — used both as `themePreset` and as the
  // always-included member of `enabledPalettes`.
  const themePreset = isPresetId(input.themePreset) ? input.themePreset : current.themePreset

  const next: SiteSettings = {
    language: isSiteLang(input.language) ? input.language : current.language,
    title: (input.title ?? current.title).trim() || DEFAULT_SETTINGS.title,
    description: input.description ?? current.description,
    siteUrl: input.siteUrl !== undefined ? sanitizeUrl(input.siteUrl) : current.siteUrl,
    logoUrl,
    logoWidth,
    logoRenderUrl,
    logoRenderHeight,
    logoEmailUrl,
    logoDarkUrl,
    logoDarkRenderUrl,
    logoDarkRenderHeight,
    showLogo,
    showDescription: input.showDescription ?? current.showDescription,
    faviconUrl: input.faviconUrl ?? current.faviconUrl,
    appIconUrl: input.appIconUrl ?? current.appIconUrl,
    // Never unset by a merge: an owner who dismissed the steps has dismissed them, and a
    // PUT that omits the flag is every other settings save on the screen.
    firstRunDone: input.firstRunDone ?? current.firstRunDone,
    contentWidth: clampNumber(input.contentWidth, 360, 1600, current.contentWidth),
    postsPerPage: clampNumber(input.postsPerPage, 1, 100, current.postsPerPage),
    relatedCount: clampNumber(input.relatedCount, 0, 12, current.relatedCount),
    excerptLength: clampNumber(input.excerptLength, 10, 100, current.excerptLength),
    autosaveSeconds: clampNumber(input.autosaveSeconds, 15, 600, current.autosaveSeconds),
    maxUploadMb: clampNumber(input.maxUploadMb, 0, 4096, current.maxUploadMb),
    storageQuotaGb: clampNumber(input.storageQuotaGb, 0, 4096, current.storageQuotaGb),
    customCss: input.customCss !== undefined ? sanitizeCss(input.customCss) : current.customCss,
    // Footer is rendered through renderInlineMarkdown (escape-first), so here we only
    // trim + cap length; markup safety is the renderer's job.
    footer: typeof input.footer === 'string' ? input.footer.slice(0, 600) : current.footer,
    menu: sanitizeMenu(input.menu, current.menu),
    featured: sanitizeFeatured(input.featured, current.featured),
    mostViewedCount: clampNumber(input.mostViewedCount, 0, 10, current.mostViewedCount),
    sidebarLayout: input.sidebarLayout === 'two' || input.sidebarLayout === 'single' ? input.sidebarLayout : current.sidebarLayout,
    defaultScheme: isScheme(input.defaultScheme) ? input.defaultScheme : current.defaultScheme,
    themePreset,
    fontPreset: isFontPresetId(input.fontPreset) ? input.fontPreset : current.fontPreset,
    chromeFont: isChromeFontId(input.chromeFont) ? input.chromeFont : current.chromeFont,
    ideChrome: typeof input.ideChrome === 'boolean' ? input.ideChrome : current.ideChrome,
    enabledPalettes: sanitizeEnabledPalettes(input.enabledPalettes ?? current.enabledPalettes, themePreset),
    themes: sanitizeThemes(input.themes, current.themes),
    typography: sanitizeTypography(input.typography, current.typography),
    customFont: sanitizeFont(input.customFont, current.customFont),
    seo: sanitizeSeo(input.seo, current.seo),
    features: sanitizeFeatures(input.features, current.features),
    home: sanitizeHome(input.home, current.home),
    figure: sanitizeFigure(input.figure, current.figure),
    gallery: sanitizeGallery(input.gallery, current.gallery),
    postImage: sanitizePostImage(input.postImage, current.postImage),
    shape: sanitizeShape(input.shape, current.shape),
    table: sanitizeTable(input.table, current.table),
    author: sanitizeAuthor(input.author, current.author),
    comments: sanitizeComments(input.comments, current.comments),
    mcp: sanitizeMcp(input.mcp, current.mcp),
    ai: sanitizeAi(input.ai, current.ai),
    inks: sanitizeInks(input.inks, current.inks),
    motion: sanitizeMotion(input.motion, current.motion),
    cache: sanitizeCache(input.cache, current.cache),
    backups: sanitizeBackups(input.backups, current.backups),
    timezone: input.timezone !== undefined ? sanitizeTimezone(input.timezone, current.timezone) : current.timezone,
    updateCheck: typeof input.updateCheck === 'boolean' ? input.updateCheck : current.updateCheck,
  }
  // Persist image refs store-relative (collapse); keep `next` absolute for the client.
  const stored: SiteSettings = {
    ...next,
    logoUrl: collapseBlob(next.logoUrl),
    logoRenderUrl: collapseBlob(next.logoRenderUrl),
    logoEmailUrl: collapseBlob(next.logoEmailUrl),
    logoDarkUrl: collapseBlob(next.logoDarkUrl),
    logoDarkRenderUrl: collapseBlob(next.logoDarkRenderUrl),
    faviconUrl: collapseBlob(next.faviconUrl),
    appIconUrl: collapseBlob(next.appIconUrl),
    customFont: { ...next.customFont, faces: next.customFont.faces.map((x) => ({ ...x, url: collapseBlob(x.url) })) },
    seo: { ...next.seo, ogFallbackImage: collapseBlob(next.seo.ogFallbackImage) },
  }
  run(
    `insert into settings (id, data) values (1, $data)
     on conflict(id) do update set data = excluded.data`,
    { data: JSON.stringify(stored) },
  )
  return next
}
