// Which tab a setting is behind — the one thing the seven tabs never told you.
//
// [ADR 0011](../../../docs/decisions/0011-settings-regrouped-into-seven.md) split five
// tangled tabs into seven defined ones, each printing the question it answers, because the
// owner said the old arrangement was tangled. It is a better arrangement and it did not
// solve the problem: two weeks later the same owner said *"các tab cài đặt thực ra khá rối,
// không biết chỉnh cái gì ở đâu cả"*.
//
// So the answer this time is NOT a third arrangement. There are around fifty settings and no
// grouping makes a person remember which of seven boxes holds one of them; what makes the
// arrangement stop mattering is being able to type a word. That is what this index is for.
//
// **It holds LOCALE KEYS, never English.** The search reads `t[key]`, so an owner working in
// Vietnamese types Vietnamese and matches Vietnamese, with no second list to translate.
//
// ⚠️ A hand-written index of a rendered screen goes stale the first time somebody adds a
// field and forgets this file — and it goes stale SILENTLY, which is the failure mode worth
// designing against: a search that quietly cannot find a setting is worse than no search,
// because it teaches you the setting does not exist. So the tour opens every tab, reads
// every label the screen actually renders, and fails if one of them is not reachable from
// here. Adding a field without adding it here turns that flow red.

import type { AdminStrings } from '@/locales/types'

/** The seven tabs, as `SettingsView` keys them. */
export type SettingsTab =
  'site' | 'layout' | 'reading' | 'appearance' | 'seo' | 'connections' | 'ai' | 'system'

/**
 * Dictionary keys whose value is a STRING.
 *
 * Not every entry is one — `paletteNames` is a nested record — and a plain `keyof` would let
 * an index row point at it, which typechecks and then renders `[object Object]` in a result
 * row. The narrowing costs three lines and makes that unwritable.
 */
type StringKey = {
  [K in keyof AdminStrings]: AdminStrings[K] extends string ? K : never
}[keyof AdminStrings]

export type SettingEntry = {
  /** The tab it lives behind. */
  tab: SettingsTab
  /** Its label, as a key into the admin dictionary — never a literal string. */
  label: StringKey
  /** Its explanatory note, when it has one. Searched too: people describe, not name. */
  note?: StringKey
}

/**
 * Every setting a person might go looking for.
 *
 * NOT every string on the screen: a card title, a tab name, a Save button and the six
 * language names are not settings, and a search that returns them buries the row that is.
 * The rule for what belongs here is "a control the owner can change", which is also the rule
 * the tour checks against.
 */
