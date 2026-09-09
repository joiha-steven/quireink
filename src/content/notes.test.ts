// Notes against the real schema: the lifecycle, the namespace of their own, and the clip
// fields a later tier depends on.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import {
  saveNote, getNote, getNoteIndex, getPublicNotes, deleteNote, restoreNote, purgeNote,
  getTrashedNotes, emptyNotesTrash,
} from '@/content/notes'
import { savePage } from '@/content/pages'
import { getRedirects } from '@/server/redirects'
import { SlugConflictError } from '@/content/slugs'

const DIR = './.tmp/test-notes'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => {
  for (const t of ['notes', 'pages', 'posts', 'redirects']) db().run(`delete from ${t}`)
})

const PAST = '2020-01-01T00:00:00.000Z'

describe('saveNote', () => {
  it('round-trips a note and derives the slug from the title', async () => {
    const saved = await saveNote({ title: 'On reed pens', content: 'They run dry.', status: 'published', date: PAST })
    expect(saved.slug).toBe('on-reed-pens')
    expect(await getNote('on-reed-pens')).toMatchObject({ title: 'On reed pens', content: 'They run dry.', date: PAST })
  })

  it('keeps a clip: where it came from, what it said, and a slug from the source when untitled', async () => {
    const saved = await saveNote({
      content: 'Worth keeping.', status: 'draft', date: PAST,
      sourceUrl: 'https://example.com/the-reed-pen', sourceTitle: 'The reed pen', quote: 'every stroke starts wet',
    })
    expect(saved.slug).toBe('the-reed-pen')
    expect(await getNote('the-reed-pen')).toMatchObject({
      sourceUrl: 'https://example.com/the-reed-pen', sourceTitle: 'The reed pen', quote: 'every stroke starts wet',
    })
  })

  it('drops a source that is not an http(s) URL rather than keeping something it would link to', async () => {
    await saveNote({ title: 'x', content: '', date: PAST, sourceUrl: 'javascript:alert(1)' })
    expect((await getNote('x'))?.sourceUrl).toBeUndefined()
  })

  it('lives in a namespace of its own: a note and a page may share a name', async () => {
    await savePage({ title: 'About', content: 'page', status: 'published' })
    const note = await saveNote({ title: 'About', content: 'note', date: PAST })
    expect(note.slug).toBe('about')
    expect((await getNote('about'))?.content).toBe('note')
  })

  it('refuses a name another note holds, and lets a note keep its own', async () => {
    await saveNote({ title: 'One', content: '', date: PAST })
    await saveNote({ title: 'Two', content: '', date: PAST })
    await expect(saveNote({ title: 'Two', slug: 'one', content: '', date: PAST }, 'two')).rejects.toBeInstanceOf(SlugConflictError)
    await expect(saveNote({ title: 'One again', slug: 'one', content: '', date: PAST }, 'one')).resolves.toMatchObject({ slug: 'one' })
  })

  it('leaves a permanent redirect under /notes/ when renamed', async () => {
    await saveNote({ title: 'Old name', content: 'body', date: PAST })
    await saveNote({ title: 'New name', content: 'body', date: PAST }, 'old-name')
    expect(await getNote('old-name')).toBeNull()
    expect((await getNote('new-name'))?.content).toBe('body')
    expect(await getRedirects()).toContainEqual(expect.objectContaining({
      source: '/notes/old-name', destination: '/notes/new-name', permanent: true,
    }))
  })
})

describe('the two lists', () => {
  it('lists every live note newest first for the owner, and only published, reached dates for a reader', async () => {
    await saveNote({ title: 'Draft', content: '', status: 'draft', date: '2021-01-01T00:00:00.000Z' })
    await saveNote({ title: 'Older', content: '', status: 'published', date: PAST })
    await saveNote({ title: 'Newer', content: '', status: 'published', date: '2021-06-01T00:00:00.000Z' })
    await saveNote({ title: 'Future', content: '', status: 'published', date: '2999-01-01T00:00:00.000Z' })
    expect((await getNoteIndex()).map((n) => n.title)).toEqual(['Future', 'Newer', 'Draft', 'Older'])
    expect((await getPublicNotes()).map((n) => n.title)).toEqual(['Newer', 'Older'])
  })
})

describe('the trash', () => {
  it('trashes, restores and purges, and the slug stays reserved while trashed', async () => {
    await saveNote({ title: 'Kept', content: '', date: PAST })
    await deleteNote('kept')
    expect(await getNote('kept')).toBeNull()
    expect((await getTrashedNotes()).map((n) => n.slug)).toEqual(['kept'])
    await expect(saveNote({ title: 'Kept', content: '', date: PAST })).rejects.toBeInstanceOf(SlugConflictError)
    await restoreNote('kept')
    expect(await getNote('kept')).not.toBeNull()
    await deleteNote('kept')
    await purgeNote('kept')
    expect(await getTrashedNotes()).toEqual([])
  })

  it('empties the whole trash and says how many went', async () => {
    await saveNote({ title: 'A', content: '', date: PAST })
    await saveNote({ title: 'B', content: '', date: PAST })
    await deleteNote('a')
    await deleteNote('b')
    expect(await emptyNotesTrash()).toBe(2)
    expect(await getNoteIndex()).toEqual([])
  })
})
