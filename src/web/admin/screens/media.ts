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
import { SHEET_FOOT, buttonClass } from '@/admin-shared/kit'
import { META } from '@/admin-shared/scale'
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
 * THE WAY TO THE NEXT PAGE, and it is three links rather than an island.
 *
 * Turning a page is a navigation: the address says which page, the server draws it, and Back
 * goes back a page the way it does everywhere else. An island would have had to build a tile,
 * and a tile built in the browser is a second copy of `media-images.ts` drifting from it in
 * silence — the same rule the write column keeps.
 *
 * ⚠️ THE LINK CARRIES ITS OWN TAB. Switching tabs on this screen is an attribute and not a
 * navigation, so the address can be sitting on `?tab=files` while somebody is looking at the
 * pictures. A pager that only wrote `page=` would send them to page two of the wrong kind.
 *
 * Nothing at all when there is one page, which is the usual case: a pager under a grid of nine
 * is an offer to go nowhere.
 */
function pager(t: AdminStrings, kind: Kind, at: number, pages: number): string {
  if (pages <= 1) return ''
  const href = (n: number) => `/admin/media?tab=${kind}${n > 1 ? `&page=${n}` : ''}`
  const step = (n: number, label: string, live: boolean) => live
    ? `<a href="${escapeAttr(href(n))}" class="${buttonClass('secondary')}">${escapeHtml(label)}</a>`
    // Drawn and dead rather than absent: a pager whose keys move as you reach the ends is a
    // pair of buttons that will not stay under the pointer.
    : `<span aria-disabled="true" class="${buttonClass('secondary')} pointer-events-none opacity-50">`
      + `${escapeHtml(label)}</span>`
  return `<nav class="flex items-center justify-center gap-3 pt-6 pb-2" data-media-pager="${escapeAttr(kind)}">`
    + step(at - 1, t.pagerPrev, at > 1)
    + `<span class="${META} tabular-nums">`
    + `${escapeHtml(t.pagerOf.replace('{n}', String(at)).replace('{total}', String(pages)))}</span>`
    + step(at + 1, t.pagerNext, at < pages)
    + `</nav>`
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
      sheetTop(strip + imageTools(t, lang, view.totals))
      + imagesPanel(t, lang, view.images, open === 'images', pager(t, 'images', view.at.images, view.pages.images))
      + videosPanel(t, lang, view.videos, open === 'videos', pager(t, 'videos', view.at.videos, view.pages.videos))
      + filesPanel(t, lang, view.files, view.icons, open === 'files', pager(t, 'files', view.at.files, view.pages.files))
      // The page's old intro sentence, demoted to the sheet's closing small print — a hint is
      // not a headline.
      + `<div class="${SHEET_FOOT}">${escapeHtml(t.libraryIntro)}</div>`,
    )
    + `</div>`
}
