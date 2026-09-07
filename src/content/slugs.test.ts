// Ported from the frozen tree's `src/lib/slugs.test.ts`. Same five cases; the mocked
// PostgREST builder is gone and the rows are real (see src/test/db.ts).
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db, nowMs } from '@/store/db'
import { ensureSlugFree, RESERVED_SLUGS, SlugConflictError } from '@/content/slugs'
import { savePost } from '@/content/posts'
import { createApp } from '@/web/app'

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

/**
 * The reserved list, kept honest against the router rather than against somebody's memory.
 *
 * A fixed route shadows a slug only when it is one bare segment, or a segment with a
 * wildcard under it: Hono matches `/uploads/*` with the wildcard empty but does not match
 * `/assets/:file` with the parameter missing. So the set below is derived from the routes
 * the app actually registers, and adding a one-segment route without adding its name to
 * `RESERVED_SLUGS` turns this red.
 */
describe('reserved slugs', () => {
  // `/archive` looks like one of these and is not: it asks for the owner's own document
  // first and only draws the year index when there is none. See `term-routes.ts`.
  const EXCEPTIONS = new Set(['archive'])

  const shadowingSegments = (): Set<string> => {
    const out = new Set<string>()
    for (const { path } of createApp().routes) {
      const m = /^\/([a-z0-9-]+)(\/\*)?$/.exec(path)
      if (m?.[1]) out.add(m[1])
    }
    for (const name of EXCEPTIONS) out.delete(name)
    return out
  }

  it('names exactly the one-segment routes that swallow a slug', () => {
    expect([...shadowingSegments()].sort()).toEqual([...RESERVED_SLUGS].sort())
  })

  it('refuses to save a post or page at any of them', async () => {
    for (const slug of RESERVED_SLUGS) {
      await expect(ensureSlugFree(slug, 'post')).rejects.toBeInstanceOf(SlugConflictError)
      await expect(ensureSlugFree(slug, 'page')).rejects.toBeInstanceOf(SlugConflictError)
    }
  })

  it('proves each reserved name really is unreachable, and each exception really is not', async () => {
    const app = createApp()
    const reaches = async (slug: string): Promise<boolean> => {
      db().run(`delete from posts where slug = ?`, [slug])
      db().run(`insert into posts (slug, title, date, status, content, created_at, updated_at)
                values (?, ?, ?, 'published', 'body', ?, ?)`,
        [slug, `Probe ${slug}`, Date.parse('2020-01-01T00:00:00.000Z'), nowMs(), nowMs()])
      const res = await app.request(`/${slug}`)
      return res.status === 200 && (await res.text()).includes(`Probe ${slug}`)
    }
    for (const slug of RESERVED_SLUGS) expect([slug, await reaches(slug)]).toEqual([slug, false])
    for (const slug of EXCEPTIONS) expect([slug, await reaches(slug)]).toEqual([slug, true])
  })

  it('lets an ordinary word through', async () => {
    await expect(ensureSlugFree('about-us', 'page')).resolves.toBeUndefined()
    await savePost({ title: 'Ordinary', status: 'published', date: '2020-01-01T00:00:00.000Z' })
  })
})
