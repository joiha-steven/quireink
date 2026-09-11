// The owner's search (ADR 0024). Every test here is a way the OLD admin filter failed:
// it could not see a body, could not see a draft, and could not see a page at all.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { savePage } from '@/content/pages'
import { searchEverything } from '@/content/search-owner'

const DIR = './.tmp/test-search-owner'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => {
  db().run(`delete from posts`)
  db().run(`delete from pages`)
})

const slugs = async (q: string) => (await searchEverything(q)).map((h) => h.slug)

describe('searchEverything', () => {
  it('finds a DRAFT by a sentence in its body — the thing the old filter could not do', async () => {
    await savePost({
      title: 'Ligatures', status: 'draft',
      content: 'The fi ligature exists because the hook collides with the dot.',
    })
    expect(await slugs('collides with the dot')).toEqual(['ligatures'])
    // And the title filter it replaces would have matched none of those words.
    expect(await slugs('ligatures')).toEqual(['ligatures'])
  })

  it('folds diacritics both ways, because the owner types without them', async () => {
    await savePost({ title: 'Dấu tiếng Việt', status: 'draft', content: 'Dấu chữ và dấu thanh chồng hai tầng.' })
    expect(await slugs('dau thanh')).toEqual(['dau-tieng-viet'])
    expect(await slugs('chồng hai tầng')).toEqual(['dau-tieng-viet'])
  })

  // The other half of that rule, and the half the FTS index cannot hold on its own: it is
  // folded, so it answers "lề" with every "lệ", "lê" and "lẻ" in the blog. In Vietnamese
  // those are different words, and the owner typed the one they meant.
  it('an accented word means its accents: "lề" does not drag in "lệ"', async () => {
    await savePost({ title: 'Căn lề', status: 'draft', content: 'Căn lề trái cho đoạn văn.' })
    await savePost({ title: 'Tỉ lệ', status: 'published', content: 'Tỉ lệ chuyển đổi của trang.' })
    await savePost({ title: 'Quả lê', status: 'published', content: 'Quả lê chín trên bàn.' })
    expect(await slugs('lề')).toEqual(['can-le'])
    expect(await slugs('lệ')).toEqual(['ti-le'])
    // And an unaccented query still asks the wide question, because that is what folding is for.
    expect((await slugs('le')).sort()).toEqual(['can-le', 'qua-le', 'ti-le'])
  })

  it('shows the passage the accented word is in, not the one the folded index found', async () => {
    await savePost({
      title: 'Hai chữ', status: 'draft',
      content: 'Tỉ lệ chuyển đổi của trang này rất cao. Sau đó căn lề trái cho cả đoạn.',
    })
    const [hit] = await searchEverything('lề')
    expect(hit?.line).toContain('lề')
    expect(hit?.line).not.toContain('Tỉ lệ chuyển đổi')
  })

  it('still fills the page when most of what the index matched is another spelling', async () => {
    // The narrowing drops rows AFTER the database has cut the list, so the query has to ask
    // for more than it shows. Reading exactly the page size returned one result here.
    // The three wanted rows are the OLDEST, so the list is cut date-first and they fall
    // outside a window the size of the page.
    for (let i = 0; i < 3; i++) {
      await savePost({ title: `Căn lề ${i}`, status: 'draft', content: 'Căn lề trái.' })
    }
    for (let i = 0; i < 70; i++) {
      await savePost({ title: `Tỉ lệ ${i}`, status: 'draft', content: 'Tỉ lệ chuyển đổi.' })
    }
    expect((await slugs('lề')).sort()).toEqual(['can-le-0', 'can-le-1', 'can-le-2'])
  })

  it('searches pages as well as posts, and says which is which', async () => {
    await savePost({ title: 'A post', status: 'published', content: 'ogonek is not a comma' })
    await savePage({ title: 'A page', status: 'draft', content: 'ogonek is a tail' })
    const hits = await searchEverything('ogonek')
    expect(hits.map((h) => h.kind).sort()).toEqual(['page', 'post'])
  })

  it('returns the passage the words were found in, not the first line of the post', async () => {
    await savePost({
      title: 'Measure', status: 'published',
      content: 'One opening paragraph about nothing in particular.\n\nWiden the leading before you widen the column.',
    })
    const [hit] = await searchEverything('widen the leading')
    expect(hit?.line).toContain('leading')
    expect(hit?.line).not.toContain('nothing in particular')
  })

  it('never leaks a trashed post', async () => {
    await savePost({ title: 'Gone', status: 'published', content: 'a sentence that exists' })
    db().run(`update posts set deleted_at = 1 where slug = 'gone'`)
    expect(await slugs('a sentence that exists')).toEqual([])
  })

  it('reads FTS5 operator punctuation as ordinary words, rather than throwing', async () => {
    await savePost({ title: 'Quotes', status: 'draft', content: `don't panic about "quotes" or -dashes` })
    expect(await slugs(`don't`)).toEqual(['quotes'])
    // `OR` is FTS5's operator. Quoted, it is the word this post happens to contain, which
    // is the proof: unquoted it would be syntax, and a bare operator is a query error.
    expect(await slugs('OR')).toEqual(['quotes'])
    expect(await slugs('-dashes')).toEqual(['quotes'])
    // A lone quote matches nothing, and must do it by returning nothing rather than by
    // throwing under somebody who is still typing.
    expect(await searchEverything('"')).toEqual([])
  })

  it('is empty for an empty query rather than returning everything', async () => {
    await savePost({ title: 'Something', status: 'published', content: 'anything' })
    expect(await searchEverything('')).toEqual([])
    expect(await searchEverything('   ')).toEqual([])
  })
})
