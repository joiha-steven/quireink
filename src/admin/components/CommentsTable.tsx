// The moderation queue as ONE SHEET (the admin-pages mock, page 3): the COMMENT is the
// thing, so each row is two lines of its text with everything the admin knows — who,
// where, when — as one line of small print underneath. It was a six-column spreadsheet
// stretched across the workspace, and the owner's verdict on that register was "thua xa
// trang write": a moderator moderates by READING.
//
// Short rows fill TWO newspaper columns from lg up (`.paper-cols`) — one column left
// half the sheet blank, which the owner read as a hole. The search reaches the text,
// the name and the post title, and paints its hits with the pen (`Marked`).
//
// Delete is a soft delete (moves to Trash); the row drops from the list on success.
// The text is collapsed to two lines — click it to expand, click again to collapse.
import { useState } from 'react'
import type { AdminComment, ApiResponse } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { formatDateTimeShort, foldAccents } from '@/utils'
import { PageHeader, EmptyState } from './kit'
import { SHEET, SHEET_FOOT, SHEET_TOOL, SheetTop } from './sheet'
import { Marked } from './Marked'
import { useAdminT } from './I18nProvider'

export function CommentsTable({ initial }: { initial: AdminComment[] }) {
  const t = useAdminT()
  const { notify } = useToast()
  const [rows, setRows] = useState(initial)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState('')

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

  const needle = foldAccents(query.trim())
  const shown = needle
    ? rows.filter((c) => foldAccents(`${c.content} ${c.name} ${c.postTitle ?? ''}`).includes(needle))
    : rows

  if (initial.length === 0) {
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
      <div className={SHEET}>
        <SheetTop>
          <span className={SHEET_TOOL}>{rows.length.toLocaleString()} {t.commentsNavTitle.toLowerCase()}</span>
          <span className="flex-1" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.commentsSearch}
            aria-label={t.commentsSearch}
            className="h-8 w-56 rounded-md border border-neutral-200 bg-white px-3 text-sm placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:placeholder:text-neutral-500"
          />
        </SheetTop>
        {shown.length === 0 ? (
          <p className="px-5 py-8 text-sm text-neutral-500 dark:text-neutral-400">{t.filterEmpty}</p>
        ) : (
          <ul className="paper-cols">
            {shown.map((c) => (
              <li key={c.id} className="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  className="block w-full text-left text-sm text-neutral-800 dark:text-neutral-200"
                  aria-expanded={expanded.has(c.id)}
                >
                  <span className={expanded.has(c.id) ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}>
                    <Marked text={c.content} needle={query} />
                  </span>
                </button>
                {/* One line of small print, the row's whole ledger. The name leads because
                    a moderator's second question (after "what does it say") is "who". */}
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="font-medium text-neutral-600 dark:text-neutral-300"><Marked text={c.name} needle={query} /></span>
                  {c.email && <span className="truncate">{c.email}</span>}
                  <span aria-hidden>·</span>
                  <a
                    href={`/${c.postSlug}`}
                    target="_blank"
                    rel="noopener"
                    title={c.postTitle}
                    className="max-w-[16rem] truncate hover:text-neutral-700 hover:underline dark:hover:text-neutral-300"
                  >
                    <Marked text={c.postTitle ?? c.postSlug} needle={query} />
                  </a>
                  <span aria-hidden>·</span>
                  <span className="whitespace-nowrap">{formatDateTimeShort(c.createdAt)}</span>
                  {c.ip && (
                    <span className="whitespace-nowrap">
                      · {c.ip}
                      {c.country && ` (${c.country})`}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => { void handleDelete(c.id) }}
                    className="ml-auto font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                  >
                    {t.commentsColDelete}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className={SHEET_FOOT}>{t.commentsFootHint}</div>
      </div>
    </div>
  )
}
