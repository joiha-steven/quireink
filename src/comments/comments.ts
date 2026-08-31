// Comments: text-only reader comments in the SQLite `comments` table. The public
// tree is rebuilt here (re-rooting orphans, tombstoning deleted-but-replied nodes)
// and rendered to SAFE html via comment-md — email is NEVER put in the public tree.
// Soft delete via `deleted_at` (Invariant 6), read live through `liveOnly()`.

import type { AdminComment, CommentProvider, PublicComment } from '@/types'
import { renderCommentMarkdown } from '@/comments/comment-md'
import { all, one, run } from '@/store/query'
import { liveOnly, nowMs, toIso } from '@/store/db'

export const MAX_COMMENT_LEN = 1000
const MAX_DEPTH = 2 // depth 0,1,2 => 3 reply tiers

// Bad-input errors from addComment (empty body, missing parent, too-deep reply).
// The route maps these to 400; anything else is a real 500.
export class CommentInputError extends Error {}

// A row as the tree builder and the admin projection see it. Timestamps stay ISO
// strings: this type crosses into `buildCommentTree`, which is pure and unchanged, and
// into JSON payloads. Only the STORAGE representation is integer milliseconds, and the
// conversion happens at the read boundary below.
export type CommentRow = {
  id: number
  post_slug: string
  parent_id: number | null
  depth: number
  author_name: string
  author_email?: string
  author_website: string | null
  author_ip?: string | null
  author_country?: string | null
  provider: string
  content: string
  created_at: string
  deleted_at: string | null
}

type DbRow = Omit<CommentRow, 'created_at' | 'deleted_at'> & {
  created_at: number
  deleted_at: number | null
}

const toRow = (r: DbRow): CommentRow => ({
  ...r,
  created_at: toIso(r.created_at),
  deleted_at: r.deleted_at == null ? null : toIso(r.deleted_at),
})

function asProvider(p: string): CommentProvider {
  return p === 'google' ? p : 'manual'
}

// A key list as ONE bound parameter, rather than a generated `in (?, ?, ?)` run.
const keyList = (keys: (string | number)[]) => JSON.stringify(keys)

// ---- public read: the rendered comment tree for one post ---------------------

// Public projection (no email).
const PUBLIC_COLS = 'id, parent_id, depth, author_name, author_website, provider, content, created_at, deleted_at'

// Recursively build one node. Returns null when a deleted node has no live reply
// (pruned); a deleted node WITH replies becomes a blanked tombstone.
function buildNode(row: CommentRow, childrenBy: Map<number, CommentRow[]>): PublicComment | null {
  const replies = (childrenBy.get(row.id) ?? [])
    .map((c) => buildNode(c, childrenBy))
    .filter((x): x is PublicComment => x !== null)
  const deleted = row.deleted_at !== null
  if (deleted && replies.length === 0) return null
  return {
    id: row.id,
    parentId: row.parent_id,
    name: deleted ? '' : row.author_name,
    website: deleted ? undefined : row.author_website || undefined,
    provider: asProvider(row.provider),
    contentHtml: deleted ? '' : renderCommentMarkdown(row.content),
    createdAt: row.created_at,
    deleted,
    replies,
  }
}

// Pure tree builder (no DB) — exported for tests. Input rows are oldest-first.
// Re-roots orphans (parent purged), prunes deleted leaves, tombstones the rest.
export function buildCommentTree(rows: CommentRow[]): PublicComment[] {
  const ids = new Set(rows.map((r) => r.id))
  const childrenBy = new Map<number, CommentRow[]>()
  const roots: CommentRow[] = []
  for (const r of rows) {
    // A row whose parent was purged (parent_id no longer present) re-roots to top.
    if (r.parent_id === null || !ids.has(r.parent_id)) roots.push(r)
    else (childrenBy.get(r.parent_id) ?? childrenBy.set(r.parent_id, []).get(r.parent_id)!).push(r)
  }
  return roots.map((r) => buildNode(r, childrenBy)).filter((x): x is PublicComment => x !== null)
}

