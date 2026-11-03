// The post index, read once per page however many parts of the page ask for it — and never
// handed out across a write (invariant 1), inside one request or between two.
import { afterAll, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { getPublicPosts, indexReadCount, savePost } from '@/content/posts'
import { clearCache } from '@/server/cache'
import { once, withReadScope } from '@/content/read-scope'

const DIR = './.tmp/test-read-scope'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))
const app = createApp()

const post = (i: number) => savePost({
  title: `Post ${i}`, slug: `post-${i}`, content: 'x', status: 'published',
  date: '2020-01-01T00:00:00.000Z', tags: ['t'], categories: ['c'],
} as Parameters<typeof savePost>[0])

describe('one page, one read of the index', () => {
  it('reads it once for a 404, which no cache keeps and every probe pays for', async () => {
    await post(1)
    clearCache()
    const before = indexReadCount()
    expect((await app.request('/no-such-page')).status).toBe(404)
    expect(indexReadCount() - before).toBe(1)
  })

  it('reads it once for a listing, the sidebar included', async () => {
    clearCache()
    const before = indexReadCount()
    expect((await app.request('/tag/t')).status).toBe(200)
    expect(indexReadCount() - before).toBe(1)
  })

  it('reads it again in the next request, so nothing is kept between two', async () => {
    clearCache()
    await app.request('/no-such-page')
    const before = indexReadCount()
    await app.request('/no-such-page')
    expect(indexReadCount() - before).toBe(1)
  })
})

describe('a write still wins', () => {
  it('hands out nothing read before a flush, inside the same page', async () => {
    await withReadScope(async () => {
      const first = (await getPublicPosts()).length
      await post(2)
      clearCache()
      expect((await getPublicPosts()).length).toBe(first + 1)
    })
  })

  it('gives each caller its own copies', async () => {
    await withReadScope(async () => {
      const [a] = await getPublicPosts()
      a!.title = 'changed by one part of the page'
      expect((await getPublicPosts())[0]!.title).not.toBe('changed by one part of the page')
    })
  })

  it('is a plain read outside a page, as the warm and the clock make them', () => {
    let n = 0
    once('k', () => n++)
    once('k', () => n++)
    expect(n).toBe(2)
  })
})
