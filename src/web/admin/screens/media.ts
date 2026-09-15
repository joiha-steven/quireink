// The library, as HTML the server sends (ADR 0054).
//
// ⚠️ THE KIND IS IN THE ADDRESS NOW (`?tab=videos`), and it was not in the React face: that one
// always opened on Images, forgot which tab you were on after a reload, and could not be linked
// to. Same rule as the trash, which opens on `?tab=media`. `replaceState`, so Back leaves the
// library rather than walking the three kinds you clicked through.
//
// ⚠️ ALL THREE KINDS ARRIVE DRAWN. The React face mounted videos and files lazily and fetched
// `/api/files` the first time either was opened, so two of the three tabs were a spinner on
// first click and lost their state on the way back. One read gives all three
// (`views-media.ts`), and switching tabs is an attribute.
//
// Nothing here is a form. Every control is `type="button"`, because `ui/Button` emits a button
// with no type and HTML's default is submit — and two of the buttons on this screen delete
// things in batches.
import type { SiteSettings } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { SHEET_FOOT } from '@/admin-shared/kit'
import { pageHeader, sheet, sheetTop, tabs } from '@/web/admin/kit'
import { mediaScreenView } from '@/web/admin/views-media'
import { imageTools, imagesPanel } from '@/web/admin/screens/media-images'
import { filesPanel, videosPanel } from '@/web/admin/screens/media-files'

const KINDS = ['images', 'videos', 'files'] as const
type Kind = (typeof KINDS)[number]

const openKind = (query: URLSearchParams): Kind => {
  const asked = query.get('tab')
  return KINDS.find((k) => k === asked) ?? 'images'
}

/**
 * The words the island can need to SAY, and only those.
 *
 * `{n}` and `{name}` stay unreplaced: which count and which file depend on what was ticked.
 * Every other string on this screen is already in the markup above it — including both empty
 * states and both faces of the unused filter's own label.
 */
function words(t: AdminStrings): string {
  return escapeAttr(JSON.stringify({
    askOne: t.askPurgeTitle, askMany: t.askPurgeManyTitle,
    askUnusedTitle: t.askDeleteUnusedTitle, askUnused: t.askDeleteUnusedBody,
    noUndo: t.askNoUndo, yes: t.askDeleteForever, no: t.askCancel,
    trashed: t.movedToTrash, deleteFailed: t.deleteFailed, noMatch: t.deleteNoMatch,
    copied: t.copiedUrl, uploaded: t.uploaded, uploadFailed: t.uploadFailed,
    badType: t.unsupportedType, checkFailed: t.checkUnusedFailed,
    found: t.unusedFound, none: t.unusedNone,
    describing: t.aiDescribeAllStarted, noVision: t.aiCannotSeeImages,
    noModel: t.aiNotConfigured.replace('{tab}', t.tabServer),
    loadFailed: t.loadMediaFailed,
  }))
}

export async function mediaScreen(settings: SiteSettings, query: URLSearchParams): Promise<string> {
  const t = adminT(settings.language)
  const lang = settings.language
  const open = openKind(query)
  const view = await mediaScreenView()

  const strip = tabs({
    items: [
      { key: 'images', label: t.tabImages },
      { key: 'videos', label: t.tabVideos },
      { key: 'files', label: t.tabFiles },
    ],
    value: open,
    attrs: 'data-media-tabs',
  })

  return `<div data-screen="media" data-media-tab="${escapeAttr(open)}"`
    + ` data-lang="${escapeAttr(lang)}" data-media-words="${words(t)}">`
    + pageHeader({ title: t.libraryTitle })
    + sheet(
      // The images tab's own tools ride on the sheet's FIRST ROW beside the kind tabs, which is
      // where React put them with a portal. `hidden` when another kind is open: a tab that is
      // not on screen must not leave its tools in the visible row.
      sheetTop(strip + imageTools(t, lang, view.images))
      + imagesPanel(t, lang, view.images, open === 'images')
      + videosPanel(t, lang, view.videos, open === 'videos')
      + filesPanel(t, lang, view.files, view.icons, open === 'files')
      // The page's old intro sentence, demoted to the sheet's closing small print — a hint is
      // not a headline.
      + `<div class="${SHEET_FOOT}">${escapeHtml(t.libraryIntro)}</div>`,
    )
    + `</div>`
}
