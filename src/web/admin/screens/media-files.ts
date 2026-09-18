// The other two kinds: videos as players, attachments as rows.
//
// Both tabs mounted LAZILY in the React face — they fetched `/api/files` the first time anybody
// clicked them, and lost everything on the way back. All three kinds come out of one read now
// (`views-media.ts`), so switching tabs is an attribute and nothing is fetched twice.
//
// The two lists share `POST /api/files/delete`, which is a SOFT delete: the trash gives an
// attachment back until it is purged. It is still the only destructive thing on these tabs and
// it goes through `quire:confirm` first.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { FileItem, SiteLang } from '@/types'
import { escapeAttr, escapeHtml, formatBytes } from '@/utils'
import { formatDate } from '@/i18n/format'
import { CHECK } from '@/admin-shared/kit'
import { NOTE_TEXT, TAP } from '@/admin-shared/scale'
import { emptyState, selectionBar } from '@/web/admin/kit'
import { dropWell } from '@/web/admin/screens/media-images'

const FRAME = 'divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200'
  + ' dark:divide-neutral-800 dark:border-neutral-800'

const QUIET = 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'

/** Short uppercase tag from the filename extension, or the MIME subtype when it has none. */
function ext(f: FileItem): string {
  const dot = f.filename.lastIndexOf('.')
  if (dot >= 0 && dot < f.filename.length - 1) return f.filename.slice(dot + 1).toUpperCase()
  const sub = f.contentType.split('/')[1]
  return (sub || 'FILE').toUpperCase().slice(0, 5)
}

const meta = (f: FileItem, lang: SiteLang): string =>
  `${escapeHtml(formatBytes(f.size))} · ${escapeHtml(formatDate(f.uploadedAt, lang))}`

const tickBox = (f: FileItem, cls: string): string =>
  `<input type="checkbox" class="${cls} h-4 w-4 shrink-0 ${CHECK}" data-pick="${escapeAttr(f.url)}"`
  + ` aria-label="${escapeAttr(f.filename)}">`

/**
 * One attachment.
 *
 * `managed` is the site icons, which are uploaded in Settings and listed here only so the owner
 * can see that the space is being used. They carry no tick and no delete: the screen that put
 * them there is the screen that takes them away.
 */
function fileRow(t: AdminStrings, lang: SiteLang, f: FileItem, managed: boolean): string {
  const actions = managed
    ? `<span class="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500`
      + ` dark:bg-neutral-800 dark:text-neutral-400">${escapeHtml(t.iconsManaged)}</span>`
    : `<button type="button" data-copy="${escapeAttr(f.url)}" class="${TAP} ${QUIET}">`
      + `${escapeHtml(t.copyUrl)}</button>`
      + `<a href="${escapeAttr(f.url)}" download="${escapeAttr(f.filename)}" class="${QUIET}">`
      + `${escapeHtml(t.download)}</a>`
  return `<li class="flex items-center gap-3 bg-white p-3 dark:bg-neutral-900"`
    + ` data-file="${escapeAttr(f.url)}">`
    + (managed ? '' : tickBox(f, ''))
    + `<span class="flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-xs`
    + ` font-bold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">${escapeHtml(ext(f))}</span>`
    + `<div class="min-w-0 flex-1">`
    + `<p class="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200"`
    + ` title="${escapeAttr(f.filename)}">${escapeHtml(f.filename)}</p>`
    + `<p class="${NOTE_TEXT}">${meta(f, lang)}</p></div>`
    + `<div class="flex shrink-0 flex-wrap items-center gap-3 text-xs">${actions}</div></li>`
}

export function filesPanel(
  t: AdminStrings, lang: SiteLang, files: FileItem[], icons: FileItem[], open: boolean, pagerHtml = '',
): string {
  const rows = files.map((f) => fileRow(t, lang, f, false)).join('')
  const iconRows = icons.map((f) => fileRow(t, lang, f, true)).join('')
  const empty = files.length === 0 && icons.length === 0
  return `<div data-media-panel="files" class="px-4 pt-4 pb-2"${open ? '' : ' hidden'}>`
    + `<div class="space-y-5">`
    + dropWell(t, 'file', t.filesDropzone, '')
    + selectionBar({ clearLabel: t.clearSelection, deleteLabel: t.deleteSelected, attrs: 'data-file-bar' })
    + `<div data-file-body>`
    + `<div class="space-y-6" data-file-lists${empty ? ' hidden' : ''}>`
    + `<ul class="${FRAME}" data-file-list${files.length ? '' : ' hidden'}>${rows}</ul>`
    + `<div class="space-y-2"${icons.length ? '' : ' hidden'}>`
    + `<h3 class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">`
    + `${escapeHtml(t.iconsGroupTitle)}</h3>`
    + `<ul class="${FRAME}">${iconRows}</ul></div></div>`
    + `<div data-file-empty${empty ? '' : ' hidden'}>${emptyState({ title: t.noFiles })}</div>`
    + `</div>` + pagerHtml + `</div></div>`
}

/** `preload=metadata`: the browser fetches only the headers, not the file. */
function videoRow(t: AdminStrings, lang: SiteLang, f: FileItem): string {
  return `<li class="overflow-hidden rounded-lg border border-neutral-200 bg-white`
    + ` dark:border-neutral-800 dark:bg-neutral-900" data-file="${escapeAttr(f.url)}">`
    + `<video src="${escapeAttr(f.url)}" controls preload="metadata" playsinline`
    + ` class="block aspect-video w-full bg-neutral-950 object-contain"></video>`
    + `<div class="flex items-start gap-3 p-3">`
    + tickBox(f, 'mt-1')
    + `<div class="min-w-0 flex-1">`
    + `<p class="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200"`
    + ` title="${escapeAttr(f.filename)}">${escapeHtml(f.filename)}</p>`
    + `<p class="${NOTE_TEXT}">${meta(f, lang)}</p></div>`
    + `<button type="button" data-copy="${escapeAttr(f.url)}" class="shrink-0 text-xs ${QUIET}">`
    + `${escapeHtml(t.copyUrl)}</button></div></li>`
}

export function videosPanel(
  t: AdminStrings, lang: SiteLang, videos: FileItem[], open: boolean, pagerHtml = '',
): string {
  const rows = videos.map((f) => videoRow(t, lang, f)).join('')
  return `<div data-media-panel="videos" class="px-4 pt-4 pb-2"${open ? '' : ' hidden'}>`
    + `<div class="space-y-5">`
    + dropWell(t, 'file', t.videosDropzone, 'video/*')
    + selectionBar({ clearLabel: t.clearSelection, deleteLabel: t.deleteSelected, attrs: 'data-video-bar' })
    + `<div data-video-body>`
    + `<ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-video-list`
    + `${videos.length ? '' : ' hidden'}>${rows}</ul>`
    + `<div data-video-empty${videos.length ? ' hidden' : ''}>${emptyState({ title: t.noVideos })}</div>`
    + `</div>` + pagerHtml + `</div></div>`
}
