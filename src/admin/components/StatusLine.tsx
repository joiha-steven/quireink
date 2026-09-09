// The write pane's second question — WHERE a piece stands — and the order of the list.
//
// Two lamps with their words, and the sort cycle at the far end. The lamps are the ones
// every row already wears (amber: waiting on you; green: done), so pressing "Drafts" lights
// the amber that marks a draft, and both unlit is everything. Its own file because the pane
// is at its 400-line cap, and because a control that is a question of its own reads better
// as a thing of its own.
import { Lamp } from '@/admin/ui/Lamp'
import { useAdminT } from './I18nProvider'
import { SHEET_TOOL } from './sheet'
import type { WriteSort, WriteStatus } from './useWritingItems'

/** A status lamp that is ON: the same small print, in ink. Derived, so the two differ by
 *  exactly the ink, the way `SHEET_TOOL_DANGER` is derived from the same line. */
const STATUS_ON = SHEET_TOOL
  .replace('text-neutral-500', 'font-medium text-neutral-900')
  .replace('dark:text-neutral-400', 'dark:text-white')

export function StatusLine({
  status,
  onStatus,
  sort,
  onSort,
}: {
  status: WriteStatus
  onStatus: (s: WriteStatus) => void
  sort: WriteSort
  onSort: (s: WriteSort) => void
}) {
  const t = useAdminT()
  const lamp = (value: Exclude<WriteStatus, 'all'>, label: string, lit: 'attention' | 'good') => {
    const on = status === value
    return (
      <button
        type="button"
        aria-pressed={on}
        data-write-status={value}
        onClick={() => onStatus(on ? 'all' : value)}
        className={`${on ? STATUS_ON : SHEET_TOOL} inline-flex items-center gap-1.5`}
      >
        <Lamp state={on ? lit : 'off'} />
        {label}
      </button>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex gap-3">
        {lamp('draft', t.scopeDrafts, 'attention')}
        {lamp('published', t.scopePublished, 'good')}
      </span>
      <button
        type="button"
        onClick={() => onSort(sort === 'updated' ? 'created' : 'updated')}
        className={SHEET_TOOL}
      >
        ↓ {sort === 'updated' ? t.sortUpdated : t.sortCreated}
      </button>
    </div>
  )
}
