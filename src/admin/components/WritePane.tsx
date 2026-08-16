// The list beside the paper — the left half of the Writing Desk mock's write screen.
//
// A slim column of everything written, most recently touched first: search that reaches
// the body, the scope tabs, and one dark button for a new piece. Rows show the WRITING —
// title, then the matched line while searching or the standing first line otherwise.
//
// It fetches the content view itself so the editor pages can drop it in beside any sheet
// without threading list props through their own views. Beside an editor it appears from
// xl up — on a narrow window the sheet takes the room and the list is one "← Viết" away;
// on the Write screen itself (`always`) it is the page at every width.
import { useState } from 'react'
import Link from '@/admin/router'
import { useView } from '@/admin/useView'
import type { Post, Page } from '@/types'
import { formatDateTimeShort } from '@/utils'
import { Button } from '@/admin/ui/Button'
import { Tabs } from './kit'
import { useAdminT } from './I18nProvider'
import { useWritingItems, type WriteScope, type WriteSort } from './useWritingItems'

type ContentView = {
  posts: Post[]
  pages: Page[]
  views: Record<string, number>
}

function Rows({
  posts,
  pages,
  views,
  activeSlug,
}: ContentView & { activeSlug?: string }) {
  const t = useAdminT()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<WriteScope>('all')
  const [sort, setSort] = useState<WriteSort>('updated')
  const { shown, bodyHits } = useWritingItems(posts, pages, query, scope, sort)

  // The scope* keys, not tabPages/statusPublished: five words must share ONE line in a
  // 320px column in every language, so this row carries its own deliberately short set.
  const scopeTabs: { key: WriteScope; label: string }[] = [
    { key: 'all', label: t.filterAll },
    { key: 'page', label: t.scopePages },
    { key: 'post', label: t.scopePosts },
    { key: 'published', label: t.scopePublished },
    { key: 'draft', label: t.scopeDrafts },
  ]

  return (
    <>
      <div className="space-y-3 px-4 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.filterPlaceholder}
            aria-label={t.filterPlaceholder}
            className="h-9 w-full min-w-0 rounded-lg border border-neutral-200 bg-white px-3 text-sm placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:placeholder:text-neutral-500"
          />
          <Link href="/admin/editor" className="shrink-0">
            <Button size="sm">{t.newPost}</Button>
          </Link>
        </div>
        <Tabs tabs={scopeTabs} value={scope} onChange={setScope} size="sm" dense />
        {/* One quiet button cycling the order, not a second control row's worth of chrome. */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setSort(sort === 'updated' ? 'created' : 'updated')}
            className="text-xs text-neutral-400 transition hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200"
          >
            ↓ {sort === 'updated' ? t.sortUpdated : t.sortCreated}
          </button>
        </div>
      </div>

      {/* "Nothing matches" is only true once the server has answered — saying it while the
          body search is in flight is a lie that corrects itself, which reads as a flicker. */}
      {shown.length === 0 && (query.trim().length < 2 || bodyHits !== null) ? (
        <p className="px-4 py-6 text-sm text-neutral-400 dark:text-neutral-500">{t.filterEmpty}</p>
      ) : (
        <div className="scroll-fade min-h-0 flex-1 overflow-y-auto pb-6">
          {shown.map((it) => {
            const found = bodyHits?.get(`${it.kind}:${it.slug}`)
            const under = found ?? it.standing
            const active = it.slug === activeSlug
            const drafty = it.status !== 'published'
            // The date beside "Published" is the PUBLICATION date — showing the last save
            // there read as a wrong publish time. A draft's only honest date is its save.
            const when = !drafty && it.kind === 'post' ? it.created : it.touched
            return (
              <Link
                key={`${it.kind}:${it.slug}`}
                href={it.editHref}
                data-write-row
                aria-current={active ? 'page' : undefined}
                className={`block border-b border-neutral-100 px-4 py-3 dark:border-neutral-800 ${
                  active ? 'bg-white dark:bg-neutral-900' : 'hover:bg-white/60 dark:hover:bg-neutral-900/60'
                }`}
              >
                <span className="flex items-baseline gap-2">
                  {/* The mock's dot: work still on the desk is the marked state; published
                      is the quiet one. Neutral inks — the admin is monochrome. */}
                  <span
                    aria-hidden
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 self-start rounded-full ${
                      drafty ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-600'
                    }`}
                  />
                  <span className="min-w-0">
                    <span className={`block text-sm ${active ? 'font-semibold' : 'font-medium'} text-neutral-900 dark:text-white ${!it.title ? 'italic text-neutral-400 dark:text-neutral-500' : ''}`}>
                      {it.title || t.untitled}
                    </span>
                    {under && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-neutral-500 dark:text-neutral-400">
                        {it.kind === 'page' && <span className="mr-1 text-neutral-400">{t.kindPage}</span>}
                        {under}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-neutral-400 dark:text-neutral-500">
                      {(drafty ? t.statusDraft : t.statusPublished)}
                      {when ? ` · ${formatDateTimeShort(new Date(when).toISOString())}` : ''}
                      {!drafty && views[`/${it.slug}`] ? ` · ${views[`/${it.slug}`].toLocaleString()}` : ''}
                    </span>
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

/**
 * The pane, self-fetching. `activeSlug` marks the open piece's row. The column keeps its
 * own scroll so a long list never scrolls the sheet, and the fade says where it clips.
 */
export function WritePane({ activeSlug, always = false }: { activeSlug?: string; always?: boolean }) {
  const { data } = useView<ContentView>('content')
  return (
    <aside
      className={`${
        always ? 'flex w-full xl:w-80' : 'hidden w-80 xl:flex'
      } shrink-0 flex-col self-start overflow-hidden rounded-[10px] border border-neutral-200/80 bg-neutral-50 xl:sticky xl:top-0 xl:max-h-[calc(100vh-1.5rem)] dark:border-neutral-800 dark:bg-neutral-950`}
    >
      {data ? (
        <Rows {...data} activeSlug={activeSlug} />
      ) : (
        <div className="p-4">
          <div className="h-9 animate-pulse rounded-lg bg-neutral-200/60 dark:bg-neutral-800" />
        </div>
      )}
    </aside>
  )
}
