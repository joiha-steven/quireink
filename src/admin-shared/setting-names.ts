// What a changed setting is CALLED, for the activity log (2026-09-30).
//
// `settings.save` stores the dotted paths a save touched (`content/settings-diff.ts`), raw, so
// the row outlives whichever language the admin is in today. The log printed them raw too:
// "Changed settings: mcp.enabled", "logoDarkRenderHeight, logoDark…", in every language. This
// turns each path back into the words the settings screen shows beside that control.
//
// A path not named here climbs to its group ("home.front.lead.on" → "home.front" → "home"), so a
// new field is still said in words, only less precisely; `setting-names.test.ts` walks every
// path in `DEFAULT_SETTINGS` and fails on one that reaches no words at all.
import type { AdminStrings } from '@/locales/types'

type StringKey = {
  [K in keyof AdminStrings]: AdminStrings[K] extends string ? K : never
}[keyof AdminStrings]

/** A dictionary key, or a proper name that is the same in every language (`=robots.txt`). */
type Name = StringKey | `=${string}`

const NAMES: Record<string, Name> = {
  language: 'siteLanguage', title: 'siteTitle', description: 'siteDescription', siteUrl: 'seoCanonical',
  timezone: 'siteTimezone', showDescription: 'showDescription', excerptLength: 'excerptLength',
  logoUrl: 'cardBranding', logoRenderUrl: 'cardBranding', logoEmailUrl: 'cardBranding',
  logoRenderHeight: 'cardBranding', logoDarkUrl: 'chooseLogoDark', logoDarkRenderUrl: 'chooseLogoDark',
  logoDarkRenderHeight: 'chooseLogoDark', logoWidth: 'logoWidth', showLogo: 'showLogo',
  faviconUrl: 'favicon', appIconUrl: 'appIcon', author: 'cardAuthor', 'author.name': 'authorName',
  'author.bio': 'authorBio', 'author.avatarUrl': 'authorAvatar', 'author.url': 'authorLink',

  contentWidth: 'siteWidth', postsPerPage: 'postsPerPage', mostViewedCount: 'mostViewedCount',
  menu: 'menuTitle', footer: 'footerContent', featured: 'cardFeatured', sidebarLayout: 'sidebarLayoutLabel',
  navOrder: 'navArrange', home: 'homeModeLabel', 'home.mode': 'homeModeLabel', 'home.page': 'homePageLabel',
  'home.listPath': 'listPathLabel', 'home.front': 'cardFront',

  relatedCount: 'relatedCount', figure: 'cardPictures', 'figure.frame': 'figureFrame',
  'figure.ink': 'figureFrameColour', gallery: 'cardPictures', 'gallery.ratio': 'galleryRatio',
  'gallery.captions': 'galleryCaptions', postImage: 'cardPictures', 'postImage.hero': 'postImageHero',
  'postImage.thumb': 'postImageThumb', table: 'cardTable', 'table.head': 'tableHead', 'table.grid': 'tableGrid',
  'table.ruleWeight': 'tableRuleWeight', 'table.stripe': 'tableStripe', 'table.firstColumn': 'tableFirstCol',
  'table.padding': 'tablePadding', 'table.narrow': 'tableNarrow', inks: 'cardInk',
  'inks.yellow': 'inkYellow', 'inks.green': 'inkGreen', 'inks.pink': 'inkPink', 'inks.blue': 'inkBlue',
  'inks.orange': 'inkOrange', 'inks.ring': 'inkRing', 'inks.underline': 'inkUnderline',
  'inks.selection': 'inkSelectionLight', 'inks.selectionDark': 'inkSelectionDark',
  features: 'cardPost', 'features.progressBar': 'featProgress',

  look: 'lookLabel', fontPreset: 'cardFont', chromeFont: 'chromeFontLabel', customFont: 'cardFont',
  typography: 'cardTypography', shape: 'cardShape', 'shape.density': 'shapeDensity',
  'shape.radius': 'shapeRadius', 'shape.headingWeight': 'shapeHeading', defaultScheme: 'defaultScheme',
  themePreset: 'themePreset', enabledPalettes: 'paletteShown', themes: 'navAppearance',
  customCss: 'customCss', motion: 'motionLabel', 'motion.enabled': 'motionLabel',
  'motion.keys': 'keyFeedbackLabel', 'motion.keyVolume': 'keyVolumeLabel', 'motion.penSqueak': 'penSqueakLabel',

  comments: 'commentsEnable', 'comments.enabled': 'commentsEnable', 'comments.turnstile': 'commentsTurnstile',
  'comments.googleAuth': 'commentsGoogleAuth',

  customHead: 'customHeadLabel', customBodyEnd: 'customBodyEndLabel', seo: 'cardServerSettings',
  'seo.autoSchema': 'seoAutoSchema', 'seo.ogImage': 'seoOgImage', 'seo.ogFallbackImage': 'seoOgImage',
  'seo.sitemap': '=Sitemap', 'seo.rss': '=RSS', 'seo.llms': '=llms.txt', 'seo.robots': '=robots.txt',
  mcp: 'mcpEnable', api: 'apiEnable', activitypub: 'apEnable', 'activitypub.handle': 'apHandle',
  ai: 'cardAi', 'ai.commentGuard': 'aiTaskComments', cache: 'cacheEnable', updateCheck: 'updateCheckLabel',
  backups: 'backupAuto', 'backups.encrypt': 'backupEncrypt', 'backups.pubKey': 'backupEncrypt',
  'backups.passPub': 'backupEncrypt', 'backups.passSalt': 'backupEncrypt',
  'backups.intervalDays': 'backupIntervalLabel', 'backups.keep': 'backupKeepLabel',
  autosaveSeconds: 'autosaveLabel', maxUploadMb: 'maxUploadLabel', storageQuotaGb: 'storageQuotaLabel',
  dashboard: 'dashboardSystemLine', firstRunDone: 'firstRunTitle', setupDone: 'firstRunTitle',
  seenRelease: 'updateCheckLabel', sourceRepo: 'cfWfRepoLabel',

  // Details written by hand rather than by the diff, before and after this file.
  'offsite bucket': 'offsiteTitle', 'ai keys': 'cardAi', 'appearance (MCP)': 'navAppearance',
  'homepage (MCP)': 'cardFront', 'no change': 'logNoChange',
}

