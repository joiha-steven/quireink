// The time machine. Its two subtle rules are the trim (keep the newest 3) and the
// identical-snapshot skip, which together decide whether a real older version survives an
// autosave storm.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import type { PostWithContent } from '@/types'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { all } from '@/store/query'
import { getRevisions, pushRevision, renameRevisions, deleteRevisions } from '@/content/revisions'

const DIR = './.tmp/test-revisions'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const post = (over: Partial<PostWithContent> = {}): PostWithContent => ({
  title: 'Title', slug: 'a-post', date: '2026-01-01T00:00:00.000Z', status: 'draft',
  categories: [], tags: [], content: 'body', ...over,
})

// `saved_at` is milliseconds, so a burst of pushes inside one tick would tie. Stamping
// explicitly keeps the ordering assertions about the code, not about clock resolution.
const stamp = (slug: string, ms: number) =>
  db().run(`update post_revisions set saved_at = ? where id = (select max(id) from post_revisions where slug = ?)`, [ms, slug])

beforeEach(() => db().run(`delete from post_revisions`))

describe('pushRevision', () => {
  it('stores a snapshot and reads it back newest-first', async () => {
    await pushRevision(post({ content: 'v1' }))
    stamp('a-post', 1000)
    await pushRevision(post({ content: 'v2' }))
    stamp('a-post', 2000)
    const revs = await getRevisions('a-post')
    expect(revs.map((r) => r.content)).toEqual(['v2', 'v1'])
    expect(revs[0]!.savedAt).toBe('1970-01-01T00:00:02.000Z')
  })

  it('skips a snapshot identical to the latest, so a no-op autosave evicts nothing', async () => {
    await pushRevision(post({ content: 'v1' }))
    await pushRevision(post({ content: 'v1' }))
    expect(await getRevisions('a-post')).toHaveLength(1)
  })

  it('keeps only the newest 3 and drops the oldest', async () => {
    for (const [i, body] of ['v1', 'v2', 'v3', 'v4'].entries()) {
      await pushRevision(post({ content: body }))
      stamp('a-post', 1000 + i)
    }
    expect((await getRevisions('a-post')).map((r) => r.content)).toEqual(['v4', 'v3', 'v2'])
  })

  it('trims per slug, never across posts', async () => {
    for (const body of ['v1', 'v2', 'v3', 'v4']) await pushRevision(post({ content: body }))
    await pushRevision(post({ slug: 'other', content: 'x' }))
    expect(await getRevisions('other')).toHaveLength(1)
  })

  it('stores image refs store-relative and expands them on read (Invariant 3)', async () => {
    await pushRevision(post({ content: '![x](/uploads/media/a.webp)', featuredImage: '/uploads/media/b.webp' }))
    const raw = all<{ data: string }>(`select data from post_revisions`)[0]!.data
    expect(raw).toContain('media/a.webp')
    expect(raw).not.toContain('/uploads/')
    const rev = (await getRevisions('a-post'))[0]!
    expect(rev.content).toBe('![x](/uploads/media/a.webp)')
    expect(rev.featuredImage).toBe('/uploads/media/b.webp')
  })
})

describe('rename and delete', () => {
  it('moves history with the slug', async () => {
    await pushRevision(post({ content: 'v1' }))
    await renameRevisions('a-post', 'renamed')
    expect(await getRevisions('a-post')).toHaveLength(0)
    expect(await getRevisions('renamed')).toHaveLength(1)
  })

  it('a rename to the same slug is a no-op', async () => {
    await pushRevision(post({ content: 'v1' }))
    await renameRevisions('a-post', 'a-post')
    expect(await getRevisions('a-post')).toHaveLength(1)
  })

  it('drops every snapshot for a post', async () => {
    await pushRevision(post({ content: 'v1' }))
    await deleteRevisions('a-post')
    expect(await getRevisions('a-post')).toHaveLength(0)
  })
})
