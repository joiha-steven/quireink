// Find media that is referenced NOWHERE — a non-destructive audit for the
// library ("check unused" button, GET /api/media/unused). Returns the list so
// the owner can review and delete by hand; it never deletes anything itself.
//
// "Used" spans post + page bodies/featured images, site settings (logo, OG
// fallback) AND every revision snapshot (time machine) — an image only kept in
// an old revision is still NOT unused, because restoring that revision needs it.
// That is exactly the case the old destructive sweeper missed.

import { getIndex, getPost } from '@/content/posts'
import { getPageIndex, getPage } from '@/content/pages'
import { getRevisions } from '@/content/revisions'
import { getSettings } from '@/content/settings'
import { getMedia } from '@/media/media'
import { collapseBlob } from '@/media/blob'

const MEDIA_RE = /media\/[^\s")'#]+/gi

// All store-relative media pathnames referenced anywhere in a piece of text.
function refsIn(text: string | undefined): string[] {
  if (!text) return []
  return [...collapseBlob(text).matchAll(MEDIA_RE)].map((m) => m[0])
}

// Every store-relative media key referenced anywhere it matters for keeping a blob:
// post + page bodies/featured images, site settings, AND every revision snapshot.
// Purge/unused both build on this ONE definition of "still needed".
export async function usedMediaKeys(): Promise<Set<string>> {
  const used = new Set<string>()
  const add = (text?: string) => refsIn(text).forEach((r) => used.add(r))

  for (const p of await getIndex()) {
    const full = await getPost(p.slug)
    add(full?.content)
    add(full?.featuredImage)
    for (const rev of await getRevisions(p.slug)) {
      add(rev.content)
      add(rev.featuredImage)
    }
  }
  for (const p of await getPageIndex()) {
    const full = await getPage(p.slug)
    add(full?.content)
    add(full?.featuredImage)
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
