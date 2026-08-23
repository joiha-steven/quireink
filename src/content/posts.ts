// Posts: metadata columns + markdown body in the SQLite `posts` table. Categories and
// tags live in `post_terms` (see post-terms.ts). Image refs (body + featuredImage) stored
// store-relative, re-expanded to absolute URLs on read.

import type { Post, PostWithContent } from '@/types'
import { collapseBlob, expandBlob } from '@/media/blob'
import { slugify, deriveExcerpt, clampExcerpt, isPublicallyVisible, readingMinutes } from '@/utils'
import { ensureSlugFree } from '@/content/slugs'
import { pushRevision, renameRevisions, deleteRevisions } from '@/content/revisions'
import { renameComments, deleteCommentsForPost } from '@/comments/comments'
import { saveRedirect, clearRedirectForPath } from '@/server/redirects'
import { getSettings } from '@/content/settings'
import { writeExcerpt } from '@/content/ai-excerpt'
import { TERM_SELECT, parseTerms, writeTerms, updateTermRows, type TermKind } from '@/content/post-terms'
import { all, one, run, tx } from '@/store/query'
import { liveOnly, nowMs, toIso, fromIso } from '@/store/db'

export type { TermKind }

// Metadata columns (everything except the heavy `content` body) for list reads.
const META_COLS = `p.slug, p.title, p.date, p.status, p.featured_image, p.excerpt,
  p.reading_minutes, p.series, p.series_order, p.meta_title, p.meta_description,
  p.cover_image, p.updated_at,${TERM_SELECT}`

// A row as stored (snake_case, store-relative image refs). Timestamps are integer
// milliseconds; `categories`/`tags` arrive as JSON text from the junction table.
type PostRow = {
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
  content?: string | null
}

// Row -> Post metadata (absolute image URLs, no body).
function rowToMeta(row: PostRow): Post {
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
  }
}

// Stable projection of meaningful fields — to decide whether a save changed
// anything (so a no-op autosave skips a revision).
function projection(p: PostWithContent): string {
  return JSON.stringify({
    title: p.title,
    date: p.date,
    status: p.status,
    categories: p.categories,
    tags: p.tags,
    series: p.series ?? '',
    seriesOrder: p.seriesOrder ?? 0,
    metaTitle: p.metaTitle ?? '',
    metaDescription: p.metaDescription ?? '',
    coverImage: p.coverImage ? collapseBlob(p.coverImage) : '',
    featuredImage: p.featuredImage ? collapseBlob(p.featuredImage) : '',
    excerpt: p.excerpt ?? '',
    content: collapseBlob(p.content),
  })
}

// Full metadata list, newest first. The frozen tree wrapped this in `React.cache` to
// dedupe within one render; there is no render pass to dedupe across here.
function readIndex(): Post[] {
  try {
    return all<PostRow>(
      `select ${META_COLS} from posts p where ${liveOnly('p')} order by p.date desc`,
    ).map(rowToMeta)
  } catch (error) {
    // Degrade to empty (DB unreachable) instead of 500ing.
    console.error(`[ERROR] posts.readIndex: ${(error as Error).message}`)
    return []
  }
}

// Full metadata manifest, newest first (admin list incl. drafts).
export async function getIndex(): Promise<Post[]> {
  return readIndex()
}

// Public list: published + date reached only.
export async function getPublicPosts(): Promise<Post[]> {
  return readIndex().filter((p) => isPublicallyVisible(p.status, p.date))
}

/**
 * FTS5 query text from a user's words. Every token becomes a quoted phrase, so the string
 * can never be read as FTS5 operator syntax: an apostrophe, a `-`, a stray `"` or a bare
 * `OR` would otherwise throw a syntax error and silently return no results. Space-joined
 * phrases are an implicit AND, matching the `websearch` behaviour this replaces.
 */
function ftsQuery(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word.replaceAll('"', '""')}"`)
    .join(' ')
}

// Full-text over title + BODY. `remove_diacritics 2` folds accents in the INDEX, so
// "lap trinh" finds "lập trình" with no accent-stripping layer above.
// Ordering stays date-desc, as in the frozen tree; bm25 relevance ranking is an ALLOWED
// parity exception that has deliberately not been taken during the port.
export async function searchPosts(query: string): Promise<Post[]> {
  const q = query.trim()
  if (!q) return []
  try {
    return all<PostRow>(
      `select ${META_COLS} from posts_fts f
         join posts p on p.rowid = f.rowid
        where posts_fts match ? and ${liveOnly('p')} and p.status = 'published'
        order by p.date desc limit 50`,
      ftsQuery(q),
    )
      .map(rowToMeta)
      .filter((p) => isPublicallyVisible(p.status, p.date))
  } catch (error) {
    console.error(`[ERROR] posts.searchPosts: ${(error as Error).message}`)
    return []
  }
}

