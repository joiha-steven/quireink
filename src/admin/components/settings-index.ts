// Which tab a setting is behind — the one thing the tabs never told you.
//
// [ADR 0011](../../../docs/decisions/0011-settings-regrouped-into-seven.md) split five
// tangled tabs into seven defined ones (eight since `ai`), each printing the question it answers, because
// settings kept being looked for on the wrong tab. It is a better arrangement and it did not
// solve the problem: two weeks later the tabs were still reported as confusing, with no way
// to tell which one held a given setting.
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

/**
 * The SEVEN tabs, as `SettingsView` keys them (ADR 0041).
 *
 * ⚠️ Re-keyed wholesale on 2026-09-07 — every row's `tab` was reassigned. The index is what
 * both the search and `?setting=` read, so a row with a stale tab is a search result that
 * opens the wrong page: the index and the tab components have to move in one commit, and the
 * tour flow that opens every tab and looks for every label is what proves they did.
 */
export type SettingsTab =
  'blog' | 'home' | 'post' | 'appearance' | 'people' | 'server' | 'account'

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
  // Blog — what this blog is
  { tab: 'blog', label: 'siteTitle' },
  { tab: 'blog', label: 'siteDescription' },
  { tab: 'blog', label: 'siteLanguage' },
  { tab: 'blog', label: 'siteTimezone', note: 'siteTimezoneHint' },
  { tab: 'blog', label: 'showDescription' },
  { tab: 'blog', label: 'excerptLength' },
  { tab: 'blog', label: 'showLogo' },
  { tab: 'blog', label: 'chooseLogoDark' },
  { tab: 'blog', label: 'logoWidth' },
  { tab: 'blog', label: 'favicon' },
  { tab: 'blog', label: 'appIcon' },
  // Who wrote it. The NAME is the switch for the whole group, so its note is the one that
  // has to be findable — somebody looking for "byline" is looking for that sentence.
  { tab: 'blog', label: 'authorName', note: 'authorNameHint' },
  { tab: 'blog', label: 'authorBio', note: 'authorBioHint' },
  { tab: 'blog', label: 'authorAvatar', note: 'authorAvatarHint' },
  { tab: 'blog', label: 'authorLink', note: 'authorLinkHint' },

  // Home & menu — what a reader sees when they open the front page
  { tab: 'home', label: 'siteWidth', note: 'siteWidthHint' },
  { tab: 'home', label: 'postsPerPage' },
  { tab: 'home', label: 'listPathLabel', note: 'listPathHint' },
  { tab: 'home', label: 'mostViewedCount' },
  { tab: 'post', label: 'galleryCaptions' },
  { tab: 'post', label: 'figureFrame', note: 'figureFrameHint' },
  { tab: 'post', label: 'figureFrameColour', note: 'figureFrameColourHint' },
  { tab: 'post', label: 'postImageHero', note: 'postImageHeroHint' },
  { tab: 'home', label: 'postImageThumb', note: 'postImageThumbHint' },
  { tab: 'home', label: 'frontCount' },
  { tab: 'home', label: 'frontLead' },
  { tab: 'home', label: 'frontSecondary' },
  { tab: 'home', label: 'frontFeaturedRow' },
  { tab: 'home', label: 'frontPopularRow' },
  { tab: 'home', label: 'frontLatestRow' },
  { tab: 'home', label: 'frontShowDate' },
  { tab: 'home', label: 'frontShowReading' },
  { tab: 'home', label: 'frontTagLinks' },

  // Posts — what surrounds the words on a post
  { tab: 'post', label: 'featSearch', note: 'featSearchDesc' },
  { tab: 'post', label: 'featToc', note: 'featTocDesc' },
  { tab: 'post', label: 'featRelated', note: 'featRelatedDesc' },
  { tab: 'post', label: 'featReadNext', note: 'featReadNextDesc' },
  { tab: 'post', label: 'featResume', note: 'featResumeDesc' },
  { tab: 'post', label: 'featOffline', note: 'featOfflineDesc' },
  { tab: 'post', label: 'featReadingTime', note: 'featReadingTimeDesc' },
  { tab: 'post', label: 'featProgress', note: 'featProgressDesc' },
  { tab: 'post', label: 'featDeck', note: 'featDeckDesc' },
  { tab: 'post', label: 'featCategoryLabel', note: 'featCategoryLabelDesc' },
  { tab: 'post', label: 'featBookText', note: 'featBookTextDesc' },
  { tab: 'post', label: 'featBookMode', note: 'featBookModeDesc' },
  { tab: 'post', label: 'featPenUnderline', note: 'featPenUnderlineDesc' },
  { tab: 'post', label: 'featPenRing', note: 'featPenRingDesc' },
  { tab: 'home', label: 'featSidebar', note: 'featSidebarDesc' },
  { tab: 'home', label: 'featSidebarCategories', note: 'featSidebarCategoriesDesc' },
  { tab: 'home', label: 'featSidebarSeries', note: 'featSidebarSeriesDesc' },
  { tab: 'home', label: 'featSidebarArchive', note: 'featSidebarArchiveDesc' },
  { tab: 'home', label: 'featSidebarTags', note: 'featSidebarTagsDesc' },
  { tab: 'home', label: 'featInfiniteScroll', note: 'featInfiniteScrollDesc' },
  { tab: 'home', label: 'featGridView', note: 'featGridViewDesc' },
  { tab: 'home', label: 'featArchive', note: 'featArchiveDesc' },
  { tab: 'home', label: 'featLeadPost', note: 'featLeadPostDesc' },
  { tab: 'post', label: 'relatedCount', note: 'relatedCountHint' },
  { tab: 'people', label: 'commentsEnable' },
  // Not a reader feature at all — the admin's own record of what changed. It sits on this
  // tab because that is where the toggle is, and the search's job is where things ARE.

  // Appearance — how it looks
  { tab: 'appearance', label: 'themePreset' },
  { tab: 'appearance', label: 'shapeDensity', note: 'shapeDensityHint' },
  { tab: 'appearance', label: 'shapeRadius', note: 'shapeRadiusHint' },
  { tab: 'appearance', label: 'shapeHeading', note: 'shapeHeadingHint' },
  // The reading-font picker carries no label of its own — the card title IS its name
  // (`FontFields`). Indexed under that, because "font" is the word somebody types and a
  // picker nobody can find is a picker nobody uses.
  { tab: 'appearance', label: 'cardFont', note: 'fontPresetHint' },
  { tab: 'appearance', label: 'chromeFontLabel', note: 'chromeFontHint' },
  { tab: 'appearance', label: 'fontSmoothing' },
  { tab: 'appearance', label: 'lookLabel' },
  { tab: 'account', label: 'motionLabel' },
  { tab: 'account', label: 'keyFeedbackLabel', note: 'keyFeedbackDesc' },
  { tab: 'account', label: 'keyVolumeLabel', note: 'keyVolumeDesc' },
  { tab: 'account', label: 'penSqueakLabel', note: 'penSqueakDesc' },
  { tab: 'account', label: 'keyHear' },
  { tab: 'account', label: 'autosaveLabel', note: 'autosaveHint' },

  // Server & connections — who this machine talks to
  { tab: 'blog', label: 'seoCanonical' },
  { tab: 'server', label: 'seoAutoSchema' },
  { tab: 'server', label: 'seoOgImage' },
  { tab: 'server', label: 'redirectSource' },
  { tab: 'server', label: 'redirectDestination' },

  // Comments & mail, and the rest of the server
  { tab: 'people', label: 'nlSmtpHost' },
  { tab: 'people', label: 'nlSmtpPort' },
  { tab: 'people', label: 'nlSmtpUser' },
  { tab: 'people', label: 'nlSmtpPass' },
  { tab: 'people', label: 'nlSmtpFrom' },
  { tab: 'people', label: 'nlSmtpSecure' },
  { tab: 'people', label: 'commentsTurnstile' },
  { tab: 'people', label: 'commentsGoogleAuth' },
  { tab: 'server', label: 'customHeadLabel', note: 'customCodeNote' },
  { tab: 'server', label: 'customBodyEndLabel', note: 'customBodyEndHint' },
  { tab: 'post', label: 'cardInk', note: 'inkHelp' },
  { tab: 'post', label: 'inkHighlighter' },
  { tab: 'post', label: 'inkLines', note: 'inkLinesHint' },
  { tab: 'post', label: 'inkSelection', note: 'inkSelectionHint' },
  { tab: 'server', label: 'mcpEnable' },
  { tab: 'server', label: 'mcpUrlLabel' },
  { tab: 'server', label: 'mcpTokensTitle' },
  { tab: 'server', label: 'cardAi' },
  { tab: 'server', label: 'aiProviderLabel' },
  { tab: 'server', label: 'aiKeyLabel' },
  { tab: 'server', label: 'aiModelLabel' },
  // Alt text and excerpts stopped being switches on 2026-08-29 — they follow the key now —
  // and their rows came out of the index with them. An entry for a setting that is no longer
  // drawn is worse than a missing one: the search answers, opens the AI tab, and highlights
  // nothing, which reads as the tab having lost the setting rather than the index being old.
  { tab: 'server', label: 'aiTaskComments' },

  // Server & connections — the state of the install
  { tab: 'server', label: 'cacheEnable' },
  { tab: 'account', label: 'dashboardSystemLine', note: 'dashboardSystemLineDesc' },
  { tab: 'server', label: 'updateCheckLabel', note: 'updateCheckDesc' },
  // Moved off Reading, where an audit of the OWNER's actions had been filed as a reader
  // feature. The tour reads the labels each tab renders, so this row and the card move together.
  { tab: 'account', label: 'featActivityLog', note: 'featActivityLogDesc' },
  { tab: 'server', label: 'clearCache' },
  { tab: 'server', label: 'backupAuto' },
  { tab: 'server', label: 'offsiteTitle', note: 'offsiteHelp' },
  { tab: 'server', label: 's3Bucket' },
  { tab: 'server', label: 'offsiteTest' },
  { tab: 'server', label: 'backupIntervalLabel' },
  { tab: 'server', label: 'backupKeepLabel' },
  { tab: 'server', label: 'maxUploadLabel', note: 'maxUploadHint' },
  { tab: 'server', label: 'storageQuotaLabel', note: 'storageQuotaHint' },
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
