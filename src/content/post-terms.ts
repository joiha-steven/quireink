// Categories and tags. In Postgres these were two `text[]` columns on `posts` with GIN
// indexes; here they are one junction table, which makes /category/{slug} an index seek
// instead of a scan and turns a site-wide rename into a single UPDATE.
//
// PARITY NOTE: `post_terms` has no ordering column, so the author's chosen order within a
// post is not preserved: terms come back in index order (alphabetical). The frozen tree
// kept array order. Recorded in scripts/port/LEDGER.md rather than fixed here, because
// adding an ordering column is a schema decision, not a port.

import { all, run } from '@/store/query'

export type TermKind = 'category' | 'tag'

// The two correlated subqueries every post read needs. Written out per kind rather than
// interpolated, because no SQL is assembled in this codebase.
export const TERM_SELECT = `
  (select json_group_array(term) from post_terms where post_slug = p.slug and kind = 'category') as categories,
  (select json_group_array(term) from post_terms where post_slug = p.slug and kind = 'tag') as tags`

/** `json_group_array` over zero rows yields '[]', so this never sees null in practice. */
export function parseTerms(json: string | null): string[] {
  if (!json) return []
  const parsed: unknown = JSON.parse(json)
  return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
}

/**
 * Replace one post's terms. Delete-then-insert rather than a diff: the lists are a handful
 * of strings, and a diff is where a term goes missing.
 *
 * Caller runs this inside the same transaction as the post write.
 */
export function writeTerms(slug: string, categories: string[], tags: string[]): { categories: string[]; tags: string[] } {
  run(`delete from post_terms where post_slug = ?`, slug)
  const add = (kind: TermKind, list: string[]): string[] => {
    // ONE TERM PER NAME, whatever its case (2026-09-30). "Chữ Việt" and "chữ việt" were stored as
    // two tags that share one address, `/tag/chu-viet`, and the article linked it twice. A name
    // already on the blog keeps the spelling most posts use; a comma separates names, as it does
    // in the box they are typed into, so `a,b` is two tags and not one with a comma in it.
    const known = new Map<string, string>()
    for (const { term } of all<{ term: string }>(
      `select term from post_terms where kind = ? group by term order by count(*) desc, term`, kind,
    )) if (!known.has(foldTerm(term))) known.set(foldTerm(term), term)
    const names = list.flatMap((t) => t.split(',')).map((t) => t.trim()).filter(Boolean)
    const chosen = new Map<string, string>()
    for (const name of names) {
      const key = foldTerm(name)
      if (!chosen.has(key)) chosen.set(key, known.get(key) ?? name)
    }
    for (const term of chosen.values()) {
      run(`insert or ignore into post_terms (post_slug, kind, term) values (?, ?, ?)`, slug, kind, term)
    }
    return [...chosen.values()]
  }
  // What was STORED, so the caller answers with the spelling kept rather than the one sent.
  return { categories: add('category', categories), tags: add('tag', tags) }
}

/** The same name, whatever its case or its Unicode composition. */
const foldTerm = (term: string): string => term.normalize('NFC').toLowerCase()

/**
 * Rename (`newName` set) or remove (null) a term across EVERY post. Returns how many posts
 * were affected.
 *
 * The frozen tree read every post's array, edited it in JS and wrote the whole array back,
 * and documented that as an accepted last-write-wins risk. That risk is gone: this is two
 * statements against one table.
 *
 * `update or ignore` is what handles a rename that COLLIDES: a post already carrying the
 * destination term would violate the primary key, so its old row is skipped and then
 * deleted, which is exactly the merge the old `applyTerm` did by de-duping.
 */
export function updateTermRows(kind: TermKind, name: string, newName: string | null): number {
  const affected = all<{ post_slug: string }>(
    `select post_slug from post_terms where kind = ? and term = ?`, kind, name,
  ).length
  if (affected === 0) return 0
  if (newName) run(`update or ignore post_terms set term = ? where kind = ? and term = ?`, newName, kind, name)
  run(`delete from post_terms where kind = ? and term = ?`, kind, name)
  return affected
}