// Read one full post.
export async function getPost(slug: string): Promise<PostWithContent | null> {
  try {
    const row = one<PostRow>(
      `select ${META_COLS}, p.content from posts p where ${liveOnly('p')} and p.slug = ?`,
      slug,
    )
    if (!row) return null
    return { ...rowToMeta(row), content: expandBlob(row.content ?? '') }
  } catch (error) {
    console.error(`[ERROR] posts.getPost(${slug}): ${(error as Error).message}`)
    return null
  }
}

// Normalize input into a complete Post + content pair. `excerptWords` sets the
// auto-excerpt length when the author leaves it blank.
function normalize(input: Partial<PostWithContent>, excerptWords = 50): PostWithContent {
  const content = (input.content ?? '').trim()
  const title = (input.title ?? '').trim()
  // slugify() can reduce a non-empty title/slug (emoji, punctuation-only, an empty
  // import title) to '' — an empty slug makes the row unreachable in the editor and
  // Trash. Fall back to a timestamped slug so every post keeps an editable identity.
  const slug = (input.slug?.trim() ? slugify(input.slug) : slugify(title)) || `post-${Date.now()}`
  // Author excerpt wins (length-capped); else auto from the body.
  const excerpt = input.excerpt?.trim() ? clampExcerpt(input.excerpt.trim()) : deriveExcerpt(content, excerptWords)
  return {
    title,
    slug,
    date: input.date ?? new Date().toISOString(),
    status: input.status === 'published' ? 'published' : 'draft',
    categories: input.categories ?? [],
    tags: input.tags ?? [],
    series: input.series?.trim() || undefined,
    seriesOrder: input.series?.trim() ? (input.seriesOrder ?? 0) : undefined,
    metaTitle: input.metaTitle?.trim() || undefined,
    metaDescription: input.metaDescription?.trim() || undefined,
    coverImage: input.coverImage || undefined,
    featuredImage: input.featuredImage || undefined,
    excerpt,
    content,
  }
}

// Drop the body, add computed reading time so lists (no bodies) can show it.
function toMeta(post: PostWithContent): Post {
  const { content, ...meta } = post
  return { ...meta, readingMinutes: readingMinutes(content) }
}

// Create or overwrite a post.
export async function savePost(
  input: Partial<PostWithContent>,
  previousSlug?: string,
): Promise<Post> {
  const { excerptLength } = await getSettings()
  const post = normalize(input, excerptLength)
  // Slug shared across posts + pages → reject collisions.
  await ensureSlugFree(post.slug, 'post', previousSlug)

  // Time machine: snapshot the current version before overwriting.
  const overwriting = previousSlug ?? post.slug
  const existing = one<PostRow>(
    `select ${META_COLS}, p.content from posts p where p.slug = ?`, overwriting,
  )
  if (existing) {
    const prev: PostWithContent = { ...rowToMeta(existing), content: expandBlob(existing.content ?? '') }
    if (projection(prev) !== projection({ ...post, slug: prev.slug })) {
      await pushRevision(prev)
    }
  }

  // The row and its terms move together: a half-applied save would leave a post carrying
  // its predecessor's categories.
  tx(() => {
    run(
      `insert into posts (slug, title, date, status, featured_image, excerpt, reading_minutes,
                          content, series, series_order, meta_title, meta_description,
                          cover_image, created_at, updated_at)
       values ($slug, $title, $date, $status, $featuredImage, $excerpt, $readingMinutes,
               $content, $series, $seriesOrder, $metaTitle, $metaDescription,
               $coverImage, $now, $now)
       on conflict(slug) do update set
         title = excluded.title, date = excluded.date, status = excluded.status,
         featured_image = excluded.featured_image, excerpt = excluded.excerpt,
         reading_minutes = excluded.reading_minutes, content = excluded.content,
         series = excluded.series, series_order = excluded.series_order,
         meta_title = excluded.meta_title, meta_description = excluded.meta_description,
         cover_image = excluded.cover_image, updated_at = excluded.updated_at`,
      {
        slug: post.slug,
        title: post.title,
        date: fromIso(post.date),
        status: post.status,
        featuredImage: post.featuredImage ? collapseBlob(post.featuredImage) : null,
        excerpt: post.excerpt ?? null,
        // Recomputed so the column stays in sync with the body for list reads.
        readingMinutes: readingMinutes(post.content),
        content: collapseBlob(post.content),
        series: post.series?.trim() || null,
        seriesOrder: post.series?.trim() ? (post.seriesOrder ?? 0) : 0,
        metaTitle: post.metaTitle?.trim() || null,
        metaDescription: post.metaDescription?.trim() || null,
        coverImage: post.coverImage ? collapseBlob(post.coverImage) : null,
        now: nowMs(),
      },
    )
    writeTerms(post.slug, post.categories, post.tags)
  })

  // Slug changed → drop the old row, move its revisions + comments, and leave a 301
  // from the old path so existing links + search results keep working.
  if (previousSlug && previousSlug !== post.slug) {
    run(`delete from posts where slug = ?`, previousSlug)
    await renameRevisions(previousSlug, post.slug)
    await renameComments(previousSlug, post.slug)
    await saveRedirect({ source: `/${previousSlug}`, destination: `/${post.slug}`, permanent: true })
  }
  // This slug is now live content, so any redirect that used it as a SOURCE is stale
  // (live content must win over a redirect; also breaks a rename-back self-loop).
  await clearRedirectForPath(`/${post.slug}`)

  // The AUTHOR left the excerpt blank on a published post — normalize() has already
  // stored the mechanical fifty-word fallback, and only this save path knows the field
  // was blank. Fire-and-forget: the job declines instantly unless a key and its switch
  // are both on, and its write-back is guarded so an author edit always wins.
  if (post.status === 'published' && !input.excerpt?.trim()) {
    void writeExcerpt(post.slug, post.excerpt ?? '', post.content)
  }

  return toMeta(post)
}

