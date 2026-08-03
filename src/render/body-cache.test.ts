// The rendered body is cached by its own content.
//
// MEASURED on the live box before this existed: `marked.parse` alone took 360ms on an
// 85,000-character post, and `renderPostContent` was 359ms of a 364ms page render. Every
// write anywhere emptied the page cache, so the next reader paid it again — and the CDN
// purge this release added means the next reader is a real one.

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { all } from '@/store/query'
import { renderPostContent } from '@/render/post-content'
import { collapseBlob } from '@/media/blob'

const DIR = './.tmp/test-body-cache'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => db().run(`delete from render_cache`))

const rows = (): number => all<{ n: number }>(`select count(*) as n from render_cache`)[0]!.n

describe('the body cache', () => {
  it('stores the rendered body and serves the second render from it', async () => {
    const md = '# Heading\n\nA paragraph, long enough to be worth keeping.\n'
    const first = await renderPostContent({ markdown: md })
    expect(rows()).toBe(1)
    const second = await renderPostContent({ markdown: md })
    expect(second).toBe(first)
    expect(rows()).toBe(1) // no second row: it was a hit, not a re-render
  })

  it('keys on the markdown, so an edit is simply a different key', async () => {
    await renderPostContent({ markdown: 'One paragraph.' })
    await renderPostContent({ markdown: 'One paragraph, edited.' })
    expect(rows()).toBe(2)
  })

  it('keys on the media facts too, because they change the markup', async () => {
    // An image renders as a bare <img> until its AVIF/WebP variants exist and then as a
    // <picture>. Same markdown, different HTML — so the media state has to be IN the key
    // rather than invalidated out of it, which is the whole reason this needs no graph.
    const md = '![A photo](/uploads/media/x.jpg)\n'
    const bare = await renderPostContent({ markdown: md })
    const withVariants = await renderPostContent({
      markdown: md, readyOriginals: new Set([collapseBlob('/uploads/media/x.jpg')]),
    })
    expect(rows()).toBe(2)
    expect(bare).not.toContain('<picture')
    expect(withVariants).toContain('image/avif')
  })

  it('keys on the intrinsic size, which reserves the image box', async () => {
    const md = '![A photo](/media/y.jpg)\n'
    await renderPostContent({ markdown: md })
    await renderPostContent({
      markdown: md, imageDims: new Map([['media/y.jpg', { width: 800, height: 600 }]]),
    })
    expect(rows()).toBe(2)
  })

  it('renders correctly with the table missing, because a cache is never load-bearing', async () => {
    db().run(`drop table render_cache`)
    const html = await renderPostContent({ markdown: 'Still renders.' })
    expect(html).toContain('Still renders.')
    db().run(`create table if not exists render_cache (key text primary key, html text not null,
      created_at integer not null) without rowid`)
  })
})
