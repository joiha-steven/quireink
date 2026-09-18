// The pictures: the tool band, the drop well, the sweeps, and every tile drawn in the first
// response. The React face fetched `/api/media` on mount, so the library was a grid of grey
// boxes for one round trip every time it was opened.
//
// ⚠️ THREE CONTROLS IN THE ACTION ROW ARE EXPENSIVE, and two of them look exactly like the
// quiet ones beside them, which is why this says so out loud:
//
//   · "Describe all with AI" posts to `/api/media/describe-missing`, which answers 200 at once
//     and then loops the owner's paid vision model over every undescribed image in the
//     background. Nothing asks first.
//   · "Delete all unused" and "Delete selected" soft-delete in a batch — the trash gives them
//     back until it is purged — and both go through `quire:confirm`.
//   · "Check unused" destroys nothing, but it reads every post, every page and every stored
//     revision, JSON-parsing each one, before it even reads the library.
//
// Nothing here is a form: every control is `type="button"` and the island does the request, for
// the same reason the newsletter's send is not one (`screens/newsletter-send.ts`).
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { MediaItem, SiteLang } from '@/types'
import { escapeAttr, escapeHtml, formatBytes } from '@/utils'
import { formatCount, formatDate } from '@/i18n/format'
import { CONTROL_SM, DROPZONE, DROPZONE_IDLE, SHEET_TOOL, SHEET_TOOL_DANGER } from '@/admin-shared/kit'
import { mediaTileMark, type MediaWords } from '@/admin-shared/media-marks'
import { emptyState, select } from '@/web/admin/kit'
import { htmlOf } from '@/web/admin/mark-html'

export const mediaWords = (t: AdminStrings): MediaWords => ({
  copyUrl: t.copyUrl, download: t.download, delete: t.delete, unusedBadge: t.unusedBadge,
})

/**
 * Five at desktop, six on a wide screen.
 *
 * The gaps are uneven on purpose: the caption sits under its own tile, so the vertical gap has
 * a line of type in it that the horizontal one does not.
 */
export const GRID = 'grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4'
  + ' lg:grid-cols-5 xl:grid-cols-6'

/**
 * The count and the size over the WHOLE library, then a name search and a sort.
 *
 * It rides on the SHEET'S OWN FIRST ROW beside the kind tabs. The library was two chrome rows
 * deep before anything of its own appeared — tabs, then a band holding a count, a search and a
 * sort — and the tab row was otherwise empty. React reached that with a portal, because the
 * count lived in the grid's state and the tabs in its parent's; the server just writes it there.
 */
/**
 * ⚠️ THE COUNT IS THE LIBRARY, NOT THE PAGE. `items` is one page of tiles now, so counting it
 * would print "200 images" to somebody with four thousand, and the figure would change as they
 * turned pages. `totals` comes from one `count(*)` over the whole table (`views-media.ts`).
 */
export function imageTools(
  t: AdminStrings, lang: SiteLang, totals: { images: number; bytes: number },
): string {
  const bytes = totals.bytes
  // A real box, and not `display: contents`. The React face portalled this band into a slot
  // the sheet row owned — `flex w-full … sm:flex-1` — and with `contents` the count and the
  // search group become direct children of the row instead, which lays them out with ITS gaps:
  // measured 2026-09-14 at 375, the row came out 4px shorter and the two lines 4px closer.
  return `<div class="flex w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto sm:flex-1"`
    // THE LIBRARY'S OWN NUMBERS, carried for the island — which can no longer count them,
    // because the grid beside it holds one page. It moves these by the delta of what it
    // uploads and deletes instead (`island/lib/media-images.ts`).
    + ` data-media-total="${totals.images}" data-media-total-bytes="${totals.bytes}"`
    + ` data-media-tools${totals.images ? '' : ' hidden'}>`
    + `<span class="w-full whitespace-nowrap text-sm text-neutral-500 sm:w-auto dark:text-neutral-400">`
    + `<span class="font-medium text-neutral-700 tabular-nums dark:text-neutral-200" data-media-count>`
    + `${escapeHtml(formatCount(totals.images, lang))}</span> ${escapeHtml(t.mediaTotalImages)}`
    + `<span class="text-neutral-300 dark:text-neutral-600"> · </span>`
    + `<span class="tabular-nums" data-media-bytes>${escapeHtml(formatBytes(bytes))}</span></span>`
    + `<div class="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">`
    + `<input type="search" data-media-find aria-label="${escapeAttr(t.mediaSearch)}"`
    + ` placeholder="${escapeAttr(t.mediaSearch)}" class="${CONTROL_SM} min-w-0 flex-1 sm:w-52 sm:flex-none">`
    + `<label class="sr-only" for="media-sort">${escapeHtml(t.sortLabel)}</label>`
    + select({
      name: 'media-sort', label: t.sortLabel, value: 'new', attrs: 'data-media-sort id="media-sort"',
      options: [['new', t.sortNewest], ['name', t.sortName], ['size', t.sortSize]],
    })
    + `</div></div>`
}