// Soft-delete (set deleted_at): row/body/revisions/blobs kept, slug stays reserved
// so restore always works. Nothing purged until an explicit Trash purge.
export async function deletePost(slug: string): Promise<void> {
  run(`update posts set deleted_at = ? where slug = ?`, nowMs(), slug)
}

// Restore to live (clear deleted_at); slug was reserved → no collision check.
export async function restorePost(slug: string): Promise<void> {
  run(`update posts set deleted_at = null where slug = ?`, slug)
}

// Hard delete a post + its revisions (Trash UI only). `post_terms` cascades.
export async function purgePost(slug: string): Promise<void> {
  run(`delete from posts where slug = ?`, slug)
  await deleteRevisions(slug)
  await deleteCommentsForPost(slug)
}

// Trashed posts (metadata only), most-recently-deleted first, for the Trash view.
export async function getTrashedPosts(): Promise<Post[]> {
  try {
    return all<PostRow & { deleted_at: number }>(
      `select ${META_COLS}, p.deleted_at from posts p
        where p.deleted_at is not null order by p.deleted_at desc`,
    ).map((row) => ({ ...rowToMeta(row), deletedAt: toIso(row.deleted_at) }))
  } catch (error) {
    console.error(`[ERROR] posts.getTrashedPosts: ${(error as Error).message}`)
    return []
  }
}

// Permanently remove EVERY trashed post (empty the posts Trash). Returns the count.
export async function emptyPostsTrash(): Promise<number> {
  const trashed = await getTrashedPosts()
  await Promise.all(trashed.map((p) => purgePost(p.slug)))
  return trashed.length
}

// Up to `limit` other public posts sharing the most tags/categories (tags weighted
// ×2), newest first as tiebreak. Empty when nothing shares.
export async function getRelatedPosts(slug: string, limit = 3): Promise<Post[]> {
  const all = await getPublicPosts()
  const current = all.find((p) => p.slug === slug)
  if (!current) return []
  const tags = new Set(current.tags)
  const cats = new Set(current.categories)
  return all
    .filter((p) => p.slug !== slug)
    .map((p) => ({
      p,
      score: p.tags.filter((t) => tags.has(t)).length * 2 + p.categories.filter((c) => cats.has(c)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.p.date).getTime() - new Date(a.p.date).getTime())
    .slice(0, limit)
    .map((x) => x.p)
}

// Rename (newName set) or remove (null) a category/tag across EVERY post. Returns posts
// changed. One UPDATE now, not the frozen tree's read-modify-write over every row.
export async function updateTerm(kind: TermKind, name: string, newName: string | null): Promise<number> {
  return tx(() => updateTermRows(kind, name, newName?.trim() || null))
}

// Distinct categories across all posts.
export async function getCategories(): Promise<string[]> {
  const posts = await getIndex()
  return [...new Set(posts.flatMap((p) => p.categories))].sort()
}

// Distinct tags across all posts.
export async function getTags(): Promise<string[]> {
  const posts = await getIndex()
  return [...new Set(posts.flatMap((p) => p.tags))].sort()
}

export type TermCount = { name: string; count: number }

// Terms of PUBLISHED posts only, with their post counts — what the public sidebar
// lists. Busiest first, ties alphabetical. (`getCategories`/`getTags` above serve
// the admin, and include drafts.)
export async function getPublicTaxonomy(): Promise<{ categories: TermCount[]; tags: TermCount[] }> {
  const posts = await getPublicPosts()
  const tally = (pick: (p: Post) => string[]): TermCount[] => {
    const counts = new Map<string, number>()
    for (const p of posts) for (const term of pick(p)) counts.set(term, (counts.get(term) ?? 0) + 1)
    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }
  return { categories: tally((p) => p.categories), tags: tally((p) => p.tags) }
}
