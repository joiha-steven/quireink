// One stream of everything written — posts and pages flattened, most recently touched
// first — plus the search that reaches the body (ADR 0024 steps 1–2).
//
// Extracted from the retired `WritingList` table when the Write screen became two panes:
// the ITEMS and the SEARCH are the part that must never fork between screens, and the hook
// is the seam that guarantees it.
import { useEffect, useMemo, useState } from 'react'
import type { Post, Page, Note, ApiResponse } from '@/types'
// Type-only, and it must stay that way: the module it comes from opens the database.
import type { OwnerHit } from '@/content/search-owner'
import { foldAccents, untitledNumbers } from '@/utils'

/** WHAT a row is — and 'all' is the mixed stream, most recently touched first. */
export type WriteKind = 'all' | 'page' | 'post' | 'note'
/** WHERE a row stands. Two questions, two controls: they used to share one row of six
 *  segments, which could not hold its own labels in any language (2026-09-09), and a
 *  reader asking for "drafts" could not also ask "of posts". Now the two stack. */
export type WriteStatus = 'all' | 'published' | 'draft'
export type WriteSort = 'updated' | 'created'
/** The dashboard's two "needs attention" checks, as a filter this list can be asked for. */
export type WriteNeeds = 'excerpt' | 'image' | null

/** Posts, pages and notes, flattened to the few things a row actually renders. */
export type WriteItem = {
  kind: 'post' | 'page' | 'note'
  slug: string
  title: string
  status: string
  /** Sort key: last save, falling back to the publication date a post always has. */
  touched: number
  /** A post's publication date. Pages have no second date, so this repeats `touched`. */
  created: number
  /** The second line when nothing was searched for: a post's excerpt, a page's address. */
  standing: string
  terms: string
  editHref: string
  viewHref?: string
  /**
   * Published and missing something a shared link will show. The dashboard's "needs
   * attention" card counts exactly these two, and its rows link here — a count that names a
   * problem and lands you on an unfiltered list has told you a number and nothing else.
   * Always false for a page: neither concept exists on one.
   */
  noExcerpt: boolean
  noImage: boolean
  /**
   * 1, 2, 3… for a draft with no title, so the sidebar can tell several apart instead of
   * showing one identical label for all of them. Numbered by creation order and NOT by
   * position in the list, so a given draft keeps its number as new ones appear above it and
   * as the list re-sorts. `undefined` for anything with a title.
   */
  untitledNo?: number
}

const stamp = (iso?: string): number => (iso ? new Date(iso).getTime() : 0)

export function useWritingItems(posts: Post[], pages: Page[], notes: Note[], query: string, kind: WriteKind, status: WriteStatus = 'all', sort: WriteSort = 'updated', needs: WriteNeeds = null) {
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
      created: stamp(p.date),
      standing: p.excerpt ?? '',
      terms: [p.tags.join(' '), p.categories.join(' ')].join(' '),
      editHref: `/admin/editor/${p.slug}`,
      viewHref: p.status === 'published' ? `/${p.slug}` : undefined,
      noExcerpt: p.status === 'published' && !p.excerpt?.trim(),
      noImage: p.status === 'published' && !p.featuredImage,
    }))
    const fromPages = pages.map<WriteItem>((p) => ({
      kind: 'page',
      slug: p.slug,
      title: p.title,
      status: p.status,
      touched: stamp(p.updatedAt),
      created: stamp(p.updatedAt),
      standing: `/${p.slug}`,
      terms: '',
      editHref: `/admin/page-editor/${p.slug}`,
      viewHref: p.status === 'published' ? `/${p.slug}` : undefined,
      noExcerpt: false,
      noImage: false,
    }))
    // A note (ADR 0044): dated like a post, addressed under /notes/, and a clip shows where
    // it came from where a post shows its excerpt.
    const fromNotes = notes.map<WriteItem>((n) => ({
      kind: 'note',
      slug: n.slug,
      title: n.title || n.sourceTitle || '',
      status: n.status,
      touched: stamp(n.updatedAt) || stamp(n.date),
      created: stamp(n.date),
      standing: n.sourceTitle ?? n.quote ?? `/notes/${n.slug}`,
      terms: '',
      editHref: `/admin/note-editor/${n.slug}`,
      viewHref: n.status === 'published' ? `/notes/${n.slug}` : undefined,
      noExcerpt: false,
      noImage: false,
    }))
    const all = [...fromPosts, ...fromPages, ...fromNotes]
    const numbers = untitledNumbers(all)
    for (const i of all) i.untitledNo = numbers.get(`${i.kind}:${i.slug}`)
    const key = sort === 'created' ? (i: WriteItem) => i.created : (i: WriteItem) => i.touched
    return all.sort((a, b) => key(b) - key(a))
  }, [posts, pages, notes, sort])

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
      // Kind and status STACK: "drafts of posts" is one question, not two lists.
      if (kind !== 'all' && it.kind !== kind) return false
      if (status !== 'all' && it.status !== status) return false
      // The dashboard's filter, and it stacks WITH both rather than replacing them: a
      // person who arrives on "no share image" and then presses Drafts is asking a narrower
      // question, not starting again.
      if (needs === 'excerpt' && !it.noExcerpt) return false
      if (needs === 'image' && !it.noImage) return false
      if (!needle) return true
      if (foldAccents(`${it.title} ${it.terms}`).includes(needle)) return true
      return bodyHits?.has(`${it.kind}:${it.slug}`) ?? false
    })
  }, [items, kind, status, needle, bodyHits, needs])

  return { items, shown, bodyHits }
}
