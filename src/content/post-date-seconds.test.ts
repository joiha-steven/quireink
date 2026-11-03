// The editor's date box holds minutes, so every save from it sent :00 and the post lost its seconds
// (`…:51.751` → `…:00`): two posts dated the same minute could swap places in the list and the feeds,
// and an unchanged date still differed from the stored one (2026-11-03).
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { getPost, savePost } from '@/content/posts'
import { getRevisions } from '@/content/revisions'
import { getNote, saveNote } from '@/content/notes'

const DIR = './.tmp/test-post-date-seconds'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))
beforeEach(() => { for (const t of ['posts', 'post_terms', 'post_revisions', 'notes']) db().run(`delete from ${t}`) })

describe('a save that names the same minute', () => {
  it('keeps the seconds the post already had', async () => {
    await savePost({ slug: 'ink', title: 'Ink', content: 'x', status: 'published', date: '2026-10-22T09:41:51.751Z' })
    await savePost({ slug: 'ink', title: 'Ink', content: 'y', status: 'published', date: '2026-10-22T09:41:00.000Z' }, 'ink')
    expect((await getPost('ink'))!.date).toBe('2026-10-22T09:41:51.751Z')
  })

  it('takes a new minute as given', async () => {
    await savePost({ slug: 'ink', title: 'Ink', content: 'x', status: 'published', date: '2026-10-22T09:41:51.751Z' })
    await savePost({ slug: 'ink', title: 'Ink', content: 'x', status: 'published', date: '2026-10-22T09:42:00.000Z' }, 'ink')
    expect((await getPost('ink'))!.date).toBe('2026-10-22T09:42:00.000Z')
  })

  it('is no change at all, so it writes no revision', async () => {
    await savePost({ slug: 'ink', title: 'Ink', content: 'x', status: 'published', date: '2026-10-22T09:41:51.751Z' })
    await savePost({ slug: 'ink', title: 'Ink', content: 'x', status: 'published', date: '2026-10-22T09:41:00.000Z' }, 'ink')
    expect(await getRevisions('ink')).toEqual([])
  })
})

describe('a note saved in the same minute', () => {
  it('keeps its seconds too', async () => {
    await saveNote({ slug: 'jot', title: 'Jot', content: 'x', status: 'published', date: '2026-10-22T09:41:51.751Z' })
    await saveNote({ slug: 'jot', title: 'Jot', content: 'y', status: 'published', date: '2026-10-22T09:41:00.000Z' }, 'jot')
    expect((await getNote('jot'))!.date).toBe('2026-10-22T09:41:51.751Z')
  })
})
