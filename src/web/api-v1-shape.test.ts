// WHAT LEAVES BY THE PUBLIC DOOR, asserted as a KEY SET rather than as a few fields.
//
// ⚠️ EVERY PIECE BELOW IS FILLED IN FULL, including the fields that must not travel. A
// projection test built from a realistic row proves nothing about a field that row happens not
// to carry: `deletedAt` is absent on every live post, so a projection that spread the row and
// forgot to strip it would pass every honest-looking fixture and leak on the one row in the
// trash. So each fixture here is deliberately unrealistic — every optional field set, including
// the three that are supposed to stay behind — and the assertion is EQUALITY.
//
// This is the same discipline `sheet-save.test.ts` arrived at from the other direction. There a
// stale hand-written list LOST a field the owner typed; here it would PUBLISH one they did not.
import { describe, expect, it } from 'bun:test'
import type { Note, Page, Post, PostWithContent } from '@/types'
import type { Sibling } from '@/content/translations'
import {
  apiNote, apiNoteFull, apiPage, apiPageFull, apiPost, apiPostFull, paginate, PER_DEFAULT, PER_MAX,
} from '@/web/api-v1-shape'

const SITE = 'https://example.test'

/** A post carrying EVERY field the type allows, wanted or not. */
const fullPost = (): PostWithContent => ({
  title: 'Một bài', slug: 'mot-bai', date: '2026-01-02T03:04:05.000Z', status: 'published',
  categories: ['Ghi chép'], tags: ['bút'], content: '# Thân bài',
  featuredImage: '/uploads/a.jpg', coverImage: '/uploads/b.jpg', excerpt: 'Mở đầu',
  readingMinutes: 4, series: 'Bộ ba', seriesOrder: 2,
  metaTitle: 'SEO title', metaDescription: 'SEO description',
  updatedAt: '2026-02-03T00:00:00.000Z',
  // The three that must stay behind.
  deletedAt: '2026-03-04T00:00:00.000Z', lang: 'vi', translationGroup: 'grp-1',
})

const fullPage = (): Page => ({
  title: 'Giới thiệu', slug: 'gioi-thieu', status: 'published',
  featuredImage: '/uploads/c.jpg', updatedAt: '2026-02-03T00:00:00.000Z',
  deletedAt: '2026-03-04T00:00:00.000Z', lang: 'en', translationGroup: 'grp-2',
})

const fullNote = (): Note => ({
  title: 'Trích', slug: 'trich', date: '2026-01-02T03:04:05.000Z', status: 'published',
  sourceUrl: 'https://elsewhere.test/a', sourceTitle: 'Elsewhere', quote: 'Một câu.',
  updatedAt: '2026-02-03T00:00:00.000Z', deletedAt: '2026-03-04T00:00:00.000Z',
})

const keys = (o: Record<string, unknown>): string[] => Object.keys(o).sort()

describe('a post on the wire', () => {
  it('carries exactly these fields and no others', () => {
    expect(keys(apiPost(fullPost(), SITE))).toEqual([
      'categories', 'coverImage', 'date', 'excerpt', 'featuredImage', 'lang', 'readingMinutes',
      'series', 'seriesOrder', 'slug', 'tags', 'title', 'updatedAt', 'url',
    ])
  })

  it('leaves the trash, the SEO overrides and the group id behind', () => {
    // Named one by one as well as counted above, because the list is what a reader of this file
    // checks and the reasons differ: `deletedAt` is a fact about the owner's trash, `metaTitle`
    // and `metaDescription` are instructions to a crawler about a page rather than anything the
    // piece says, and `translationGroup` is an opaque key that means nothing off this machine.
    const body = apiPost(fullPost(), SITE)
    for (const gone of ['deletedAt', 'metaTitle', 'metaDescription', 'translationGroup', 'status', 'content']) {
      expect(gone in body).toBe(false)
    }
  })

  it('makes an upload absolute and leaves a URL somebody typed alone', () => {
    const local = apiPost(fullPost(), SITE)
    expect(local.coverImage).toBe(`${SITE}/uploads/b.jpg`)
    expect(local.url).toBe(`${SITE}/mot-bai`)
    const hosted = apiPost({ ...fullPost(), coverImage: 'https://cdn.test/x.jpg' }, SITE)
    expect(hosted.coverImage).toBe('https://cdn.test/x.jpg')
  })

  it('says null where a post said nothing, rather than dropping the field', () => {
    // A key that vanishes when empty makes every client write `if ('series' in post)`. `null`
    // is one shape for "asked and answered: nothing", and the key set above is then the same
    // set for every post, which is what makes it assertable at all.
    const bare: Post = {
      title: 'T', slug: 't', date: '2026-01-01T00:00:00.000Z', status: 'published',
      categories: [], tags: [],
    }
    const body = apiPost(bare, SITE)
    expect(keys(body)).toEqual(keys(apiPost(fullPost(), SITE)))
    expect(body.series).toBeNull()
    expect(body.lang).toBeNull()
    expect(body.excerpt).toBe('')
  })

  it('adds the body and the translations, and only on the single piece', () => {
    const siblings: Sibling[] = [{ lang: 'en', path: '/the-essay', title: 'The essay' }]
    const one = apiPostFull(fullPost(), SITE, siblings)
    expect(one.content).toBe('# Thân bài')
    expect(one.translations).toEqual([{ lang: 'en', url: `${SITE}/the-essay`, title: 'The essay' }])
    // The counter-test: the LIST item has neither, which is what keeps a listing from being a
    // copy of the whole blog and a sibling lookup from running once per row.
    const listed = apiPost(fullPost(), SITE)
    expect('content' in listed).toBe(false)
    expect('translations' in listed).toBe(false)
  })
})