export const SETTINGS_INDEX: SettingEntry[] = [
  // Site — what this site is
  { tab: 'site', label: 'siteTitle' },
  { tab: 'site', label: 'siteDescription' },
  { tab: 'site', label: 'siteLanguage' },
  { tab: 'site', label: 'siteTimezone', note: 'siteTimezoneHint' },
  { tab: 'site', label: 'showDescription' },
  { tab: 'site', label: 'excerptLength' },
  { tab: 'site', label: 'showLogo' },
  { tab: 'site', label: 'chooseLogoDark' },
  { tab: 'site', label: 'logoWidth' },
  { tab: 'site', label: 'favicon' },
  { tab: 'site', label: 'appIcon' },

  // Layout — where things sit
  { tab: 'layout', label: 'siteWidth', note: 'siteWidthHint' },
  { tab: 'layout', label: 'postsPerPage' },
  { tab: 'layout', label: 'listPathLabel', note: 'listPathHint' },
  { tab: 'layout', label: 'mostViewedCount' },
  { tab: 'layout', label: 'galleryCaptions' },
  { tab: 'layout', label: 'frontCount' },
  { tab: 'layout', label: 'frontLead' },
  { tab: 'layout', label: 'frontSecondary' },
  { tab: 'layout', label: 'frontFeaturedRow' },
  { tab: 'layout', label: 'frontPopularRow' },
  { tab: 'layout', label: 'frontLatestRow' },
  { tab: 'layout', label: 'frontShowDate' },
  { tab: 'layout', label: 'frontShowReading' },
  { tab: 'layout', label: 'frontTagLinks' },

  // Reading — what a reader gets on a post
  { tab: 'reading', label: 'featSearch', note: 'featSearchDesc' },
  { tab: 'reading', label: 'featToc', note: 'featTocDesc' },
  { tab: 'reading', label: 'featRelated', note: 'featRelatedDesc' },
  { tab: 'reading', label: 'featReadingTime', note: 'featReadingTimeDesc' },
  { tab: 'reading', label: 'featProgress', note: 'featProgressDesc' },
  { tab: 'reading', label: 'featDeck', note: 'featDeckDesc' },
  { tab: 'reading', label: 'featCategoryLabel', note: 'featCategoryLabelDesc' },
  { tab: 'reading', label: 'featBookText', note: 'featBookTextDesc' },
  { tab: 'reading', label: 'featBookMode', note: 'featBookModeDesc' },
  { tab: 'reading', label: 'featPenUnderline', note: 'featPenUnderlineDesc' },
  { tab: 'reading', label: 'featPenRing', note: 'featPenRingDesc' },
  { tab: 'reading', label: 'featSidebar', note: 'featSidebarDesc' },
  { tab: 'reading', label: 'featSidebarSeries', note: 'featSidebarSeriesDesc' },
  { tab: 'reading', label: 'featInfiniteScroll', note: 'featInfiniteScrollDesc' },
  { tab: 'reading', label: 'featGridView', note: 'featGridViewDesc' },
  { tab: 'reading', label: 'featLeadPost', note: 'featLeadPostDesc' },
  { tab: 'reading', label: 'relatedCount', note: 'relatedCountHint' },
  { tab: 'reading', label: 'commentsEnable' },
  // Not a reader feature at all — the admin's own record of what changed. It sits on this
  // tab because that is where the toggle is, and the search's job is where things ARE.
  { tab: 'reading', label: 'featActivityLog', note: 'featActivityLogDesc' },

  // Appearance — how it looks
  { tab: 'appearance', label: 'themePreset' },
  // The reading-font picker carries no label of its own — the card title IS its name
  // (`FontFields`). Indexed under that, because "font" is the word somebody types and a
  // picker nobody can find is a picker nobody uses.
  { tab: 'appearance', label: 'cardFont', note: 'fontPresetHint' },
  { tab: 'appearance', label: 'chromeFontLabel', note: 'chromeFontHint' },
  { tab: 'appearance', label: 'fontSmoothing' },
  { tab: 'appearance', label: 'ideChromeLabel' },
  { tab: 'appearance', label: 'motionLabel' },
  { tab: 'appearance', label: 'keyFeedbackLabel', note: 'keyFeedbackDesc' },
  { tab: 'appearance', label: 'autosaveLabel', note: 'autosaveHint' },

  // Search & URLs — how machines see it
  { tab: 'seo', label: 'seoCanonical' },
  { tab: 'seo', label: 'seoAutoSchema' },
  { tab: 'seo', label: 'seoOgImage' },
  { tab: 'seo', label: 'redirectSource' },
  { tab: 'seo', label: 'redirectDestination' },

  // Connections — what else it talks to
  { tab: 'connections', label: 'nlSmtpHost' },
  { tab: 'connections', label: 'nlSmtpPort' },
  { tab: 'connections', label: 'nlSmtpUser' },
  { tab: 'connections', label: 'nlSmtpPass' },
  { tab: 'connections', label: 'nlSmtpFrom' },
  { tab: 'connections', label: 'nlSmtpSecure' },
  { tab: 'connections', label: 'commentsTurnstile' },
  { tab: 'connections', label: 'commentsGoogleAuth' },
  { tab: 'appearance', label: 'cardInk', note: 'inkHelp' },
  { tab: 'appearance', label: 'inkHighlighter' },
  { tab: 'appearance', label: 'inkLines', note: 'inkLinesHint' },
  { tab: 'appearance', label: 'inkSelection', note: 'inkSelectionHint' },
  { tab: 'ai', label: 'mcpEnable' },
  { tab: 'ai', label: 'mcpUrlLabel' },
  { tab: 'ai', label: 'mcpTokensTitle' },
  { tab: 'ai', label: 'cardAi' },
  { tab: 'ai', label: 'aiProviderLabel' },
  { tab: 'ai', label: 'aiKeyLabel' },
  { tab: 'ai', label: 'aiModelLabel' },
  { tab: 'ai', label: 'aiTaskAltText' },
  { tab: 'ai', label: 'aiTaskExcerpt' },
  { tab: 'ai', label: 'aiTaskComments' },

  // System — moving content in and out
  { tab: 'system', label: 'cacheEnable' },
  { tab: 'system', label: 'updateCheckLabel', note: 'updateCheckDesc' },
  { tab: 'system', label: 'clearCache' },
  { tab: 'system', label: 'backupAuto' },
  { tab: 'system', label: 'backupIntervalLabel' },
  { tab: 'system', label: 'backupKeepLabel' },
  { tab: 'system', label: 'maxUploadLabel', note: 'maxUploadHint' },
  { tab: 'system', label: 'storageQuotaLabel', note: 'storageQuotaHint' },
]

/**
 * Fold accents away so a Vietnamese owner can type without them.
 *
 * Typing "be rong" for "Bề rộng" is what people actually do — it is faster than reaching for
 * tone marks, and every Vietnamese search box on the planet accepts it. NFD splits a letter
 * from its marks and the range strips the marks; `đ` is not a combining pair and has to be
 * replaced on its own.
 */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().trim()
}

/**
 * The settings whose label or note matches, in index order.
 *
 * Order is the index's, which is the order the tabs and cards are in — so a query matching
 * three things lists them the way the screen does, not the way a relevance score guesses.
 */
export function searchSettings(query: string, t: AdminStrings): SettingEntry[] {
  const q = fold(query)
  if (q.length < 2) return []
  return SETTINGS_INDEX.filter((e) => {
    const label = fold(String(t[e.label] ?? ''))
    const note = e.note ? fold(String(t[e.note] ?? '')) : ''
    return label.includes(q) || note.includes(q)
  })
}
