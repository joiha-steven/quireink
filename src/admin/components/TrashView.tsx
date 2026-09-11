// Trash dashboard: four tabs (posts / pages / media / files), each listing the
// soft-deleted items of that kind with Restore + Delete-permanently, plus an
// "Empty trash" button per tab. All destructive actions hit POST /api/trash and
// then router.refresh() so the list re-syncs from the server (the page is
// force-dynamic via the admin layout). No local list state — props are the
// source of truth, a global `pending` flag just disables actions mid-request.
import { useState } from 'react'
import { useRouter } from '@/admin/router'
import type { Post, Page, MediaItem, FileItem, AdminComment, ApiResponse, Note } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { useConfirm } from '@/admin/ui/ConfirmDialog'
import { formatDateTimeShort } from '@/utils'
import { indexIn, lanes } from '@/accent'
import { CONTROL_SM, EmptyState, NOTE_TEXT, PageHeader, Tabs } from './kit'
import { Tick } from '@/admin/ui/Tick'
import { SHEET, SHEET_FOOT, SHEET_TOOL, SHEET_TOOL_DANGER, SheetTop } from './sheet'
import { useAdminT } from './I18nProvider'

type Kind = 'posts' | 'pages' | 'notes' | 'media' | 'files' | 'comments' | 'subscribers'

// The slice of a subscriber the trash row prints. Status rides along so a restored row's
// meaning is visible before restoring it: putting back a confirmed reader is not the same
// act as putting back a bot's pending sign-up.
type TrashedSubscriber = { id: number; email: string; status: string; deletedAt?: string }

