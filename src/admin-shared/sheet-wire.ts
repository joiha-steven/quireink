// ONE DESCRIPTION OF THE WRITING SHEET, which the route and the island both compile against.
//
// The shape a screen is handed used to exist twice — once in the route that built it, once in
// the component that read it — and the two disagreed in silence. `listSessions()` returns epoch
// milliseconds and the screen called `.slice()` on them; a snapshot's timestamp was called `at`
// on one side and `createdAt` on the other. Neither was a type error, because neither side had
// ever been shown the other's idea.
//
// So the sheet's payload is described HERE, imported by both ends, and a disagreement becomes a
// compile error rather than a blank field.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { KeyFeedback, PostStatus, SiteLang } from '@/types'

export type SheetKind = 'post' | 'page' | 'note'

/** The piece, as the fields on the sheet hold it. Every kind carries every key; the ones that
 *  do not apply are empty, so one draft type serves three panels and the island never branches
 *  on a missing property. */
export type SheetDraft = {
  title: string
  slug: string
  /**
   * ⚠️ A WALL CLOCK ON THE SITE'S ZONE, not an instant. `2027-03-04T09:30` with no offset,
   * exactly as the field holds it — the conversion to and from an instant happens at the save,
   * with the SITE's timezone, because a schedule is a time on the blog's clock rather than on
   * the clock of whichever machine is typing.
   */
  date: string
  status: PostStatus
  categories: string[]
  tags: string[]
  series: string
  seriesOrder: number
  featuredImage: string
  coverImage: string
  metaTitle: string
  metaDescription: string
  excerpt: string
  sourceUrl: string
  sourceTitle: string
  quote: string
}

/** Everything the island needs that is not in the markup. */
export type SheetData = {
  kind: SheetKind
  lang: SiteLang
  /** The site's zone, for the one field that is a wall clock. */
  timezone: string
  /** Empty for a piece that has never been saved: there is no row and no address yet. */
  slug: string
  /** The body, in Markdown, straight out of the page rather than a second round trip. */
  content: string
  draft: SheetDraft
  /** How often the local and server snapshots are written, in seconds. */
  autosaveSeconds: number
  /** When the server last took a snapshot of this piece, or null. WHEN, never WHAT — the body
   *  is fetched only if somebody says yes to the offer. */
  autosaveAt: number | null
  /**
   * When the ROW itself was last really saved, in ms, or null for a piece that has none.
   *
   * ⚠️ A SNAPSHOT OLDER THAN THIS HAS BEEN SUPERSEDED. The writer saved AFTER it, so offering
   * it back is offering to undo the save — which is the opposite of what the offer is for.
   */
  rowSavedAt: number | null
  /** The typewriter's sound, which the editor reads and this only carries. TYPED, because
   *  `mode: string` made the island cast on the way in — and a cast is where a setting renamed
   *  on the server goes on compiling and stops working. */
  keySound: { mode: KeyFeedback; volume: number; squeak: boolean }
}

/** Where a kind's rows live, which is the only thing the save path needs to know about it. */
export const API_PATH: Record<SheetKind, string> = {
  post: '/api/posts',
  page: '/api/pages',
  note: '/api/notes',
}

/** Where a kind is READ on the public site, which the three do not share. */
export const LIVE_PATH: Record<SheetKind, (slug: string) => string> = {
  post: (slug) => `/${slug}`,
  page: (slug) => `/${slug}`,
  note: (slug) => `/notes/${slug}`,
}

/** The address the sheet itself lives at. */
export const SHEET_PATH: Record<SheetKind, string> = {
  post: '/admin/editor',
  page: '/admin/page-editor',
  note: '/admin/note-editor',
}

/** The snapshot key on this device. One per kind per piece; `new` until it has a row. */
export const draftKey = (kind: SheetKind, slug: string): string =>
  `quire:draft:${kind}:${slug || 'new'}`