describe('a page and a note on the wire', () => {
  it('gives a page exactly these fields', () => {
    expect(keys(apiPage(fullPage(), SITE))).toEqual([
      'featuredImage', 'lang', 'slug', 'title', 'updatedAt', 'url',
    ])
    expect(keys(apiPageFull({ ...fullPage(), content: 'x' }, SITE, []))).toEqual([
      'content', 'featuredImage', 'lang', 'slug', 'title', 'translations', 'updatedAt', 'url',
    ])
  })

  it('gives a note exactly these fields, and neither language column', () => {
    // A note has no `lang` and no group (ADR 0044, ADR 0056): a clip quotes its source in the
    // source's own language, and there is no second note that is "the English one".
    expect(keys(apiNote(fullNote(), SITE))).toEqual([
      'date', 'quote', 'slug', 'sourceTitle', 'sourceUrl', 'title', 'updatedAt', 'url',
    ])
    expect(keys(apiNoteFull({ ...fullNote(), content: 'x' }, SITE))).toEqual([
      'content', 'date', 'quote', 'slug', 'sourceTitle', 'sourceUrl', 'title', 'updatedAt', 'url',
    ])
  })

  it('puts a note under /notes, never in the post namespace', () => {
    expect(apiNote(fullNote(), SITE).url).toBe(`${SITE}/notes/trich`)
  })
})

describe('paging', () => {
  const rows = Array.from({ length: 45 }, (_, i) => i)

  it('defaults to one page of PER_DEFAULT, and counts the rest', () => {
    const page = paginate(rows)
    expect(page.items.length).toBe(PER_DEFAULT)
    expect(page).toMatchObject({ total: 45, page: 1, per: PER_DEFAULT, pages: 3 })
    expect(page.items[0]).toBe(0)
  })

  it('refuses a page size larger than the cap', () => {
    // ⚠️ THE CAP IS THE POINT OF THIS FUNCTION. `per` is a LIMIT, and an unclamped limit is a
    // one-request way to ask this blog to assemble everything it has ever published.
    expect(paginate(rows, '1', '100000').items.length).toBe(Math.min(PER_MAX, 45))
    expect(paginate(rows, '1', '100000').per).toBe(PER_MAX)
  })

  it('reads a page past the end as the last page, not as a miss', () => {
    const page = paginate(rows, '99', '20')
    expect(page.page).toBe(3)
    expect(page.items).toEqual([40, 41, 42, 43, 44])
  })

  it('treats nonsense as unsaid rather than as an error', () => {
    // `?per=abc` is a client bug, and page 1 of 20 is more use to whoever is debugging it than
    // a 400 that reads as though the endpoint itself is broken.
    for (const bad of ['abc', '0', '-3', '1.5', '']) {
      expect(paginate(rows, bad, bad).per).toBe(PER_DEFAULT)
      expect(paginate(rows, bad, bad).page).toBe(1)
    }
  })

  it('clamps a number written in scientific notation, which IS a whole number', () => {
    // ⚠️ `Number('1e9')` is 1000000000 and `Number.isInteger` says yes, so this reaches the cap
    // rather than the nonsense branch — which is the right outcome and not the obvious one. A
    // reader who assumed "only digits get through" would have written the guard as a regexp on
    // the string and let this one past in a different shape.
    expect(paginate(rows, '1', '1e9').per).toBe(PER_MAX)
  })

  it('answers an empty blog with one empty page', () => {
    // `pages: 0` would make `page` clamp to 0 and every client's `for (let p = 1; p <= pages)`
    // silently correct; one empty page is the honest shape of "nothing here yet".
    expect(paginate([])).toEqual({ items: [], total: 0, page: 1, per: PER_DEFAULT, pages: 1 })
  })
})