/** `features.search` → `featSearch`: thirty switches named by one rule rather than listed. */
const featureKey = (path: string): string =>
  path.startsWith('features.') ? `feat${path[9]?.toUpperCase() ?? ''}${path.slice(10)}` : ''

/** The words for one path, or '' when nothing up its chain has any. */
export function settingName(t: AdminStrings, path: string): string {
  const words = t as unknown as Record<string, unknown>
  for (let at = path; at; at = at.includes('.') ? at.slice(0, at.lastIndexOf('.')) : '') {
    const name = NAMES[at]
    if (name?.startsWith('=')) return name.slice(1)
    if (name && typeof words[name] === 'string') return words[name] as string
    const feat = featureKey(at)
    if (feat && typeof words[feat] === 'string') return words[feat] as string
  }
  return ''
}

/**
 * A stored `settings.save` detail, said: `mcp.enabled, logoDarkUrl +3` → "Enable MCP server,
 * Choose dark logo +3". Names repeat when two paths share one control, so each is said once.
 */
export function settingsDetail(t: AdminStrings, detail: string): string {
  const said = new Set<string>()
  let more = ''
  for (const part of detail.split(/,\s*/)) {
    const [path = '', count] = part.trim().split(/\s+(?=\+\d+$)/)
    said.add(settingName(t, path) || path)
    if (count) more = ` ${count}`
  }
  return [...said].filter(Boolean).join(', ') + more
}
