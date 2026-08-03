// The `buildCommentTree` cases are the frozen tree's, unchanged: it is a pure function
// and its five behaviours are the ones a renderer can silently lose. The `addComment`
// guards no longer mock the data layer; the parent row is real, which is the only way to
// prove the depth is derived from the STORED parent rather than from the caller.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db, nowMs } from '@/store/db'
import {
  buildCommentTree, addComment, getCommentTree, countsByPosts, getAdminComments,
  getTrashedComments, softDeleteComment, restoreComment, purgeComment,
  emptyCommentsTrash, renameComments, deleteCommentsForPost,
  CommentInputError, MAX_COMMENT_LEN, type CommentRow,
} from '@/comments/comments'

const DIR = './.tmp/test-comments'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => {
  db().run(`delete from comments`)
  db().run(`delete from posts`)
})

// Build a row with sane defaults; override what each case needs.
function row(p: Partial<CommentRow> & { id: number }): CommentRow {
  return {
    id: p.id,
    post_slug: p.post_slug ?? 'hello',
    parent_id: p.parent_id ?? null,
    depth: p.depth ?? 0,
    author_name: p.author_name ?? `u${p.id}`,
    author_website: p.author_website ?? null,
    provider: p.provider ?? 'manual',
    content: p.content ?? `c${p.id}`,
    created_at: p.created_at ?? '2026-01-01T00:00:00Z',
    deleted_at: p.deleted_at ?? null,
  }
}