// The full comment tree for a post (incl. tombstones), oldest-first at each level.
export async function getCommentTree(postSlug: string): Promise<PublicComment[]> {
  try {
    // No liveOnly here: deleted rows are needed to render tombstones; pruning happens in buildNode.
    const rows = all<DbRow>(
      `select ${PUBLIC_COLS} from comments where post_slug = ? order by created_at asc, id asc`,
      postSlug,
    )
    return buildCommentTree(rows.map(toRow))
  } catch (error) {
    console.error(`[ERROR] comments.getCommentTree: ${(error as Error).message}`)
    return []
  }
}

// ---- public write ------------------------------------------------------------

export type NewComment = {
  postSlug: string
  parentId: number | null
  name: string
  email: string
  website?: string
  provider: CommentProvider
  content: string
  ip?: string // client IP, stored for admin moderation (never shown publicly)
  country?: string // ISO 3166-1 alpha-2 from the edge, if available
}

// Insert a comment. Validates the parent (must exist, be live, same post, depth <
// MAX_DEPTH) and derives depth server-side — the client is never trusted for it.
// Returns the new node ready to render (single, no replies). Throws on bad input.
export async function addComment(input: NewComment): Promise<PublicComment> {
  const content = input.content.trim().slice(0, MAX_COMMENT_LEN)
  if (!content) throw new CommentInputError('Comment cannot be empty')

  let depth = 0
  let postSlug = input.postSlug
  if (input.parentId !== null) {
    const p = one<{ post_slug: string; depth: number; deleted_at: number | null }>(
      `select post_slug, depth, deleted_at from comments where id = ?`,
      input.parentId,
    )
    if (!p || p.deleted_at !== null) throw new CommentInputError('Comment not found')
    if (p.depth >= MAX_DEPTH) throw new CommentInputError('Maximum reply depth reached')
    depth = p.depth + 1
    postSlug = p.post_slug // a reply always belongs to the parent's post
  }

  const inserted = one<DbRow>(
    `insert into comments (post_slug, parent_id, depth, author_name, author_email,
                           author_website, author_ip, author_country, provider, content, created_at)
     values ($postSlug, $parentId, $depth, $name, $email, $website, $ip, $country, $provider, $content, $now)
     returning ${PUBLIC_COLS}`,
    {
      postSlug, parentId: input.parentId, depth,
      name: input.name, email: input.email,
      website: input.website || null, ip: input.ip || null, country: input.country || null,
      provider: input.provider, content, now: nowMs(),
    },
  )
  if (!inserted) throw new Error('addComment: no row')
  const row = toRow(inserted)
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.author_name,
    website: row.author_website || undefined,
    provider: asProvider(row.provider),
    contentHtml: renderCommentMarkdown(row.content),
    createdAt: row.created_at,
    deleted: false,
    replies: [],
  }
}

// ---- counts ------------------------------------------------------------------

// slug -> live comment count, for the admin content table.
export async function countsByPosts(): Promise<Record<string, number>> {
  try {
    const out: Record<string, number> = {}
    const rows = all<{ post_slug: string; n: number }>(
      `select post_slug, count(*) n from comments where ${liveOnly('comments')} group by post_slug`,
    )
    for (const r of rows) out[r.post_slug] = r.n
    return out
  } catch (error) {
    console.error(`[ERROR] comments.countsByPosts: ${(error as Error).message}`)
    return {}
  }
}

// ---- admin reads (flat, include email + post title) --------------------------

const ADMIN_COLS = 'id, post_slug, parent_id, depth, author_name, author_email, author_website, author_ip, author_country, provider, content, created_at, deleted_at'

// Map post slugs -> titles so the admin table can show which post a comment is on.
async function titlesFor(slugs: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(slugs)]
  if (unique.length === 0) return {}
  const out: Record<string, string> = {}
  const rows = all<{ slug: string; title: string }>(
    `select slug, title from posts where slug in (select value from json_each(?))`,
    keyList(unique),
  )
  for (const r of rows) out[r.slug] = r.title
  return out
}

