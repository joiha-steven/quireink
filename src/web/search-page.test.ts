// /search: the box with its button inside, and what the page offers before a query is typed.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { savePost } from '@/content/posts'
import { deletePost } from '@/content/posts-trash'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { clearCache } from '@/server/cache'

const DIR = './.tmp/test-search-page'
freshDatabase(DIR)
const app = createApp()
const hour = 3_600_000
type Input = Parameters<typeof savePost>[0]

beforeAll(async () => {
  resetSecretCache()
  resetLimits()
  clearCache()
  const base = { content: 'Body text.', categories: ['Craft'] }
  await savePost({ ...base, title: 'Live Alpha', slug: 'live-alpha', status: 'published',
    date: new Date(Date.now() - hour).toISOString(), tags: ['kerning'] } as Input)
  await savePost({ ...base, title: 'Ahead Beta', slug: 'ahead-beta', status: 'published',
    date: new Date(Date.now() + hour).toISOString(), tags: ['futuretag'] } as Input)
  await savePost({ ...base, title: 'Draft Gamma', slug: 'draft-gamma', status: 'draft',
    date: new Date(Date.now() - hour).toISOString(), tags: ['drafttag'] } as Input)
  await savePost({ ...base, title: 'Trash Delta', slug: 'trash-delta', status: 'published',
    date: new Date(Date.now() - hour).toISOString(), tags: ['trashtag'] } as Input)
  await deletePost('trash-delta')
  clearCache()
})
afterAll(() => dropDatabase(DIR))

describe('/search with no query', () => {
  it('lists the tags and the newest public posts, and nothing unpublished', async () => {
    const res = await app.request('/search')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('href="/tag/kerning"')
    expect(html).toContain('href="/live-alpha"')
    for (const hidden of ['futuretag', 'drafttag', 'trashtag', 'ahead-beta', 'draft-gamma', 'trash-delta']) {
      expect(html).not.toContain(hidden)
    }
  })

  it('has one form whose submit button is inside it and named', async () => {
    const html = await (await app.request('/search')).text()
    const form = html.match(/<form class="qbox"[^>]*action="\/search"[\s\S]*?<\/form>/)
    expect(form).not.toBeNull()
    expect(form![0]).toContain('<button type="submit" aria-label="Search"')
    expect(form![0]).toContain('<input type="search" name="q"')
    expect(form![0]).toContain('aria-label="Search"')
  })
})

describe('/search with a query', () => {
  it('renders results as before, with the same box, and no suggestions', async () => {
    const html = await (await app.request('/search?q=Alpha')).text()
    expect(html).toContain('Results for')
    expect(html).toContain('href="/live-alpha"')
    expect(html).toContain('value="Alpha"')
    expect(html).not.toContain('class="qs-tags"')
    expect(html).not.toContain('class="qs-recent"')
  })

  it('says so when nothing matches', async () => {
    const html = await (await app.request('/search?q=zzzznomatch')).text()
    expect(html).toContain('No matching posts found.')
  })

  it('does not let the query out of the attribute', async () => {
    const html = await (await app.request('/search?q=' + encodeURIComponent('" onfocus=alert(1) x="'))).text()
    expect(html).not.toContain('" onfocus=alert(1)')
  })
})
