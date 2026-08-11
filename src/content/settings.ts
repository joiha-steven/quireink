// Settings: a single row (id=1) in Postgres `settings`. Reads fall back to
// defaults on any failure so the header/<title> never crash. Image refs stored
// store-relative, binaries on Blob. Validation/migration lives in settings-sanitize.ts.

import type { BackupSettings, CommentSettings, FeatureSettings, FontSettings, SeoSettings, SiteSettings, TypographySettings } from '@/types'
import { collapseBlob, expandBlob, deleteByPathname } from '@/media/blob'
import { renderLogo } from '@/media/files'
import { one, run } from '@/store/query'
import { isSiteLang } from '@/locales/langs'
import { DEFAULT_PRESET_ID, isPresetId, isFontPresetId, defaultThemes, ALL_PALETTE_IDS, DEFAULT_TYPOGRAPHY, DEFAULT_FONT, DEFAULT_FONT_PRESET, isChromeFontId, DEFAULT_CHROME_FONT, TYPE_ROLES } from '@/content/themes'
import {
  DEFAULT_HOME, DEFAULT_GALLERY, DEFAULT_HIGHLIGHT, sanitizeMenu, migrateThemes, sanitizeThemes, sanitizeEnabledPalettes, sanitizeSeo, sanitizeFeatures, sanitizeHome, sanitizeGallery, sanitizeHighlight, sanitizeMcp, sanitizeMotion, sanitizeCache,
  sanitizeBackups, sanitizeComments, sanitizeCss, sanitizeUrl, clampNumber, sanitizeFeatured,
} from '@/content/settings-sanitize'
import { sanitizeTypography, sanitizeFont, fontFormat } from '@/content/settings-type'

// Re-export so existing importers keep working.
export { DEFAULT_THEME, themesToCss, getDefaultTheme, DEFAULT_TYPOGRAPHY, DEFAULT_FONT } from '@/content/themes'

export const DEFAULT_SEO: SeoSettings = {
  autoSchema: true,
  sitemap: true,
  llms: true,
  robots: true,
  rss: true,
  ogImage: true,
  ogFallbackImage: '',
}

export const DEFAULT_BACKUPS: BackupSettings = {
  enabled: false,
  intervalDays: 4,
  keep: 4,
}

export const DEFAULT_FEATURES: FeatureSettings = {
  search: true,
  toc: true,
  related: true,
  readingTime: true,
  progressBar: true,
  activityLog: true,
  sidebar: true,
  sidebarSeries: true,
  leadPost: true,
  categoryLabel: true,
  deck: true,
  bookText: false,
  bookMode: true,
  infiniteScroll: false,
  gridView: true,
}

export const DEFAULT_COMMENTS: CommentSettings = {
  enabled: false,
  turnstile: false,
  googleAuth: false,
}

