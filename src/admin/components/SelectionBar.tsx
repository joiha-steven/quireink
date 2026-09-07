// "Clear · Delete (n)", the bar the file and video libraries raise once something is ticked.
//
// Both had it written out longhand, byte-identical, and neither had the tap target: `TAP` is
// on the row buttons three lines above it in `FileLibrary` but not on this pair, so the two
// controls that DELETE were the smallest thing to hit on the screen — the 16px line box the
// kit measured at four widths and wrote `TAP` to fix.
//
// Its own file rather than `kit.tsx`, which says at the top that its primitives are pure
// presentation and take no hooks. This one reads the translations.
import type { ReactNode } from 'react'
import { useAdminT } from './I18nProvider'
import { TAP } from './kit'

export function SelectionBar(
  { count, onClear, onDelete, actions }: {
    count: number
    onClear: () => void
    onDelete: () => void
    /**
     * Anything else this list can do to a selection, drawn BEFORE Delete.
     *
     * The order is the point: the one irreversible verb sits at the end of the row, where a
     * hand travelling left to right arrives at it last. Export sits before it for the same
     * reason Cancel sits before Save everywhere else in this admin.
     */
    actions?: ReactNode
  },
) {
  const t = useAdminT()
  if (count === 0) return null
  return (
    <div className="flex flex-wrap items-center justify-end gap-4">
      <button type="button" onClick={onClear} className={`${TAP} text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white`}>
        {t.clearSelection}
      </button>
      {actions}
      <button type="button" onClick={onDelete} className={`${TAP} text-sm font-medium text-neutral-800 hover:text-black dark:text-neutral-200 dark:hover:text-white`}>
        {t.deleteSelected} ({count})
      </button>
    </div>
  )
}
