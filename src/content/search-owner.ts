// The owner's search: one query over everything written, drafts included (ADR 0024).
//
// It is NOT `searchPosts`. That one answers a reader: published posts only, gated again by
// `isPublicallyVisible` so a scheduled post stays hidden until its date. This one answers
// the person who wrote them, so a draft nobody has ever seen is exactly what it is for —
// and a draft is the whole reason the admin's old client-side filter over titles, tags and
// categories was useless.
//
// Posts and pages share the `/{slug}` namespace (invariant 2), so they share one result
// list here too, each carrying `kind` so the caller knows which editor to open.
import { all } from '@/store/query'
import { liveOnly } from '@/store/db'

/**
 * One result. `PostsTable` imports this with `import type`, which erases at build time —
 * `src/types.ts` would be the other home for it, but that file sits one line under the
 * 400-line cap `check:filesize` enforces, and a shared type is not a reason to split the
 * domain types. Keep the admin's import type-only: a value import here would pull the
 * database into the browser bundle.
 */
export type OwnerHit = {
  kind: 'post' | 'page'
  slug: string
  title: string
  status: string
  updatedAt: number | null
  /** The passage the words were found in, plain text. The row highlights it itself. */
  line: string
}

type HitRow = {
  slug: string
  title: string
  status: string
  updated_at: number | null
  line: string | null
}

/**
 * FTS5 query text from a user's words: every token becomes a quoted phrase, space-joined,
 * which is an implicit AND. Quoting is not tidiness — an apostrophe, a `-`, a stray `"` or
 * a bare `OR` is FTS5 OPERATOR syntax, and an unquoted one throws rather than returning
 * nothing, so a person typing "don't" would get an error page for a search.
 *
 * Same shape as `posts.ftsQuery`, deliberately not shared: that one belongs to the reader's
 * path and this file must not make the public search's behaviour depend on an admin change.
 */
function ftsQuery(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word.replaceAll('"', '""')}"`)
    .join(' ')
}

// `snippet()` returns the passage the match sits in, taken from the BODY column (index 1),
// with empty markers: the row highlights the words itself, because the body is Markdown and
// any marker inserted here would have to survive escaping on the way to the DOM.
//
// Both queries are written out rather than templated over a table name. Two near-identical
// strings are cheaper to read than one string with a hole in it, and this file then contains
// no SQL that is assembled at runtime at all.
const LIMIT = 60

export async function searchEverything(query: string): Promise<OwnerHit[]> {
  const q = query.trim()
  if (!q) return []
  const match = ftsQuery(q)

  try {
    const posts = all<HitRow>(
      `select p.slug, p.title, p.status, p.updated_at,
              snippet(posts_fts, 1, '', '', '…', 14) as line
         from posts_fts f
         join posts p on p.rowid = f.rowid
        where posts_fts match ? and ${liveOnly('p')}
        order by p.updated_at desc, p.date desc
        limit ?`,
      match,
      LIMIT,
    )
    const pages = all<HitRow>(
      `select g.slug, g.title, g.status, g.updated_at,
              snippet(pages_fts, 1, '', '', '…', 14) as line
         from pages_fts f
         join pages g on g.rowid = f.rowid
        where pages_fts match ? and ${liveOnly('g')}
        order by g.updated_at desc
        limit ?`,
      match,
      LIMIT,
    )

    return [
      ...posts.map((r) => toHit(r, 'post')),
      ...pages.map((r) => toHit(r, 'page')),
    ]
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, LIMIT)
  } catch (error) {
    // A malformed match string is the one failure that reaches here, and a search that
    // returns nothing is better than a screen that shows an error while somebody types.
    console.error(`[ERROR] search-owner.searchEverything: ${(error as Error).message}`)
    return []
  }
}

function toHit(row: HitRow, kind: 'post' | 'page'): OwnerHit {
  return {
    kind,
    slug: row.slug,
    title: row.title,
    status: row.status,
    updatedAt: row.updated_at ?? null,
    line: (row.line ?? '').replace(/\s+/g, ' ').trim(),
  }
}