// Per-role type CSS vars on :root (+ optional font-smoothing). Injected after
// globals.css (same defaults), so a saved scale wins and a fresh install still works.
//
// BOOK MODE IS ONE NUMBER, AND IT IS EMITTED TWICE. Do not "simplify" this to one block.
//
// The rule the owner asked for: in book mode the reading text runs 15% larger than the
// article, and every gap around it moves by the same 15%. Type and the space between it are
// one system; enlarging the words alone gives you crowded reading, not bigger reading. So
// `--sp`, the article's spacing unit, carries the scale exactly as `--fs-<role>` does, and
// every gap inside the article is a multiple of it.
//
// Emitting the block a SECOND time on `.book-overlay` is the whole mechanism, and it is
// there because the obvious version does not work. A `var()` inside a custom property is
// substituted where that property is DECLARED, not where it is used — so `--fs-body`
// declared on `:root` resolves `var(--type-scale, 1)` against `:root`, where the scale is
// undefined, and the resolved `calc(1.13rem * 1)` is what inherits. Overriding
// `--type-scale` on a descendant then changes nothing at all. This file used to claim the
// opposite in a comment, and book mode had been rendering at EXACTLY the article's size
// since the port. Measured 2026-07-29, every ratio 1.000: body, leading, headings, and
// every gap.
//
//   #a { --scale:1; --unit:calc(10px * var(--scale,1)) }  ->  calc(10px * 1)
//   #b { --scale:2 }                        (inherits #a's) ->  calc(10px * 1)   <- the trap
//   #c { --scale:2; --unit:calc(10px * var(--scale,1)) }  ->  calc(10px * 2)   <- the fix
//
// Re-declaring the identical text on `.book-overlay` re-substitutes it THERE, where the
// scale is 1.15. The numbers still live in one place: this function. Pinned by
// `web/typography.test.ts`, and the reasoning is in docs/conventions.md.
function scaledVars(t: TypographySettings): string {
  const roles = TYPE_ROLES.map((r) => {
    const s = t.roles[r]
    return `--fs-${r}:calc(${s.size}rem * var(--type-scale, 1))`
      + `;--lh-${r}:${s.line};--ls-${r}:${s.spacing}em`
  }).join(';')
  // The article's spacing unit. Scale-dependent, so it belongs in this block and nowhere
  // else: a second definition on :root elsewhere would win or lose by source order and the
  // book overlay would go back to unscaled gaps.
  return `${roles};--sp:calc(1rem * var(--type-scale, 1))`
}

export function typographyToCss(t: TypographySettings): string {
  const vars = scaledVars(t)
  const smooth = t.smoothing ? `body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}` : ''
  return `:root{${vars}}.book-overlay{${vars}}${smooth}`
}

// Emit one @font-face per uploaded weight for the owner typeface and point
// --font-reading at it (Inter stays the fallback). Empty when no font is set.
export function fontToCss(f: FontSettings): string {
  if (!f.family || f.faces.length === 0) return ''
  const faces = f.faces
    .map((face) => {
      const fmt = fontFormat(face.url)
      const src = `url('${face.url}')${fmt ? ` format('${fmt}')` : ''}`
      return `@font-face{font-family:'${f.family}';font-weight:${face.weight};font-style:normal;src:${src};font-display:swap}`
    })
    .join('')
  // An uploaded custom font styles the reader's words (article, comments, editor),
  // matching the built-in fontPreset scope — the chrome stays Inter.
  return faces + `:root{--font-reading:'${f.family}', var(--font-inter)}`
}

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
  // 0 = do not narrow the deployment's ceiling. NOT a copy of `MAX_UPLOAD_MB` /
  // `STORAGE_QUOTA_GB`: two places holding one limit is how they disagree (`media/limits.ts`).
  maxUploadMb: 0,
  storageQuotaGb: 0,
  contentWidth: 672,
  postsPerPage: 10,
  relatedCount: 3,
  excerptLength: 50,
  ideChrome: false,
  customCss: '',
  footer: '© {year} {title} · [powered by Quire Ink](https://github.com/joiha-steven/quireink)',
  menu: [],
  featured: [],
  mostViewedCount: 3,
  sidebarLayout: 'single',
  themePreset: DEFAULT_PRESET_ID,
  enabledPalettes: ALL_PALETTE_IDS,
  themes: defaultThemes(),
  typography: DEFAULT_TYPOGRAPHY,
  customFont: DEFAULT_FONT,
  home: DEFAULT_HOME,
  gallery: DEFAULT_GALLERY,
  highlight: DEFAULT_HIGHLIGHT,
  seo: DEFAULT_SEO,
  features: DEFAULT_FEATURES,
  comments: DEFAULT_COMMENTS,
  mcp: { enabled: false },
  motion: { enabled: true, typewriter: true },
  // On, because a blog that is fast for readers is the default. The switch exists for the
  // hour you are changing the look and want to see it, not for permanent use.
  cache: { enabled: true },
  backups: DEFAULT_BACKUPS,
}

