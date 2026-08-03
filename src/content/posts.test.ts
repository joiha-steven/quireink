// Posts against the real schema. This replaces the frozen tree's `soft-delete.test.ts`,
// which had to hand-write a filter engine inside a mock to prove Invariant 6; here the
// trashed row is really in the table, so a read path that drops `liveOnly` really fails.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one, all } from '@/store/query'
import {
  savePost, getPost, getIndex, getPublicPosts, searchPosts, deletePost, restorePost,
  purgePost, getTrashedPosts, emptyPostsTrash, getRelatedPosts,
} from '@/content/posts'
import { getRevisions } from '@/content/revisions'
import { getRedirects } from '@/server/redirects'
import { addComment, getCommentTree } from '@/comments/comments'

const DIR = './.tmp/test-posts'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PAST = '2020-01-01T00:00:00.000Z'
const FUTURE = '2099-01-01T00:00:00.000Z'

beforeEach(() => {
  for (const t of ['posts', 'pages', 'post_revisions', 'comments', 'redirects', 'settings']) {
    db().run(`delete from ${t}`)
  }
})

describe('savePost', () => {
  it('round-trips a post, derives the slug, and computes reading time', async () => {
    const saved = await savePost({ title: 'Hello World', content: 'a '.repeat(400), status: 'published', date: PAST })
    expect(saved.slug).toBe('hello-world')
    expect(saved.readingMinutes).toBeGreaterThan(0)
    const post = await getPost('hello-world')
    expect(post).toMatchObject({ title: 'Hello World', status: 'published', date: PAST })
  })

  it('stores the date as integer milliseconds but hands back ISO 8601', async () => {
    await savePost({ title: 'Dated', date: PAST })
    const stored = one<{ date: number }>(`select date from posts where slug = 'dated'`)!
    expect(stored.date).toBe(Date.parse(PAST))
    expect((await getPost('dated'))!.date).toBe(PAST)
  })

  it('stores image refs store-relative and expands them on read (Invariant 3)', async () => {
    await savePost({
      title: 'Shots', content: '![x](/uploads/media/a.webp)',
      featuredImage: '/uploads/media/b.webp', coverImage: '/uploads/media/c.webp',
    })
    const stored = one<{ content: string; featured_image: string; cover_image: string }>(
      `select content, featured_image, cover_image from posts where slug = 'shots'`)!
    expect(stored.content).toBe('![x](media/a.webp)')
    expect(stored.featured_image).toBe('media/b.webp')
    expect(stored.cover_image).toBe('media/c.webp')
    const post = await getPost('shots')
    expect(post!.content).toBe('![x](/uploads/media/a.webp)')
    expect(post!.featuredImage).toBe('/uploads/media/b.webp')
  })

  it('derives an excerpt from the body when the author leaves it blank, and caps a given one', async () => {
    await savePost({ title: 'Auto', content: 'The quick brown fox jumps.' })
    expect((await getPost('auto'))!.excerpt).toContain('quick brown fox')
    await savePost({ title: 'Manual', content: 'body', excerpt: 'chosen' })
    expect((await getPost('manual'))!.excerpt).toBe('chosen')
  })

  it('falls back to a timestamped slug when the title slugifies to nothing', async () => {
    const saved = await savePost({ title: '🎉🎉🎉', content: 'x' })
    expect(saved.slug).toMatch(/^post-\d+$/)
    expect(await getPost(saved.slug)).not.toBeNull()
  })

  it('snapshots the previous version, and skips the snapshot when nothing changed', async () => {
    // The date is pinned on purpose: `normalize` defaults an absent date to NOW, so an
    // otherwise identical save would differ on that field alone and snapshot anyway.
    await savePost({ title: 'Draft', content: 'v1', date: PAST })
    await savePost({ title: 'Draft', content: 'v2', date: PAST }, 'draft')
    expect((await getRevisions('draft')).map((r) => r.content)).toEqual(['v1'])
    await savePost({ title: 'Draft', content: 'v2', date: PAST }, 'draft') // identical: no new snapshot
    expect(await getRevisions('draft')).toHaveLength(1)
  })

  it('a rename moves revisions and comments, drops the old row, and leaves a 301', async () => {
    await savePost({ title: 'Old', content: 'v1', date: PAST })
    await savePost({ title: 'Old', content: 'v2', date: PAST }, 'old') // snapshots v1 under /old
    await addComment({ postSlug: 'old', parentId: null, name: 'A', email: 'a@b.co', provider: 'manual', content: 'hi' })

    // The title change is itself a change, so this save snapshots v2 as well.
    await savePost({ title: 'New', content: 'v2', date: PAST }, 'old')

    expect(await getPost('old')).toBeNull()
    expect(await getRevisions('old')).toHaveLength(0)
    expect((await getRevisions('new')).map((r) => r.content)).toEqual(['v2', 'v1'])
    expect(await getCommentTree('new')).toHaveLength(1)
    expect((await getRedirects())[0]).toMatchObject({ source: '/old', destination: '/new', permanent: true })
  })
})

