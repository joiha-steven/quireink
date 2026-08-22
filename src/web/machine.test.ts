// The surfaces that are not the blog: Markdown for agents, the PWA manifest, the search
// JSON, and the tokened draft preview.
//
// The preview cases are the ones that matter. It is the only public route that renders
// unpublished content, so what it must never do is render it for someone without the token.

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { savePage } from '@/content/pages'
import { getSettings, saveSettings } from '@/content/settings'
import { previewToken } from '@/content/preview'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { payload } from '@/test/api'

const DIR = './.tmp/test-machine'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string, headers?: Record<string, string>): Promise<Response> =>
  app.request(path, headers ? { headers } : undefined)

const PAST = '2020-01-01T00:00:00.000Z'
const FUTURE = '2099-01-01T00:00:00.000Z'

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings']) {
    db().run(`delete from ${t}`)
  }
})

describe('markdown for agents', () => {
  const publish = () => savePost({
    title: 'A Post', content: '## Heading\n\nSome **prose**.', status: 'published',
    date: PAST, categories: ['Engineering'],
  })

  it('serves the authored source, not the rendered HTML', async () => {
    await publish()
    const res = await get('/api/md/a-post')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/markdown')
    const body = await res.text()
    expect(body).toContain('# A Post')
    expect(body).toContain('Some **prose**.') // the asterisks survive
    expect(body).not.toContain('<strong>')
    expect(body).toContain('Engineering')
  })

  it('keeps itself out of the index, because the HTML page is the canonical one', async () => {
    await publish()
    expect((await get('/api/md/a-post')).headers.get('x-robots-tag')).toBe('noindex')
  })

  it('answers /{slug} in Markdown when the client asks for it', async () => {
    await publish()
    const res = await get('/a-post', { accept: 'text/markdown' })
    expect(res.headers.get('content-type')).toContain('text/markdown')
    expect(await res.text()).toContain('Some **prose**.')
  })

  it('still serves HTML to a browser, which lists text/markdown in no Accept it sends', async () => {
    await publish()
    const res = await get('/a-post', {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8',
    })
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('applies the same visibility rules as the page', async () => {
    await savePost({ title: 'Draft', content: 'x', status: 'draft', date: PAST })
    await savePost({ title: 'Later', content: 'x', status: 'published', date: FUTURE })
    await savePage({ title: 'Hidden', content: 'x', status: 'draft' })
    expect((await get('/api/md/draft')).status).toBe(404)
    expect((await get('/api/md/later')).status).toBe(404)
    expect((await get('/api/md/hidden')).status).toBe(404)
  })
})

describe('the manifest', () => {
  it('describes the live site rather than a build-time snapshot', async () => {
    await saveSettings({ title: 'My Blog', description: 'A tagline', language: 'vi' })
    const res = await get('/manifest.webmanifest')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/manifest+json')

    const m = await payload<Record<string, unknown>>(res)
    expect(m.name).toBe('My Blog')
    expect(m.description).toBe('A tagline')
    expect(m.lang).toBe('vi')
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/')
    // A theme colour from the palette, not a hardcoded one.
    expect(m.background_color).toMatch(/^#[0-9a-f]{3,8}$/i)
    // Three entries: two `any` sizes and one `maskable` for adaptive launchers.
    expect((m.icons as unknown[]).length).toBe(3)
  })

  it('reflects a setting the moment it is saved', async () => {
    await saveSettings({ title: 'First' })
    expect(((await get('/manifest.webmanifest').then((r) => r.json())) as { name: string }).name).toBe('First')
    await saveSettings({ title: 'Second' })
    expect(((await get('/manifest.webmanifest').then((r) => r.json())) as { name: string }).name).toBe('Second')
  })
})

describe('GET /api/search', () => {
  it('returns metadata only, never bodies', async () => {
    await savePost({ title: 'Timezone bugs', content: 'A long body about offsets', status: 'published', date: PAST })
    const res = await get('/api/search?q=timezone')
    expect(res.status).toBe(200)
    const results = await payload<Record<string, unknown>[]>(res)
    expect(results.length).toBe(1)
    expect(results[0]!.title).toBe('Timezone bugs')
    // Sending the body would make a public endpoint an efficient way to dump the blog.
    expect(Object.keys(results[0]!).sort()).toEqual(['date', 'slug', 'title'])
  })

  it('honours the same feature gate as the /search page', async () => {
    const { features } = await getSettings()
    await saveSettings({ features: { ...features, search: false } })
    expect((await get('/api/search?q=x')).status).toBe(404)
  })
})

describe('GET /preview/:slug', () => {
  it('renders a draft for whoever holds the token', async () => {
    await savePost({ title: 'Unfinished', content: 'Secret **draft** body', status: 'draft', date: PAST })
    const res = await get(`/preview/unfinished?key=${previewToken('unfinished')}`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Unfinished')
    expect(html).toContain('<strong>draft</strong>')
  })

  it('404s without a key, with a wrong key, and with another slug\'s key', async () => {
    await savePost({ title: 'Unfinished', content: 'x', status: 'draft', date: PAST })
    await savePost({ title: 'Other', content: 'x', status: 'draft', date: PAST })
    expect((await get('/preview/unfinished')).status).toBe(404)
    expect((await get('/preview/unfinished?key=guess')).status).toBe(404)
    // The token is an HMAC OF THE SLUG, so a valid link cannot be edited into a link to
    // someone else's draft.
    expect((await get(`/preview/unfinished?key=${previewToken('other')}`)).status).toBe(404)
  })

  it('is never indexed and never stored in a shared cache', async () => {
    await savePost({ title: 'Unfinished', content: 'x', status: 'draft', date: PAST })
    const res = await get(`/preview/unfinished?key=${previewToken('unfinished')}`)
    expect(res.headers.get('x-robots-tag')).toContain('noindex')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('says it is a preview, in the site language', async () => {
    // The frozen tree hardcoded this banner in Vietnamese, in a component. It is a locale
    // key now, in all six languages, which is the rule everything else in 2.0 follows.
    await savePost({ title: 'Unfinished', content: 'x', status: 'draft', date: PAST })
    const url = `/preview/unfinished?key=${previewToken('unfinished')}`

    await saveSettings({ language: 'en' })
    expect(await get(url).then((r) => r.text())).toContain('Preview: this page is not public')

    await saveSettings({ language: 'vi' })
    expect(await get(url).then((r) => r.text())).toContain('Bản xem trước')
  })

  it('leaves the public route unaffected: the draft is still a 404 there', async () => {
    await savePost({ title: 'Unfinished', content: 'x', status: 'draft', date: PAST })
    expect((await get('/unfinished')).status).toBe(404)
  })
})

describe('static files', () => {
  it('serves the reading font the head preloads', async () => {
    // This is not a formality. Every page preloads `/fonts/inter-latin.woff2`, and for the
    // whole of M2 so far nothing served it: the site's reading font never loaded, so the
    // typography settings were decorative. Found by requesting the URL, not by a test.
    const res = await get('/fonts/inter-latin.woff2')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('font/woff2')
    expect(res.headers.get('cache-control')).toContain('immutable')
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000)
  })

  it('serves every font the settings can preload', async () => {
    // A preset the owner can choose whose font 404s is a broken site for that owner only,
    // which is the kind of thing nobody reports.
    for (const family of ['literata', 'sourcesans', 'sourceserif', 'jetbrainsmono']) {
      for (const subset of ['latin', 'latin-ext', 'vietnamese']) {
        const res = await get(`/fonts/${family}-${subset}.woff2`)
        expect(`${family}-${subset}: ${res.status}`).toBe(`${family}-${subset}: 200`)
      }
    }
  })

  it('serves the icons the manifest and the head point at', async () => {
    expect((await get('/app-icon.png')).headers.get('content-type')).toBe('image/png')
    expect((await get('/favicon.ico')).headers.get('content-type')).toBe('image/x-icon')
  })

  it('has a manifest link in the head, or the site is not installable', async () => {
    await savePost({ title: 'Anything', content: 'x', status: 'published', date: PAST })
    const html = await get('/anything').then((r) => r.text())
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest">')
  })
})
