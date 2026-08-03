// The database half of series. `series.test.ts` covers the pure ordering rules that moved
// verbatim; these are the two writes, where a rename that merges and a reorder that
// silently skips a slug are both easy to get wrong and invisible afterwards.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one } from '@/store/query'
import { savePost } from '@/content/posts'
import {
  getSeriesForPost, getSeriesList, resolveSeries, getAllSeriesNames,
  updateSeries, reorderSeries,
} from '@/content/series'

const DIR = './.tmp/test-series-store'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PAST = '2020-01-01T00:00:00.000Z'

beforeEach(() => {
  for (const t of ['posts', 'post_terms', 'post_revisions', 'settings']) db().run(`delete from ${t}`)
})

const part = (title: string, series: string, order: number, over = {}) =>
  savePost({ title, series, seriesOrder: order, status: 'published', date: PAST, ...over })

describe('reads', () => {
  it('gives a post its ordered siblings and its own position', async () => {
    await part('Part Two', 'Bun Notes', 1)
    await part('Part One', 'Bun Notes', 0)
    await part('Elsewhere', 'Other', 0)
    const info = await getSeriesForPost('part-two')
    expect(info!.name).toBe('Bun Notes')
    expect(info!.slug).toBe('bun-notes')
    expect(info!.posts.map((p) => p.title)).toEqual(['Part One', 'Part Two'])
    expect(info!.currentIndex).toBe(1)
  })

  it('is null for a post with no series, and for a draft', async () => {
    await savePost({ title: 'Loner', status: 'published', date: PAST })
    await part('Hidden', 'Bun Notes', 0, { status: 'draft' })
    expect(await getSeriesForPost('loner')).toBeNull()
    expect(await getSeriesForPost('hidden')).toBeNull()
  })

  it('never shows a draft part to the public', async () => {
    await part('Public', 'Bun Notes', 0)
    await part('Draft Part', 'Bun Notes', 1, { status: 'draft' })
    expect((await getSeriesForPost('public'))!.posts.map((p) => p.title)).toEqual(['Public'])
    expect(await getSeriesList()).toEqual([{ name: 'Bun Notes', slug: 'bun-notes', count: 1 }])
  })

  it('resolves a slug back to the display name, and returns nothing for an unknown one', async () => {
    await part('One', 'Bun Notes', 0)
    expect((await resolveSeries('bun-notes')).name).toBe('Bun Notes')
    expect(await resolveSeries('nope')).toEqual({ name: null, posts: [] })
  })

  it('lists every series name including drafts, for the editor autocomplete', async () => {
    await part('A', 'Zed Series', 0)
    await part('B', 'Alpha Series', 0, { status: 'draft' })
    expect(await getAllSeriesNames()).toEqual(['Alpha Series', 'Zed Series'])
  })
})

describe('updateSeries', () => {
  it('renames across every post and reports the count', async () => {
    await part('A', 'Old Name', 0)
    await part('B', 'Old Name', 1)
    await part('C', 'Untouched', 0)
    expect(await updateSeries('Old Name', 'New Name')).toBe(2)
    expect(await getAllSeriesNames()).toEqual(['New Name', 'Untouched'])
  })

  it('a rename into an EXISTING series merges the two', async () => {
    await part('A', 'Old Name', 0)
    await part('B', 'Keep', 0)
    await updateSeries('Old Name', 'Keep')
    expect((await resolveSeries('keep')).posts.map((p) => p.title).sort()).toEqual(['A', 'B'])
  })

  it('a null or blank new name clears the series AND resets the order', async () => {
    await part('A', 'Doomed', 3)
    expect(await updateSeries('Doomed', null)).toBe(1)
    expect(await getSeriesForPost('a')).toBeNull()
    expect(one<{ series_order: number }>(`select series_order from posts where slug = 'a'`)!.series_order).toBe(0)
    await part('B', 'Also Doomed', 2)
    expect(await updateSeries('Also Doomed', '   ')).toBe(1)
    expect(await getSeriesForPost('b')).toBeNull()
  })

  it('reports 0 for a series nobody is in', async () => {
    expect(await updateSeries('ghost', 'x')).toBe(0)
  })
})

describe('reorderSeries', () => {
  it('rewrites the order to match the given slug list', async () => {
    await part('A', 'S', 0)
    await part('B', 'S', 1)
    await part('C', 'S', 2)
    expect(await reorderSeries('S', ['c', 'a', 'b'])).toBe(3)
    expect((await resolveSeries('s')).posts.map((p) => p.title)).toEqual(['C', 'A', 'B'])
  })

  it('ignores a slug that is not in this series, and counts only what it touched', async () => {
    await part('A', 'S', 0)
    await part('Other', 'T', 0)
    expect(await reorderSeries('S', ['a', 'other', 'ghost'])).toBe(1)
    expect(one<{ series_order: number }>(`select series_order from posts where slug = 'other'`)!.series_order).toBe(0)
  })
})