describe('lists and visibility', () => {
  it('orders newest first, and the public list drops drafts and future dates', async () => {
    await savePost({ title: 'Older', status: 'published', date: '2020-01-01T00:00:00.000Z' })
    await savePost({ title: 'Newer', status: 'published', date: '2021-01-01T00:00:00.000Z' })
    await savePost({ title: 'Draft', status: 'draft', date: PAST })
    await savePost({ title: 'Scheduled', status: 'published', date: FUTURE })
    expect((await getIndex()).map((p) => p.title)).toEqual(['Scheduled', 'Newer', 'Older', 'Draft'])
    expect((await getPublicPosts()).map((p) => p.title)).toEqual(['Newer', 'Older'])
  })

  it('scores related posts by shared terms, tags weighted double', async () => {
    await savePost({ title: 'Base', status: 'published', date: PAST, tags: ['bun'], categories: ['dev'] })
    await savePost({ title: 'Two Tags', status: 'published', date: PAST, tags: ['bun'], categories: ['dev'] })
    await savePost({ title: 'Cat Only', status: 'published', date: PAST, categories: ['dev'] })
    await savePost({ title: 'Nothing', status: 'published', date: PAST, tags: ['other'] })
    const related = await getRelatedPosts('base')
    expect(related.map((p) => p.title)).toEqual(['Two Tags', 'Cat Only'])
  })
})

describe('search', () => {
  const publish = (title: string, content: string, over = {}) =>
    savePost({ title, content, status: 'published', date: PAST, ...over })

  it('folds Vietnamese diacritics, so an unaccented query finds an accented post', async () => {
    await publish('Lập trình hằng ngày', 'viết blog mười năm')
    expect((await searchPosts('lap trinh')).map((p) => p.slug)).toEqual(['lap-trinh-hang-ngay'])
  })

  it('searches the body, not just the title', async () => {
    await publish('Untitled', 'a paragraph about sqlite internals')
    expect(await searchPosts('sqlite')).toHaveLength(1)
  })

  it('requires every word (implicit AND), like the websearch it replaces', async () => {
    await publish('One', 'alpha beta')
    await publish('Two', 'alpha only')
    expect((await searchPosts('alpha beta')).map((p) => p.title)).toEqual(['One'])
  })

  it('never surfaces drafts, future posts or trashed posts', async () => {
    await publish('Live', 'needle here')
    await savePost({ title: 'Hidden Draft', content: 'needle here', status: 'draft', date: PAST })
    await publish('Scheduled', 'needle here', { date: FUTURE })
    await publish('Trashed', 'needle here')
    await deletePost('trashed')
    expect((await searchPosts('needle')).map((p) => p.title)).toEqual(['Live'])
  })

  it('treats operator characters as text instead of throwing FTS5 syntax errors', async () => {
    await publish('Punctuated', 'writing about C++ and "quotes"')
    // Each of these would be a syntax error if the query were passed through raw.
    for (const q of ['C++', '"', 'OR', 'NEAR(', '-alpha', "it's"]) {
      expect(Array.isArray(await searchPosts(q))).toBe(true)
    }
    expect(await searchPosts('writing')).toHaveLength(1)
  })

  it('is empty for a blank query', async () => {
    await publish('Something', 'body')
    expect(await searchPosts('   ')).toEqual([])
  })
})

describe('soft delete (Invariant 6)', () => {
  const seed = async () => {
    await savePost({ title: 'Live', content: 'needle', status: 'published', date: PAST })
    await savePost({ title: 'Trashed', content: 'needle', status: 'published', date: PAST })
    await deletePost('trashed')
  }

  it('hides a trashed post from EVERY live read', async () => {
    await seed()
    expect((await getIndex()).map((p) => p.slug)).toEqual(['live'])
    expect((await getPublicPosts()).map((p) => p.slug)).toEqual(['live'])
    expect((await searchPosts('needle')).map((p) => p.slug)).toEqual(['live'])
    expect(await getPost('trashed')).toBeNull()
  })

  it('keeps the row, so restore brings it back whole', async () => {
    await seed()
    expect(one<{ n: number }>(`select count(*) n from posts`)!.n).toBe(2)
    await restorePost('trashed')
    expect((await getPost('trashed'))!.content).toBe('needle')
  })

  it('lists the trash most-recently-deleted first', async () => {
    await savePost({ title: 'First', date: PAST })
    await savePost({ title: 'Second', date: PAST })
    await deletePost('first')
    db().run(`update posts set deleted_at = deleted_at - 1000 where slug = 'first'`)
    await deletePost('second')
    expect((await getTrashedPosts()).map((p) => p.title)).toEqual(['Second', 'First'])
  })

  it('a purge takes the terms, revisions and comments with it', async () => {
    await savePost({ title: 'Doomed', content: 'v1', categories: ['dev'], tags: ['bun'] })
    await savePost({ title: 'Doomed', content: 'v2', categories: ['dev'] }, 'doomed')
    await addComment({ postSlug: 'doomed', parentId: null, name: 'A', email: 'a@b.co', provider: 'manual', content: 'hi' })
    await purgePost('doomed')
    expect(one<{ n: number }>(`select count(*) n from posts`)!.n).toBe(0)
    expect(all(`select 1 from post_terms`)).toHaveLength(0)
    expect(await getRevisions('doomed')).toHaveLength(0)
    expect(await getCommentTree('doomed')).toHaveLength(0)
  })

  it('empties the posts trash and reports the count', async () => {
    await savePost({ title: 'One', date: PAST })
    await savePost({ title: 'Two', date: PAST })
    await deletePost('one')
    expect(await emptyPostsTrash()).toBe(1)
    expect((await getIndex()).map((p) => p.title)).toEqual(['Two'])
  })
})