describe('buildCommentTree', () => {
  it('nests replies under their parent', () => {
    const tree = buildCommentTree([
      row({ id: 1 }),
      row({ id: 2, parent_id: 1, depth: 1 }),
      row({ id: 3, parent_id: 2, depth: 2 }),
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.replies[0]!.id).toBe(2)
    expect(tree[0]!.replies[0]!.replies[0]!.id).toBe(3)
  })

  it('renders content as limited markdown, never exposes email', () => {
    const tree = buildCommentTree([row({ id: 1, content: 'hi **there**' })])
    expect(tree[0]!.contentHtml).toBe('hi <strong>there</strong>')
    expect(tree[0]).not.toHaveProperty('email')
  })

  it('prunes a deleted comment that has no replies', () => {
    const tree = buildCommentTree([row({ id: 1, deleted_at: '2026-01-02T00:00:00Z' })])
    expect(tree).toHaveLength(0)
  })

  it('tombstones a deleted comment that still has a live reply', () => {
    const tree = buildCommentTree([
      row({ id: 1, deleted_at: '2026-01-02T00:00:00Z', content: 'secret', author_name: 'Alice' }),
      row({ id: 2, parent_id: 1, depth: 1, content: 'still here' }),
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.deleted).toBe(true)
    expect(tree[0]!.name).toBe('')
    expect(tree[0]!.contentHtml).toBe('')
    expect(tree[0]!.replies[0]!.contentHtml).toBe('still here')
  })

  it('re-roots an orphan whose parent was purged', () => {
    // id 2 references parent 99 which is not in the set -> treated as a root.
    const tree = buildCommentTree([row({ id: 1 }), row({ id: 2, parent_id: 99, depth: 1 })])
    expect(tree.map((c) => c.id).sort()).toEqual([1, 2])
  })
})

const base = { postSlug: 'hello', name: 'A', email: 'a@b.co', provider: 'manual' as const, content: 'hi' }

describe('addComment input guards', () => {
  it('rejects a reply past the 3-tier limit with a CommentInputError', async () => {
    const top = await addComment({ ...base, parentId: null })
    const mid = await addComment({ ...base, parentId: top.id })
    const leaf = await addComment({ ...base, parentId: mid.id }) // depth 2, the deepest tier
    await expect(addComment({ ...base, parentId: leaf.id })).rejects.toBeInstanceOf(CommentInputError)
  })

  it('rejects a reply to a missing parent', async () => {
    await expect(addComment({ ...base, parentId: 999 })).rejects.toBeInstanceOf(CommentInputError)
  })

  it('rejects a reply to a TRASHED parent', async () => {
    const parent = await addComment({ ...base, parentId: null })
    await softDeleteComment(parent.id)
    await expect(addComment({ ...base, parentId: parent.id })).rejects.toBeInstanceOf(CommentInputError)
  })

  it('rejects empty content', async () => {
    await expect(addComment({ ...base, parentId: null, content: '   ' })).rejects.toBeInstanceOf(CommentInputError)
  })
})

describe('addComment stored shape', () => {
  it('derives depth and post from the PARENT, never from the caller', async () => {
    const parent = await addComment({ ...base, postSlug: 'real-post', parentId: null })
    const reply = await addComment({ ...base, postSlug: 'a-lie', parentId: parent.id })
    const stored = db().query<{ post_slug: string; depth: number }, [number]>(
      `select post_slug, depth from comments where id = ?`,
    ).get(reply.id)!
    expect(stored).toEqual({ post_slug: 'real-post', depth: 1 })
  })

  it('truncates content at MAX_COMMENT_LEN', async () => {
    const c = await addComment({ ...base, parentId: null, content: 'x'.repeat(MAX_COMMENT_LEN + 50) })
    const stored = db().query<{ content: string }, [number]>(
      `select content from comments where id = ?`).get(c.id)!
    expect(stored.content).toHaveLength(MAX_COMMENT_LEN)
  })

  it('never returns the email in the public node', async () => {
    const c = await addComment({ ...base, parentId: null })
    expect(JSON.stringify(c)).not.toContain('a@b.co')
  })
})

describe('reads', () => {
  it('renders the tree for one post only, and counts live comments per post', async () => {
    await addComment({ ...base, postSlug: 'p1', parentId: null })
    await addComment({ ...base, postSlug: 'p1', parentId: null })
    const other = await addComment({ ...base, postSlug: 'p2', parentId: null })
    expect(await getCommentTree('p1')).toHaveLength(2)
    await softDeleteComment(other.id)
    expect(await countsByPosts()).toEqual({ p1: 2 })
  })

  it('gives the admin table the email, the post title and a total across pages', async () => {
    db().run(`insert into posts (slug,title,date,created_at,updated_at) values ('p1','Real Title',?,?,?)`,
      [nowMs(), nowMs(), nowMs()])
    for (let i = 0; i < 3; i++) await addComment({ ...base, postSlug: 'p1', parentId: null })
    const page = await getAdminComments(1, 2)
    expect(page.total).toBe(3)
    expect(page.rows).toHaveLength(2)
    expect(page.rows[0]).toMatchObject({ email: 'a@b.co', postTitle: 'Real Title' })
  })

  it('falls back to the slug when the post is gone', async () => {
    await addComment({ ...base, postSlug: 'orphan', parentId: null })
    expect((await getAdminComments()).rows[0]!.postTitle).toBe('orphan')
  })
})

describe('mutations', () => {
  it('soft delete keeps the row and restore brings it back', async () => {
    const c = await addComment({ ...base, parentId: null })
    await softDeleteComment(c.id)
    expect(await getTrashedComments()).toHaveLength(1)
    expect((await getAdminComments()).total).toBe(0)
    await restoreComment(c.id)
    expect((await getAdminComments()).total).toBe(1)
  })

  it('a purged parent leaves its live reply re-rooted, not deleted', async () => {
    const parent = await addComment({ ...base, parentId: null })
    const reply = await addComment({ ...base, parentId: parent.id, content: 'still here' })
    await purgeComment(parent.id)
    const tree = await getCommentTree('hello')
    expect(tree.map((c) => c.id)).toEqual([reply.id])
  })

  it('empties the trash and reports the count', async () => {
    const a = await addComment({ ...base, parentId: null })
    await addComment({ ...base, parentId: null })
    await softDeleteComment(a.id)
    expect(await emptyCommentsTrash()).toBe(1)
    expect((await getAdminComments()).total).toBe(1)
  })

  it('moves comments with a renamed slug, and drops them with a purged post', async () => {
    await addComment({ ...base, postSlug: 'old', parentId: null })
    await renameComments('old', 'new')
    expect(await getCommentTree('old')).toHaveLength(0)
    expect(await getCommentTree('new')).toHaveLength(1)
    await deleteCommentsForPost('new')
    expect(await getCommentTree('new')).toHaveLength(0)
  })
})
