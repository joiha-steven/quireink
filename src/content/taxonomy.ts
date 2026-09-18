// Taxonomy slugs: category/tag URLs use the slugified term (e.g. "Suy nghĩ" →
// /category/suy-nghi) instead of the raw %-encoded name. Terms are stored on posts
// as their display name; the slug is derived (slugify) for the URL and resolved
// back by matching. Slugify is lossy, so the route finds the term whose slug
// matches and shows its real name.

import { slugify } from '@/utils'

type Taxo = 'categories' | 'tags'
type HasTaxo = { categories: string[]; tags: string[] }

/**
 * The URL slug for a taxonomy term (what links should point at).
 *
 * ⚠️ THE RAW TERM WHEN THERE IS NOTHING TO SLUGIFY, and that is not a nicety. `slugify` folds
 * Latin and Cyrillic and drops everything else, so a tag written in Japanese, Chinese, Korean,
 * Thai, Arabic, Hebrew, Hindi or Greek came back as the EMPTY STRING — eight scripts, three of
 * which this admin is translated into. Every taxonomy link on every page then pointed at
 * `/tag/`, which is a 404; the sitemap advertised the same dead URL and collapsed every such
 * tag into one `<loc>`; and worst of all `/tag/日本語` WORKED until `canonicalTermSlug` compared
 * it against the empty slug and 301'd the working address into the dead one. A blog in one of
 * those scripts had no reachable term archive at all.
 *
 * A post slug has a `post-<timestamp>` fallback for the same reason, and `slugify`'s own comment
 * records CJK falling through to it deliberately. Taxonomy had no fallback of any kind.
 *
 * Raw rather than percent-encoded, because that is what the rest of the tree already compares
 * against: `resolveTerm` matches `term === raw` after decoding, and `web/term-routes.ts` encodes
 * once when it redirects. Returning an encoded slug here would make the canonical check see a
 * difference that is not one and 301 to a double-encoded address.
 */
export const termSlug = (term: string): string => slugify(term) || term

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

/**
 * The one address a term archive answers at, for a URL that may be an old spelling of it.
 *
 * `resolveTerm` deliberately matches the raw pre-slug term as well, so an inbound
 * `/category/Suy%20ngh%C4%A9` still finds its posts. That is a redirect, not a second page:
 * left as a 200 it printed a canonical, an og:url, a feed link and a pager all carrying the
 * raw name, spaces and all, so one archive had two indexable addresses each claiming to be
 * the canonical one. Null when nothing matches, so the caller can 404 as before.
 */
export function canonicalTermSlug<T extends HasTaxo>(posts: T[], kind: Taxo, slug: string): string | null {
  const { name } = resolveTerm(posts, kind, slug)
  return name === null ? null : termSlug(name)
}

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
