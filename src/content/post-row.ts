// One post row, as the database holds it, and the way back to a `Post`.
//
// Its own file so `posts.ts` and `posts-trash.ts` read the same columns and build the same
// object from them. It was private to `posts.ts`, which meant the trash half could only be
// split out of that file by exporting the row shape into a cycle.

import type { Post, SiteLang } from '@/types'
import { expandBlob } from '@/media/blob'
import { TERM_SELECT, parseTerms } from '@/content/post-terms'
import { toIso } from '@/store/db'
import { LANG_CODES } from '@/locales/langs'

/** A stored language code, or undefined when it is absent or not one this blog knows. */
export const asLang = (raw: string | null | undefined): SiteLang | undefined =>
  raw && (LANG_CODES as readonly string[]).includes(raw) ? raw as SiteLang : undefined

// Metadata columns (everything except the heavy `content` body) for list reads.
export const META_COLS = `p.slug, p.title, p.date, p.status, p.featured_image, p.excerpt,
  p.reading_minutes, p.series, p.series_order, p.meta_title, p.meta_description,
  p.cover_image, p.updated_at, p.lang, p.tr_group,${TERM_SELECT}`

// A row as stored (snake_case, store-relative image refs). Timestamps are integer
// milliseconds; `categories`/`tags` arrive as JSON text from the junction table.
export type PostRow = {
  slug: string
  title: string
  date: number
  status: string
  categories: string | null
  tags: string | null
  featured_image: string | null
  excerpt: string | null
  reading_minutes: number | null
  series: string | null
  series_order: number | null
  meta_title: string | null
  meta_description: string | null
  cover_image: string | null
  updated_at?: number | null
  lang: string | null
  tr_group: string | null
  content?: string | null
}

// Row -> Post metadata (absolute image URLs, no body).
export function rowToMeta(row: PostRow): Post {
  return {
    title: row.title,
    slug: row.slug,
    date: toIso(row.date),
    status: row.status === 'published' ? 'published' : 'draft',
    categories: parseTerms(row.categories),
    tags: parseTerms(row.tags),
    featuredImage: row.featured_image ? expandBlob(row.featured_image) : undefined,
    excerpt: row.excerpt ?? undefined,
    readingMinutes: row.reading_minutes ?? undefined,
    series: row.series ?? undefined,
    seriesOrder: row.series != null ? (row.series_order ?? 0) : undefined,
    metaTitle: row.meta_title ?? undefined,
    metaDescription: row.meta_description ?? undefined,
    coverImage: row.cover_image ? expandBlob(row.cover_image) : undefined,
    updatedAt: row.updated_at == null ? undefined : toIso(row.updated_at),
    // NARROWED RATHER THAN CAST. The column is free text and a row can carry anything an
    // older release, an import or a hand-edited database put there; a value that is not one
    // of the eleven reads as "nobody has said", which is what an empty column means anyway.
    lang: asLang(row.lang),
    translationGroup: row.tr_group || undefined,
  }
}
