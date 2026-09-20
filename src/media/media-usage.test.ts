// WHAT THE "CHECK UNUSED" SWEEP IS ALLOWED TO NAME.
//
// It only reports — it never deletes — but the owner deletes on its word, so a picture named
// here wrongly is a picture that goes. Until 2026-09-19 the settings half of the scan read two
// fields, `logoUrl` and `seo.ogFallbackImage`, and the other seven pictures a blog can hold
// were all reported as referenced nowhere: the author's avatar (reported by eye), the favicon,
// the app icon, the dark logo, and the three twins the logo pipeline derives.
//
// So the rule under test is not "these nine fields". It is that a picture NAMED ANYWHERE in
// the settings is used, whichever field happens to hold it — because a list of fields is a
// list that goes stale the next time a setting holds a picture, silently.
//
// ⚠️ AND THE SAME LIST WENT STALE AGAIN ON THE TABLES, which is why the block at the foot of
// this file exists. The scan read `content` and `featured_image` and nothing else, so three
// live references were reported as orphans: a post's SECOND picture (`cover_image`), every
// picture in the NOTEBOOK, and the cover inside a revision snapshot. Proved with the real
// routes on 2026-09-19 — reported unused, purged 200, blob gone.

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { saveSettings } from '@/content/settings'
import { savePost } from '@/content/posts'
import { findUnusedMedia } from '@/media/media-usage'

const DIR = './.tmp/test-media-usage'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

/** A row in the library, which is all this audit reads. */
const upload = (name: string): void => {
  db().run(
    `insert into media (path, filename, size, uploaded_at, variants) values (?, ?, 1, 1, 0)`,
    [`media/${name}`, name],
  )
}

const unused = async (): Promise<string[]> =>
  (await findUnusedMedia()).map((u) => u.replace(/^.*media\//, '')).sort()

beforeEach(() => {
  for (const t of ['media', 'posts', 'pages', 'notes', 'post_revisions', 'settings']) db().run(`delete from ${t}`)
})

describe('a picture the settings point at', () => {
  it('is used, whichever setting holds it', async () => {
    for (const f of ['logo.webp', 'face.webp', 'favicon.png', 'app-icon.png', 'logo-dark.webp', 'og.jpg', 'orphan.webp']) {
      upload(f)
    }
    await saveSettings({
      logoUrl: '/uploads/media/logo.webp',
      logoDarkUrl: '/uploads/media/logo-dark.webp',
      faviconUrl: '/uploads/media/favicon.png',
      appIconUrl: '/uploads/media/app-icon.png',
      author: { avatarUrl: '/uploads/media/face.webp' },
      seo: { ogFallbackImage: '/uploads/media/og.jpg' },
    } as Parameters<typeof saveSettings>[0])

    // The one nothing points at, and only that one.
    expect(await unused()).toEqual(['orphan.webp'])
  })

  it('and the counter-test: a picture nothing holds IS named', async () => {
    // Every assertion above is "the list is short". A scan that returned nothing at all would
    // pass them, and would also be the most dangerous possible answer to give a delete button.
    upload('nobody-wants-me.webp')
    expect(await unused()).toEqual(['nobody-wants-me.webp'])
  })

  it('a post body still counts, which is the half that always worked', async () => {
    upload('in-a-post.webp')
    upload('orphan.webp')
    await savePost({
      title: 'Bai', slug: 'bai', status: 'published', date: new Date().toISOString(),
      content: 'Anh: ![x](/uploads/media/in-a-post.webp)',
    } as Parameters<typeof savePost>[0])
    expect(await unused()).toEqual(['orphan.webp'])
  })
})

describe('a picture a TABLE points at, in any column', () => {
  it('counts a post cover, which lives in its own column beside the featured image', async () => {
    upload('cover.webp')
    upload('featured.webp')
    db().run(
      `insert into posts (slug, title, content, date, status, created_at, updated_at,`
      + ` featured_image, cover_image) values (?, ?, '', 1, 'published', 1, 1, ?, ?)`,
      ['p', 'A post', 'media/featured.webp', 'media/cover.webp'],
    )
    expect(await unused()).toEqual([])
  })

  it('counts a picture in a note, which the sweep never read at all', async () => {
    upload('in-a-note.webp')
    db().run(
      `insert into notes (slug, title, content, date, status, created_at, updated_at)`
      + ` values (?, '', ?, 1, 'published', 1, 1)`,
      ['n', 'look at ![this](/uploads/media/in-a-note.webp)'],
    )
    expect(await unused()).toEqual([])
  })

  it('counts a cover kept only in a revision, because restoring it needs the bytes', async () => {
    upload('old-cover.webp')
    db().run(
      `insert into post_revisions (slug, data, saved_at) values (?, ?, 1)`,
      ['p', JSON.stringify({ title: 'was', content: '', coverImage: 'media/old-cover.webp' })],
    )
    expect(await unused()).toEqual([])
  })

  it('and the counter-test: the same search names a picture nothing holds', async () => {
    // ⚠️ THE LOAD-BEARING HALF. Every assertion above is that a list came back EMPTY, which is
    // also what a broken sweep returns, what an empty library returns, and what a query that
    // threw and was swallowed returns. This proves the three rows above were actually read.
    upload('orphan.webp')
    upload('cover.webp')
    db().run(
      `insert into posts (slug, title, content, date, status, created_at, updated_at, cover_image)`
      + ` values (?, '', '', 1, 'published', 1, 1, ?)`,
      ['p', 'media/cover.webp'],
    )
    expect(await unused()).toEqual(['orphan.webp'])
  })
})
