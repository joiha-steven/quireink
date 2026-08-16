// One list of everything written — posts and pages, drafts and published, most recently
// touched first (ADR 0024, step 2).
//
// It replaces two tables that were two TABS, which meant finding a thing required knowing
// which drawer it was in before looking for it. Posts and pages already share the `/{slug}`
// namespace (invariant 2) and now share the search index too, so the split was in the
// screen only.
//
// The row shows the WRITING: a title and the line under it. Views and comments stay, at the
// right, where a number belongs — but they are no longer what the eye lands on first.
import { useEffect, useMemo, useState } from 'react'
import Link from '@/admin/router'
import { useRouter } from '@/admin/router'
import type { Post, Page, ApiResponse } from '@/types'
// Type-only, and it must stay that way: the module it comes from opens the database.
import type { OwnerHit } from '@/content/search-owner'
import { useToast } from '@/admin/ui/Toast'
import { formatDateTimeShort, foldAccents } from '@/utils'
import { RowActions, StatusPill } from './RowActions'
import { CLUSTER_GAP, CONTROL, EmptyState, TableFrame, Tabs, THEAD, TROW } from './kit'
import { useAdminT } from './I18nProvider'

type Scope = 'all' | 'published' | 'draft'

/** Posts and pages, flattened to the few things a row actually renders. */
type Item = {
  kind: 'post' | 'page'
  slug: string
  title: string
  status: string
  /** Sort key: last save, falling back to the publication date a post always has. */
  touched: number
  /** The second line when nothing was searched for: a post's excerpt, a page's address. */
  standing: string
  terms: string
  editHref: string
  viewHref?: string
}

const stamp = (iso?: string): number => (iso ? new Date(iso).getTime() : 0)

