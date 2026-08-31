// The moderation queue, GROUPED BY POST — because that is the unit a moderator thinks in.
//
// It was one flat list of every comment on the blog, newest first, two newspaper columns
// wide: readable at twenty comments and unusable at two hundred, with nothing to hold on to
// between one row and the next. Three replies to the same post sat in three different places
// and read as three unrelated problems; a heated thread was invisible as a thread.
//
// So a post is a CARD: its title, how many comments it holds, a link to read it live, then
// its comments newest first. The eye lands on a title, not on row 47 of a list, and a card
// carries its own count — which is the number that tells you where to look first.
//
// The band at the top is the same four numbers a moderator would work out by scrolling, and
// the two filters are the two questions actually asked of this screen: what is NEW, and where
// is the noise (the busiest posts first).
//
// Delete is a soft delete (moves to Trash); the row drops from its card on success. The text
// is collapsed to three lines — click it to expand, click again to collapse.
import { useMemo, useState } from 'react'
import type { AdminComment, ApiResponse } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { formatDateTimeShort, foldAccents } from '@/utils'
import { PageHeader, EmptyState, Tabs, type TabItem } from './kit'
import { SHEET, SHEET_FOOT, SHEET_TOOL, SHEET_TOOL_DANGER, SheetTop, NumBand } from './sheet'
import { Marked } from './Marked'
import { useAdminT } from './I18nProvider'

type Sort = 'recent' | 'busiest'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** The commenter's initial, for the small square that opens every row. */
const initialOf = (name: string): string => (name.trim()[0] ?? '?').toUpperCase()

