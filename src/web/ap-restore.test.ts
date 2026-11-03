// What `/{slug}` answers once a post has come back from the Trash under `?r=<n>` (2026-11-04).
//
// A server holding the page address fetches it and is handed the object whose id is the current
// `?r=<n>`, which Mastodon then fetches again by that id and keeps (`FetchResourceService`). An id
// that was withdrawn answers 410 with a Tombstone, as ActivityPub §6.4 asks, and an `r` the
// ledger never gave is a 404. A browser is never shown a second page: `?r=` is ignored for HTML,
// the canonical stays the page, and the page cache gains no key.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { dropDatabase, freshDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { getSettings, saveSettings } from '@/content/settings'
import { savePost } from '@/content/posts'
import { deletePost, restorePost } from '@/content/posts-trash'
import { clearCache, pageCache } from '@/server/cache'
import { resetLimits } from '@/server/rate-limit'
import { run } from '@/store/query'
import { ensureKeys } from '@/ap/keys'
import { sweepAnnounce } from '@/ap/announce'

const DIR = './.tmp/test-ap-restore-routes'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))
const app = createApp()
const SITE = 'https://blog.example'
const URL = `${SITE}/comes-back`
const AP = { accept: 'application/activity+json' }

const sweep = async () => sweepAnnounce({ settings: await getSettings(), site: SITE, since: 0 })
const get = async (path: string, headers: Record<string, string> = {}) => await app.request(path, { headers })

beforeEach(async () => {
  resetLimits()
  clearCache()
  for (const t of ['ap_sent', 'ap_queue', 'ap_followers', 'posts']) run(`delete from ${t}`)
  await saveSettings({ siteUrl: SITE, title: 'A Blog', activitypub: { enabled: true, handle: 'quire' } })
  ensureKeys()
  await savePost({
    title: 'Comes back', slug: 'comes-back', content: 'Body.', status: 'published',
    date: new Date(Date.now() - 3600_000).toISOString(), categories: [], tags: [],
  } as Parameters<typeof savePost>[0])
  await sweep()
})

/** Trash, say so, restore, say so: the post is back as `?r=1`. */
const roundTrip = async () => {
  await deletePost('comes-back')
  await sweep()
  await restorePost('comes-back')
  await sweep()
}

describe('a server asking for a post that came back', () => {
  it('is handed the object under its current id, from the page address and from that id', async () => {
    await roundTrip()
    for (const path of ['/comes-back', '/comes-back?r=1']) {
      const res = await get(path, AP)
      expect(res.status).toBe(200)
      const note = await res.json() as { id: string; url: string; type: string }
      expect([note.type, note.id, note.url]).toEqual(['Note', `${URL}?r=1`, URL])
    }
  })

  it('is told an id that was withdrawn is gone: 410 and a Tombstone', async () => {
    await roundTrip()
    await deletePost('comes-back')
    await sweep()
    await restorePost('comes-back')
    await sweep() // now ?r=2; ?r=1 was withdrawn
    const res = await get('/comes-back?r=1', AP)
    expect(res.status).toBe(410)
    expect(await res.json()).toMatchObject({ id: `${URL}?r=1`, type: 'Tombstone' })
  })

  it('is told the same for a post still in the Trash', async () => {
    await deletePost('comes-back')
    await sweep()
    const res = await get('/comes-back', AP)
    expect(res.status).toBe(410)
    expect(await res.json()).toMatchObject({ id: URL, type: 'Tombstone' })
  })

  it('gets a 404 for an r the ledger never gave', async () => {
    await roundTrip()
    for (const r of ['2', '9', '0', 'x', '01']) expect((await get(`/comes-back?r=${r}`, AP)).status).toBe(404)
  })
})

describe('a reader following that id in a browser', () => {
  it('gets the one page, canonical to the page address, and the cache gains no key', async () => {
    await roundTrip()
    const plain = await get('/comes-back', { accept: 'text/html' })
    const withR = await get('/comes-back?r=1', { accept: 'text/html' })
    const unknown = await get('/comes-back?r=9', { accept: 'text/html' })
    expect([plain.status, withR.status, unknown.status]).toEqual([200, 200, 200])
    const html = await withR.text()
    expect(html).toBe(await plain.text())
    expect(html).toContain(`<link rel="canonical" href="${URL}"`)
    expect(pageCache.has('/comes-back')).toBe(true)
    expect(pageCache.has('/comes-back?r=1')).toBe(false)
  })
})