/** An empty draft, so a new piece starts from a shape rather than from undefined. */
export const emptyDraft = (): SheetDraft => ({
  title: '', slug: '', date: '', status: 'draft',
  categories: [], tags: [], series: '', seriesOrder: 0,
  featuredImage: '', coverImage: '', metaTitle: '', metaDescription: '', excerpt: '',
  sourceUrl: '', sourceTitle: '', quote: '',
})

/**
 * THE WORDS THE SHEET AND ITS EDITOR PRINT, and no more.
 *
 * ⚠️ ONE LANGUAGE, AND A NAMED SUBSET OF IT. ADR 0054's second decision is that the eleven admin
 * dictionaries stop shipping: the server picks the language and sends the words already chosen,
 * inside the HTML. A whole dictionary is 1,258 keys and 25 KB gzipped on every editor open, most
 * of it for screens this one cannot reach — so the list is named here, the TYPE is derived from
 * the list, and the picker below is derived from it too. A key added to one is added to all
 * three at once, which is the only arrangement in which a subset cannot drift from what uses it.
 */
export const SHEET_WORD_KEYS = [
  'askCancel', 'attributes', 'captionPlaceholder', 'close', 'copyUrl', 'dateCalendar',
  'dateMonthNext', 'dateMonthPrev', 'dateNow', 'dateTime', 'dateTomorrow', 'delete', 'download',
  'draftRestored', 'edFocus', 'edReadMinutes', 'edWords', 'editorPlaceholder', 'findCount',
  'findFind', 'findMatchCase', 'findNext', 'findNoMatch', 'findPrevious', 'findReplace',
  'findReplaceAll', 'findReplaceWith', 'galleryAdd', 'galleryPickHint', 'galleryPickTitle',
  'hideAttributes', 'imageUploadFailed', 'imgAlignCenter', 'imgAlignLeft', 'imgAlignRight',
  'imgCaptions', 'imgDefault', 'imgFrameInk', 'imgFrameMedium', 'imgFrameNone', 'imgFramePaper',
  'imgFrameThick', 'imgFrameThin', 'imgGrid', 'imgNoCaptions', 'imgRatioNatural',
  'imgSizeColumn', 'imgSizeWide', 'inkBlue', 'inkGreen', 'inkOrange', 'inkPink', 'inkYellow',
  'keptLocallyPrefix', 'keptOnServerPrefix', 'kindNote', 'kindPage', 'loadMediaFailed',
  'localDraftDiscard', 'localDraftFound', 'localDraftRestore', 'mathPlaceholder', 'mediaTitle',
  'moreActions', 'navWrite', 'needTitle', 'previewDraft', 'promptLink', 'publish', 'published',
  'removeAria', 'restore', 'revisionLoaded', 'save', 'saveDraft', 'saveFailed', 'savedAtPrefix',
  'savedDraft', 'saving', 'schedule', 'scheduled', 'scheduledForPrefix', 'serverDraftFound',
  'slashHint', 'slugTaken', 'statusDraft', 'statusPublished', 'tbBold', 'tbCodeBlock',
  'tbCodeInline', 'tbColAdd', 'tbColDel', 'tbDivider', 'tbGallery', 'tbHeading', 'tbHighlight',
  'tbImage', 'tbInsert', 'tbItalic', 'tbLink', 'tbLinkRemove', 'tbList', 'tbListNumbered',
  'tbMarkdown', 'tbMath', 'tbMathInline', 'tbParagraph', 'tbQuote', 'tbRing', 'tbRowAdd',
  'tbRowDel', 'tbStrike', 'tbTable', 'tbTableDelete', 'tbTask', 'tbUnderline',
  'titlePlaceholder', 'tmLatest', 'trashFailed', 'trashedOne', 'undo', 'unsaved',
  'unsupportedType', 'untitled', 'unusedBadge',
] as const

export type SheetWords = Pick<AdminStrings, (typeof SHEET_WORD_KEYS)[number]>

export const sheetWords = (t: AdminStrings): SheetWords =>
  Object.fromEntries(SHEET_WORD_KEYS.map((k) => [k, t[k]])) as SheetWords
