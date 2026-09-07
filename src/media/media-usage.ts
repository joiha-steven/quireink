// Find media that is referenced NOWHERE — a non-destructive audit for the
// library ("check unused" button, GET /api/media/unused). Returns the list so
// the owner can review and delete by hand; it never deletes anything itself.
//
// "Used" spans post + page bodies/featured images, site settings (logo, OG
// fallback) AND every revision snapshot (time machine) — an image only kept in
// an old revision is still NOT unused, because restoring that revision needs it.
// That is exactly the case the old destructive sweeper missed.

import { getSettings } from '@/content/settings'
import { getMedia } from '@/media/media'
import { collapseBlob } from '@/media/blob'
import { all } from '@/store/query'

const MEDIA_RE = /media\/[^\s")'#]+/gi

// All store-relative media pathnames referenced anywhere in a piece of text.
function refsIn(text: string | undefined): string[] {
  if (!text) return []
  return [...collapseBlob(text).matchAll(MEDIA_RE)].map((m) => m[0])
}

type Body = { content: string | null; featured_image: string | null }

/**
 * Every store-relative media key referenced anywhere it matters for keeping a blob: post and
 * page bodies and featured images, site settings, and every revision snapshot. Purge and the
 * unused audit both build on this ONE definition of "still needed".
 *
 * FOUR QUERIES, not four per post. It walked the index and then asked for each post on its
 * own, then for that post's revisions on their own, and parsed up to three JSON snapshots per
 * slug — every time the owner emptied the media trash or pressed "check unused".
 *
 * TRASHED POSTS AND PAGES COUNT. The old walk read the live index, so an image used only by a
 * trashed post was reported unused and could be permanently deleted — and then the post came
 * back out of the trash with a hole in it. The trash is somewhere a piece comes back FROM,
 * which is the same argument the revision snapshots already won here.
 */
export async function usedMediaKeys(): Promise<Set<string>> {
  const used = new Set<string>()
  const add = (text?: string | null) => refsIn(text ?? undefined).forEach((r) => used.add(r))

  for (const r of all<Body>(`select content, featured_image from posts`)) {
    add(r.content)
    add(r.featured_image)
  }
  for (const r of all<Body>(`select content, featured_image from pages`)) {
    add(r.content)
    add(r.featured_image)
  }
  // The snapshot is the whole post as JSON. Parsed rather than scanned as text: a body's
  // newlines are two characters inside JSON, and a path with one immediately after it would
  // be read as one longer name, which is how a used image becomes an unused one.
  for (const r of all<{ data: string }>(`select data from post_revisions`)) {
    try {
      const snap = JSON.parse(r.data) as { content?: string; featuredImage?: string }
      add(snap.content)
      add(snap.featuredImage)
    } catch (error) {
      console.error(`[ERROR] media-usage.usedMediaKeys revision: ${(error as Error).message}`)
    }
  }
  const s = await getSettings()
  add(s.logoUrl)
  add(s.seo.ogFallbackImage)
  return used
}

// Absolute URLs of media items referenced by no post, page, setting, or
// revision. `getMedia()` already returns expanded URLs (same form the client
// holds), so we hand those straight back for an exact match in the grid.
export async function findUnusedMedia(): Promise<string[]> {
  const used = await usedMediaKeys()
  const media = await getMedia()
  return media.filter((m) => !used.has(collapseBlob(m.url))).map((m) => m.url)
}
