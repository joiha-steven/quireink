// Pages list (no chrome): title + status only, with per-row edit/delete.
import { useState } from 'react'
import Link from '@/admin/router'
import { useRouter } from '@/admin/router'
import type { Page, ApiResponse } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { RowActions, StatusPill } from './RowActions'
import { EmptyState, TableFrame, THEAD, TROW } from './kit'
import { useAdminT } from './I18nProvider'

export function PagesTable({ initialPages, views }: { initialPages: Page[]; views: Record<string, number> }) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [pages, setPages] = useState(initialPages)

  async function handleDelete(slug: string) {
    if (!confirm(t.confirmDeletePage)) return
    try {
      const res = await fetch(`/api/pages/${slug}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      setPages((prev) => prev.filter((p) => p.slug !== slug))
      notify(t.movedToTrash)
      router.refresh()
    } catch {
      notify(t.deleteFailed, 'error')
    }
  }

  if (pages.length === 0) {
    return <EmptyState title={t.noPages} />
  }

  return (
    <TableFrame>
        <thead className={THEAD}>
          <tr>
            <th className="px-4 py-3 font-medium">{t.colTitle}</th>
            <th className="px-4 py-3 font-medium">{t.colStatus}</th>
            <th className="hidden px-4 py-3 font-medium text-right sm:table-cell">{t.colViews}</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">{t.slug}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {pages.map((p) => (
            <tr key={p.slug} className={`transition-colors ${TROW}`}>
              <td className="px-4 py-3 font-medium">
                <Link href={`/admin/page-editor/${p.slug}`} className="hover:underline">
                  {p.title || t.untitled}
                </Link>
              </td>
              <td className="px-4 py-3">
                <StatusPill published={p.status === 'published'} label={p.status === 'published' ? t.statusPublished : t.statusDraft} />
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums text-neutral-500 sm:table-cell dark:text-neutral-400">{(views[`/${p.slug}`] ?? 0).toLocaleString()}</td>
              <td className="hidden px-4 py-3 text-neutral-500 sm:table-cell dark:text-neutral-400">/{p.slug}</td>
              <td className="px-4 py-3">
                <RowActions
                  editHref={`/admin/page-editor/${p.slug}`}
                  viewHref={p.status === 'published' ? `/${p.slug}` : undefined}
                  onDelete={() => handleDelete(p.slug)}
                />
              </td>
            </tr>
          ))}
        </tbody>
    </TableFrame>
  )
}