export function CommentsTable({ initial }: { initial: AdminComment[] }) {
  const t = useAdminT()
  const { notify } = useToast()
  const [rows, setRows] = useState(initial)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('recent')

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

  // The search reaches the text, the name and the post title, accent-folded — typing "cafe"
  // finds "café", which is the only behaviour that is not a surprise in a Vietnamese admin.
  const needle = foldAccents(query.trim().toLowerCase())
  const shown = needle
    ? rows.filter((c) => foldAccents(`${c.content} ${c.name} ${c.postTitle ?? ''}`.toLowerCase()).includes(needle))
    : rows

  // One pass, memoised: grouping two hundred comments on every keystroke of the search box
  // is work nobody asked for.
  const groups = useMemo(() => {
    const by = new Map<string, { slug: string; title: string; items: AdminComment[]; newest: number }>()
    for (const c of shown) {
      const g = by.get(c.postSlug) ?? { slug: c.postSlug, title: c.postTitle ?? c.postSlug, items: [], newest: 0 }
      g.items.push(c)
      g.newest = Math.max(g.newest, Date.parse(c.createdAt) || 0)
      by.set(c.postSlug, g)
    }
    const list = [...by.values()]
    for (const g of list) g.items.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
    // 'busiest' still falls back to recency inside a tie, so the order is never arbitrary.
    list.sort((a, b) => (sort === 'busiest' ? b.items.length - a.items.length || b.newest - a.newest : b.newest - a.newest))
    return list
  }, [shown, sort])

  // The band's four numbers, off the FULL set rather than the filtered one: a total that
  // changes as you type is not a total.
  const stats = useMemo(() => {
    const since = Date.now() - WEEK_MS
    return {
      total: rows.length,
      posts: new Set(rows.map((c) => c.postSlug)).size,
      week: rows.filter((c) => (Date.parse(c.createdAt) || 0) >= since).length,
      people: new Set(rows.map((c) => (c.email || c.name).toLowerCase())).size,
    }
  }, [rows])

  if (initial.length === 0) {
    return (
      <div>
        <PageHeader title={t.commentsNavTitle} />
        <EmptyState title={t.commentsEmpty} />
      </div>
    )
  }

  const SORTS: TabItem<Sort>[] = [
    { key: 'recent', label: t.commentsSortRecent },
    { key: 'busiest', label: t.commentsSortBusiest },
  ]

  return (
    <div>
      <PageHeader title={t.commentsNavTitle} />
      <div className={SHEET}>
        <SheetTop>
          <Tabs tabs={SORTS} value={sort} onChange={setSort} size="sm" role="choice" />
          <span className="flex-1" />
          <span className={SHEET_TOOL}>
            {t.commentsInPosts
              .replace('{n}', shown.length.toLocaleString())
              .replace('{p}', groups.length.toLocaleString())}
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.commentsSearch}
            aria-label={t.commentsSearch}
            className="h-8 w-56 rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-[inset_0_1px_1.5px_rgba(0,0,0,.06)] placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-[inset_0_1px_1.5px_rgba(0,0,0,.35)] dark:placeholder:text-neutral-500"
          />
        </SheetTop>
        <NumBand
          items={[
            { n: stats.total.toLocaleString(), label: t.commentsNavTitle },
            { n: stats.posts.toLocaleString(), label: t.commentsStatPosts },
            { n: stats.week.toLocaleString(), label: t.commentsStatWeek },
            { n: stats.people.toLocaleString(), label: t.commentsStatPeople },
          ]}
        />
        {groups.length === 0 ? (
          <p className="px-5 py-8 text-sm text-neutral-500 dark:text-neutral-400">{t.filterEmpty}</p>
        ) : (
          <div className="paper-cols">
            {groups.map((g) => (
              <section key={g.slug} className="px-5 py-4">
                {/* The post's own line: title, count, and the way out to the live page.
                    A count on the card is what says "look here first" without a chart. */}
                <div className="mb-2 flex items-baseline gap-2 border-b border-neutral-100 pb-2 dark:border-neutral-800">
                  <a
                    href={`/${g.slug}`}
                    target="_blank"
                    rel="noopener"
                    title={g.title}
                    className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900 hover:underline dark:text-white"
                  >
                    <Marked text={g.title} needle={query} />
                  </a>
                  <span className="shrink-0 rounded-full border border-neutral-200 px-1.5 text-[11px] tabular-nums text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                    {g.items.length}
                  </span>
                </div>
                <ul>
                  {g.items.map((c) => (
                    <li key={c.id} className="group flex gap-2.5 py-2">
                      {/* The initial, so a name is findable by SHAPE while scanning — the
                          same person twice in a card is then obvious at a glance. */}
                      <span
                        aria-hidden
                        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-neutral-100 text-[11px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        {initialOf(c.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-x-2 text-xs text-neutral-500 dark:text-neutral-400">
                          <span className="truncate font-medium text-neutral-700 dark:text-neutral-300">
                            <Marked text={c.name} needle={query} />
                          </span>
                          <span className="whitespace-nowrap">{formatDateTimeShort(c.createdAt)}</span>
                          {/* Delete waits for the pointer, and takes no room while it waits:
                              a moderator reads far more rows than they act on. It is red
                              ballpoint, the ink this admin reserves for striking out. */}
                          <button
                            type="button"
                            onClick={() => { void handleDelete(c.id) }}
                            className={`ml-auto shrink-0 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 ${SHEET_TOOL_DANGER}`}
                          >
                            {t.commentsColDelete}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggle(c.id)}
                          className="mt-0.5 block w-full text-left text-sm text-neutral-800 dark:text-neutral-200"
                          aria-expanded={expanded.has(c.id)}
                        >
                          <span className={expanded.has(c.id) ? 'whitespace-pre-wrap break-words' : 'line-clamp-3'}>
                            <Marked text={c.content} needle={query} />
                          </span>
                        </button>
                        {/* The forensics, one line, and only where it exists. It is the third
                            question a moderator asks, so it is the third thing here. */}
                        {(c.email || c.ip) && (
                          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[11px] text-neutral-400 dark:text-neutral-500">
                            {c.email && <span className="truncate">{c.email}</span>}
                            {c.ip && <span className="whitespace-nowrap">{c.ip}{c.country && ` (${c.country})`}</span>}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        <div className={SHEET_FOOT}>{t.commentsFootHint}</div>
      </div>
    </div>
  )
}
