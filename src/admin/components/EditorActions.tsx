// The editor's action bar: where you came from, whether the work is saved, and the two
// buttons that end a writing session.
//
// Split out of `PostForm` when it passed its 400-line cap. The seam is deliberate: this is
// the only chrome on a screen that is otherwise a sheet of paper, and the decision it now
// carries — that the FIRST publish opens the attributes rather than publishing — belongs
// next to the button that makes it, not buried in a 400-line form (ADR 0024, step 5).
import Link from '@/admin/router'
import { Button } from '@/admin/ui/Button'
import { useAdminT } from './I18nProvider'
import type { RefObject } from 'react'

export function EditorActions({
  barRef,
  status,
  saving,
  dirty,
  settingsOpen,
  onToggleSettings,
  savedSlug,
  onPreview,
  onSaveDraft,
  onPublish,
  publishLabel,
  published,
}: {
  barRef: RefObject<HTMLDivElement | null>
  /** The "saved 12:04" / "unsaved" line, already assembled by `saveStatusLine`. */
  status: string
  saving: boolean
  dirty: boolean
  settingsOpen: boolean
  onToggleSettings: () => void
  savedSlug: string | null
  onPreview: () => void
  onSaveDraft: () => void
  onPublish: () => void
  publishLabel: string
  published: boolean
}) {
  const t = useAdminT()
  return (
    <div
      ref={barRef}
      className="z-20 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-xl lg:sticky lg:top-4 dark:border-neutral-800 dark:bg-neutral-900/95"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/admin/content" className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
          ← {t.navWrite}
        </Link>
        <span className="hidden h-4 w-px bg-neutral-200 sm:block dark:bg-neutral-800" />
        <span className="text-sm text-neutral-500 dark:text-neutral-400">{status}</span>
      </div>
      <div className="flex items-center gap-2">
        {/* `<Button variant="secondary">`, not a fifth copy of it. This was the whole class
            list re-typed — one border shade off, its own hover, and a `shadow-sm` in an
            admin that draws none. */}
        <Button variant="secondary" type="button" onClick={onToggleSettings}>
          {settingsOpen ? t.hideAttributes : t.attributes}
        </Button>
        {savedSlug && (
          <button type="button" onClick={onPreview} className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
            {t.previewDraft}
          </button>
        )}
        <Button variant="secondary" onClick={onSaveDraft} disabled={saving || !dirty}>
          {t.saveDraft}
        </Button>
        <Button onClick={onPublish} disabled={saving || (!dirty && published)}>
          {publishLabel}
        </Button>
      </div>
    </div>
  )
}
