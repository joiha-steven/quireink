// ONE STREAM OF EVERYTHING WRITTEN — posts, pages and notes flattened to the few things a row
// actually draws, most recently touched first.
//
// It was `useWritingItems.ts`, a React hook, and the flattening half of it never needed React:
// it is a map and a sort over data the server already holds (`contentView()`), computed in the
// browser only because that is where the list used to be drawn. The half that DID need a
// browser — the debounced body search — stays in the browser, as the island's.
//
// ⚠️ THE ROWS ARE ALL DRAWN AND THE FILTERS HIDE. `docs/admin-one-dom.md` trap 2: the log sends
// its two hundred rows once with the facts a filter asks about written into each one, and the
// island sets `hidden`. Filtering by kind, by status or by what a piece is missing is then a
// property of the markup rather than a round trip, and it is correct in the first frame for the
// one filter that arrives in the address (`?needs=image`, from the dashboard).
import type { Note, Page, Post } from '@/types'
import { untitledNumbers } from '@/utils'

/** WHAT a row is. `all` is the mixed stream. */
export type WriteKind = 'all' | 'page' | 'post' | 'note'

/**
 * WHERE a row stands. Two questions, two controls: they shared one row of six segments until
 * 2026-09-09, which could not hold its own labels in any language, and a reader asking for
 * "drafts" could not also ask "of posts". Now the two stack.
 */
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
  /** Tags and categories, for the search that does not reach the body. Posts only. */
  terms: string
  editHref: string
  /**
   * Published and missing something a shared link will show. The dashboard's "needs attention"
   * card counts exactly these two and its rows link here, because a count that names a problem
   * and lands you on an unfiltered list has told you a number and nothing else.
   *
   * Always false for a page and for a note: neither concept exists on one.
   */
  noExcerpt: boolean
  noImage: boolean
  /**
   * 1, 2, 3… for a draft with no title, so the column can tell several apart instead of showing
   * one identical label for all of them. Numbered by CREATION order and not by position in the
   * list, so a given draft keeps its number as new ones appear above it and as the list re-sorts.
   * `undefined` for anything with a title.
   */
  untitledNo?: number
}

const stamp = (iso?: string): number => (iso ? new Date(iso).getTime() : 0)

/**
 * Whether a post has been given a publication date in the future.
 *
 * It is not a fourth status: a scheduled post's `status` IS `published`, which is why asking
 * for Drafts does not show it. The lamp pulses instead, which is the only place the difference
 * is said out loud.
 */
export const isQueued = (it: WriteItem, now: number): boolean =>
  it.kind === 'post' && it.status === 'published' && it.created > now

/** The stream, sorted. `sort` decides which of the two dates is the key; both are descending. */
export function writeItems(
  posts: Post[], pages: Page[], notes: Note[], sort: WriteSort = 'updated',
): WriteItem[] {
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
    noExcerpt: false,
    noImage: false,
  }))
  // A note (ADR 0044): dated like a post, addressed under /notes/, and a clip shows where it
  // came from where a post shows its excerpt.
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
    noExcerpt: false,
    noImage: false,
  }))
  const all = [...fromPosts, ...fromPages, ...fromNotes]
  const numbers = untitledNumbers(all)
  for (const i of all) i.untitledNo = numbers.get(`${i.kind}:${i.slug}`)
  const key = sort === 'created' ? (i: WriteItem) => i.created : (i: WriteItem) => i.touched
  return all.sort((a, b) => key(b) - key(a))
}

/**
 * The one filter that arrives in the ADDRESS, from the dashboard's "needs attention" rows.
 *
 * Read from the query rather than applied by the island, so the list is already narrowed in the
 * first frame — a page that draws forty-eight rows and then hides forty of them is a flash of
 * the wrong answer on a screen somebody was sent to for a specific one. Anything that is not
 * one of the two checks is dropped rather than honoured: a filter nobody can name is a list
 * that has silently stopped being the list of everything.
 */
export const needsFrom = (query: URLSearchParams): WriteNeeds => {
  const asked = query.get('needs')
  return asked === 'excerpt' || asked === 'image' ? asked : null
}

/** What a row is missing, as the attribute a CSS rule reads. Empty when it is missing nothing. */
export const needsOf = (it: WriteItem): string =>
  [it.noExcerpt ? 'excerpt' : '', it.noImage ? 'image' : ''].filter(Boolean).join(' ')
