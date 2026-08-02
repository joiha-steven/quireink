// Settings validation + migration — pure functions (unknown -> typed, clamped,
// back-compat shims). No DB, no Blob, no React. settings.ts depends on this ONE
// WAY (settings -> settings-sanitize, never back) for its getSettings/saveSettings merge.

import type { BackupSettings, CacheSettings, CommentSettings, FeatureSettings, FrontSettings, FrontStrip, GallerySettings, HomeSettings, McpSettings, MenuItem, MotionSettings, SeoSettings, ThemeColors, ThemeSettings } from '@/types'
import { DEFAULT_PRESET_ID, isPresetId, defaultThemes, THEME_PRESETS } from '@/content/themes'

// Keep only well-formed menu items (label + href both present).
export function sanitizeMenu(input: unknown, fallback: MenuItem[]): MenuItem[] {
  if (!Array.isArray(input)) return fallback
  return input
    .filter((m): m is MenuItem => !!m && typeof m.label === 'string' && typeof m.href === 'string')
    .map((m) => ({ label: m.label.trim(), href: m.href.trim() }))
    .filter((m) => m.label && m.href)
}

const HEX = /^#[0-9a-fA-F]{3,8}$/

// Validate one color, falling back when malformed.
function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value.trim()) ? value.trim() : fallback
}

// Merge a partial color set over a fallback set.
function sanitizeColors(input: unknown, fallback: ThemeColors): ThemeColors {
  const o = (input ?? {}) as Partial<ThemeColors>
  // `accent` arrived after `link`. Settings saved before it have no accent key, so
  // seed it from the RESOLVED link — the same rule the presets use. A palette whose
  // link the owner had customized keeps that hue instead of snapping to the preset.
  const link = color(o.link, fallback.link)
  return {
    bg: color(o.bg, fallback.bg),
    text: color(o.text, fallback.text),
    heading: color(o.heading, fallback.heading),
    meta: color(o.meta, fallback.meta),
    link,
    accent: color(o.accent, link),
    rule: color(o.rule, fallback.rule),
  }
}

function sanitizeTheme(input: unknown, fallback: ThemeSettings): ThemeSettings {
  const o = (input ?? {}) as Partial<ThemeSettings>
  return {
    light: sanitizeColors(o.light, fallback.light),
    dark: sanitizeColors(o.dark, fallback.dark),
  }
}

// Back-compat: older configs stored a single `theme`; seed it into the default
// palette so custom colors survive the move to per-palette.
export function migrateThemes(stored: Record<string, unknown>): Record<string, ThemeSettings> {
  const base = defaultThemes()
  const legacy = stored.theme
  if (stored.themes == null && legacy) {
    const def = isPresetId(stored.themePreset) ? (stored.themePreset as string) : DEFAULT_PRESET_ID
    base[def] = sanitizeTheme(legacy, base[def])
  }
  return base
}

// Per-palette map: merge stored colors over `base` for each known preset id;
// unknown ids dropped.
export function sanitizeThemes(input: unknown, base: Record<string, ThemeSettings>): Record<string, ThemeSettings> {
  const o = (input ?? {}) as Record<string, unknown>
  const out: Record<string, ThemeSettings> = {}
  for (const p of THEME_PRESETS) {
    out[p.id] = sanitizeTheme(o[p.id], base[p.id] ?? p.theme)
  }
  return out
}

// Palettes offered to visitors: keep only known preset ids, in preset order, and
// ALWAYS include the default (it must stay selectable). A non-array (missing field,
// e.g. legacy settings) means "all on"; an empty/garbage array collapses to just
// the default — which hides the switcher (one option). Invariant for `enabledPalettes`.
export function sanitizeEnabledPalettes(input: unknown, defaultId: string): string[] {
  const def = isPresetId(defaultId) ? defaultId : DEFAULT_PRESET_ID
  if (!Array.isArray(input)) return THEME_PRESETS.map((p) => p.id)
  const want = new Set(input.filter((x): x is string => typeof x === 'string'))
  want.add(def)
  return THEME_PRESETS.map((p) => p.id).filter((id) => want.has(id))
}

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

export function sanitizeSeo(input: unknown, fallback: SeoSettings): SeoSettings {
  const o = (input ?? {}) as Partial<SeoSettings>
  return {
    autoSchema: bool(o.autoSchema, fallback.autoSchema),
    sitemap: bool(o.sitemap, fallback.sitemap),
    llms: bool(o.llms, fallback.llms),
    robots: bool(o.robots, fallback.robots),
    rss: bool(o.rss, fallback.rss),
    ogImage: bool(o.ogImage, fallback.ogImage),
    // A full image URL (keep the path); only the type is validated.
    ogFallbackImage: typeof o.ogFallbackImage === 'string' ? o.ogFallbackImage.trim() : fallback.ogFallbackImage,
  }
}

