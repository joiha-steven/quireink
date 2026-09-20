// Find media that is referenced NOWHERE — a non-destructive audit for the
// library ("check unused" button, GET /api/media/unused). Returns the list so
// the owner can review and delete by hand; it never deletes anything itself.
//
// "Used" spans every text a post, a page, a NOTE, a revision snapshot or the settings holds —
// an image only kept in an old revision is still NOT unused, because restoring that revision
// needs it. That is exactly the case the old destructive sweeper missed.

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

/** Every string anywhere inside a row or a parsed snapshot, however deeply it sits. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const v of value) strings(v, out)
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out)
  return out
}

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

  // ⚠️ THE WHOLE ROW, not the columns somebody remembered — the same rule the settings block
  // below already learned, applied to the tables. Naming columns missed three live references
  // and nothing said so, because a sweep that reads two columns reports the third as unused
  // with exactly the confidence it reports a real orphan:
  //
  //   `posts.cover_image` — a second picture per post, in its own column since the paper look
  //   `notes.content`     — the entire notebook, never read here at all
  //   `coverImage` in a revision snapshot — read as two named fields, and that was not one
  //
  // The audit is the only thing between the library's "delete for ever" and a live page, and
  // `purgeMediaBatch` takes the blob, so a backup made afterwards does not carry the bytes
  // either. Proved with the real routes on 2026-09-19: a cover image and a note's image were
  // both reported unused and purged 200, while a body image was correctly refused 409.
  //
  // `select *` costs the extra columns of a row whose body was being read anyway, and buys the
  // column somebody adds next year. `refsIn` only matches `media/…`, so a title or a slug
  // passing through it finds nothing.
  for (const table of ['posts', 'pages', 'notes'] as const) {
    // A fixed identifier from a closed set, which is the one thing that may be interpolated
    // (CLAUDE.md). No value goes near this string.
    for (const row of all<Record<string, unknown>>(`select * from ${table}`)) {
      for (const text of strings(row)) add(text)
    }
  }
  // The snapshot is the whole post as JSON. PARSED rather than scanned as text: a body's
  // newlines are two characters inside JSON, and a path with one immediately after it would
  // be read as one longer name, which is how a used image becomes an unused one. Then every
  // string in the parsed object, for the reason above — it held `coverImage` all along.
  for (const r of all<{ data: string }>(`select data from post_revisions`)) {
    try {
      for (const text of strings(JSON.parse(r.data))) add(text)
    } catch (error) {
      console.error(`[ERROR] media-usage.usedMediaKeys revision: ${(error as Error).message}`)
    }
  }
  // ⚠️ THE WHOLE SETTINGS OBJECT, not a list of the fields somebody remembered. It read
  // `logoUrl` and `seo.ogFallbackImage` and nothing else, so SEVEN other pictures the owner had
  // chosen were reported as referenced nowhere: the author's avatar, the favicon, the app icon,
  // the dark logo, and the three derived twins the logo pipeline writes. Reported by eye about
  // the avatar; the favicon and the app icon were in the same list, and this audit exists to
  // tell somebody what is safe to delete.
  //
  // A list of fields is a list that goes stale the next time a setting holds a picture, and
  // nothing would say so — the sweep would simply start naming that one too. `refsIn` already
  // finds `media/…` anywhere in a string, and JSON puts a quote either side of every value,
  // which is where the pattern stops. So the rule is the object.
  add(JSON.stringify(await getSettings()))
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
