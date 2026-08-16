// Posts list (no chrome): rows with per-row edit/delete. Tabs + heading +
// "new" button live in ContentDashboard, which renders this.
import { useEffect, useMemo, useState } from 'react'
import Link from '@/admin/router'
import { useRouter } from '@/admin/router'
import type { Post, ApiResponse } from '@/types'
// Type-only, and it must stay that way: the module it comes from opens the database.
import type { OwnerHit } from '@/content/search-owner'
import { useToast } from '@/admin/ui/Toast'
import { formatDateTimeShort, foldAccents } from '@/utils'
import { RowActions, StatusPill } from './RowActions'
import { CLUSTER_GAP, CONTROL, EmptyState, TableFrame, Tabs, THEAD, TROW } from './kit'
import { useAdminT } from './I18nProvider'

type StatusFilter = 'all' | 'published' | 'draft'

export function PostsTable({
  initialPosts,
  views,
  commentCounts,
  commentsEnabled,
}: {
  initialPosts: Post[]
  views: Record<string, number>
  commentCounts: Record<string, number>
  commentsEnabled: boolean
}) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [posts, setPosts] = useState(initialPosts)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  async function handleDelete(slug: string) {
    if (!confirm(t.confirmDeletePost)) return
    try {
      const res = await fetch(`/api/posts/${slug}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      setPosts((prev) => prev.filter((p) => p.slug !== slug))
      notify(t.movedToTrash)
      router.refresh()
    } catch {
      notify(t.deleteFailed, 'error')
    }
  }

  // What the words were found IN, keyed by slug, for the rows the title alone did not match.
  // Null means "no server answer for this query yet", which is not the same as "no matches":
  // the difference is why an empty state cannot be decided from this value alone.
  const [bodyHits, setBodyHits] = useState<Map<string, string> | null>(null)

  // The body search is the SERVER's, because the body is not here. This component is handed
  // metadata for every post and nothing else, which is exactly why its filter could only
  // ever match titles, tags and categories — the sentence the owner remembers writing was
  // never in the browser to be found (ADR 0024).
  //
  // Debounced, because it runs per keystroke; one character is not a search, it is the
  // beginning of one, and asking SQLite for every post that contains "t" helps nobody.
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
          const hits = json.data?.hits ?? []
          setBodyHits(new Map(hits.filter((h) => h.kind === 'post').map((h) => [h.slug, h.line])))
        } catch {
          // A failed search leaves the title filter working rather than emptying the screen.
          setBodyHits(null)
        }
      })()
    }, 180)
    return () => clearTimeout(timer)
  }, [query])

  // Status + (title/tags/categories, matched here) OR (body, matched by the server).
  const needle = foldAccents(query.trim())
  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (status !== 'all' && p.status !== status) return false
      if (!needle) return true
      if (foldAccents([p.title, p.tags.join(' '), p.categories.join(' ')].join(' ')).includes(needle)) return true
      return bodyHits?.has(p.slug) ?? false
    })
  }, [posts, status, needle, bodyHits])

  if (posts.length === 0) {
    return <EmptyState title={t.noPosts} />
  }

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t.filterAll },
    { key: 'published', label: t.statusPublished },
    { key: 'draft', label: t.statusDraft },
  ]

  return (
    <>
      {/* A filter box is not a document. It ran `flex-1` and measured 1051px, which says the
          answer typed into it might be a paragraph; it is two or three words. The kit's
          `CONTROL` rather than a hand-rolled copy of it, which had a lighter border, a
          different focus ring and two pixels less height than every other field in the admin.

          The two sit TOGETHER rather than at opposite ends of the row: they narrow the same
          list, and a thousand pixels between them says they are unrelated controls. */}
      <div className={`${CLUSTER_GAP} flex flex-wrap items-center gap-3`}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.filterPlaceholder}
          aria-label={t.filterPlaceholder}
          className={`${CONTROL} w-full sm:w-80`}
        />
        <Tabs tabs={statusTabs} value={status} onChange={setStatus} size="sm" />
      </div>

      {/* "Nothing matches" is only true once the server has answered. Saying it while the
          body search is still in flight is a lie that corrects itself, which reads as a
          flicker and teaches the owner to distrust the screen. */}
      {filtered.length === 0 && (needle.length < 2 || bodyHits !== null) ? (
        <EmptyState title={t.filterEmpty} />
      ) : (
    <TableFrame>
        <thead className={THEAD}>
          <tr>
            {/* `w-full` says the SLACK goes to the title, and on its own it fixed nothing,
                which is the useful half of this note. Measured at 1083px — this admin in a
                window that is not maximised — the seven columns wanted 794px of a 793px
                table: Status 100, Views 71, Comments 104, Date 136, Categories 109, actions
                136. There was no slack to give, so the only cell anybody reads collapsed to
                its min-content at 138px and every headline wrapped to three or four lines.
                A priority is worth nothing until something is dropped, so the comment count
                and the categories now wait for `xl` (the categories still show under the
                title below that, as they already did on a phone). Title: 138px → 351px. */}
            <th className="w-full px-4 py-3 font-medium">{t.colTitle}</th>
            <th className="whitespace-nowrap px-4 py-3 font-medium">{t.colStatus}</th>
            <th className="hidden px-4 py-3 font-medium text-right sm:table-cell">{t.colViews}</th>
            {commentsEnabled && <th className="hidden px-4 py-3 font-medium text-right xl:table-cell">{t.commentsCount}</th>}
            {/* Date + categories are secondary — hidden on narrow screens */}
            <th className="hidden px-4 py-3 font-medium sm:table-cell">{t.colDate}</th>
            <th className="hidden px-4 py-3 font-medium xl:table-cell">{t.colCategories}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.slug} className={`transition-colors ${TROW}`}>
              {/* The title is the OWNER'S OWN WORDS, so it takes the reading face — the same
                  division the reading site makes, where a list card's title is set in
                  `--font-reading` and the date beside it is not. Every other cell in this row
                  is the machine talking: a status, a count, a date, a category. */}
              <td className="px-4 py-3 font-medium">
                {/* On the LINK and not on the cell: the categories line below is taxonomy,
                    which is chrome, and it would inherit the face from a cell that carried
                    it. */}
                <Link href={`/admin/editor/${p.slug}`} className="hover:underline">
                  {p.title || t.untitled}
                </Link>
                {/* The passage the words were found in. Without it a row that matched on its
                    BODY looks like a row that matched on nothing, and the owner has to open
                    the post to find out why it is in the list. */}
                {bodyHits?.get(p.slug) && (
                  <div className="mt-1 line-clamp-2 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    {bodyHits.get(p.slug)}
                  </div>
                )}
                {p.categories.length > 0 && (
                  <div className="mt-1 text-xs font-normal text-neutral-400 xl:hidden">{p.categories.join(', ')}</div>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusPill published={p.status === 'published'} label={p.status === 'published' ? t.statusPublished : t.statusDraft} />
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums text-neutral-500 sm:table-cell dark:text-neutral-400">{(views[`/${p.slug}`] ?? 0).toLocaleString()}</td>
              {commentsEnabled && (
                <td className="hidden px-4 py-3 text-right tabular-nums text-neutral-500 xl:table-cell dark:text-neutral-400">{(commentCounts[p.slug] ?? 0).toLocaleString()}</td>
              )}
              <td className="hidden whitespace-nowrap px-4 py-3 text-neutral-500 sm:table-cell dark:text-neutral-400">{formatDateTimeShort(p.date)}</td>
              <td className="hidden px-4 py-3 text-neutral-500 xl:table-cell dark:text-neutral-400">{p.categories.join(', ')}</td>
              <td className="px-4 py-3">
                <RowActions
                  editHref={`/admin/editor/${p.slug}`}
                  viewHref={p.status === 'published' ? `/${p.slug}` : undefined}
                  onDelete={() => handleDelete(p.slug)}
                />
              </td>
            </tr>
          ))}
        </tbody>
    </TableFrame>
      )}
    </>
  )
}
