// Renaming a piece back to a name it had before.
//
// a → b leaves `/a → /b`. Renaming b → a then saved `/b → /a` BEFORE clearing `/a`: the loop
// check saw `/a → /b → /a`, refused, and threw after the rename had committed. The owner got a
// 500, `/a` kept sending readers to `/b`, and `/b` was a 404 — the piece was unreachable, and a
// second rename could not fix it. Posts, pages and notes each had the same order.

import { describe, it, expect, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { savePost } from '@/content/posts'
import { savePage } from '@/content/pages'
import { saveNote } from '@/content/notes'
import { findRedirect } from '@/server/redirects'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-rename-back'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const DATE = '2024-01-01T00:00:00.000Z'

describe('a piece renamed back to an earlier name', () => {
  it('a post answers at its old-new name, and the other name points to it', async () => {
    await savePost({ title: 'A', slug: 'rb-a', content: 'x', status: 'published', date: DATE })
    await savePost({ title: 'A', slug: 'rb-b', content: 'x', status: 'published', date: DATE }, 'rb-a')
    await savePost({ title: 'A', slug: 'rb-a', content: 'x', status: 'published', date: DATE }, 'rb-b')
    expect(findRedirect('/rb-a')).toBeNull()
    expect(findRedirect('/rb-b')?.destination).toBe('/rb-a')
    expect((await app.request('/rb-a')).status).toBe(200)
    const old = await app.request('/rb-b')
    expect(old.status).toBe(301)
    expect(old.headers.get('location')).toBe('/rb-a')
  })

  it('so does a page', async () => {
    await savePage({ title: 'P', slug: 'rb-p1', content: 'x', status: 'published' })
    await savePage({ title: 'P', slug: 'rb-p2', content: 'x', status: 'published' }, 'rb-p1')
    await savePage({ title: 'P', slug: 'rb-p1', content: 'x', status: 'published' }, 'rb-p2')
    expect((await app.request('/rb-p1')).status).toBe(200)
    expect(findRedirect('/rb-p2')?.destination).toBe('/rb-p1')
  })

  it('and a note', async () => {
    await saveNote({ title: 'N', slug: 'rb-n1', content: 'x', status: 'published', date: DATE })
    await saveNote({ title: 'N', slug: 'rb-n2', content: 'x', status: 'published', date: DATE }, 'rb-n1')
    await saveNote({ title: 'N', slug: 'rb-n1', content: 'x', status: 'published', date: DATE }, 'rb-n2')
    expect((await app.request('/notes/rb-n1')).status).toBe(200)
    expect(findRedirect('/notes/rb-n2')?.destination).toBe('/notes/rb-n1')
  })
})
