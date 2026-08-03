// Categories and tags moved from two Postgres `text[]` columns to a junction table, so
// this is the port's largest shape change and the one most able to lose data quietly.
// The rename-collision case is the subtle one: the frozen tree merged by de-duping an
// array in JS, and here the merge falls out of a primary-key conflict.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { all } from '@/store/query'
import {
  savePost, getPost, updateTerm, getCategories, getTags, getPublicTaxonomy,
} from '@/content/posts'
import { tagText, termSlug } from '@/content/taxonomy'

const DIR = './.tmp/test-post-terms'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PAST = '2020-01-01T00:00:00.000Z'

beforeEach(() => {
  for (const t of ['posts', 'post_terms', 'post_revisions', 'settings']) db().run(`delete from ${t}`)
})

const terms = () =>
  all<{ post_slug: string; kind: string; term: string }>(
    `select post_slug, kind, term from post_terms order by post_slug, kind, term`,
  )

describe('writing terms', () => {
  it('stores them in the junction table and reads them back on the post', async () => {
    await savePost({ title: 'A', date: PAST, categories: ['Dev', 'Notes'], tags: ['bun'] })
    expect(terms()).toEqual([
      { post_slug: 'a', kind: 'category', term: 'Dev' },
      { post_slug: 'a', kind: 'category', term: 'Notes' },
      { post_slug: 'a', kind: 'tag', term: 'bun' },
    ])
    const post = await getPost('a')
    expect(post!.categories).toEqual(['Dev', 'Notes'])
    expect(post!.tags).toEqual(['bun'])
  })

  it('replaces the whole set on re-save, leaving no stale rows', async () => {
    await savePost({ title: 'A', date: PAST, categories: ['Dev'], tags: ['bun', 'sqlite'] })
    await savePost({ title: 'A', date: PAST, categories: ['Notes'], tags: [] }, 'a')
    expect(terms().map((t) => t.term)).toEqual(['Notes'])
  })

  it('trims, drops blanks and de-dupes', async () => {
    await savePost({ title: 'A', date: PAST, tags: ['  bun  ', 'bun', '', '   '] })
    expect((await getPost('a'))!.tags).toEqual(['bun'])
  })

  it('a post with no terms reads back as empty arrays, not null', async () => {
    await savePost({ title: 'A', date: PAST })
    expect(await getPost('a')).toMatchObject({ categories: [], tags: [] })
  })

  it('the same term on two posts is two rows, not a conflict', async () => {
    await savePost({ title: 'A', date: PAST, tags: ['bun'] })
    await savePost({ title: 'B', date: PAST, tags: ['bun'] })
    expect(terms()).toHaveLength(2)
  })

  it('a category and a tag of the same name stay separate', async () => {
    await savePost({ title: 'A', date: PAST, categories: ['bun'], tags: ['bun'] })
    const post = await getPost('a')
    expect(post!.categories).toEqual(['bun'])
    expect(post!.tags).toEqual(['bun'])
  })
})

describe('updateTerm', () => {
  const seed = async () => {
    await savePost({ title: 'One', date: PAST, status: 'published', tags: ['old'], categories: ['dev'] })
    await savePost({ title: 'Two', date: PAST, status: 'published', tags: ['old', 'keep'] })
    await savePost({ title: 'Three', date: PAST, status: 'published', tags: ['unrelated'] })
  }

  it('renames across every post and reports how many changed', async () => {
    await seed()
    expect(await updateTerm('tag', 'old', 'new')).toBe(2)
    expect((await getPost('one'))!.tags).toEqual(['new'])
    expect((await getPost('two'))!.tags.sort()).toEqual(['keep', 'new'])
    expect((await getPost('three'))!.tags).toEqual(['unrelated'])
  })

  it('MERGES when the rename collides with a term the post already has', async () => {
    await seed()
    expect(await updateTerm('tag', 'old', 'keep')).toBe(2)
    // Post two had both; it must end up with ONE 'keep', not a duplicate and not a loss.
    expect((await getPost('two'))!.tags).toEqual(['keep'])
    expect((await getPost('one'))!.tags).toEqual(['keep'])
  })

  it('removes a term when the new name is null, and treats blank as removal', async () => {
    await seed()
    expect(await updateTerm('tag', 'old', null)).toBe(2)
    expect((await getPost('one'))!.tags).toEqual([])
    await updateTerm('tag', 'keep', '   ')
    expect((await getPost('two'))!.tags).toEqual([])
  })

  it('does not touch the other kind, or a term nobody uses', async () => {
    await seed()
    await updateTerm('tag', 'dev', 'renamed') // 'dev' is a CATEGORY here
    expect((await getPost('one'))!.categories).toEqual(['dev'])
    expect(await updateTerm('tag', 'ghost', 'x')).toBe(0)
  })
})

describe('taxonomy listings', () => {
  it('lists distinct terms across all posts including drafts, sorted', async () => {
    await savePost({ title: 'Pub', date: PAST, status: 'published', categories: ['Zed'], tags: ['b'] })
    await savePost({ title: 'Dra', date: PAST, status: 'draft', categories: ['Alpha'], tags: ['a'] })
    expect(await getCategories()).toEqual(['Alpha', 'Zed'])
    expect(await getTags()).toEqual(['a', 'b'])
  })

  it('the public taxonomy counts PUBLISHED posts only, busiest first', async () => {
    await savePost({ title: 'A', date: PAST, status: 'published', tags: ['common'] })
    await savePost({ title: 'B', date: PAST, status: 'published', tags: ['common', 'rare'] })
    await savePost({ title: 'C', date: PAST, status: 'draft', tags: ['common', 'hidden'] })
    const { tags } = await getPublicTaxonomy()
    expect(tags).toEqual([{ name: 'common', count: 2 }, { name: 'rare', count: 1 }])
  })

  it('drops the terms of a trashed post from the public taxonomy', async () => {
    await savePost({ title: 'A', date: PAST, status: 'published', tags: ['gone'] })
    db().run(`update posts set deleted_at = 1 where slug = 'a'`)
    expect((await getPublicTaxonomy()).tags).toEqual([])
    expect(await getTags()).toEqual([])
  })
})

describe('a tag is DISPLAYED hyphenated, and stored as it was typed', () => {
  // "giao diện" reads as two ordinary words, and a cloud of them ("viết mẫu giao diện hiệu
  // năng") reads as a sentence with no way to see where one tag ends and the next begins.
  // Hyphenated, every tag is one unbroken token.
  it('replaces the spaces inside a tag, and only for display', () => {
    expect(tagText('giao diện')).toBe('giao-diện')
    expect(tagText('một hai ba')).toBe('một-hai-ba')
    expect(tagText('typography')).toBe('typography')
  })

  it('leaves the stored term and its URL slug alone', async () => {
    // The whole point of it being display-only: a link, a lookup and an old bookmark all
    // keep working, because none of them ever sees the hyphenated form.
    await savePost({ title: 'A', date: PAST, status: 'published', tags: ['giao diện'] })
    expect((await getPost('a'))?.tags).toEqual(['giao diện'])
    expect(termSlug('giao diện')).toBe('giao-dien')
  })
})