export function sanitizeFeatures(input: unknown, fallback: FeatureSettings): FeatureSettings {
  const o = (input ?? {}) as Partial<FeatureSettings>
  return {
    search: bool(o.search, fallback.search),
    toc: bool(o.toc, fallback.toc),
    related: bool(o.related, fallback.related),
    readingTime: bool(o.readingTime, fallback.readingTime),
    progressBar: bool(o.progressBar, fallback.progressBar),
    activityLog: bool(o.activityLog, fallback.activityLog),
    sidebar: bool(o.sidebar, fallback.sidebar),
    sidebarSeries: bool(o.sidebarSeries, fallback.sidebarSeries),
    leadPost: bool(o.leadPost, fallback.leadPost),
    categoryLabel: bool(o.categoryLabel, fallback.categoryLabel),
    deck: bool(o.deck, fallback.deck),
    bookText: bool(o.bookText, fallback.bookText),
    bookMode: bool(o.bookMode, fallback.bookMode),
    infiniteScroll: bool(o.infiniteScroll, fallback.infiniteScroll),
    gridView: bool(o.gridView, fallback.gridView),
  }
}

export function sanitizeComments(input: unknown, fallback: CommentSettings): CommentSettings {
  const o = (input ?? {}) as Partial<CommentSettings>
  return {
    enabled: bool(o.enabled, fallback.enabled),
    turnstile: bool(o.turnstile, fallback.turnstile),
    googleAuth: bool(o.googleAuth, fallback.googleAuth),
  }
}

export function sanitizeMcp(input: unknown, fallback: McpSettings): McpSettings {
  const o = (input ?? {}) as Partial<McpSettings>
  return { enabled: bool(o.enabled, fallback.enabled) }
}

/**
 * A mount path for the post list: one leading slash, one segment, no trailing slash.
 *
 * Kept to a single segment on purpose. The list shares the `/{slug}` namespace with every
 * post and page, and a one-segment path is the only shape whose collisions can be checked
 * against that namespace at all — `/a/b` would need a second, deeper reservation rule for
 * no gain. Anything malformed falls back rather than mounting the list somewhere unreachable.
 */
export function sanitizeListPath(input: unknown, fallback: string): string {
  if (typeof input !== 'string') return fallback
  const slug = input.trim().replace(/^\/+|\/+$/g, '').toLowerCase()
  return /^[a-z0-9][a-z0-9-]*$/.test(slug) ? `/${slug}` : fallback
}

/** Columns in a row: 1, 2 or 3. Anything else is the fallback rather than a broken grid. */
const columns = (v: unknown, fallback: number): number =>
  v === 1 || v === 2 || v === 3 ? v : fallback

export function sanitizeFront(input: unknown, fallback: FrontSettings): FrontSettings {
  const o = (input ?? {}) as Partial<FrontSettings>
  const lead = (o.lead ?? {}) as Partial<FrontSettings['lead']>
  const featured = (o.featured ?? {}) as Partial<FrontSettings['featured']>
  const popular = (o.popular ?? {}) as Partial<FrontSettings['popular']>
  const latest = (o.latest ?? {}) as Partial<FrontSettings['latest']>
  return {
    // `fallback.kind`, for the same reason `mode` takes its fallback: a partial save must
    // not turn a text-led front page back into an image-led one just by not mentioning it.
    kind: o.kind === 'text' || o.kind === 'image' ? o.kind : fallback.kind,
    lead: {
      on: bool(lead.on, fallback.lead.on),
      source: lead.source === 'pinned' || lead.source === 'latest' ? lead.source : fallback.lead.source,
      slug: typeof lead.slug === 'string' ? lead.slug.trim().replace(/^\/+/, '').slice(0, 200) : fallback.lead.slug,
      secondary: clampNumber(lead.secondary, 0, 3, fallback.lead.secondary),
    },
    featured: {
      on: bool(featured.on, fallback.featured.on),
      count: clampNumber(featured.count, 1, 12, fallback.featured.count),
      columns: columns(featured.columns, fallback.featured.columns),
    },
    // Capped at eight rows. A front page that scrolls past every category is an archive
    // with extra steps, and each strip costs a reader a screen.
    strips: Array.isArray(o.strips)
      ? o.strips
        .filter((s): s is FrontStrip => !!s && typeof s.category === 'string' && !!s.category.trim())
        .slice(0, 8)
        .map((s) => ({
          category: s.category.trim().slice(0, 100),
          count: clampNumber(s.count, 1, 12, 3),
          columns: columns(s.columns, 3),
        }))
      : fallback.strips,
    popular: {
      on: bool(popular.on, fallback.popular.on),
      count: clampNumber(popular.count, 1, 12, fallback.popular.count),
      // Three windows, not a free number: 7, 30, or all time. A window nobody can name is a
      // window nobody can reason about when the row looks wrong.
      days: popular.days === 7 || popular.days === 30 || popular.days === 0
        ? popular.days
        : fallback.popular.days,
    },
    latest: {
      on: bool(latest.on, fallback.latest.on),
      count: clampNumber(latest.count, 1, 24, fallback.latest.count),
      columns: columns(latest.columns, fallback.latest.columns),
    },
    showDate: bool(o.showDate, fallback.showDate),
    showReadingTime: bool(o.showReadingTime, fallback.showReadingTime),
    tagLinks: bool(o.tagLinks, fallback.tagLinks),
  }
}

