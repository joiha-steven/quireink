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
import { accentedWords, indexIn, keepsAccents, lanes, wordIndexIn } from '@/accent'

/**
 * One result. `WritingList` imports this with `import type`, which erases at build time —
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
  body: string | null
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

// The body comes back whole rather than as `snippet()`, which is both the correct answer and
// the cheap one. Correct: SQLite reads the FOLDED index, so on an accented query it centred
// the passage on the wrong word — a search for "lề" underlined "lệ" in a sentence that had
// nothing to do with the question. Cheap: measured 2026-09-11 over 500 posts of ~6 KB,
// `snippet()` costs 23 ms per 60 rows because it re-tokenizes every document it quotes,
// against 1 ms to read those bodies and cut the passage here.
//
// Both queries are written out rather than templated over a table name. Two near-identical
// strings are cheaper to read than one string with a hole in it, and this file then contains
// no SQL that is assembled at runtime at all.
const LIMIT = 60

/**
 * Rows read before the accent pass narrows them, and only when a query carries accents:
 * that pass drops rows, so reading exactly `LIMIT` of them would leave a search for "lề"
 * showing four results because the other fifty-six were spellings of "lệ".
 */
const CANDIDATES = 240

/** Words of context in a passage — the number `snippet()` was asked for, kept so that a row
 *  reads the way it always has. */
const CONTEXT = 14

export async function searchEverything(query: string): Promise<OwnerHit[]> {
  // The same cap the reader's search has, and for the same reason: one AND-ed phrase per
  // token means a long enough query is a lot of FTS5 work on a single thread.
  const q = query.trim().slice(0, 200)
  if (!q) return []
  const match = ftsQuery(q)
  const words = q.split(/\s+/).filter(Boolean)
  const cap = accentedWords(q).length > 0 ? CANDIDATES : LIMIT

  try {
    const posts = all<HitRow>(
      `select p.slug, p.title, p.status, p.updated_at, p.content as body
         from posts_fts f
         join posts p on p.rowid = f.rowid
        where posts_fts match ? and ${liveOnly('p')}
        order by p.updated_at desc, p.date desc
        limit ?`,
      match,
      cap,
    )
    const pages = all<HitRow>(
      `select g.slug, g.title, g.status, g.updated_at, g.content as body
         from pages_fts f
         join pages g on g.rowid = f.rowid
        where pages_fts match ? and ${liveOnly('g')}
        order by g.updated_at desc
        limit ?`,
      match,
      cap,
    )

    return [
      ...posts.map((row) => ({ row, kind: 'post' as const })),
      ...pages.map((row) => ({ row, kind: 'page' as const })),
    ]
      // The narrowing. The index matched these rows with the accents taken off; this asks
      // whether the words the owner actually typed are in them.
      .filter(({ row }) => keepsAccents(`${row.title}\n${row.body ?? ''}`, q))
      .sort((a, b) => (b.row.updated_at ?? 0) - (a.row.updated_at ?? 0))
      // Cut to the answer BEFORE reading any body for its passage: cutting afterwards would
      // pay for up to 480 of them to show 60.
      .slice(0, LIMIT)
      .map(({ row, kind }) => toHit(row, kind, words))
  } catch (error) {
    // A malformed match string is the one failure that reaches here, and a search that
    // returns nothing is better than a screen that shows an error while somebody types.
    console.error(`[ERROR] search-owner.searchEverything: ${(error as Error).message}`)
    return []
  }
}

function toHit(row: HitRow, kind: 'post' | 'page', words: string[]): OwnerHit {
  return {
    kind,
    slug: row.slug,
    title: row.title,
    status: row.status,
    updatedAt: row.updated_at ?? null,
    line: passage(row.body ?? '', words),
  }
}

/**
 * The passage the words were found in. It starts AT the match with a leading ellipsis,
 * which is what `snippet()` did, and it finds the match the way the caller's filter did —
 * so the sentence under the row is the sentence that answered the question.
 */
function passage(body: string, words: string[]): string {
  const hay = lanes(body.replace(/\s+/g, ' ').trim())
  const earliest = (seek: (h: typeof hay, w: string) => number) =>
    words.reduce((best, word) => {
      const found = seek(hay, word)
      return found !== -1 && (best === -1 || found < best) ? found : best
    }, -1)
  // The whole word first, because that is what the index matched. A hit inside a longer
  // word is worth quoting only when there is no standing one.
  const whole = earliest(wordIndexIn)
  const at = whole === -1 ? earliest(indexIn) : whole
  // -1 means the words matched the TITLE and not the body, so the opening line is the
  // passage: a row with an empty second line looks like a row that failed to load.
  const from = at === -1 ? 0 : hay.text.lastIndexOf(' ', at) + 1
  const rest = hay.text.slice(from).split(' ')
  return `${from > 0 ? '…' : ''}${rest.slice(0, CONTEXT).join(' ')}${rest.length > CONTEXT ? '…' : ''}`
}
