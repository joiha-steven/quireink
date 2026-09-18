// A TAG IN A SCRIPT `slugify` CANNOT FOLD, end to end.
//
// ⚠️ EIGHT WRITING SYSTEMS HAD NO TERM ARCHIVE AT ALL. `slugify` folds Latin and Cyrillic and
// drops the rest, and `termSlug` had no fallback — so a tag in Japanese, Chinese, Korean, Thai,
// Arabic, Hebrew, Hindi or Greek slugged to the EMPTY STRING. Every taxonomy link on every page
// pointed at `/tag/`, which is a 404; the sitemap advertised the same dead URL and collapsed
// every such tag into one `<loc>`; and `/tag/日本語` worked right up until the canonical check
// compared it against the empty slug and 301'd it into the dead one.
//
// Three of those scripts are languages this admin is translated into.
//
// Driven through the real app rather than asserted on `termSlug`, because the bug was never in
// one function: it was the link, the redirect and the sitemap disagreeing with `resolveTerm`,
// which had matched the raw term all along.
import { describe, it, expect, afterAll, beforeEach } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { savePost } from '@/content/posts'
import { getSeriesList } from '@/content/series'
import { clearCache } from '@/server/cache'

const DIR = './.tmp/test-term-scripts'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
beforeEach(() => {
  for (const t of ['posts', 'post_terms', 'settings']) db().run(`delete from ${t}`)
  clearCache()
})

const SCRIPTS = ['日本語', '한국어', 'ไทย', 'العربية', 'Ελληνικά', 'Русский', 'giao diện']

describe('a tag whose letters no slug can carry', () => {
  it('is linked, resolves, and does not redirect to itself', async () => {
    for (const tag of SCRIPTS) {
      db().run(`delete from posts`)
      db().run(`delete from post_terms`)
      clearCache()
      await savePost({
        title: `A post tagged ${tag}`, slug: 'tagged-post', status: 'published',
        content: 'Body.', excerpt: 'Set.', date: '2026-01-01T00:00:00.000Z', tags: [tag],
      })
      const page = await (await app.request('/tagged-post')).text()
      // The link the page prints, and it must not be the bare `/tag/`.
      const href = /href="(\/tag\/[^"]*)"/.exec(page)?.[1] ?? ''
      expect(`${tag}: ${href === '/tag/' ? 'DEAD LINK' : 'linked'}`).toBe(`${tag}: linked`)

      const res = await app.request(href)
      // A 301 to itself is the shape the bug took: the archive was reachable until the
      // canonical check sent it somewhere else.
      expect(`${tag}: ${res.status}`).toBe(`${tag}: 200`)
    }
  })

  it('appears in the sitemap once per tag, encoded, and not as a bare kind path', async () => {
    await savePost({
      title: 'Two scripts', slug: 'two-scripts', status: 'published', content: 'Body.',
      excerpt: 'Set.', date: '2026-01-01T00:00:00.000Z', tags: ['日本語', '한국어'],
    })
    const xml = await (await app.request('/sitemap.xml')).text()
    expect(xml).not.toContain('/tag/</loc>')
    expect(xml).toContain(`/tag/${encodeURIComponent('日本語')}</loc>`)
    expect(xml).toContain(`/tag/${encodeURIComponent('한국어')}</loc>`)
  })
})

/**
 * ⚠️ A SERIES HAD THE SAME HOLE AND NO WAY OUT OF IT.
 *
 * Taxonomy at least still RESOLVED from the raw term, which is why `/tag/日本語` worked until the
 * canonical check took it away. `resolveSeries` compared slugs only, so a series named in a
 * script `slugify` cannot fold had no address at all: slug `""`, `/series/` answering 301 then
 * 404, `/series/書体の話` answering 404, and the link on every post in that series pointing at
 * nothing. Found while bringing the docs in line with the taxonomy fix, because the sentence in
 * `docs/features/reading.md` says a series slug is made "like categories/tags" — and it was.
 */
describe('a series whose letters no slug can carry', () => {
  it('has an address, in every script', async () => {
    for (const name of ['書体の話', '한국어 연재', 'ไทย', 'Letterforms', 'giao diện']) {
      db().run(`delete from posts`)
      clearCache()
      for (const [i, part] of [['One', 'part-one'], ['Two', 'part-two']].entries()) {
        await savePost({
          title: part[0]!, slug: part[1]!, status: 'published', content: 'Body.', excerpt: 'Set.',
          date: `2026-01-0${i + 1}T00:00:00.000Z`, series: name, seriesOrder: i + 1,
        })
      }
      const slug = (await getSeriesList())[0]?.slug ?? ''
      expect(`${name}: ${slug === '' ? 'NO SLUG' : 'slugged'}`).toBe(`${name}: slugged`)
      const res = await app.request(`/series/${encodeURIComponent(slug)}`)
      expect(`${name}: ${res.status}`).toBe(`${name}: 200`)
    }
  })
})
