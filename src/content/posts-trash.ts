// The posts Trash: soft delete, restore, purge, and emptying it.
//
// Split from `posts.ts` when that file reached its ceiling. The seam is by subject: `posts.ts`
// is what a post IS and how it is written, and this is what happens to one after it is thrown
// away — a shorter list with its own rules, chief among them that a trashed post is a post
// that comes back, so its slug stays reserved and its bytes stay on disk.

import type { Post } from '@/types'
import { PostRow, META_COLS, rowToMeta } from '@/content/post-row'
import { deleteRevisions } from '@/content/revisions'
import { deleteCommentsForPost } from '@/comments/comments'
import { clearRedirectForPath } from '@/server/redirects'
import { all, run, tx } from '@/store/query'
import { nowMs, toIso } from '@/store/db'

// Soft-delete (set deleted_at): row/body/revisions/blobs kept, slug stays reserved
// so restore always works. Nothing purged until an explicit Trash purge.
export async function deletePost(slug: string): Promise<void> {
  run(`update posts set deleted_at = ? where slug = ?`, nowMs(), slug)
}

// Restore to live (clear deleted_at); slug was reserved → no collision check.
//
// The redirect goes with it. Trashing a post and then pointing its path somewhere else is
// an ordinary thing to do, and the redirect middleware runs BEFORE the router: without
// this, restoring the post put it back in the table and left it unreachable, answering the
// old redirect instead, with nothing to say why. Live content wins, both directions.
export async function restorePost(slug: string): Promise<void> {
  run(`update posts set deleted_at = null where slug = ?`, slug)
  await clearRedirectForPath(`/${slug}`)
}

// Hard delete a post + its revisions (Trash UI only). `post_terms` cascades. One transaction:
// a purge that stopped after the row left revisions and comments keyed to a slug nothing
// answers to, which nothing would ever collect.
export async function purgePost(slug: string): Promise<void> {
  tx(() => {
    run(`delete from posts where slug = ?`, slug)
    deleteRevisions(slug)
    deleteCommentsForPost(slug)
  })
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
