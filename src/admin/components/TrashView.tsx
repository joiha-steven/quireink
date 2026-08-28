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
import { EmptyState, NOTE_TEXT, PageHeader, Tabs } from './kit'
import { SHEET, SHEET_FOOT, SHEET_TOOL, SHEET_TOOL_DANGER, SheetTop } from './sheet'
import { useAdminT } from './I18nProvider'

type Kind = 'posts' | 'pages' | 'media' | 'files' | 'comments' | 'subscribers'

// The slice of a subscriber the trash row prints. Status rides along so a restored row's
// meaning is visible before restoring it: putting back a confirmed reader is not the same
// act as putting back a bot's pending sign-up.
type TrashedSubscriber = { id: number; email: string; status: string; deletedAt?: string }

export function TrashView({
  posts,
  pages,
  media,
  files,
  comments,
  subscribers,
}: {
  posts: Post[]
  pages: Page[]
  media: MediaItem[]
  files: FileItem[]
  comments: AdminComment[]
  subscribers: TrashedSubscriber[]
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
    subscribers: subscribers.length,
  }
  const tabs: { key: Kind; label: string }[] = [
    { key: 'posts', label: `${t.tabPosts} (${counts.posts})` },
    { key: 'pages', label: `${t.tabPages} (${counts.pages})` },
    { key: 'media', label: `${t.tabImages} (${counts.media})` },
    { key: 'files', label: `${t.tabFiles} (${counts.files})` },
    { key: 'comments', label: `${t.commentsNavTitle} (${counts.comments})` },
    // The Newsletter screen's own word for the same people, so the two never disagree.
    { key: 'subscribers', label: `${t.nlTabPeople} (${counts.subscribers})` },
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
    // ONE SHEET (the admin-pages mock, page 5): kind tabs on the sheet's first row with
    // "empty this kind" as a quiet tool beside them; each item is a row — the thing
    // first, the deletion date and the two verbs as small print after it.
    <div>
      <PageHeader title={t.trashTitle} />
      <div className={SHEET}>
        <SheetTop>
          <Tabs tabs={tabs} value={tab} onChange={setTab} size="sm" />
          <span className="flex-1" />
          {counts[tab] > 0 && (
            <button type="button" onClick={() => onEmpty(tab)} disabled={pending} className={SHEET_TOOL_DANGER}>
              {t.emptyTrash}
            </button>
          )}
        </SheetTop>

        {tab === 'posts' && <SlugTable rows={posts} kind="posts" />}
        {tab === 'pages' && <SlugTable rows={pages} kind="pages" />}
        {tab === 'media' && <MediaTable rows={media} />}
        {tab === 'files' && <FileTable rows={files} />}
        {tab === 'comments' && <CommentTable rows={comments} />}
        {tab === 'subscribers' && <SubscriberTable rows={subscribers} />}
        <div className={SHEET_FOOT}>{t.trashHint}</div>
      </div>
    </div>
  )

  // ----- per-kind tables (kept inline so they share act/onRestore/onPurge) -----

  function Empty() {
    return <div className="p-8"><EmptyState title={t.trashEmpty} /></div>
  }

  // A trashed item's row: the thing first, then one line of small print — when it was
  // deleted and the two verbs that decide its fate, both quiet words.
  function Row({ kind, id, deletedAt, children }: { kind: Kind; id: string; deletedAt?: string | null; children: React.ReactNode }) {
    return (
      <li className="border-b border-neutral-100 px-5 py-3 hover:bg-neutral-50/60 dark:border-neutral-800 dark:hover:bg-neutral-800/30">
        {children}
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs text-neutral-500 dark:text-neutral-400">
          {deletedAt && <span className="whitespace-nowrap">{t.colDeletedAt} {formatDateTimeShort(deletedAt)}</span>}
          <span className="ml-auto flex gap-3">
            <button type="button" onClick={() => onRestore(kind, id)} disabled={pending} className={SHEET_TOOL}>
              {t.restore}
            </button>
            <button type="button" onClick={() => onPurge(kind, id)} disabled={pending} className={SHEET_TOOL_DANGER}>
              {t.deletePermanently}
            </button>
          </span>
        </div>
      </li>
    )
  }

  function Rows({ children }: { children: React.ReactNode }) {
    return <ul className="paper-cols">{children}</ul>
  }

  function SlugTable({ rows, kind }: { rows: (Post | Page)[]; kind: 'posts' | 'pages' }) {
    if (rows.length === 0) return <Empty />
    return (
      <Rows>
        {rows.map((r) => (
          <Row key={r.slug} kind={kind} id={r.slug} deletedAt={r.deletedAt}>
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{r.title || t.untitled}</p>
          </Row>
        ))}
      </Rows>
    )
  }

  function MediaTable({ rows }: { rows: MediaItem[] }) {
    if (rows.length === 0) return <Empty />
    return (
      <Rows>
        {rows.map((m) => (
          <Row key={m.url} kind="media" id={m.url} deletedAt={m.deletedAt}>
            <div className="flex items-center gap-3">
              <img src={m.thumb || m.url} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-md object-cover" />
              <span className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">{m.filename}</span>
            </div>
          </Row>
        ))}
      </Rows>
    )
  }

  function FileTable({ rows }: { rows: FileItem[] }) {
    if (rows.length === 0) return <Empty />
    return (
      <Rows>
        {rows.map((f) => (
          <Row key={f.url} kind="files" id={f.url} deletedAt={f.deletedAt}>
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{f.filename}</p>
          </Row>
        ))}
      </Rows>
    )
  }

  function CommentTable({ rows }: { rows: AdminComment[] }) {
    if (rows.length === 0) return <Empty />
    return (
      <Rows>
        {rows.map((c) => (
          <Row key={c.id} kind="comments" id={String(c.id)} deletedAt={c.deletedAt}>
            <p className="line-clamp-1 text-sm text-neutral-800 dark:text-neutral-200">{c.content}</p>
            <p className={NOTE_TEXT}>{c.name} · {c.postTitle}</p>
          </Row>
        ))}
      </Rows>
    )
  }

  function SubscriberTable({ rows }: { rows: TrashedSubscriber[] }) {
    if (rows.length === 0) return <Empty />
    const statusLabel: Record<string, string> = {
      confirmed: t.nlConfirmed, pending: t.nlPending, unsubscribed: t.nlUnsub,
    }
    return (
      <Rows>
        {rows.map((s) => (
          <Row key={s.id} kind="subscribers" id={String(s.id)} deletedAt={s.deletedAt}>
            <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200" title={s.email}>{s.email}</p>
            <p className={NOTE_TEXT}>{statusLabel[s.status] ?? s.status}</p>
          </Row>
        ))}
      </Rows>
    )
  }
}
