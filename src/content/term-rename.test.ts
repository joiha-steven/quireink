// A RENAMED CATEGORY, TAG OR SERIES TAKES ITS ADDRESS WITH IT.
//
// Renaming only rewrote the posts' terms (2026-11-03): the front page's strip for the category kept
// the old name and drew nothing, a menu item pointing at `/category/old` became a 404, and the old
// listing, which the sitemap had been handing to search engines, answered 404 with no redirect.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { savePost, updateTerm } from '@/content/posts'
import { updateSeries } from '@/content/series'
import { getSettings, saveSettings } from '@/content/settings'
import { findRedirect } from '@/server/redirects'

const DIR = './.tmp/test-term-rename'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PAST = '2020-01-01T00:00:00.000Z'

beforeEach(async () => {
  for (const t of ['posts', 'post_terms', 'redirects', 'settings']) db().run(`delete from ${t}`)
  await savePost({ title: 'Nib', content: 'x', status: 'published', date: PAST, categories: ['Calligraphy'], tags: ['colour'], series: 'Ink and press' })
  const s = await getSettings()
  await saveSettings({
    menu: [{ label: 'Calligraphy', href: '/category/calligraphy' }, { label: 'Colour', href: '/tag/colour' }, { label: 'About', href: '/about' }],
    home: { ...s.home, front: { ...s.home.front, strips: [{ category: 'Calligraphy', count: 3, columns: 3 }, { category: 'Printing', count: 3, columns: 3 }] } },
  })
})

describe('renaming a category', () => {
  it('moves the front page strip, the menu item and the old address to the new name', async () => {
    expect(await updateTerm('category', 'Calligraphy', 'Thư pháp')).toBe(1)
    const s = await getSettings()
    expect(s.home.front.strips.map((x) => x.category)).toEqual(['Thư pháp', 'Printing'])
    expect(s.menu[0]).toEqual({ label: 'Thư pháp', href: '/category/thu-phap' })
    expect(s.menu[2]).toEqual({ label: 'About', href: '/about' })
    expect(findRedirect('/category/calligraphy')?.destination).toBe('/category/thu-phap')
  })

  it('renamed back, leaves no loop and no redirect on the live name', async () => {
    await updateTerm('category', 'Calligraphy', 'Thư pháp')
    await updateTerm('category', 'Thư pháp', 'Calligraphy')
    expect(findRedirect('/category/calligraphy')).toBeNull()
    expect(findRedirect('/category/thu-phap')?.destination).toBe('/category/calligraphy')
  })

  it('writes no redirect when only the spelling changed and the address did not', async () => {
    await updateTerm('category', 'Calligraphy', 'calligraphy')
    expect(findRedirect('/category/calligraphy')).toBeNull()
    expect((await getSettings()).home.front.strips[0]!.category).toBe('calligraphy')
  })

  it('gives the old address back once a published post carries that name again', async () => {
    await updateTerm('category', 'Calligraphy', 'Thư pháp')
    await savePost({ title: 'Again', content: 'y', status: 'published', date: PAST, categories: ['Calligraphy'] })
    expect(findRedirect('/category/calligraphy')).toBeNull()
  })
})

describe('renaming a tag and a series', () => {
  it('redirects the old tag address and moves the menu item', async () => {
    await updateTerm('tag', 'colour', 'màu')
    expect(findRedirect('/tag/colour')?.destination).toBe('/tag/mau')
    expect((await getSettings()).menu[1]).toEqual({ label: 'Colour', href: '/tag/mau' })
  })

  it('redirects the old series address', async () => {
    expect(await updateSeries('Ink and press', 'Mực và máy in')).toBe(1)
    expect(findRedirect('/series/ink-and-press')?.destination).toBe('/series/muc-va-may-in')
  })
})
