// Bringing images home: the pure scanners, and one real move against the real schema —
// the fetcher is injected, so no test ever touches the network (the SSRF guard would
// veto localhost anyway, by design).
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost, getPost } from '@/content/posts'
import { savePage, getPage } from '@/content/pages'
import { remoteImageUrls, rewriteUrl, bringImagesHome } from '@/import/images'

const DIR = './.tmp/test-import-images'
const UPLOADS = `${DIR}-uploads`
freshDatabase(DIR)
process.env.STORAGE_LOCAL_DIR = UPLOADS
mkdirSync(UPLOADS, { recursive: true })

afterAll(() => {
  dropDatabase(DIR)
  delete process.env.STORAGE_LOCAL_DIR
  delete process.env.SITE_URL
  try { rmSync(UPLOADS, { recursive: true, force: true }) } catch { /* ignore */ }
})

beforeEach(() => {
  for (const t of ['posts', 'pages', 'post_revisions', 'media', 'redirects', 'settings']) {
    db().run(`delete from ${t}`)
  }
  delete process.env.SITE_URL
})

// A GIF header is enough: gif is a PASSTHROUGH type, so no decoder ever reads past it.
const GIF = new TextEncoder().encode('GIF89a').buffer as ArrayBuffer
const fetchGif = async () => ({ body: GIF, contentType: 'image/gif' })

describe('remoteImageUrls', () => {
  it('finds markdown images and raw src attributes, and strips the #grid tag', () => {
    const md = [
      '![a photo](https://old.example/wp-content/uploads/a.jpg)',
      '![b](https://old.example/b.png#grid)',
      '<img src="https://old.example/c.gif" alt="">',
    ].join('\n\n')
    expect(remoteImageUrls(md, null)).toEqual([
      'https://old.example/wp-content/uploads/a.jpg',
      'https://old.example/b.png',
      'https://old.example/c.gif',
    ])
  })

  it('leaves local references, plain links and the own host alone', () => {
    const md = [
      '![local](/uploads/media/kept.jpg)',
      '[a deliberate link out](https://elsewhere.example/photo.jpg)',
      '![mine](https://my.example/uploads/media/mine.jpg)',
    ].join('\n\n')
    expect(remoteImageUrls(md, 'my.example')).toEqual([])
  })
})

describe('rewriteUrl', () => {
  it('replaces the whole URL only — never the inside of a longer one', () => {
    const md = '![a](https://old.example/p.jpg#grid) ![b](https://old.example/p.jpg.webp)'
    const out = rewriteUrl(md, 'https://old.example/p.jpg', '/uploads/media/p.jpg')
    expect(out).toBe('![a](/uploads/media/p.jpg#grid) ![b](https://old.example/p.jpg.webp)')
  })
})

describe('bringImagesHome', () => {
  it('stores a remote image once and rewrites every reference to it', async () => {
    await savePost({
      title: 'One', slug: 'one', status: 'published', date: '2020-01-01T00:00:00.000Z',
      content: '![p](https://old.example/photo.jpg#grid)',
      featuredImage: 'https://old.example/photo.jpg',
    })
    await savePage({ title: 'Two', slug: 'two', status: 'published', content: '<img src="https://old.example/photo.jpg">' })

    const report = await bringImagesHome(5, fetchGif)
    expect(report).toMatchObject({ found: 1, moved: 1, remaining: 0, failed: [] })

    const post = await getPost('one')
    // Stored under the fetched file's own name; the #grid tag survives the rewrite.
    expect(post?.content).toMatch(/!\[p\]\(\/uploads\/media\/photo[^)]*#grid\)/)
    expect(post?.featuredImage).toMatch(/^\/uploads\/media\/photo/)
    const page = await getPage('two')
    expect(page?.content).toContain('src="/uploads/media/photo')
    // One URL in two documents is still ONE media item.
    expect(db().prepare('select count(*) as n from media').get()).toMatchObject({ n: 1 })
  })

  it('reports a failed fetch and leaves that reference untouched', async () => {
    await savePost({
      title: 'One', slug: 'one', status: 'published', date: '2020-01-01T00:00:00.000Z',
      content: '![gone](https://old.example/gone.jpg)',
    })
    const failing = async () => { throw new Error('fetch failed (404)') }
    const report = await bringImagesHome(5, failing)
    expect(report.moved).toBe(0)
    expect(report.remaining).toBe(1)
    expect(report.failed).toEqual([{ url: 'https://old.example/gone.jpg', reason: 'fetch failed (404)' }])
    expect((await getPost('one'))?.content).toContain('https://old.example/gone.jpg')
  })

  it('respects the batch limit and reports the rest as remaining', async () => {
    await savePost({
      title: 'Many', slug: 'many', status: 'published', date: '2020-01-01T00:00:00.000Z',
      content: '![a](https://old.example/a.gif) ![b](https://old.example/b.gif) ![c](https://old.example/c.gif)',
    })
    const report = await bringImagesHome(2, fetchGif)
    expect(report).toMatchObject({ found: 3, moved: 2, remaining: 1 })
    // The next call picks up the queue where this one stopped.
    const second = await bringImagesHome(2, fetchGif)
    expect(second).toMatchObject({ found: 1, moved: 1, remaining: 0 })
  })

  it('does not touch images already on the site\'s own host', async () => {
    process.env.SITE_URL = 'https://my.example'
    await savePost({
      title: 'Mine', slug: 'mine', status: 'published', date: '2020-01-01T00:00:00.000Z',
      content: '![ok](https://my.example/uploads/media/ok.jpg)',
    })
    expect(await bringImagesHome(5, fetchGif)).toMatchObject({ found: 0, moved: 0, remaining: 0 })
  })
})
