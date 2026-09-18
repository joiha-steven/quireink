// Pure series ordering + grouping — no db/blob, so it is safe to import from client
// components (the admin SeriesManager) and the edge. The db-backed reads/writes live in
// `series.ts` (which re-exports these for server callers + tests).
import type { Post } from '@/types'
import { slugify } from '@/utils'

// Order within a series: explicit order first, chronological as the tiebreak. Pure.
export function orderSeries(posts: Post[]): Post[] {
  return [...posts].sort(
    (a, b) =>
      (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0) ||
      new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
}

// One series with its ordered parts (incl. drafts) — what the admin manager lists.
export type SeriesEntry = { name: string; slug: string; parts: { slug: string; title: string }[] }

// All series across the passed posts (incl. drafts), each with its ordered parts. Busiest
// first, ties alphabetical. Pure over the passed index (no fetch) so the admin dashboard
// can reuse the posts it already loaded.
/**
 * The URL slug for a series, with the same fallback taxonomy has (`content/taxonomy.ts`).
 *
 * ⚠️ `slugify` folds Latin and Cyrillic and drops the rest, so a series named in Japanese
 * slugs to the empty string. `content/series.ts` learned that in 2026-09 and fixed the public
 * route; this file kept a second copy of the arithmetic — `slugify(name)` with nothing after
 * it — and that copy is the one the admin's series drawer prints into `href="/series/…"`. It
 * printed `/series/`, which resolves to no series at all. One function now, and it lives here
 * because `series.ts` already imports from this file.
 */
export const seriesSlug = (name: string): string => slugify(name) || name

export function seriesEntries(posts: Post[]): SeriesEntry[] {
  const groups = new Map<string, Post[]>()
  for (const p of posts) if (p.series) (groups.get(p.series) ?? groups.set(p.series, []).get(p.series)!).push(p)
  return [...groups]
    .map(([name, group]) => ({
      name,
      slug: seriesSlug(name),
      parts: orderSeries(group).map((p) => ({ slug: p.slug, title: p.title })),
    }))
    .sort((a, b) => b.parts.length - a.parts.length || a.name.localeCompare(b.name))
}