// Canonical base URL: owner value, else the SITE_URL env, else localhost.
export function resolveSiteUrl(s: SiteSettings): string {
  if (s.siteUrl) return s.siteUrl
  if (process.env.SITE_URL) return process.env.SITE_URL
  return 'http://localhost:3000'
}

// PWA / home-screen icon: app icon → favicon → bundled `/app-icon.png`.
export function resolveAppIcon(s: SiteSettings): string {
  return s.appIconUrl || s.faviconUrl || '/app-icon.png'
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
      maxUploadMb: clampNumber(stored.maxUploadMb, 0, 4096, DEFAULT_SETTINGS.maxUploadMb),
      storageQuotaGb: clampNumber(stored.storageQuotaGb, 0, 4096, DEFAULT_SETTINGS.storageQuotaGb),
      customCss: sanitizeCss(stored.customCss),
      themePreset: isPresetId(stored.themePreset) ? stored.themePreset : DEFAULT_PRESET_ID,
      fontPreset: isFontPresetId(stored.fontPreset) ? stored.fontPreset : DEFAULT_FONT_PRESET,
      chromeFont: resolveChromeFont(stored),
      ideChrome: stored.ideChrome === true,
      featured: sanitizeFeatured(stored.featured, []),
      mostViewedCount: clampNumber(stored.mostViewedCount, 0, 10, DEFAULT_SETTINGS.mostViewedCount),
      sidebarLayout: stored.sidebarLayout === 'two' ? 'two' : 'single',
      enabledPalettes: sanitizeEnabledPalettes(stored.enabledPalettes, isPresetId(stored.themePreset) ? stored.themePreset : DEFAULT_PRESET_ID),
      themes: sanitizeThemes(stored.themes, migrateThemes(stored as Record<string, unknown>)),
      typography: sanitizeTypography(stored.typography, DEFAULT_TYPOGRAPHY),
      customFont: (() => {
        const f = sanitizeFont(stored.customFont, DEFAULT_FONT)
        return { ...f, faces: f.faces.map((x) => ({ ...x, url: expandBlob(x.url) })) }
      })(),
      seo: { ...seo, ogFallbackImage: expandBlob(seo.ogFallbackImage) },
      features: sanitizeFeatures(stored.features, DEFAULT_FEATURES),
      home: sanitizeHome(stored.home, DEFAULT_SETTINGS.home),
      gallery: sanitizeGallery(stored.gallery, DEFAULT_GALLERY),
      highlight: sanitizeHighlight(stored.highlight, DEFAULT_HIGHLIGHT),
      comments: sanitizeComments(stored.comments, DEFAULT_COMMENTS),
      mcp: sanitizeMcp(stored.mcp, DEFAULT_SETTINGS.mcp),
      motion: sanitizeMotion(stored.motion, DEFAULT_SETTINGS.motion),
      cache: sanitizeCache(stored.cache, DEFAULT_SETTINGS.cache),
      backups: sanitizeBackups(stored.backups, DEFAULT_BACKUPS),
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
    contentWidth: clampNumber(input.contentWidth, 360, 1600, current.contentWidth),
    postsPerPage: clampNumber(input.postsPerPage, 1, 100, current.postsPerPage),
    relatedCount: clampNumber(input.relatedCount, 0, 12, current.relatedCount),
    excerptLength: clampNumber(input.excerptLength, 10, 100, current.excerptLength),
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
    gallery: sanitizeGallery(input.gallery, current.gallery),
    // `current.highlight` as the fallback, not the default: a save that does not mention the
    // stroke must not quietly put it back to `marker`.
    highlight: sanitizeHighlight(input.highlight, current.highlight),
    comments: sanitizeComments(input.comments, current.comments),
    mcp: sanitizeMcp(input.mcp, current.mcp),
    motion: sanitizeMotion(input.motion, current.motion),
    cache: sanitizeCache(input.cache, current.cache),
    backups: sanitizeBackups(input.backups, current.backups),
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
