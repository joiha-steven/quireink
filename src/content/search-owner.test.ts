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
