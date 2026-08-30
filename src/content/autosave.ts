// The editor's autosave, on the server — and the promise that it never reaches a reader.
//
// The editor has autosaved to `localStorage` since M2, deliberately: writing an in-progress
// draft to `posts.content` would put half a sentence on a PUBLISHED page, and no interval is
// short enough to make that acceptable. That left one real gap, and it is the one nobody
// notices until it costs them: the work existed on exactly one browser. A dead laptop, a
// cleared profile, a machine left at the office — everything typed since the last Save was
// gone, and the local snapshot could not say otherwise because it went with the machine.
//
// So the snapshot lands in a column of its own. `posts.content` is still moved by an explicit
// Save and by nothing else, so the live page is exactly what was last published; `autosave_json`
// is a side note the editor offers back when it is newer than the row.
//
// ⚠️ UNIFORM FOR DRAFTS AND PUBLISHED POSTS, and that is a decision rather than laziness. The
// obvious shortcut is "a draft is not live, so autosave straight into its row" — and it is a
// RACE: a draft can be published a second later, and the status this code read is already
// stale by the time the row is written. One path that is safe for the dangerous case is safer
// than two paths where the cheap one is only usually right.
//
// ⚠️ NOTHING THAT RENDERS A PAGE MAY READ THESE COLUMNS. `getPost`, the feeds, the sitemap and
// the search index all select named columns and none of them names this one; `store/autosave.test.ts`
// holds that.
import { one, run } from '@/store/query'
import { nowMs } from '@/store/db'

export type AutosaveKind = 'post' | 'page'

/** The table a kind lives in. A closed set, and the only identifier interpolated below. */
const TABLE: Record<AutosaveKind, string> = { post: 'posts', page: 'pages' }

export type Autosave = { json: string; at: number }

/**
 * Stash the in-progress draft against an EXISTING row.
 *
 * Returns false when the slug names nothing — a piece that has never been saved has no row to
 * hang a snapshot on, and localStorage stays its only copy until the first save. The editor is
 * told this rather than being left to assume, because "autosaved" is a claim.
 *
 * `updated_at` is NOT touched. That column is when the piece was last SAVED, it is what the
 * editor prints and what the pane sorts by, and an autosave moving it would make every post
 * look freshly worked on because somebody left a tab open.
 */
export function putAutosave(kind: AutosaveKind, slug: string, json: string): boolean {
  const { changes } = run(
    `update ${TABLE[kind]} set autosave_json = ?, autosave_at = ? where slug = ? and deleted_at is null`,
    json,
    nowMs(),
    slug,
  )
  return changes > 0
}

export function getAutosave(kind: AutosaveKind, slug: string): Autosave | null {
  const row = one<{ autosave_json: string | null; autosave_at: number | null }>(
    `select autosave_json, autosave_at from ${TABLE[kind]} where slug = ?`,
    slug,
  )
  if (!row?.autosave_json || row.autosave_at == null) return null
  return { json: row.autosave_json, at: row.autosave_at }
}

/**
 * Drop the snapshot, because a real save just landed and it is now the older text.
 *
 * Called from `savePost`/`savePage` rather than from the route, so every path that writes a
 * piece clears it — the MCP server and the importer save through the same function, and a
 * stale snapshot surviving one of those would offer to restore text the author had replaced.
 */
export function clearAutosave(kind: AutosaveKind, slug: string): void {
  run(`update ${TABLE[kind]} set autosave_json = null, autosave_at = null where slug = ?`, slug)
}
