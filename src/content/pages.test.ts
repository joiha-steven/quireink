// Pages against the real schema: the lifecycle (save, rename, trash, restore, purge) and
// the two invariants a read path can drop silently.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db, nowMs } from '@/store/db'
import { one } from '@/store/query'
import {
  savePage, getPage, getPageIndex, getPublicPages, deletePage, restorePage,
  purgePage, getTrashedPages, emptyPagesTrash,
} from '@/content/pages'
import { getRedirects } from '@/server/redirects'

const DIR = './.tmp/test-pages'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => {
  db().run(`delete from pages`)
  db().run(`delete from posts`)
  db().run(`delete from redirects`)
})

describe('savePage', () => {
  it('round-trips a page and derives the slug from the title', async () => {
    const saved = await savePage({ title: 'About Us', content: 'hello', status: 'published' })
    expect(saved.slug).toBe('about-us')
    const page = await getPage('about-us')
    expect(page).toMatchObject({ title: 'About Us', content: 'hello', status: 'published' })
  })

  it('stores image refs store-relative and expands them on read (Invariant 3)', async () => {
    await savePage({ title: 'Team', content: '![x](/uploads/media/a.webp)', featuredImage: '/uploads/media/b.webp' })
    const stored = one<{ content: string; featured_image: string }>(
      `select content, featured_image from pages where slug = 'team'`,
    )!
    expect(stored.content).toBe('![x](media/a.webp)')
    expect(stored.featured_image).toBe('media/b.webp')
    const page = await getPage('team')
    expect(page!.content).toBe('![x](/uploads/media/a.webp)')
    expect(page!.featuredImage).toBe('/uploads/media/b.webp')
  })

  it('does not restamp created_at when overwriting, but does bump updated_at', async () => {
    await savePage({ title: 'Notes', content: 'v1' })
    const first = one<{ created_at: number; updated_at: number }>(
      `select created_at, updated_at from pages where slug = 'notes'`,
    )!
    db().run(`update pages set created_at = 1, updated_at = 1 where slug = 'notes'`)
    // An overwrite always names the row it is replacing; without it the slug it wants is
    // already taken by itself and `ensureSlugFree` rejects the save.
    await savePage({ title: 'Notes', content: 'v2' }, 'notes')
    const after = one<{ created_at: number; updated_at: number }>(
      `select created_at, updated_at from pages where slug = 'notes'`,
    )!
    expect(after.created_at).toBe(1)
    expect(after.updated_at).toBeGreaterThanOrEqual(first.created_at)
  })

  it('a rename drops the old row and leaves a 301 from the old path', async () => {
    await savePage({ title: 'Old Name', content: 'body' })
    await savePage({ title: 'New Name', content: 'body' }, 'old-name')
    expect(await getPage('old-name')).toBeNull()
    expect((await getPage('new-name'))!.content).toBe('body')
    const redirects = await getRedirects()
    expect(redirects).toHaveLength(1)
    expect(redirects[0]).toMatchObject({ source: '/old-name', destination: '/new-name', permanent: true })
  })

  it('clears a redirect that pointed AWAY from the slug now going live (no self-loop)', async () => {
    await savePage({ title: 'A', content: '1' })
    await savePage({ title: 'B', content: '1' }, 'a') // leaves /a -> /b
    await savePage({ title: 'A', content: '2' }) // /a is live content again
    expect(await getRedirects()).toHaveLength(0)
  })
})

describe('lists', () => {
  it('orders by title and includes drafts; the public list drops them', async () => {
    await savePage({ title: 'Zebra', status: 'published' })
    await savePage({ title: 'Apple', status: 'draft' })
    expect((await getPageIndex()).map((p) => p.title)).toEqual(['Apple', 'Zebra'])
    expect((await getPublicPages()).map((p) => p.title)).toEqual(['Zebra'])
  })
})

describe('soft delete (Invariant 6)', () => {
  it('hides a trashed page from every live read but keeps the row and the slug', async () => {
    await savePage({ title: 'Secret', status: 'published' })
    await deletePage('secret')
    expect(await getPage('secret')).toBeNull()
    expect(await getPageIndex()).toHaveLength(0)
    expect(await getPublicPages()).toHaveLength(0)
    expect(one<{ n: number }>(`select count(*) n from pages`)!.n).toBe(1)
  })

  it('restores back to live', async () => {
    await savePage({ title: 'Secret', status: 'published' })
    await deletePage('secret')
    await restorePage('secret')
    expect((await getPage('secret'))!.title).toBe('Secret')
  })

  it('saving a trashed page does not silently untrash it', async () => {
    await savePage({ title: 'Secret', content: 'v1' })
    await deletePage('secret')
    await savePage({ title: 'Secret', content: 'v2' }, 'secret')
    expect(await getPage('secret')).toBeNull()
    expect(one<{ content: string }>(`select content from pages where slug = 'secret'`)!.content).toBe('v2')
  })

  it('lists the trash most-recently-deleted first', async () => {
    await savePage({ title: 'First' })
    await savePage({ title: 'Second' })
    db().run(`update pages set deleted_at = ? where slug = 'first'`, [nowMs() - 1000])
    db().run(`update pages set deleted_at = ? where slug = 'second'`, [nowMs()])
    const trashed = await getTrashedPages()
    expect(trashed.map((p) => p.title)).toEqual(['Second', 'First'])
    expect(trashed[0]!.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('purge is a hard delete, and emptying the trash reports how many went', async () => {
    await savePage({ title: 'One' })
    await savePage({ title: 'Two' })
    await deletePage('one')
    await deletePage('two')
    await purgePage('one')
    expect(one<{ n: number }>(`select count(*) n from pages`)!.n).toBe(1)
    expect(await emptyPagesTrash()).toBe(1)
    expect(one<{ n: number }>(`select count(*) n from pages`)!.n).toBe(0)
  })
})
