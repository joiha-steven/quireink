// Admin comments table: content, post, time, name, IP, delete. Delete is a soft
// delete (moves to Trash); the row drops from the list on success. The content cell
// is collapsed to two lines by default — click it to expand to the full text, click
// again to collapse (each row, replies included, toggles on its own).
import { useState } from 'react'
import type { AdminComment, ApiResponse } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { formatDateTimeShort } from '@/utils'
import { PageHeader, TableFrame, THEAD, TROW, EmptyState } from './kit'
import { useAdminT } from './I18nProvider'

export function CommentsTable({ initial }: { initial: AdminComment[] }) {
  const t = useAdminT()
  const { notify } = useToast()
  const [rows, setRows] = useState(initial)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDelete(id: number) {
    if (!confirm(t.commentsConfirmDelete)) return
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      setRows((prev) => prev.filter((c) => c.id !== id))
      notify(t.movedToTrash)
    } catch {
      notify(t.deleteFailed, 'error')
    }
  }

  if (rows.length === 0) {
    return (
      <div>
        <PageHeader title={t.commentsNavTitle} />
        <EmptyState title={t.commentsEmpty} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={t.commentsNavTitle} />
      <TableFrame>
          <thead className={THEAD}>
            <tr>
              {/* The comment takes the slack — see `PostsTable`. */}
              <th className="w-full px-4 py-3 font-medium">{t.commentsColContent}</th>
              {/* `min-w`, not `max-w`. The comment column claims every spare pixel, so an
                  auto-layout table squeezed this one to its longest WORD — measured at 97px,
                  in which "The golden canon, and the arithmetic under it" wrapped to five
                  lines and made every row 145px tall. The row was then sized by the column
                  that matters least, while the comment beside it stayed clamped at two lines
                  inside all that height. A minimum reserves the width; the clamp below stops
                  a long title setting the row height ever again. */}
              <th className="hidden min-w-[11rem] px-4 py-3 font-medium md:table-cell">{t.commentsColPost}</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">{t.commentsColTime}</th>
              <th className="px-4 py-3 font-medium">{t.commentsColName}</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">{t.commentsColIp}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className={TROW}>
                <td className="max-w-xs px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    className="block w-full text-left text-neutral-700 dark:text-neutral-300"
                    aria-expanded={expanded.has(c.id)}
                  >
                    <span className={expanded.has(c.id) ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}>
                      {c.content}
                    </span>
                  </button>
                </td>
                <td className="hidden min-w-[11rem] max-w-[16rem] px-4 py-3 md:table-cell">
                  {/* Clamped to two lines, and `title` so the rest is still one hover away —
                      the same bargain the comment cell makes one column to the left. */}
                  <a
                    href={`/${c.postSlug}`}
                    target="_blank"
                    rel="noopener"
                    title={c.postTitle}
                    className="line-clamp-2 break-words text-neutral-500 hover:underline dark:text-neutral-400"
                  >
                    {c.postTitle}
                  </a>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-neutral-500 sm:table-cell dark:text-neutral-400">
                  {formatDateTimeShort(c.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-neutral-800 dark:text-neutral-200">{c.name}</div>
                  {c.email && <div className="text-xs text-neutral-400 dark:text-neutral-500">{c.email}</div>}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-neutral-500 sm:table-cell dark:text-neutral-400">
                  {c.ip ? (
                    <span className="text-xs">
                      {c.ip}
                      {c.country && ` (${c.country})`}
                    </span>
                  ) : (
                    <span className="text-neutral-300 dark:text-neutral-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="text-xs font-medium text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
                  >
                    {t.commentsColDelete}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
      </TableFrame>
    </div>
  )
}
