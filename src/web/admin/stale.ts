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

export function savedSince(kind: keyof typeof TABLE, slug: string, base: unknown): boolean {
  if (typeof base !== 'number' || !Number.isFinite(base)) return false
  const row = one<{ updated_at: number | null }>(`select updated_at from ${TABLE[kind]} where slug = ?`, slug)
  return row?.updated_at != null && row.updated_at > base
}
