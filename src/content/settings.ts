// Settings: a single row (id=1) in Postgres `settings`. Reads fall back to
// defaults on any failure so the header/<title> never crash. Image refs stored
// store-relative, binaries on Blob. Validation/migration lives in settings-sanitize.ts.

import type { SiteSettings, SiteLook } from '@/types'
import { DEFAULT_INKS } from '@/pen/palette'
import { expandBlob } from '@/media/blob'
import { one } from '@/store/query'
import { EMPTY_NAV_ORDER, sanitizeNavOrder } from '@/content/nav-order'
import { DEFAULT_PRESET_ID, isPresetId, isFontPresetId, defaultThemes, ALL_PALETTE_IDS, DEFAULT_FONT, DEFAULT_FONT_PRESET, isChromeFontId, DEFAULT_CHROME_FONT, isScheme, getFontPreset } from '@/content/themes'
import {
  DEFAULT_HOME, DEFAULT_GALLERY, DEFAULT_FIGURE, migrateThemes, sanitizeThemes, sanitizeEnabledPalettes, sanitizeSeo, sanitizeFeatures, sanitizeHome, sanitizeGallery, sanitizeFigure, sanitizeMcp, sanitizeMotion, sanitizeCache, sanitizeDashboard,
  sanitizeBackups, sanitizeComments, sanitizeCss, sanitizeSnippet, sanitizeUrl, clampNumber, sanitizeFeatured,
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
// The write half lives in its own file: it is one long merge, and it grew a queue and a
// rescue of its own. Re-exported so no call site has to know where it moved to.
export { saveSettings } from '@/content/settings-save'

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
  // Two minutes since 2026-07-30. It was 8 seconds and a constant, which wrote a revision
  // mid-word; the interval is only half the safety net, the flush on hide is the other half.
  autosaveSeconds: 120,
  // 0 = do not narrow the deployment's ceiling. NOT a copy of `MAX_UPLOAD_MB` /
  // `STORAGE_QUOTA_GB`: two places holding one limit is how they disagree (`media/limits.ts`).
  maxUploadMb: 0,
  storageQuotaGb: 0,
  firstRunDone: false,
  // NO ROW AT ALL is the one state that means nobody has claimed this install yet, which is
  // why this default is false and the fallback in `fromStored` is not. The claim writes it
  // explicitly, because the claim may also write a language and that would make a row.
  setupDone: false,
  // On, and the reason is in `types.ts`. An operator who disagrees has one environment
  // variable; an owner who disagrees has one switch.
  // Empty, not 'UTC': an operator who set ANALYTICS_TZ on an existing install keeps their
  // answer, and a blank field reads as "whatever this server was told" rather than as a
  // choice nobody made.
  timezone: '',
  // Three empty lists: the rail has never been rearranged, so it draws itself the way the
  // code has it (`content/nav-order.ts`).
  navOrder: EMPTY_NAV_ORDER,
  updateCheck: true,
  contentWidth: 672,
  postsPerPage: 10,
  relatedCount: 3,
  excerptLength: 50,
  look: 'plain',
  customCss: '',
  customHead: '',
  customBodyEnd: '',
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
  motion: { enabled: true, keys: 'woody', keyVolume: 60, penSqueak: true },
  // On, because a blog that is fast for readers is the default. The switch exists for the
  // hour you are changing the look and want to see it, not for permanent use.
  cache: { enabled: true },
  dashboard: { systemLine: true },
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

// Back-compat: the old boolean `ideChrome` becomes the `look` selector. A blog that had the
// source-code chrome on keeps it, under its new name; every other blog lands on 'plain',
// which is what the boolean meant. A stored `look` wins outright.
//
// LOOKS, not themes: this is a closed list of four, and anything unrecognised - a blob
// written by a newer build naming a dialect this one cannot draw - falls back to 'plain'
// rather than to a half-drawn page.
const LOOKS: readonly SiteLook[] = ['plain', 'code', 'paper', 'notes']
const isLook = (value: unknown): value is SiteLook =>
  typeof value === 'string' && (LOOKS as readonly string[]).includes(value)

function resolveLook(stored: Partial<SiteSettings> & { ideChrome?: unknown }): SiteLook {
  if (isLook(stored.look)) return stored.look
  return stored.ideChrome === true ? 'code' : 'plain'
}

// Settings merged over defaults; defaults on any error.
/**
 * The last answer, and the exact bytes it was built from. Measured: 65µs a call becomes 5µs.
 *
 * A page-cache HIT pays for `getSettings` twice, an article render five times or more, and
 * every analytics beacon twice; each call parsed a blob carrying six palettes and nine type
 * roles, ran thirty sanitizers and built an `Intl.DateTimeFormat`. KEYED ON THE RAW STRING
 * rather than invalidated by `saveSettings`, so the memo is a pure function of what is in
 * the table and cannot go stale for a caller that wrote the row some other way.
 */
let cachedRaw: string | null = null
let cachedSettings: SiteSettings | null = null

/** Only for tests that swap the database file under a live process. */
export function resetSettingsCache(): void {
  cachedRaw = null
  cachedSettings = null
}

export async function getSettings(): Promise<SiteSettings> {
  try {
    const row = one<{ data: string }>(`select data from settings where id = 1`)
    const raw = row?.data ?? ''
    if (cachedSettings !== null && cachedRaw === raw) return cachedSettings
    // `data` is verbatim JSON, never reshaped. A malformed blob throws here and the
    // catch below returns defaults, which is the same "never crash the header" contract
    // the frozen tree had against a failed query.
    const stored = (row ? JSON.parse(row.data) : {}) as Partial<SiteSettings>
    // Whether this blog has a settings row at all — see `setupDone` below.
    const had = row != null
    const seo = sanitizeSeo(stored.seo, DEFAULT_SEO)
    // Expand store-relative image refs to absolute Blob URLs.
    const built: SiteSettings = {
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
      /**
       * THE SCALARS THE SPREAD USED TO CARRY THROUGH UNTOUCHED.
       *
       * `...stored` puts whatever is in the row into the answer, and only the keys named
       * below were ever named again. A `postsPerPage` of 0 reached `paginate.ts` and made
       * `totalPages` Infinity; a `title` that is not a string threw at `escapeHtml` on every
       * public page. Values only get in here through `saveSettings`, which now refuses both —
       * but a blob is also a file on disk, an import, and a row written by an older version,
       * and the read path is where a blog either survives that or does not.
       */
      title: typeof stored.title === 'string' ? stored.title : DEFAULT_SETTINGS.title,
      description: typeof stored.description === 'string' ? stored.description : DEFAULT_SETTINGS.description,
      footer: typeof stored.footer === 'string' ? stored.footer : DEFAULT_SETTINGS.footer,
      showLogo: typeof stored.showLogo === 'boolean' ? stored.showLogo : DEFAULT_SETTINGS.showLogo,
      showDescription: typeof stored.showDescription === 'boolean' ? stored.showDescription : DEFAULT_SETTINGS.showDescription,
      firstRunDone: typeof stored.firstRunDone === 'boolean' ? stored.firstRunDone : DEFAULT_SETTINGS.firstRunDone,
      // `had`, not the default: a row written before this field existed belongs to a blog
      // that is already running, and dropping its owner into first-run setup the next time
      // they enrol an authenticator would be the same wrong answer pointing the other way.
      setupDone: typeof stored.setupDone === 'boolean' ? stored.setupDone : had,
      logoWidth: clampNumber(stored.logoWidth, 24, 600, DEFAULT_SETTINGS.logoWidth),
      contentWidth: clampNumber(stored.contentWidth, 360, 1600, DEFAULT_SETTINGS.contentWidth),
      postsPerPage: clampNumber(stored.postsPerPage, 1, 100, DEFAULT_SETTINGS.postsPerPage),
      relatedCount: clampNumber(stored.relatedCount, 0, 12, DEFAULT_SETTINGS.relatedCount),
      excerptLength: clampNumber(stored.excerptLength, 10, 100, DEFAULT_SETTINGS.excerptLength),
      // Generous upper bound on purpose — these only narrow (`media/limits.ts`), so a number
      // above the deployment's own does nothing. The clamp is against a negative or a NaN
      // landing as 0, which reads as "no cap": the exact bug the setting exists to prevent.
      autosaveSeconds: clampNumber(stored.autosaveSeconds, 15, 600, DEFAULT_SETTINGS.autosaveSeconds),
      maxUploadMb: clampNumber(stored.maxUploadMb, 0, 4096, DEFAULT_SETTINGS.maxUploadMb),
      storageQuotaGb: clampNumber(stored.storageQuotaGb, 0, 4096, DEFAULT_SETTINGS.storageQuotaGb),
      customCss: sanitizeCss(stored.customCss),
      navOrder: sanitizeNavOrder(stored.navOrder, EMPTY_NAV_ORDER),
      customHead: sanitizeSnippet(stored.customHead),
      customBodyEnd: sanitizeSnippet(stored.customBodyEnd),
      defaultScheme: isScheme(stored.defaultScheme) ? stored.defaultScheme : 'system',
      themePreset: isPresetId(stored.themePreset) ? stored.themePreset : DEFAULT_PRESET_ID,
      fontPreset: isFontPresetId(stored.fontPreset) ? stored.fontPreset : DEFAULT_FONT_PRESET,
      chromeFont: resolveChromeFont(stored),
      look: resolveLook(stored),
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
      /**
       * `bookText` is the one feature whose DEFAULT changed after installs existed, and a
       * default that changes is a redesign of every blog that never answered the question.
       * So the new answer is for new blogs: no settings row at all is an install nobody has
       * configured, and a row is a blog with a look of its own to keep.
       */
      features: sanitizeFeatures(stored.features, had ? { ...DEFAULT_FEATURES, bookText: false } : DEFAULT_FEATURES),
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
      dashboard: sanitizeDashboard(stored.dashboard, DEFAULT_SETTINGS.dashboard),
      backups: sanitizeBackups(stored.backups, DEFAULT_BACKUPS),
      // Only an explicit `false` turns it off. A settings blob written before this
      // existed has no key at all, and `=== true` would read that silence as a refusal
      // for every instance that upgraded into this version.
      timezone: sanitizeTimezone(stored.timezone, ''),
      updateCheck: stored.updateCheck !== false,
    }
    cachedRaw = raw
    cachedSettings = built
    return built
  } catch (error) {
    console.error(`[ERROR] settings.getSettings: ${(error as Error).message}`)
    return DEFAULT_SETTINGS
  }
}

