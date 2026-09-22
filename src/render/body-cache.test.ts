// The rendered body is cached under the piece it belongs to.
//
// MEASURED on the live box before any of this existed: `marked.parse` alone took 360ms on an
// 85,000-character post, and `renderPostContent` was 359ms of a 364ms page render. Every
// write anywhere emptied the page cache, so the next reader paid it again.
//
// It was cached by its CONTENT until ADR 0062, which is how a production blog came to hold
// 20,001 rows and 502 MB of HTML that no reader could ever reach again: `buildSha` is in the
// key, so every deploy stranded a whole generation and nothing but age could collect it. The
// tests below are mostly the same tests; what changed is what they assert about the rows.

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { all } from '@/store/query'
import { renderPostContent } from '@/render/post-content'
import { pruneRendered } from '@/render/render-cache'
import { collapseBlob } from '@/media/blob'

const DIR = './.tmp/test-body-cache'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => db().run(`delete from body_cache`))

const rows = (): number => all<{ n: number }>(`select count(*) as n from body_cache`)[0]!.n
const key = (slot: string): string =>
  all<{ key: string }>(`select key from body_cache where slot = ?`, slot)[0]!.key

describe('the body cache', () => {
  it('stores the rendered body and serves the second render from it', async () => {
    const md = '# Heading\n\nA paragraph, long enough to be worth keeping.\n'
    const first = await renderPostContent({ markdown: md, slot: 'post:a' })
    expect(rows()).toBe(1)
    const second = await renderPostContent({ markdown: md, slot: 'post:a' })
    expect(second).toBe(first)
    expect(rows()).toBe(1) // a hit, not a re-render
  })

  it('an edit TAKES the row rather than adding one', async () => {
    await renderPostContent({ markdown: 'One paragraph.', slot: 'post:a' })
    const after = await renderPostContent({ markdown: 'One paragraph, edited.', slot: 'post:a' })
    expect(rows()).toBe(1)
    expect(after).toContain('edited')
    // And the superseded render is gone rather than merely unreachable, which is the whole
    // difference from the shape this replaced.
    expect(all<{ html: string }>(`select html from body_cache`)[0]!.html).toContain('edited')
  })

  it('keys on the media facts too, because they change the markup', async () => {
    // An image renders as a bare <img> until its AVIF/WebP variants exist and then as a
    // <picture>. Same markdown, different HTML — so the media state has to be IN the key,
    // and a changed key has to MISS. Correctness unchanged; only the row count moved.
    const md = '![A photo](/uploads/media/x.jpg)\n'
    const bare = await renderPostContent({ markdown: md, slot: 'post:b' })
    const withVariants = await renderPostContent({
      markdown: md, slot: 'post:b',
      readyOriginals: new Map([[collapseBlob('/uploads/media/x.jpg'), 2]]),
    })
    expect(bare).not.toContain('<picture')
    expect(withVariants).toContain('image/avif')
    expect(rows()).toBe(1)
  })

  it('keys on the intrinsic size, which reserves the image box', async () => {
    const md = '![A photo](/media/y.jpg)\n'
    await renderPostContent({ markdown: md, slot: 'post:c' })
    const before = key('post:c')
    await renderPostContent({
      markdown: md, slot: 'post:c', imageDims: new Map([['media/y.jpg', { width: 800, height: 600 }]]),
    })
    // The stored key is what proves this missed and rendered again — the HTML happens to come
    // out the same here, because this fixture's dimensions are for a path the markdown does
    // not use. The key is the assertion; the row count is the point.
    expect(key('post:c')).not.toBe(before)
    expect(rows()).toBe(1)
  })

  // ⚠️ THE ONE THAT WOULD HAVE CAUGHT IT. On the shape this replaces it reads 200, and 200
  // is the measured disease: one body of 88,084 characters was found in `render_cache` 204
  // times, byte for byte, one per deploy that had happened in the previous thirty days.
  it('holds one row per piece however many times its key changes', async () => {
    const md = 'A piece that never changes.\n'
    for (let i = 0; i < 200; i++) {
      // A global input moving under a piece whose own text is untouched, which is what a
      // deploy is: `buildSha` is in the key exactly like these are.
      await renderPostContent({
        markdown: md, slot: 'post:d', imageDims: new Map([['media/z.jpg', { width: i, height: i }]]),
      })
    }
    expect(rows()).toBe(1)
  })

  it('holds one row per piece, so the table is the number of pieces', async () => {
    for (let i = 0; i < 20; i++) {
      await renderPostContent({ markdown: `Piece ${i}.\n`, slot: `post:p${i}` })
    }
    expect(rows()).toBe(20)
  })

  it('caches nothing at all without a slot', async () => {
    const html = await renderPostContent({ markdown: 'Belongs to nothing.\n' })
    expect(html).toContain('Belongs to nothing')
    expect(rows()).toBe(0)
  })

  it('keeps a preview out of the published piece\'s row', async () => {
    const published = await renderPostContent({ markdown: 'The published words.\n', slot: 'post:e' })
    await renderPostContent({ markdown: 'A draft nobody has published.\n', slot: 'preview:e' })
    expect(rows()).toBe(2)
    // The reader's row is untouched: a refresh of the preview must not cost a reader a render.
    const again = await renderPostContent({ markdown: 'The published words.\n', slot: 'post:e' })
    expect(again).toBe(published)
    expect(rows()).toBe(2)
  })

  it('sweeps a slot nothing renders any more, which is what a rename leaves behind', async () => {
    await renderPostContent({ markdown: 'Under its old slug.\n', slot: 'post:old-slug' })
    db().run(`update body_cache set created_at = ? where slot = 'post:old-slug'`, [1])
    await renderPostContent({ markdown: 'Under its new slug.\n', slot: 'post:new-slug' })
    expect(rows()).toBe(2)
    pruneRendered()
    expect(all<{ slot: string }>(`select slot from body_cache`).map((r) => r.slot)).toEqual(['post:new-slug'])
  })

  it('renders correctly with the table missing, because a cache is never load-bearing', async () => {
    db().run(`drop table body_cache`)
    const html = await renderPostContent({ markdown: 'Still renders.', slot: 'post:f' })
    expect(html).toContain('Still renders.')
    db().run(`create table if not exists body_cache (slot text primary key, key text not null,
      html text not null, created_at integer not null) without rowid`)
  })
})