export function WritingList({
  initialPosts,
  initialPages,
  views,
  commentCounts,
  commentsEnabled,
}: {
  initialPosts: Post[]
  initialPages: Page[]
  views: Record<string, number>
  commentCounts: Record<string, number>
  commentsEnabled: boolean
}) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [posts, setPosts] = useState(initialPosts)
  const [pages, setPages] = useState(initialPages)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<Scope>('all')

  // Where the words were found, keyed by `kind:slug`. Null means the server has not answered
  // for this query yet, which is NOT the same as "nothing matched" — see the empty state.
  const [bodyHits, setBodyHits] = useState<Map<string, string> | null>(null)

  const items = useMemo<Item[]>(() => {
    const fromPosts = posts.map<Item>((p) => ({
      kind: 'post',
      slug: p.slug,
      title: p.title,
      status: p.status,
      touched: stamp(p.updatedAt) || stamp(p.date),
      standing: p.excerpt ?? '',
      terms: [p.tags.join(' '), p.categories.join(' ')].join(' '),
      editHref: `/admin/editor/${p.slug}`,
      viewHref: p.status === 'published' ? `/${p.slug}` : undefined,
    }))
    const fromPages = pages.map<Item>((p) => ({
      kind: 'page',
      slug: p.slug,
      title: p.title,
      status: p.status,
      touched: stamp(p.updatedAt),
      standing: `/${p.slug}`,
      terms: '',
      editHref: `/admin/page-editor/${p.slug}`,
      viewHref: p.status === 'published' ? `/${p.slug}` : undefined,
    }))
    return [...fromPosts, ...fromPages].sort((a, b) => b.touched - a.touched)
  }, [posts, pages])

  // The body search is the SERVER's, because the body is not here: this component is handed
  // metadata and nothing else. Debounced, because it runs per keystroke.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setBodyHits(null)
      return
    }
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`)
          const json = (await res.json()) as ApiResponse<{ hits: OwnerHit[] }>
          setBodyHits(new Map((json.data?.hits ?? []).map((h) => [`${h.kind}:${h.slug}`, h.line])))
        } catch {
          // A failed search leaves the title match working rather than emptying the screen.
          setBodyHits(null)
        }
      })()
    }, 180)
    return () => clearTimeout(timer)
  }, [query])

  const needle = foldAccents(query.trim())
  const shown = useMemo(() => {
    return items.filter((it) => {
      if (scope !== 'all' && it.status !== scope) return false
      if (!needle) return true
      if (foldAccents(`${it.title} ${it.terms}`).includes(needle)) return true
      return bodyHits?.has(`${it.kind}:${it.slug}`) ?? false
    })
  }, [items, scope, needle, bodyHits])

  async function handleDelete(it: Item) {
    const ask = it.kind === 'post' ? t.confirmDeletePost : t.confirmDeletePage
    if (!confirm(ask)) return
    try {
      const res = await fetch(`/api/${it.kind === 'post' ? 'posts' : 'pages'}/${it.slug}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      if (it.kind === 'post') setPosts((prev) => prev.filter((p) => p.slug !== it.slug))
      else setPages((prev) => prev.filter((p) => p.slug !== it.slug))
      notify(t.movedToTrash)
      router.refresh()
    } catch {
      notify(t.deleteFailed, 'error')
    }
  }

  if (items.length === 0) return <EmptyState title={t.noPosts} />

  const scopeTabs: { key: Scope; label: string }[] = [
    { key: 'all', label: t.filterAll },
    { key: 'published', label: t.statusPublished },
    { key: 'draft', label: t.statusDraft },
  ]

  return (
    <>
      <div className={`${CLUSTER_GAP} flex flex-wrap items-center gap-3`}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.filterPlaceholder}
          aria-label={t.filterPlaceholder}
          className={`${CONTROL} w-full sm:w-80`}
        />
        <Tabs tabs={scopeTabs} value={scope} onChange={setScope} size="sm" />
      </div>

      {/* "Nothing matches" is only true once the server has answered. Saying it while the
          body search is in flight is a lie that corrects itself, which reads as a flicker. */}
      {shown.length === 0 && (needle.length < 2 || bodyHits !== null) ? (
        <EmptyState title={t.filterEmpty} />
      ) : (
        <TableFrame>
          <thead className={THEAD}>
            <tr>
              <th className="w-full px-4 py-3 font-medium">{t.colTitle}</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">{t.colStatus}</th>
              <th className="hidden px-4 py-3 font-medium text-right sm:table-cell">{t.colViews}</th>
              {commentsEnabled && <th className="hidden px-4 py-3 font-medium text-right xl:table-cell">{t.commentsCount}</th>}
              <th className="hidden px-4 py-3 font-medium sm:table-cell">{t.colTouched}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.map((it) => {
              const found = bodyHits?.get(`${it.kind}:${it.slug}`)
              const under = found ?? it.standing
              return (
                <tr key={`${it.kind}:${it.slug}`} className={`transition-colors ${TROW}`}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={it.editHref} className="hover:underline">
                      {it.title || t.untitled}
                    </Link>
                    {/* One line of the writing itself: the passage the words were found in
                        while searching, and the standing first line otherwise. A row that
                        matched on its BODY would otherwise look like it matched on nothing. */}
                    {under && (
                      <div className="mt-1 line-clamp-2 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                        {it.kind === 'page' && <span className="mr-1.5 text-neutral-400">{t.kindPage}</span>}
                        {under}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusPill
                      published={it.status === 'published'}
                      label={it.status === 'published' ? t.statusPublished : t.statusDraft}
                    />
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-neutral-500 sm:table-cell dark:text-neutral-400">
                    {(views[`/${it.slug}`] ?? 0).toLocaleString()}
                  </td>
                  {commentsEnabled && (
                    <td className="hidden px-4 py-3 text-right tabular-nums text-neutral-500 xl:table-cell dark:text-neutral-400">
                      {it.kind === 'post' ? (commentCounts[it.slug] ?? 0).toLocaleString() : ''}
                    </td>
                  )}
                  <td className="hidden whitespace-nowrap px-4 py-3 text-neutral-500 sm:table-cell dark:text-neutral-400">
                    {it.touched ? formatDateTimeShort(new Date(it.touched).toISOString()) : ''}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions editHref={it.editHref} viewHref={it.viewHref} onDelete={() => handleDelete(it)} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableFrame>
      )}
    </>
  )
}
