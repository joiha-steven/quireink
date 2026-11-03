// ß AND FULL-WIDTH LATIN, folded rather than dropped, without losing an address.
//
// `slugify` dropped every letter it had no row for, so "Straße" slugged to `strae` and a title in
// full-width Latin ("Ｆｕｌｌ") to the empty string. Both now fold (ß → ss, full-width → its
// ASCII letter). A post slug is derived once, at creation, so no post moves; a term or series
// slug is derived on every request, so `/tag/strae` would have become a 404 the day the fold
// landed. The old spelling answers with a 301 to the new one, and only after an exact match
// has missed, so a real tag spelled `strae` keeps its own archive.
import { describe, it, expect, afterAll, beforeEach } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createApp } from '@/web/app'
import { savePost } from '@/content/posts'
import { clearCache } from '@/server/cache'
import { slugify } from '@/utils'

const DIR = './.tmp/test-slug-fold'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
beforeEach(() => {
  for (const t of ['posts', 'post_terms', 'settings']) db().run(`delete from ${t}`)
  clearCache()
})

const post = (slug: string, extra: { tags?: string[]; series?: string }) => savePost({
  title: slug, slug, status: 'published', content: 'Body.', excerpt: 'Set.',
  date: '2026-01-01T00:00:00.000Z', ...extra,
})

describe('slugify folds what it used to drop', () => {
  it('spells ß as ss and full-width Latin as ASCII', () => {
    expect(slugify('Straße')).toBe('strasse')
    expect(slugify('GROẞE Pläne')).toBe('grosse-plane')
    expect(slugify('Ｆｕｌｌ ｗｉｄｔｈ １２３')).toBe('full-width-123')
    expect(slugify('ﬁnal ﬂow')).toBe('final-flow')
  })

  it('leaves what it already spelled alone', () => {
    // Full NFKC would have turned these into `brandtm`, `x2` and `12`.
    expect(slugify('Brand™')).toBe('brand')
    expect(slugify('x²')).toBe('x')
    expect(slugify('½ off')).toBe('off')
  })
})

describe('a term slugged the old way still arrives', () => {
  it('301s /tag/strae to /tag/strasse, and its feed resolves', async () => {
    await post('tagged', { tags: ['Straße'] })
    const res = await app.request('/tag/strae')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/tag/strasse')
    expect((await app.request('/tag/strasse')).status).toBe(200)
  })

  it('301s a full-width tag that fell back to its raw name', async () => {
    await post('wide', { tags: ['Ｆｕｌｌ'] })
    const res = await app.request(`/tag/${encodeURIComponent('Ｆｕｌｌ')}`)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/tag/full')
  })

  it('keeps a real tag spelled like the old fold', async () => {
    await post('a', { tags: ['Straße'] })
    await post('b', { tags: ['strae'] })
    expect((await app.request('/tag/strae')).status).toBe(200)
  })

  it('301s a series slugged the old way', async () => {
    await post('part', { series: 'Große Reise' })
    const res = await app.request('/series/groe-reise')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/series/grosse-reise')
  })

  it('is still a 404 when nothing ever had that name', async () => {
    await post('tagged', { tags: ['Straße'] })
    expect((await app.request('/tag/nothing-here')).status).toBe(404)
  })
})
