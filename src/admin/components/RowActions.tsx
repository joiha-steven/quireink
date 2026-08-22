// Compact icon buttons for a content row: open-in-new-tab + edit (pencil) +
// delete (trash). The icon set + button chrome are exported so other admin lists
// (e.g. the taxonomy manager) reuse the exact same look.
import Link from '@/admin/router'
import { useAdminT } from './I18nProvider'

export function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20h4l10-10a2 2 0 0 0-3-3L5 17v3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13.5 6.5l3 3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
export function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
export function ExternalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 4h6v6M20 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// One shared icon-button style for every admin row action.
export const ICON_BTN =
  'flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white'

export function RowActions({
  editHref,
  viewHref,
  onDelete,
}: {
  editHref: string
  viewHref?: string
  onDelete: () => void
}) {
  const t = useAdminT()
  return (
    <div className="flex items-center justify-end gap-1">
      {viewHref && (
        <a href={viewHref} target="_blank" rel="noopener noreferrer" aria-label={t.openInNewTab} title={t.openInNewTab} className={ICON_BTN}>
          <ExternalIcon />
        </a>
      )}
      <Link href={editHref} aria-label={t.edit} title={t.edit} className={ICON_BTN}>
        <PencilIcon />
      </Link>
      <button type="button" onClick={onDelete} aria-label={t.delete} title={t.delete} className={ICON_BTN}>
        <TrashIcon />
      </button>
    </div>
  )
}

// Monochrome status pill (no color): published vs draft. Never wraps.
export function StatusPill({ published, label }: { published: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-neutral-600 dark:text-neutral-300">
      <span className={`h-1.5 w-1.5 ${published ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-600'}`} aria-hidden />
      {label}
    </span>
  )
}