/**
 * The upload well, and it is a BUTTON.
 *
 * It was a `<div onClick>` in front of a hidden file input: Tab went past it, Enter and Space
 * did nothing, and a screen reader read a line of grey text with nothing to say it could be
 * operated. The input stays hidden and stays OUTSIDE the button, because a form control inside
 * a button is not something a browser has to honour.
 */
export function dropWell(t: AdminStrings, kind: 'media' | 'file', label: string, accept: string): string {
  return `<div><button type="button" data-${kind}-drop class="${DROPZONE} ${DROPZONE_IDLE} block w-full">`
    + `${escapeHtml(label)}</button>`
    + `<input type="file" multiple hidden data-${kind}-file accept="${escapeAttr(accept)}"`
    + ` aria-label="${escapeAttr(label)}">`
    // A transform, not a width: the fill scales on the compositor instead of re-laying out the
    // bar on every tick of the upload.
    + `<div role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" hidden`
    + ` data-${kind}-progress aria-label="${escapeAttr(t.dropzone)}"`
    + ` class="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">`
    + `<div class="h-full w-full origin-left bg-neutral-900 transition-transform dark:bg-white"`
    + ` style="transform:scaleX(0)"></div></div></div>`
}

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/svg+xml,image/gif'

/**
 * The quiet row of actions, with every state it can be in already drawn.
 *
 * The counts are the one thing the island writes: how many tiles are ticked, and how many the
 * unused sweep found. Both are `{n}` in a label the server has already translated.
 */
function actionRow(t: AdminStrings): string {
  return `<div class="flex flex-wrap justify-end gap-4" data-media-actions>`
    + `<button type="button" data-media-clear class="${SHEET_TOOL}" hidden>`
    + `${escapeHtml(t.clearSelection)}</button>`
    + `<button type="button" data-media-del-picked class="${SHEET_TOOL_DANGER}" hidden>`
    + `${escapeHtml(t.deleteSelected)} (<span data-media-picked>0</span>)</button>`
    + `<button type="button" data-media-only-unused class="${SHEET_TOOL}" hidden`
    + ` data-on="${escapeAttr(t.showAll)}" data-off="${escapeAttr(t.showUnusedOnly)}">`
    + `${escapeHtml(t.showUnusedOnly)}</button>`
    + `<button type="button" data-media-del-unused class="${SHEET_TOOL_DANGER}" hidden>`
    + `${escapeHtml(t.deleteAllUnused)} (<span data-media-unused>0</span>)</button>`
    + `<button type="button" data-media-check class="${SHEET_TOOL}">${escapeHtml(t.checkUnused)}</button>`
    + `<button type="button" data-media-describe class="${SHEET_TOOL}">`
    + `${escapeHtml(t.aiDescribeAll)}</button></div>`
}

/** One tile, from the description both faces draw it from. */
export const tileHtml = (m: MediaItem, w: MediaWords, lang: SiteLang, mode: 'page' | 'picker'): string =>
  htmlOf(mediaTileMark(m, w, {
    mode,
    tickable: true,
    sizeLabel: formatBytes(m.size),
    title: `${m.filename}\n${m.width && m.height ? `${m.width}×${m.height} · ` : ''}`
      + `${formatBytes(m.size)} · ${formatDate(m.uploadedAt, lang)}`,
  }))

/**
 * BOTH EMPTY STATES SHIP DRAWN and an attribute picks (`docs/admin-one-dom.md`): "no pictures
 * at all" and "nothing matched what you typed" are different sentences, and the island cannot
 * write the second one without carrying a translation it does not need to carry.
 *
 * ⚠️ ALL THREE SIT IN ONE WRAPPER, and that is trap 4 in that document rather than tidiness.
 * Tailwind v4's `space-y-5` is `& > :not(:last-child) { margin-block-end }`, and `:last-child`
 * is STRUCTURAL — it counts the hidden ones. With the two empty states as siblings after the
 * grid, the grid stopped being the last child and took a 20px margin the React face never
 * drew. One wrapper, and the stack has one child again whichever state is showing.
 */
export function imagesPanel(
  t: AdminStrings, lang: SiteLang, items: MediaItem[], open: boolean, pagerHtml = '',
): string {
  const w = mediaWords(t)
  const tiles = items.map((m) => tileHtml(m, w, lang, 'page')).join('')
  return `<div data-media-panel="images" class="px-4 pt-4 pb-2"${open ? '' : ' hidden'}>`
    + `<div class="space-y-5">`
    + dropWell(t, 'media', t.dropzone, IMAGE_ACCEPT)
    + actionRow(t)
    + `<div data-media-body>`
    + `<div class="${GRID}" data-media-grid${items.length ? '' : ' hidden'}>${tiles}</div>`
    + `<div data-media-empty${items.length ? ' hidden' : ''}>`
    + emptyState({ title: t.noMedia }) + `</div>`
    + `<div data-media-none hidden>` + emptyState({ title: t.mediaNoMatch }) + `</div>`
    + `</div>` + pagerHtml + `</div></div>`
}
