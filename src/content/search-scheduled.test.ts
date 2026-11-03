// A READER'S SEARCH, WHEN SCHEDULED POSTS MATCH TOO.
//
// The query took its 50 rows newest first and only then dropped the posts whose date has not
// come, and a scheduled post is by definition the newest there is. Fifty of them matching a word
// left the reader with no results at all, though a published post said the word. The date is
// now part of the query, so the 50 are 50 a reader may see.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { savePost, searchPosts } from '@/content/posts'

const DIR = './.tmp/test-search-scheduled'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const hour = 3_600_000

beforeAll(async () => {
  for (let i = 0; i < 55; i++) {
    await savePost({
      title: `Ahead ${i}`, slug: `ahead-${i}`, status: 'published', content: 'Marmalade later.',
      excerpt: 'Set.', date: new Date(Date.now() + (i + 1) * hour).toISOString(),
    })
  }
  for (let i = 0; i < 3; i++) {
    await savePost({
      title: `Live ${i}`, slug: `live-${i}`, status: 'published', content: 'Marmalade now.',
      excerpt: 'Set.', date: new Date(Date.now() - (i + 1) * hour).toISOString(),
    })
  }
})

describe('searchPosts with more scheduled matches than the limit', () => {
  it('still finds the published ones', async () => {
    expect((await searchPosts('marmalade')).map((p) => p.slug)).toEqual(['live-0', 'live-1', 'live-2'])
  })

  it('and on the accented path too', async () => {
    // An accent in the query reads 200 candidates and checks the spelling; the date belongs
    // in that read as well.
    await savePost({
      title: 'Mứt live', slug: 'mut-live', status: 'published', content: 'Mứt cam.', excerpt: 'Set.',
      date: new Date(Date.now() - hour).toISOString(),
    })
    for (let i = 0; i < 205; i++) {
      await savePost({
        title: `Mứt ahead ${i}`, slug: `mut-ahead-${i}`, status: 'published', content: 'Mứt cam.',
        excerpt: 'Set.', date: new Date(Date.now() + (i + 1) * hour).toISOString(),
      })
    }
    expect((await searchPosts('mứt')).map((p) => p.slug)).toEqual(['mut-live'])
  })
})
