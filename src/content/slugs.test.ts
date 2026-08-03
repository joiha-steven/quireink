// Ported from the frozen tree's `src/lib/slugs.test.ts`. Same five cases; the mocked
// PostgREST builder is gone and the rows are real (see src/test/db.ts).
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db, nowMs } from '@/store/db'
import { ensureSlugFree, SlugConflictError } from '@/content/slugs'

const DIR = './.tmp/test-slugs'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const addPost = (slug: string) =>
  db().run(`insert into posts (slug, title, date, created_at, updated_at) values (?, ?, ?, ?, ?)`,
    [slug, slug, nowMs(), nowMs(), nowMs()])
const addPage = (slug: string) =>
  db().run(`insert into pages (slug, title, created_at, updated_at) values (?, ?, ?, ?)`,
    [slug, slug, nowMs(), nowMs()])

beforeEach(() => {
  db().run(`delete from posts`)
  db().run(`delete from pages`)
})

describe('ensureSlugFree (posts + pages share one /{slug} namespace)', () => {
  it('throws SlugConflictError when a post already owns the slug', async () => {
    addPost('hello')
    await expect(ensureSlugFree('hello', 'post')).rejects.toBeInstanceOf(SlugConflictError)
  })

  it('throws when a PAGE owns the slug a new post wants (cross-table)', async () => {
    addPage('about')
    await expect(ensureSlugFree('about', 'post')).rejects.toBeInstanceOf(SlugConflictError)
  })

  it('resolves when the slug is free in both tables', async () => {
    expect(await ensureSlugFree('brand-new', 'post')).toBeUndefined()
  })

  it('lets an item re-save its own slug (self-match by kind + slug)', async () => {
    addPost('hello')
    expect(await ensureSlugFree('hello', 'post', 'hello')).toBeUndefined()
  })

  it('a page keeping its own slug still conflicts with a post of the same slug', async () => {
    addPost('shared') // a post owns it
    addPage('shared') // this very page owns it too
    // Editing the page (self = page/shared) must still fail on the POST collision.
    await expect(ensureSlugFree('shared', 'page', 'shared')).rejects.toBeInstanceOf(SlugConflictError)
  })

  it('a TRASHED row still reserves its slug, so restore can never collide', async () => {
    addPost('gone')
    db().run(`update posts set deleted_at = ? where slug = 'gone'`, [nowMs()])
    await expect(ensureSlugFree('gone', 'post')).rejects.toBeInstanceOf(SlugConflictError)
  })
})
