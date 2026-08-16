// One stream of everything written — posts and pages flattened, most recently touched
// first — plus the search that reaches the body (ADR 0024 steps 1–2).
//
// Extracted from the retired `WritingList` table when the Write screen became two panes:
// the ITEMS and the SEARCH are the part that must never fork between screens, and the hook
// is the seam that guarantees it.
import { useEffect, useMemo, useState } from 'react'
import type { Post, Page, ApiResponse } from '@/types'
// Type-only, and it must stay that way: the module it comes from opens the database.
import type { OwnerHit } from '@/content/search-owner'
import { foldAccents } from '@/utils'

export type WriteScope = 'all' | 'published' | 'draft'

/** Posts and pages, flattened to the few things a row actually renders. */
export type WriteItem = {
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

export function useWritingItems(posts: Post[], pages: Page[], query: string, scope: WriteScope) {
  // Where the words were found, keyed by `kind:slug`. Null means the server has not answered
  // for this query yet, which is NOT the same as "nothing matched" — see the empty state.
  const [bodyHits, setBodyHits] = useState<Map<string, string> | null>(null)

  const items = useMemo<WriteItem[]>(() => {
    const fromPosts = posts.map<WriteItem>((p) => ({
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
    const fromPages = pages.map<WriteItem>((p) => ({
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

  // The body search is the SERVER's, because the body is not here: this hook is handed
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

  return { items, shown, bodyHits }
}