function toAdmin(row: CommentRow, titles: Record<string, string>): AdminComment {
  return {
    id: row.id,
    postSlug: row.post_slug,
    postTitle: titles[row.post_slug] || row.post_slug,
    name: row.author_name,
    email: row.author_email ?? '',
    website: row.author_website || undefined,
    provider: asProvider(row.provider),
    content: row.content,
    ip: row.author_ip || undefined,
    country: row.author_country || undefined,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? undefined,
  }
}

// One page of LIVE comments, newest first, for the admin Comments table.
export async function getAdminComments(page = 1, perPage = 50): Promise<{ rows: AdminComment[]; total: number }> {
  try {
    const from = (Math.max(1, page) - 1) * perPage
    const total = one<{ n: number }>(
      `select count(*) n from comments where ${liveOnly('comments')}`,
    )?.n ?? 0
    const rows = all<DbRow>(
      `select ${ADMIN_COLS} from comments where ${liveOnly('comments')}
        order by created_at desc, id desc limit ? offset ?`,
      perPage, from,
    ).map(toRow)
    const titles = await titlesFor(rows.map((r) => r.post_slug))
    return { rows: rows.map((r) => toAdmin(r, titles)), total }
  } catch (error) {
    console.error(`[ERROR] comments.getAdminComments: ${(error as Error).message}`)
    return { rows: [], total: 0 }
  }
}

// Trashed comments (most-recently-deleted first) for the Trash view.
export async function getTrashedComments(): Promise<AdminComment[]> {
  try {
    const rows = all<DbRow>(
      `select ${ADMIN_COLS} from comments where deleted_at is not null
        order by deleted_at desc, id desc`,
    ).map(toRow)
    const titles = await titlesFor(rows.map((r) => r.post_slug))
    return rows.map((r) => toAdmin(r, titles))
  } catch (error) {
    console.error(`[ERROR] comments.getTrashedComments: ${(error as Error).message}`)
    return []
  }
}

// ---- mutations ---------------------------------------------------------------

/**
 * Who wrote it and where, for the activity log.
 *
 * The log recorded a comment deletion as the row's ID and nothing else, which tells whoever
 * reads it back that a number is gone. A name and a post is the line somebody can act on.
 */
export async function describeComment(id: number): Promise<string> {
  const row = one<{ author_name: string; post_slug: string }>(
    `select author_name, post_slug from comments where id = ?`, id,
  )
  return row ? `${row.author_name} on ${row.post_slug}` : `#${id}`
}

// Soft-delete (Trash): live replies survive and the node renders as a tombstone.
export async function softDeleteComment(id: number): Promise<void> {
  run(`update comments set deleted_at = ? where id = ?`, nowMs(), id)
}

export async function restoreComment(id: number): Promise<void> {
  run(`update comments set deleted_at = null where id = ?`, id)
}

// Hard delete one comment (Trash purge). Any live child re-roots to top on read.
export async function purgeComment(id: number): Promise<void> {
  run(`delete from comments where id = ?`, id)
}

// Permanently remove EVERY trashed comment. Returns the count.
export async function emptyCommentsTrash(): Promise<number> {
  const trashed = await getTrashedComments()
  if (trashed.length === 0) return 0
  run(
    `delete from comments where id in (select value from json_each(?))`,
    keyList(trashed.map((c) => c.id)),
  )
  return trashed.length
}

// Move a post's comments when its slug changes (called from savePost's rename path).
export async function renameComments(oldSlug: string, newSlug: string): Promise<void> {
  run(`update comments set post_slug = ? where post_slug = ?`, newSlug, oldSlug)
}

// Hard-delete every comment of a post (called when the post itself is purged).
export async function deleteCommentsForPost(postSlug: string): Promise<void> {
  run(`delete from comments where post_slug = ?`, postSlug)
}