export function TrashView({
  posts,
  pages,
  notes,
  media,
  files,
  comments,
  subscribers,
}: {
  posts: Post[]
  pages: Page[]
  notes: Note[]
  media: MediaItem[]
  files: FileItem[]
  comments: AdminComment[]
  subscribers: TrashedSubscriber[]
}) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const ask = useConfirm()
  const [tab, setTab] = useState<Kind>('posts')
  const [pending, setPending] = useState(false)
  const [query, setQuery] = useState('')
  /**
   * WHAT IS TICKED, and it is cleared on every tab change.
   *
   * Ids are only unique WITHIN a kind — a post's slug and a file's URL are different
   * namespaces — so a selection carried across tabs would restore something nobody pointed at.
   */
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const swap = (k: Kind) => { setTab(k); setChosen(new Set()); setQuery('') }
  const pick = (id: string) => setChosen((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  /** Accent-folded, so "cafe" finds "café" — the same rule the write pane's search follows,
   *  including its other half: typed WITH accents, "lề" no longer finds "lệ" (`accent.ts`). */
  const keep = (name: string) => {
    const needle = query.trim()
    return !needle || indexIn(lanes(name), needle) !== -1
  }

  const counts: Record<Kind, number> = {
    posts: posts.length,
    pages: pages.length,
    notes: notes.length,
    media: media.length,
    files: files.length,
    comments: comments.length,
    subscribers: subscribers.length,
  }
  const tabs: { key: Kind; label: string }[] = [
    { key: 'posts', label: `${t.tabPosts} (${counts.posts})` },
    { key: 'pages', label: `${t.tabPages} (${counts.pages})` },
    { key: 'notes', label: `${t.tabNotes} (${counts.notes})` },
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
  // Resolves to whether the owner confirmed the second, stronger question (false = declined
  // or not an in-use error). Other kinds never hit this path.
  async function askInUse(error: string | undefined): Promise<boolean> {
    if (!error?.startsWith('in_use')) return false
    return (await ask({
      title: t.askPurgeInUseTitle.replace('{n}', error.split(':')[1] ?? ''),
      body: t.askPurgeInUseBody,
      confirmLabel: t.askDeleteForever,
      cancelLabel: t.askCancel,
      danger: true,
    })) === 'confirm'
  }

  async function onRestore(kind: Kind, id: string) {
    const { ok } = await act(kind, 'restore', [id])
    notify(ok ? t.restored : t.restoreFailed, ok ? undefined : 'error')
  }
  /** ⚠️ THIS ONE ASKS, and it is the reason the trash asks nothing on the way in: a soft
   *  delete is a decision you can walk back, and this is the moment there is nothing left to
   *  walk back to. The question NAMES the thing — a native `confirm()` took one string, so
   *  "Permanently delete this item?" was the whole of it and which item was left to whichever
   *  row the pointer happened to be over. */
  async function onPurge(kind: Kind, id: string, name: string) {
    const said = await ask({
      title: t.askPurgeTitle.replace('{name}', name),
      body: t.askNoUndo,
      confirmLabel: t.askDeleteForever,
      cancelLabel: t.askCancel,
      danger: true,
    })
    if (said !== 'confirm') return
    let r = await act(kind, 'purge', [id])
    if (!r.ok && r.error?.startsWith('in_use')) {
      if (!(await askInUse(r.error))) return // owner declined — leave it in Trash, no error toast
      r = await act(kind, 'purge', [id], true)
    }
    notify(r.ok ? t.purged : t.purgeFailed, r.ok ? undefined : 'error')
  }
  async function onEmpty(kind: Kind) {
    const said = await ask({
      title: t.askEmptyTrashTitle,
      body: t.askEmptyTrashBody,
      confirmLabel: t.askDeleteForever,
      cancelLabel: t.askCancel,
      danger: true,
    })
    if (said !== 'confirm') return
    let r = await act(kind, 'empty')
    if (!r.ok && r.error?.startsWith('in_use')) {
      if (!(await askInUse(r.error))) return
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
          <Tabs tabs={tabs} value={tab} onChange={swap} size="sm" />
          <span className="flex-1" />
          {counts[tab] > 0 && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.trashSearch}
              aria-label={t.trashSearch}
              className={`${CONTROL_SM} w-full min-w-0 sm:w-48`}
            />
          )}
          {chosen.size > 0 && (
            <button type="button" onClick={() => { void restoreChosen() }} disabled={pending} className={SHEET_TOOL}>
              {t.restore} ({chosen.size})
            </button>
          )}
          {counts[tab] > 0 && (
            <button type="button" onClick={() => onEmpty(tab)} disabled={pending} className={SHEET_TOOL_DANGER}>
              {t.emptyTrash}
            </button>
          )}
        </SheetTop>

        {tab === 'posts' && <SlugTable rows={posts} kind="posts" />}
        {tab === 'pages' && <SlugTable rows={pages} kind="pages" />}
        {tab === 'notes' && <SlugTable rows={notes} kind="notes" />}
        {tab === 'media' && <MediaTable rows={media} />}
        {tab === 'files' && <FileTable rows={files} />}
        {tab === 'comments' && <CommentTable rows={comments} />}
        {tab === 'subscribers' && <SubscriberTable rows={subscribers} />}
        <div className={SHEET_FOOT}>{t.trashHint}</div>
      </div>
    </div>
  )

  /**
   * PUT BACK EVERYTHING TICKED, in one request.
   *
   * `/api/trash` already takes an array of ids — restoring one has always been the
   * single-element case of this — so bulk restore is the endpoint's own shape rather than a
   * loop of calls, and it either all lands or none of it does.
   */
  async function restoreChosen() {
    const ids = [...chosen]
    const r = await act(tab, 'restore', ids)
    if (r.ok) setChosen(new Set())
    notify(r.ok ? t.restored : (r.error ?? t.restoreFailed), r.ok ? undefined : 'error')
  }

  // ----- per-kind tables (kept inline so they share act/onRestore/onPurge) -----

  function Empty() {
    return <div className="p-8"><EmptyState glyph="emptyBox" title={t.trashEmpty} description={t.trashEmptyHint} /></div>
  }

  // A trashed item's row: the thing first, then one line of small print — when it was
  // deleted and the two verbs that decide its fate, both quiet words.
  function Row({ kind, id, name, deletedAt, children }: { kind: Kind; id: string; name: string; deletedAt?: string | null; children: React.ReactNode }) {
    return (
      <li className="border-b border-neutral-100 px-5 py-3 hover:bg-neutral-50/60 dark:border-neutral-800 dark:hover:bg-neutral-800/30">
        <div className="flex items-start gap-3">
          <Tick checked={chosen.has(id)} onChange={() => pick(id)} disabled={pending} className="mt-0.5" />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs text-neutral-500 dark:text-neutral-400">
          {deletedAt && <span className="whitespace-nowrap">{t.colDeletedAt} {formatDateTimeShort(deletedAt)}</span>}
          <span className="ml-auto flex gap-3">
            <button type="button" onClick={() => onRestore(kind, id)} disabled={pending} className={SHEET_TOOL}>
              {t.restore}
            </button>
            <button type="button" onClick={() => onPurge(kind, id, name)} disabled={pending} className={SHEET_TOOL_DANGER}>
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

  function SlugTable({ rows, kind }: { rows: (Post | Page | Note)[]; kind: 'posts' | 'pages' | 'notes' }) {
    if (rows.length === 0) return <Empty />
    return (
      <Rows>
        {rows.filter((r) => keep(r.title || t.untitled)).map((r) => (
          <Row key={r.slug} kind={kind} id={r.slug} name={r.title || t.untitled} deletedAt={r.deletedAt}>
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
        {rows.filter((m) => keep(m.filename)).map((m) => (
          <Row key={m.url} kind="media" id={m.url} name={m.filename} deletedAt={m.deletedAt}>
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
        {rows.filter((f) => keep(f.filename)).map((f) => (
          <Row key={f.url} kind="files" id={f.url} name={f.filename} deletedAt={f.deletedAt}>
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
          <Row key={c.id} kind="comments" id={String(c.id)} name={c.name} deletedAt={c.deletedAt}>
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
          <Row key={s.id} kind="subscribers" id={String(s.id)} name={s.email} deletedAt={s.deletedAt}>
            <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200" title={s.email}>{s.email}</p>
            <p className={NOTE_TEXT}>{statusLabel[s.status] ?? s.status}</p>
          </Row>
        ))}
      </Rows>
    )
  }
}
