// A REDIRECT WHOSE SOURCE DIFFERS FROM THE REQUEST ONLY IN CASE.
//
// Sources were matched byte for byte, so a rule saved for `/Old-Case` (the way a WordPress
// permalink or a hand-typed link spells it) did nothing for `/old-case`, and the reader got a 404.
// The exact spelling is still asked first; only when it misses is the case ignored, through an
// index of its own, and never over a post or page that lives at the asked path.
import { describe, it, expect, afterAll, beforeEach } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { all } from '@/store/query'
import { createApp } from '@/web/app'
import { savePost } from '@/content/posts'
import { saveRedirect } from '@/server/redirects'
import { clearCache } from '@/server/cache'

const DIR = './.tmp/test-redirect-case'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
beforeEach(() => {
  for (const t of ['posts', 'post_terms', 'settings', 'redirects']) db().run(`delete from ${t}`)
  clearCache()
})

const where = async (path: string) => {
  const res = await app.request(path)
  return `${res.status} ${res.headers.get('location') ?? ''}`.trim()
}

describe('a redirect asked for in another case', () => {
  it('answers when only the case differs, either way round', async () => {
    await saveRedirect({ source: '/Old-Case', destination: '/new-home' })
    await saveRedirect({ source: '/lower', destination: '/elsewhere' })
    expect(await where('/old-case')).toBe('301 /new-home')
    expect(await where('/OLD-CASE')).toBe('301 /new-home')
    expect(await where('/Lower')).toBe('301 /elsewhere')
  })

  it('takes the exact spelling first', async () => {
    await saveRedirect({ source: '/Same', destination: '/upper-one' })
    await saveRedirect({ source: '/same', destination: '/lower-one' })
    expect(await where('/same')).toBe('301 /lower-one')
    expect(await where('/Same')).toBe('301 /upper-one')
  })

  it('never takes a reader away from a post that lives at the asked path', async () => {
    await savePost({
      title: 'Live', slug: 'old-post', status: 'published', content: 'Body.', excerpt: 'Set.',
      date: '2026-01-01T00:00:00.000Z',
    })
    await saveRedirect({ source: '/Old-Post', destination: '/somewhere' })
    expect(await where('/old-post')).toBe('200')
    expect(await where('/Old-Post')).toBe('301 /somewhere')
  })

  it('is an indexed read, not a scan of the table', () => {
    const plan = all<{ detail: string }>(
      `explain query plan select id, source, destination, permanent from redirects where source = ? collate nocase order by id limit 1`,
      '/x',
    ).map((r) => r.detail).join(' | ')
    expect(plan).toMatch(/SEARCH redirects USING (COVERING )?INDEX redirects_source_nocase_idx/)
  })
})