/**
 * What a fresh install serves at `/`, and what a front page looks like before anybody has
 * configured one. ADR 0014.
 *
 * `list` is what `/` has always been, so an install that upgrades into this feature sees no
 * change at all. `strips` starts EMPTY because a category row can only be chosen by the
 * owner: guessing one would put an arbitrary category on somebody's front page.
 */
export const DEFAULT_HOME: HomeSettings = {
  mode: 'list',
  page: '',
  listPath: '/post',
  front: {
    kind: 'image',
    lead: { on: true, source: 'latest', slug: '', secondary: 3 },
    featured: { on: true, count: 3, columns: 3 },
    strips: [],
    popular: { on: false, count: 4, days: 30 },
    latest: { on: true, count: 6, columns: 3 },
    showDate: true,
    showReadingTime: true,
    tagLinks: true,
  },
}

export function sanitizeHome(input: unknown, fallback: HomeSettings): HomeSettings {
  const o = (input ?? {}) as Partial<HomeSettings>
  return {
    // Anything unrecognised falls back, which for a READ is `list` (DEFAULT_HOME) and for a
    // WRITE is whatever the site is already serving. A settings blob written by a NEWER
    // version naming a mode this build cannot render lands here.
    //
    // `fallback`, not the literal `'list'`. This function has two callers and they mean
    // different things by "unrecognised": reading passes DEFAULT_HOME, saving passes the
    // CURRENT settings, and `saveSettings` takes a partial. Hard-coding the default meant a
    // save that never mentioned `home` silently moved the homepage back to the post list —
    // and the MCP `update_settings` tool builds exactly such a patch, under a comment
    // promising that saveSettings "merges over current, so nothing sensitive is ever
    // touched". Changing the site title over MCP turned off a composed front page.
    mode: o.mode === 'page' || o.mode === 'front' || o.mode === 'list' ? o.mode : fallback.mode,
    page: typeof o.page === 'string' ? o.page.trim().replace(/^\/+/, '').slice(0, 200) : fallback.page,
    listPath: sanitizeListPath(o.listPath, fallback.listPath),
    front: sanitizeFront(o.front, fallback.front),
  }
}

/** The shapes a tile may be cropped to. Must match GRID_RATIOS in render/post-content.ts. */
const GALLERY_RATIOS = ['', '1x1', '3x2', '4x3'] as const

export const DEFAULT_GALLERY: GallerySettings = {
  // What a gallery did before this setting existed, so an upgrade changes nothing.
  ratio: '',
  captions: true,
}

export function sanitizeGallery(input: unknown, fallback: GallerySettings): GallerySettings {
  const o = (input ?? {}) as Partial<GallerySettings>
  const ratio = GALLERY_RATIOS.find((r) => r === o.ratio)
  return {
    ratio: ratio ?? fallback.ratio,
    captions: bool(o.captions, fallback.captions),
  }
}

export function sanitizeCache(input: unknown, fallback: CacheSettings): CacheSettings {
  const o = (input ?? {}) as Partial<CacheSettings>
  return { enabled: bool(o.enabled, fallback.enabled) }
}

export function sanitizeMotion(input: unknown, fallback: MotionSettings): MotionSettings {
  const o = (input ?? {}) as Partial<MotionSettings>
  return {
    enabled: bool(o.enabled, fallback.enabled),
    typewriter: bool(o.typewriter, fallback.typewriter),
  }
}

export function sanitizeBackups(input: unknown, fallback: BackupSettings): BackupSettings {
  const o = (input ?? {}) as Partial<BackupSettings>
  return {
    enabled: bool(o.enabled, fallback.enabled),
    intervalDays: clampNumber(o.intervalDays, 1, 30, fallback.intervalDays),
    keep: clampNumber(o.keep, 1, 30, fallback.keep),
  }
}

// Owner CSS injected raw into <style>. Owner-only, so the only hazard is an
// accidental `</style>` closing the tag early — strip it; pass the rest through.
export function sanitizeCss(value: unknown): string {
  return typeof value === 'string' ? value.replace(/<\/style/gi, '') : ''
}

// Accept only a valid http(s) URL with no trailing slash; '' otherwise.
export function sanitizeUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const u = new URL(value.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    return u.origin
  } catch {
    return ''
  }
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}
