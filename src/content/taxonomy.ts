// Taxonomy slugs: category/tag URLs use the slugified term (e.g. "Suy nghĩ" →
// /category/suy-nghi) instead of the raw %-encoded name. Terms are stored on posts
// as their display name; the slug is derived (slugify) for the URL and resolved
// back by matching. Slugify is lossy, so the route finds the term whose slug
// matches and shows its real name.

import { slugify } from '@/utils'

type Taxo = 'categories' | 'tags'
type HasTaxo = { categories: string[]; tags: string[] }

// The URL slug for a taxonomy term (what links should point at).
export const termSlug = (term: string): string => slugify(term)

/**
 * A TAG as it is displayed: spaces become hyphens, diacritics kept.
 *
 * "giao diện" reads as two ordinary words, and a cloud of them ("viết mẫu giao diện hiệu
 * năng") reads as a sentence with no way to see where one tag ends. Hyphenated, every tag
 * is one unbroken token and the run is legible without a separator, a chip or a box.
 *
 * Display only — the stored term, the slug and every link keep the real name, so this
 * changes nothing a URL or a search depends on. Categories are proper names ("Kỹ thuật")
 * and are deliberately NOT hyphenated.
 */
export const tagText = (term: string): string => term.replace(/\s+/g, '-')

// Resolve a taxonomy slug among posts: the matching posts + the term's display
// name (first match, or null if no term matches). Back-compat: also matches a raw
// pre-slug term, so old %-encoded URLs (/category/Suy%20ngh%C4%A9) still resolve.
export function resolveTerm<T extends HasTaxo>(posts: T[], kind: Taxo, slug: string): { name: string | null; posts: T[] } {
  let raw = slug
  try {
    raw = decodeURIComponent(slug)
  } catch {
    /* malformed encoding → compare against the literal slug */
  }
  let name: string | null = null
  const matched = posts.filter((p) =>
    p[kind].some((term) => {
      const hit = slugify(term) === slug || term === raw
      if (hit && name === null) name = term
      return hit
    }),
  )
  return { name, posts: matched }
}
