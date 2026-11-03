// Two tabs on one piece: the second save must not silently undo the first.
//
// The editor sends `baseSavedAt`, the row's `updated_at` as of its last load or save. A row saved
// after that — by another tab, another device, MCP — is newer than what this tab is looking at,
// and writing over it put the other tab's words into the revision history and nowhere else, with
// "Draft saved" on both screens (2026-09-30). The save is refused instead; the editor keeps its
// text on the device and says to reload. A caller that sends no `baseSavedAt` (MCP, the API,
// imports) is not checked: it is not holding an old copy of the page.
import { one } from '@/store/query'

/** A closed set, and the only identifier interpolated below. */
const TABLE = { post: 'posts', page: 'pages', note: 'notes' } as const

/**
 * Why a save from a copy stamped `base` must not land, or null when it may.
 *
 * THE STAMP ALONE WAS NOT ENOUGH (2026-11-03). Sending a piece to the Trash leaves `updated_at`
 * alone, so a tab opened before took the save, answered "Published" and left the piece in the
 * Trash with the new words; and a save to the address another tab had renamed the piece away
 * from found no row, became a CREATE, and put a second public copy there while the rename's
 * redirect was cleared for it. A caller holding a copy is holding a copy of a ROW, so no live row
 * under that slug is as much "changed since you opened it" as a newer stamp is.
 *
 * - `trashed`: the row is in the Trash. Its own word, because Reload would show a 404 and the
 *   way back is the Trash.
 * - `stale`: saved since, renamed away, or deleted for good.
 */
export function refusedSave(kind: keyof typeof TABLE, slug: string, base: unknown): 'stale' | 'trashed' | null {
  if (typeof base !== 'number' || !Number.isFinite(base)) return null
  const row = one<{ updated_at: number | null; deleted_at: number | null }>(
    `select updated_at, deleted_at from ${TABLE[kind]} where slug = ?`, slug,
  )
  if (!row) return 'stale'
  if (row.deleted_at != null) return 'trashed'
  return row.updated_at != null && row.updated_at > base ? 'stale' : null
}
