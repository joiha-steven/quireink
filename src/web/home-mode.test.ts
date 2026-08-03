// What `/` serves. ADR 0014.
//
// The first test is the one that matters most and looks the least interesting: an install
// that upgrades into this feature must see NO change. Everything else here is a mode
// somebody chose; that one is what happens to everybody who chose nothing.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { savePost, deletePost } from '@/content/posts'
import { savePage } from '@/content/pages'
import { getSettings, saveSettings } from '@/content/settings'
import { SlugConflictError } from '@/content/slugs'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-home-mode'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const PAST = '2020-01-01T00:00:00.000Z'

/** The mode is read per request, so the cache has to go with it or the old body survives. */
async function setMode(home: Partial<{ mode: 'list' | 'page'; page: string; listPath: string }>) {
  const current = await getSettings()
  await saveSettings({ ...current, home: { ...current.home, ...home } })
  clearCache()
}

const body = async (path: string) => await (await app.request(path)).text()

// Built once. Saving the same slug twice is a genuine conflict (the namespace is shared),
// so the fixtures cannot live in a beforeEach.
await savePost({ title: 'A Post', slug: 'a-post', status: 'published', date: PAST })
await savePage({ title: 'Welcome', slug: 'welcome', status: 'published', content: 'The front door.' })

beforeEach(async () => {
  await setMode({ mode: 'list', page: '', listPath: '/post' })
})

describe('the default', () => {
  it('is the post list at /, exactly as before', async () => {
    const settings = await getSettings()
    expect(settings.home.mode).toBe('list')
    expect(await body('/')).toContain('A Post')
    // ...and the list has no second address to be found at.
    expect((await app.request('/post')).status).toBe(404)
  })
})

describe('a page as the homepage', () => {
  beforeEach(async () => {
    await setMode({ mode: 'page', page: 'welcome' })
  })

  it('renders that page at /', async () => {
    const html = await body('/')
    expect(html).toContain('Welcome')
    expect(html).toContain('The front door.')
  })

  it('moves the post list to the configured path', async () => {
    const html = await body('/post')
    expect(html).toContain('A Post')
  })

  it('301s the page\'s own slug to /, so one document has one URL', async () => {
    const res = await app.request('/welcome')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/')
  })

  it('leaves /page/2 where it is, which is deliberate', async () => {
    // Not moved to /post/page/2. The pairing is untidy and it breaks no existing link.
    expect((await app.request('/page/1')).status).toBe(200)
  })

  // Four ways a slug stops being public, none of which revisit this setting.
  it('falls back to the list when the chosen page is gone, rather than 404ing', async () => {
    await setMode({ mode: 'page', page: 'no-such-page' })
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('A Post')
  })

  it('falls back to the list when the chosen page is unpublished', async () => {
    await savePage({ title: 'Later', slug: 'later', status: 'draft', content: 'x' })
    await setMode({ mode: 'page', page: 'later' })
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('A Post')
  })
})

describe('the list path is a third occupant of the /{slug} namespace', () => {
  it('refuses a post that would take it', async () => {
    await setMode({ mode: 'page', page: 'welcome', listPath: '/post' })
    expect(savePost({ title: 'Post', slug: 'post', status: 'published', date: PAST }))
      .rejects.toThrow(SlugConflictError)
  })

  it('allows that slug again once the list is back at /', async () => {
    await deletePost('post').catch(() => {})
    await setMode({ mode: 'list' })
    await savePost({ title: 'Post', slug: 'post', status: 'published', date: PAST })
    expect(await body('/post')).toContain('Post')
  })
})

describe('the sitemap', () => {
  it('names the list where it really is, and not the homepage twice', async () => {
    await setMode({ mode: 'page', page: 'welcome', listPath: '/writing' })
    const xml = await body('/sitemap.xml')
    expect(xml).toContain('/writing<')
    // The homepage's own slug 301s, and asking a crawler to index a redirect is the bug.
    expect(xml).not.toContain('/welcome<')
  })
})
