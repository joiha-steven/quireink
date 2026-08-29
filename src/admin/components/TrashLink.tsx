// Move this piece to the Trash: the last thing in the editor's Attributes panel.
//
// The admin had no way to do this at all. `/admin/trash` has always existed, the API has
// always answered `DELETE /api/posts/:slug`, and the tour has always proved that endpoint —
// by calling it directly. Nothing in the SPA ever called it. It went with the old content
// table in `b4459b4` (2026-08-17), when the Write screen became two panes: `RowActions`
// carried the trash icon and the fetch, and neither was rebuilt into `WritePane`. Reported
// from outside on 2026-08-29 (issue #60), thirteen days and four releases later.
//
// WHERE IT SITS, AND WHY IT MOVED ONCE ALREADY. It went first into the panel's header line
// beside History and View post, and looking at that screen is what settled it: three items
// in one row, one grey, one weight, and the third of them deletes the post. A destructive
// action dressed as a third navigation link. It is at the FOOT of the panel now, under a
// rule of its own, reached by scrolling past everything else — which is the right amount of
// deliberation for the one control that takes the piece off the site.
//
// NOT in the editor's button row: that row is measured and already tight, and at 390px it
// wraps to a second line where a fourth button pushes Publish off the edge.
//
// `danger`, which `ui/Button` describes as the red ballpoint — outlined rather than filled,
// because the loudest thing on a screen should be what you came to do and not what destroys
// work. Publish is the filled button; this one is quieter than it on purpose.
//
// It is a SOFT delete. The row keeps its body, its revisions and its slug, and Trash gives it
// back. The confirmation says so — the string it inherited said the action could not be
// undone, which was never true of this endpoint.

import { useState } from 'react'
import { useRouter } from '@/admin/router'
import { Button } from '@/admin/ui/Button'
import { NOTE_TEXT } from './kit'
import { useAdminT } from './I18nProvider'

export function TrashLink({ kind, slug, onGone }: {
  kind: 'post' | 'page'
  slug: string
  /** Called instead of routing away, so a caller that owns the screen can decide. */
  onGone?: () => void
}) {
  const t = useAdminT()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const move = async () => {
    if (!confirm(kind === 'post' ? t.confirmTrashPost : t.confirmTrashPage)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/${kind === 'post' ? 'posts' : 'pages'}/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      })
      // A failed delete must not navigate: leaving the editor would look like it worked.
      if (!res.ok) { setBusy(false); return }
      if (onGone) onGone()
      else router.push('/admin/content')
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <p className={NOTE_TEXT}>{t.trashNote}</p>
      <Button variant="danger" type="button" size="sm" disabled={busy} onClick={() => void move()}>
        {t.moveToTrash}
      </Button>
    </div>
  )
}
