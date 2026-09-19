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
import { pageHeader, pager, sheet, sheetTop, tabs } from '@/web/admin/kit'
import { SEGMENT_TRACK, edgeAt, tabItemClass } from '@/admin-shared/tabs'
import { ICONS } from '@/icons'
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

/**
 * THE LIBRARY'S TWO LAYOUTS, on one pair of keys for all three kinds.
 *
 * ⚠️ NEITHER KEY IS MARKED ACTIVE HERE, and that is deliberate: which one is pressed is a
 * `localStorage` preference the SERVER cannot read. The boot script writes `data-media-view` on
 * `<html>` before the first paint and the stylesheet paints the matching key — the same
 * arrangement the rail's own state uses, and the one the chord badge had to be moved to after
 * it flickered the logo on every load.
 */
function viewKeys(t: AdminStrings): string {
  const key = (view: 'grid' | 'list', icon: 'grid' | 'menu', label: string, i: number): string =>
    `<button type="button" data-media-view-key="${view}" title="${escapeAttr(label)}"`
    + ` aria-label="${escapeAttr(label)}"`
    + ` class="${tabItemClass(false, 'sm', false, 'choice', edgeAt(i, 2))} !px-2 flex items-center">`
    + `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"`
    + ` stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[icon]}</svg></button>`
  return `<div class="${SEGMENT_TRACK} shrink-0" data-media-view-keys>`
    + key('grid', 'grid', t.mediaViewGrid, 0) + key('list', 'menu', t.mediaViewList, 1) + `</div>`
}

export async function mediaScreen(settings: SiteSettings, query: URLSearchParams): Promise<string> {
  const t = adminT(settings.language)
  const lang = settings.language
  const open = openKind(query)
  const view = await mediaScreenView(open, Number(query.get('page') ?? '1'))

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
      sheetTop(strip + viewKeys(t) + imageTools(t, lang, view.totals))
      + imagesPanel(t, lang, view.images, open === 'images', pager(t, '/admin/media', 'images', view.at.images, view.pages.images))
      + videosPanel(t, lang, view.videos, open === 'videos', pager(t, '/admin/media', 'videos', view.at.videos, view.pages.videos))
      + filesPanel(t, lang, view.files, view.icons, open === 'files', pager(t, '/admin/media', 'files', view.at.files, view.pages.files))
      // The page's old intro sentence, demoted to the sheet's closing small print — a hint is
      // not a headline.
      + `<div class="${SHEET_FOOT}">${escapeHtml(t.libraryIntro)}</div>`,
    )
    + `</div>`
}
