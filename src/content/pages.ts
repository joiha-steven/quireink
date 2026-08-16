// Static page data access. Mirrors posts.ts but with no taxonomy or date.
// Stored in the SQLite `pages` table (metadata + markdown body in `content`).

import type { Page, PageWithContent } from '@/types'
import { collapseBlob, expandBlob } from '@/media/blob'
import { slugify } from '@/utils'
import { ensureSlugFree } from '@/content/slugs'
import { saveRedirect, clearRedirectForPath } from '@/server/redirects'
import { all, one, run } from '@/store/query'
import { liveOnly, nowMs, toIso } from '@/store/db'

// `updated_at` joined the list read when the admin stopped sorting by title: one stream of
// posts AND pages, most recently touched first (ADR 0024), needs pages to carry the same
// stamp posts always did.
const META_COLS = 'slug, title, status, featured_image, updated_at'

type PageRow = {
  slug: string
  title: string
  status: string
  featured_image: string | null
  updated_at?: number | null
  content?: string | null
}

function rowToMeta(row: PageRow): Page {
  return {
    title: row.title,
    slug: row.slug,
    status: row.status === 'published' ? 'published' : 'draft',
    featuredImage: row.featured_image ? expandBlob(row.featured_image) : undefined,
    updatedAt: row.updated_at ? toIso(row.updated_at) : undefined,
  }
}

// Metadata list, ordered by title. The frozen tree wrapped this in `React.cache` to dedupe
// within one render; there is no render pass to dedupe across here, and the read is a
// synchronous indexed scan of a table with tens of rows.
function readIndex(): Page[] {
  try {
    return all<PageRow>(`select ${META_COLS} from pages where ${liveOnly('pages')}`)
      .map(rowToMeta)
      .sort((a, b) => a.title.localeCompare(b.title))
  } catch (error) {
    console.error(`[ERROR] pages.readIndex: ${(error as Error).message}`)
    return []
  }
}

// Metadata manifest, ordered by title (admin list incl. drafts).
export async function getPageIndex(): Promise<Page[]> {
  return readIndex()
}

// Public-facing list: published only (pages have no date gate).
export async function getPublicPages(): Promise<Page[]> {
  return readIndex().filter((p) => p.status === 'published')
}

// Read one full page.
export async function getPage(slug: string): Promise<PageWithContent | null> {
  try {
    const row = one<PageRow>(`select * from pages where ${liveOnly('pages')} and slug = ?`, slug)
    if (!row) return null
    return { ...rowToMeta(row), content: expandBlob(row.content ?? '') }
  } catch (error) {
    console.error(`[ERROR] pages.getPage(${slug}): ${(error as Error).message}`)
    return null
  }
}

// Normalize incoming data into a complete Page + content pair.
function normalize(input: Partial<PageWithContent>): PageWithContent {
  const content = (input.content ?? '').trim()
  const title = (input.title ?? '').trim()
  // Guard an empty slug (slugify can empty an emoji/punctuation title) — see posts.ts.
  const slug = (input.slug?.trim() ? slugify(input.slug) : slugify(title)) || `page-${Date.now()}`
  return {
    title,
    slug,
    status: input.status === 'published' ? 'published' : 'draft',
    featuredImage: input.featuredImage || undefined,
    content,
  }
}

function toMeta(page: PageWithContent): Page {
  const { content: _content, ...meta } = page
  void _content
  return meta
}

// Create or overwrite a page.
export async function savePage(
  input: Partial<PageWithContent>,
  previousSlug?: string,
): Promise<Page> {
  const page = normalize(input)
  // Reject a slug already taken by another page or post (shared URL namespace).
  await ensureSlugFree(page.slug, 'page', previousSlug)

  const now = nowMs()
  // `created_at` is absent from the update list ON PURPOSE: an overwrite must not restamp
  // the row's birth. `deleted_at` is absent for the same reason it was in the frozen tree's
  // payload — saving a trashed page must not silently untrash it.
  run(
    `insert into pages (slug, title, status, featured_image, content, created_at, updated_at)
     values ($slug, $title, $status, $featuredImage, $content, $now, $now)
     on conflict(slug) do update set
       title          = excluded.title,
       status         = excluded.status,
       featured_image = excluded.featured_image,
       content        = excluded.content,
       updated_at     = excluded.updated_at`,
    {
      slug: page.slug,
      title: page.title,
      status: page.status,
      featuredImage: page.featuredImage ? collapseBlob(page.featuredImage) : null,
      content: collapseBlob(page.content),
      now: now,
    },
  )

  // If the slug changed, drop the old row + leave a 301 from the old path.
  if (previousSlug && previousSlug !== page.slug) {
    run(`delete from pages where slug = ?`, previousSlug)
    await saveRedirect({ source: `/${previousSlug}`, destination: `/${page.slug}`, permanent: true })
  }
  // The live slug wins over any redirect that used it as a source (and no self-loop).
  await clearRedirectForPath(`/${page.slug}`)

  return toMeta(page) // full URLs for the client
}

// Soft-delete a page: move it to the Trash (set deleted_at). The row, body and any
// referenced blobs are kept; nothing is purged until an explicit Trash purge. The
// slug stays reserved (the row still exists) so restore always works.
export async function deletePage(slug: string): Promise<void> {
  run(`update pages set deleted_at = ? where slug = ?`, nowMs(), slug)
}

// Restore a trashed page back to live (clear deleted_at).
export async function restorePage(slug: string): Promise<void> {
  run(`update pages set deleted_at = null where slug = ?`, slug)
}

// Permanently remove a page (hard delete, irreversible). Only reached from Trash.
export async function purgePage(slug: string): Promise<void> {
  run(`delete from pages where slug = ?`, slug)
}

// Trashed pages (metadata only), most-recently-deleted first, for the Trash view.
export async function getTrashedPages(): Promise<Page[]> {
  try {
    const rows = all<PageRow & { deleted_at: number }>(
      `select ${META_COLS}, deleted_at from pages
        where deleted_at is not null order by deleted_at desc`,
    )
    return rows.map((row) => ({ ...rowToMeta(row), deletedAt: toIso(row.deleted_at) }))
  } catch (error) {
    console.error(`[ERROR] pages.getTrashedPages: ${(error as Error).message}`)
    return []
  }
}

// Permanently remove EVERY trashed page (empty the pages Trash). Returns the count.
export async function emptyPagesTrash(): Promise<number> {
  const trashed = await getTrashedPages()
  await Promise.all(trashed.map((p) => purgePage(p.slug)))
  return trashed.length
}
