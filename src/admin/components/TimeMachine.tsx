// Time machine: a modal listing the last few overwritten versions of a post.
// Restoring loads a revision back into the editor (non-destructive — the current
// version is itself snapshotted on the next save). Fetches GET /api/posts/[slug]/revisions.
import { useEffect, useState } from 'react'
import type { PostRevision, ApiResponse } from '@/types'
import { Button } from '@/admin/ui/Button'
import { formatDateTimeShort } from '@/utils'
import { useAdminT } from './I18nProvider'
import { INSET } from './kit'
import { OVERLAY } from './sheet'

type Props = {
  slug: string
  onRestore: (rev: PostRevision) => void
  onClose: () => void
}

// First ~180 chars of the body, stripped of markdown noise, as a preview.
function preview(content: string): string {
  const text = content.replace(/[#>*`_~\-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 180 ? `${text.slice(0, 180)}…` : text
}

export function TimeMachine({ slug, onRestore, onClose }: Props) {
  const t = useAdminT()
  const [revisions, setRevisions] = useState<PostRevision[] | null>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/posts/${encodeURIComponent(slug)}/revisions`)
      .then((r) => r.json())
      .then((json: ApiResponse<PostRevision[]>) => {
        if (active) setRevisions(json.success && json.data ? json.data : [])
      })
      .catch(() => active && setRevisions([]))
    return () => {
      active = false
    }
  }, [slug])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`flex max-h-[85vh] w-full max-w-2xl flex-col p-5 ${OVERLAY}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t.timeMachine}</h2>
          <Button variant="ghost" onClick={onClose}>{t.close}</Button>
        </div>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">{t.tmIntro}</p>

        <div className="overflow-y-auto">
          {revisions === null ? (
            <p className="py-10 text-center text-neutral-500 dark:text-neutral-400">{t.loading}</p>
          ) : revisions.length === 0 ? (
            <p className="py-10 text-center text-neutral-500 dark:text-neutral-400">{t.tmEmpty}</p>
          ) : (
            <ul className="space-y-3">
              {revisions.map((rev, i) => (
                <li
                  key={rev.savedAt}
                  className={INSET}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {rev.title || t.untitled}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        {i === 0 ? `${t.tmLatest} · ` : ''}{formatDateTimeShort(rev.savedAt)}
                      </div>
                    </div>
                    <Button variant="secondary" onClick={() => onRestore(rev)}>{t.restore}</Button>
                  </div>
                  {preview(rev.content) && (
                    <p className="mt-2 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300">
                      {preview(rev.content)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}