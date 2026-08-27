// One tile in the media grid: the thumbnail, the selection tick, the hover actions, and the
// caption under it.
//
// Split out of `MediaLibrary.tsx` on 2026-08-22, when that file crossed its 400-line ceiling.
// The seam is the obvious one: everything here is about ONE item, and nothing here knows
// about paging, filtering, uploading or the zoom overlay, which is the rest of that file.
//
// The four callbacks are already bound to this item by the caller, so nothing in here has to
// know its own url — which is also what stops a handler being wired to the wrong row.

import type { MediaItem, SiteLang } from '@/types'
import { formatBytes } from '@/utils'
import { formatDate } from '@/i18n/i18n'
import { useAdminT } from './I18nProvider'
import { CHECK, TAP } from './kit'

export function MediaCard({
  m, mode, multi, selected, lang, compactDate, unused, onOpen, onToggle, onCopy, onDelete,
}: {
  m: MediaItem
  mode: 'page' | 'picker'
  multi: boolean
  selected: boolean
  lang: SiteLang
  compactDate: (iso: string, lang: string) => string
  /** Marked by the "check unused" sweep; the badge is the only thing that reads it. */
  unused: boolean
  onOpen: () => void
  onToggle: () => void
  onCopy: () => void
  onDelete: () => void
}) {
  const t = useAdminT()
  return (
        <figure
                className={`group relative overflow-hidden rounded-lg border bg-white dark:bg-neutral-900 ${
            (mode === 'page' || multi) && selected
              ? 'border-neutral-900 ring-2 ring-neutral-900 dark:border-white dark:ring-white'
              : 'border-neutral-200 dark:border-neutral-800'
          }`}
        >
          {/* Image region. The click target fills it; the checkbox + action bar
              sit ON the image (absolute) so they cost zero layout height. */}
          <div className="relative aspect-[3/2] w-full bg-neutral-100 dark:bg-neutral-800">
            <button
              type="button"
              // Page mode: click to zoom. Picker: click to select (toggle in multi).
              onClick={onOpen}
              aria-label={m.filename}
              className="absolute inset-0 block"
            >
              <img src={m.thumb ?? m.url} alt={m.filename} className="h-full w-full object-cover" />
            </button>
            {(mode === 'page' || multi) && (
              /* The LABEL carries the hit area, not the tick. Padding on an
                 `input[type=checkbox]` is ignored by the browser — the native widget draws
                 at its border box and a `p-2` on it computes to 0, measured 2026-08-22 —
                 so the 16px tick stayed a 16px target on a phone and on an iPad. A label
                 is the standard answer and it is also the accessible one: the whole 32px
                 square is the control. `-m-2` puts the tick back where it was, so nothing
                 on the card moves. */
              <label
                className={`absolute left-1.5 top-1.5 z-20 -m-2 flex h-8 w-8 cursor-pointer items-center justify-center transition-opacity ${
                  selected ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={onToggle}
                  aria-label={m.filename}
                  className={`h-4 w-4 ${CHECK}`}
                />
              </label>
            )}
            {unused && (
              <span className="absolute right-1.5 top-1.5 z-10 bg-neutral-900 px-1.5 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900">
                {t.unusedBadge}
              </span>
            )}
            {/* Actions overlay the image bottom (always on touch, hover on desktop).

                `flex-wrap` + `whitespace-nowrap`, and both halves are needed: a tile is ~155px
                wide at 390px and the three labels do not fit on one line there, so the row was
                breaking "Copy URL" through its own middle — the same failure `ui/Button` has a
                comment about, on buttons that never went through it. Wrapping the ROW puts
                "Delete" on a second line instead, which is a layout; breaking a label is not.
                Photographed at 390px on 2026-08-22. */}
            {mode === 'page' && (
              <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-2 py-1.5 text-xs opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button type="button" onClick={onCopy} className={`${TAP} whitespace-nowrap text-white/90 hover:text-white`}>
                  {t.copyUrl}
                </button>
                <a href={m.url} download={m.filename} className={`${TAP} whitespace-nowrap text-white/90 hover:text-white`}>
                  {t.download}
                </a>
                <button type="button" onClick={onDelete} className={`${TAP} whitespace-nowrap font-medium text-white`}>
                  {t.delete}
                </button>
              </div>
            )}
          </div>
          <figcaption className="space-y-0.5 p-2 text-xs">
            <p className="truncate font-medium text-neutral-700 dark:text-neutral-300" title={m.filename}>
              {m.filename}
            </p>
            <p className="truncate text-neutral-500 dark:text-neutral-400" title={`${m.width && m.height ? `${m.width}×${m.height} · ` : ''}${formatBytes(m.size)} · ${formatDate(m.uploadedAt, lang)}`}>
              {m.width && m.height ? `${m.width}×${m.height} · ` : ''}
              {formatBytes(m.size)} · {compactDate(m.uploadedAt, lang)}
            </p>
          </figcaption>
        </figure>
  )
}
