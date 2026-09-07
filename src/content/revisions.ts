// Post "time machine": keep the last few overwritten versions of a post so the
// editor can restore one. Snapshots live in the `post_revisions` table (newest
// first), one row per snapshot: `data` holds the store-relative PostWithContent as
// JSON text, `saved_at` the timestamp.

import type { PostWithContent, PostRevision } from '@/types'
import { collapseBlob, expandBlob } from '@/media/blob'
import { all, one, run } from '@/store/query'
import { nowMs, toIso } from '@/store/db'

const MAX_REVISIONS = 3

// Store-relative snapshot of a post (image refs collapsed to pathnames), so
// revisions carry no Blob host — same portability rule as the live tables.
function collapseSnapshot(p: PostWithContent): PostWithContent {
  return {
    ...p,
    featuredImage: p.featuredImage ? collapseBlob(p.featuredImage) : undefined,
    content: collapseBlob(p.content),
  }
}

// Re-expand a stored snapshot into absolute URLs for the editor / audits.
function expandSnapshot(data: PostWithContent, savedAt: string): PostRevision {
  return {
    ...data,
    featuredImage: data.featuredImage ? expandBlob(data.featuredImage) : undefined,
    content: expandBlob(data.content ?? ''),
    savedAt,
  }
}

// Newest-first list of snapshots for a post (empty when none).
export async function getRevisions(slug: string): Promise<PostRevision[]> {
  try {
    const rows = all<{ data: string; saved_at: number }>(
      // `id desc` is not decoration. Postgres `now()` had microsecond resolution;
      // `saved_at` is milliseconds, so two snapshots can tie and an untied ORDER BY would
      // pick between them arbitrarily — including inside the trim below, which would then
      // delete the wrong one.
      `select data, saved_at from post_revisions where slug = ? order by saved_at desc, id desc`,
      slug,
    )
    return rows.map((r) => expandSnapshot(JSON.parse(r.data) as PostWithContent, toIso(r.saved_at)))
  } catch (error) {
    console.error(`[ERROR] revisions.getRevisions(${slug}): ${(error as Error).message}`)
    return []
  }
}

/** Everything a revision carries, so "the same version" means the same in both directions. */
function sameSnapshot(a: PostWithContent, b: PostWithContent): boolean {
  const of = (p: PostWithContent) => JSON.stringify([
    p.title, p.content, p.date, p.status, p.excerpt ?? '', p.featuredImage ?? '',
    p.coverImage ?? '', p.series ?? '', p.seriesOrder ?? 0,
    [...p.categories].sort(), [...p.tags].sort(),
  ])
  return of(a) === of(b)
}

// Snapshot a version that is about to be overwritten. Inserts it and trims to
// MAX_REVISIONS. Skips a snapshot identical to the latest one so a no-op autosave
// never evicts a genuinely older version.
export async function pushRevision(previous: PostWithContent): Promise<void> {
  const snapshot = collapseSnapshot(previous)
  const latest = one<{ data: string }>(
    `select data from post_revisions where slug = ? order by saved_at desc, id desc limit 1`,
    previous.slug,
  )
  const top = latest ? (JSON.parse(latest.data) as PostWithContent) : undefined
  // IDENTICAL MEANS THE WHOLE SNAPSHOT, not just its body and its title.
  //
  // A revision stores the excerpt, the terms, the status, the date and the featured image
  // as well, and `restoreRevision` puts all of them back — so two snapshots that differ in
  // any of those are two different versions. Comparing only content and title meant that
  // once the newest revision shared a body with what was being saved, every later change to
  // a date, a tag or an excerpt was dropped: the owner could not get the previous one back,
  // and the time machine showed nothing new to explain why.
  if (top && sameSnapshot(top, snapshot)) return

  run(
    `insert into post_revisions (slug, data, saved_at) values (?, ?, ?)`,
    previous.slug,
    JSON.stringify(snapshot),
    nowMs(),
  )

  // Trim: keep only the newest MAX_REVISIONS rows for this slug. Expressed as one
  // statement rather than the frozen tree's select-then-delete-by-id, because SQLite can
  // say it directly and a narrower window has no room for a partial trim.
  run(
    `delete from post_revisions
      where slug = ?
        and id not in (select id from post_revisions where slug = ?
                        order by saved_at desc, id desc limit ?)`,
    previous.slug,
    previous.slug,
    MAX_REVISIONS,
  )
}

// Move a post's revisions when its slug changes (keep history attached).
export async function renameRevisions(from: string, to: string): Promise<void> {
  if (from === to) return
  run(`update post_revisions set slug = ? where slug = ?`, to, from)
}

// Drop all revisions for a post (called when the post itself is deleted).
export async function deleteRevisions(slug: string): Promise<void> {
  run(`delete from post_revisions where slug = ?`, slug)
}
