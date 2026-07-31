// Row transforms from Quire 1.x (Postgres, via PostgREST JSON) to Quire Ink 2.0 (SQLite).
//
// Pure on purpose. These are the functions where an import silently corrupts data: a
// timestamp read as seconds, a boolean written as the string "false" (truthy in SQLite's
// eyes only if you compare it wrong), an empty array turning into a row. Keeping them
// free of both databases means they can be tested exhaustively, which is what
// 05-importer.md's Tier 3 spot comparison is really checking.

/** `timestamptz` (ISO string) -> INTEGER epoch milliseconds, UTC. NULL preserved. */
export function ts(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value
  const ms = Date.parse(String(value))
  if (Number.isNaN(ms)) throw new ImportTransformError(`unparseable timestamp: ${JSON.stringify(value)}`)
  return ms
}

/**
 * `boolean` -> 0 / 1.
 *
 * PostgREST sends real JSON booleans, but a hand-edited row or an older client can present
 * "t"/"f" or "true"/"false". Anything not recognised throws rather than defaulting: a
 * silently-wrong flag here is a post that never publishes or a variant that never renders.
 */
export function bool(value: unknown): number {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value ? 1 : 0
  const s = String(value).toLowerCase()
  if (s === 't' || s === 'true' || s === '1') return 1
  if (s === 'f' || s === 'false' || s === '0' || s === '') return 0
  throw new ImportTransformError(`unrecognised boolean: ${JSON.stringify(value)}`)
}

/** A nullable boolean column, where NULL carries meaning (`integration_keys.smtp_secure`). */
export function boolOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : bool(value)
}

export class ImportTransformError extends Error {}

/** `text` -> TEXT, with NULL and empty distinguished as they were. */
export function text(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return String(value)
}

/** `jsonb` -> TEXT, verbatim. Never reshaped; the reader parses the same bytes back. */
export function json(value: unknown): string {
  return JSON.stringify(value ?? {})
}

/** `text[]` -> a clean string list. Postgres nulls inside an array are dropped. */
export function textArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

export type TermRow = { post_slug: string; kind: 'category' | 'tag'; term: string }

/**
 * `posts.categories` / `posts.tags` -> `post_terms` rows.
 *
 * Trimmed and de-duplicated per kind, because the junction table's primary key would
 * reject a duplicate and abort the whole import transaction over a cosmetic problem in one
 * old post. A term that trims to nothing is dropped: it was never reachable as a URL.
 */
export function termRows(slug: string, categories: unknown, tags: unknown): TermRow[] {
  const out: TermRow[] = []
  const add = (kind: 'category' | 'tag', list: unknown) => {
    const seen = new Set<string>()
    for (const raw of textArray(list)) {
      const term = raw.trim()
      if (!term || seen.has(term)) continue
      seen.add(term)
      out.push({ post_slug: slug, kind, term })
    }
  }
  add('category', categories)
  add('tag', tags)
  return out
}

/**
 * Expected `post_terms` count for Tier 1, computed on the SOURCE side.
 *
 * It has to apply the same trim and de-dupe as `termRows`, or a post carrying a duplicate
 * tag reports a fatal count mismatch on an import that was in fact correct.
 */
export function expectedTermCount(posts: { slug: string; categories: unknown; tags: unknown }[]): number {
  return posts.reduce((n, p) => n + termRows(p.slug, p.categories, p.tags).length, 0)
}

/** `mcp_clients.redirect_uris text[]` -> a JSON array in a TEXT column. */
export function uriList(value: unknown): string {
  return JSON.stringify(textArray(value))
}
