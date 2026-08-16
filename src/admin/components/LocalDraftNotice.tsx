// "There is newer work on this device than on the server."
//
// Shown when the last session closed or crashed with unsaved changes: `useLocalDraft` stashes
// in-progress writing in localStorage and never sends it to the server on its own, so the
// only way it comes back is for the author to say so here.
//
// Its own file because `PostForm` reached its size cap, and this is a whole interaction —
// two buttons and a decision about somebody's unsaved words — rather than a line of layout.
import { Button } from '@/admin/ui/Button'
import { formatTime } from '@/utils'
import { useAdminT } from './I18nProvider'
import { NOTICE } from './kit'

export function LocalDraftNotice({
  at,
  onRestore,
  onDiscard,
}: {
  /** ISO time the local snapshot was taken. */
  at: string
  onRestore: () => void
  onDiscard: () => void
}) {
  const t = useAdminT()
  return (
    <div className={`mb-4 ${NOTICE}`}>
      <span className="text-neutral-800 dark:text-neutral-200">
        {t.localDraftFound} · {formatTime(at)}
      </span>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onRestore}>
          {t.localDraftRestore}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
          {t.localDraftDiscard}
        </Button>
      </div>
    </div>
  )
}
