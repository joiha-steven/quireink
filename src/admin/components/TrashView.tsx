// Trash dashboard: four tabs (posts / pages / media / files), each listing the
// soft-deleted items of that kind with Restore + Delete-permanently, plus an
// "Empty trash" button per tab. All destructive actions hit POST /api/trash and
// then router.refresh() so the list re-syncs from the server (the page is
// force-dynamic via the admin layout). No local list state — props are the
// source of truth, a global `pending` flag just disables actions mid-request.
import { useState } from 'react'
import { useRouter } from '@/admin/router'
import type { Post, Page, MediaItem, FileItem, AdminComment, ApiResponse } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { formatDateTimeShort } from '@/utils'
import { EmptyState, PageHeader, TableFrame, Tabs, THEAD } from './kit'
import { useAdminT } from './I18nProvider'

type Kind = 'posts' | 'pages' | 'media' | 'files' | 'comments'

// Shared chrome for the two row actions so they can't drift (admin tooling may
// stay neutral — see Conventions).
const ACTION_BTN =
  'rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'

export function TrashView({
  posts,
  pages,
  media,
  files,
  comments,
}: {
  posts: Post[]
  pages: Page[]
  media: MediaItem[]
  files: FileItem[]
  comments: AdminComment[]
}) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [tab, setTab] = useState<Kind>('posts')
  const [pending, setPending] = useState(false)

  const counts: Record<Kind, number> = {
    posts: posts.length,
    pages: pages.length,
    media: media.length,
    files: files.length,
    comments: comments.length,
  }
  const tabs: { key: Kind; label: string }[] = [
    { key: 'posts', label: `${t.tabPosts} (${counts.posts})` },
    { key: 'pages', label: `${t.tabPages} (${counts.pages})` },
    { key: 'media', label: `${t.tabImages} (${counts.media})` },
    { key: 'files', label: `${t.tabFiles} (${counts.files})` },
    { key: 'comments', label: `${t.commentsNavTitle} (${counts.comments})` },
  ]

  async function act(
    kind: Kind,
    action: 'restore' | 'purge' | 'empty',
    ids?: string[],
    force?: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    setPending(true)
    try {
      const res = await fetch('/api/trash', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, action, ids, force }),
      })
      const json = (await res.json()) as ApiResponse
      if (!json.success) return { ok: false, error: json.error }
      router.refresh()
      return { ok: true }
    } catch {
      return { ok: false }
    } finally {
      setPending(false)
    }
  }

  // A media purge/empty may come back `in_use:<n>` (image still used by a live page).
  // Returns whether the owner confirmed the second, stronger prompt (false = declined
  // or not an in-use error). Other kinds never hit this path.
  function askInUse(error: string | undefined): boolean {
    if (!error?.startsWith('in_use')) return false
    return confirm(t.confirmPurgeInUse.replace('{n}', error.split(':')[1] ?? ''))
  }

  async function onRestore(kind: Kind, id: string) {
    const { ok } = await act(kind, 'restore', [id])
    notify(ok ? t.restored : t.restoreFailed, ok ? undefined : 'error')
  }
  async function onPurge(kind: Kind, id: string) {
    if (!confirm(t.confirmPurge)) return
    let r = await act(kind, 'purge', [id])
    if (!r.ok && r.error?.startsWith('in_use')) {
      if (!askInUse(r.error)) return // owner declined — leave it in Trash, no error toast
      r = await act(kind, 'purge', [id], true)
    }
    notify(r.ok ? t.purged : t.purgeFailed, r.ok ? undefined : 'error')
  }
  async function onEmpty(kind: Kind) {
    if (!confirm(t.confirmEmptyTrash)) return
    let r = await act(kind, 'empty')
    if (!r.ok && r.error?.startsWith('in_use')) {
      if (!askInUse(r.error)) return
      r = await act(kind, 'empty', undefined, true)
    }
    notify(r.ok ? t.trashEmptied : t.purgeFailed, r.ok ? undefined : 'error')
  }

  return (
    <div>
      <PageHeader title={t.trashTitle} description={t.trashHint} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        {counts[tab] > 0 && (
          <button type="button" onClick={() => onEmpty(tab)} disabled={pending} className={ACTION_BTN}>
            {t.emptyTrash}
          </button>
        )}
      </div>

      {tab === 'posts' && <SlugTable rows={posts} kind="posts" />}
      {tab === 'pages' && <SlugTable rows={pages} kind="pages" />}
      {tab === 'media' && <MediaTable rows={media} />}
      {tab === 'files' && <FileTable rows={files} />}
      {tab === 'comments' && <CommentTable rows={comments} />}
    </div>
  )

  // ----- per-kind tables (kept inline so they share act/onRestore/onPurge) -----

  function Empty() {
    return <EmptyState title={t.trashEmpty} />
  }

  function Shell({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
    return (
      <TableFrame>
          <thead className={THEAD}>
            <tr>
              <th className="px-4 py-3 font-medium">{t.colTitle}</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">{t.colDeletedAt}</th>
              <th className="px-4 py-3">{head}</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
      </TableFrame>
    )
  }

  function Actions({ kind, id }: { kind: Kind; id: string }) {
    return (
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button type="button" onClick={() => onRestore(kind, id)} disabled={pending} className={ACTION_BTN}>
            {t.restore}
          </button>
          <button type="button" onClick={() => onPurge(kind, id)} disabled={pending} className={ACTION_BTN}>
            {t.deletePermanently}
          </button>
        </div>
      </td>
    )
  }

  function SlugTable({ rows, kind }: { rows: (Post | Page)[]; kind: 'posts' | 'pages' }) {
    if (rows.length === 0) return <Empty />
    return (
      <Shell head="">
        {rows.map((r) => (
          <tr key={r.slug} className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40">
            <td className="px-4 py-3 font-medium">{r.title || t.untitled}</td>
            <td className="hidden whitespace-nowrap px-4 py-3 text-neutral-500 sm:table-cell dark:text-neutral-400">
              {r.deletedAt ? formatDateTimeShort(r.deletedAt) : ''}
            </td>
            <Actions kind={kind} id={r.slug} />
          </tr>
        ))}
      </Shell>
    )
  }

  function MediaTable({ rows }: { rows: MediaItem[] }) {
    if (rows.length === 0) return <Empty />
    return (
      <Shell head="">
        {rows.map((m) => (
          <tr key={m.url} className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40">
            <td className="px-4 py-3">
              <div className="flex items-center gap-3">
                <img src={m.thumb || m.url} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded object-cover" />
                <span className="truncate font-medium">{m.filename}</span>
              </div>
            </td>
            <td className="hidden whitespace-nowrap px-4 py-3 text-neutral-500 sm:table-cell dark:text-neutral-400">
              {m.deletedAt ? formatDateTimeShort(m.deletedAt) : ''}
            </td>
            <Actions kind="media" id={m.url} />
          </tr>
        ))}
      </Shell>
    )
  }

  function FileTable({ rows }: { rows: FileItem[] }) {
    if (rows.length === 0) return <Empty />
    return (
      <Shell head="">
        {rows.map((f) => (
          <tr key={f.url} className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40">
            <td className="px-4 py-3 font-medium">{f.filename}</td>
            <td className="hidden whitespace-nowrap px-4 py-3 text-neutral-500 sm:table-cell dark:text-neutral-400">
              {f.deletedAt ? formatDateTimeShort(f.deletedAt) : ''}
            </td>
            <Actions kind="files" id={f.url} />
          </tr>
        ))}
      </Shell>
    )
  }

  function CommentTable({ rows }: { rows: AdminComment[] }) {
    if (rows.length === 0) return <Empty />
    return (
      <Shell head="">
        {rows.map((c) => (
          <tr key={c.id} className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40">
            <td className="max-w-xs px-4 py-3">
              <p className="line-clamp-1 font-medium">{c.content}</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">{c.name} · {c.postTitle}</p>
            </td>
            <td className="hidden whitespace-nowrap px-4 py-3 text-neutral-500 sm:table-cell dark:text-neutral-400">
              {c.deletedAt ? formatDateTimeShort(c.deletedAt) : ''}
            </td>
            <Actions kind="comments" id={String(c.id)} />
          </tr>
        ))}
      </Shell>
    )
  }
}
