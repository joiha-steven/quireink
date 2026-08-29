// The offline switch, on the server side of it: what is served, and what the page says.
//
// The worker's own behaviour cannot be asserted here — caching, interception and uninstall
// only exist inside a browser — so that half is a tour flow, watched against a page that
// was read and an admin URL that was not. What this file holds is the part the server
// decides, and every item is something that would silently do nothing if it broke:
//
//   * `/sw.js` at the ROOT. A worker controls the directory its script came from, so at
//     `/assets/...` it would install, activate, and never see a single page.
//   * `data-sw` present ONLY with the feature on. Absence is the instruction to uninstall.
//   * the build in the query string, because that is what makes a deploy an update and what
//     stops a new worker reading the old one's caches.

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { SW_BODY, SW_PATH } from '@/web/assets'

const DIR = './.tmp/test-offline'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)

const setOffline = async (on: boolean) => {
  const s = await getSettings()
  await saveSettings({ features: { ...s.features, offline: on } })
  clearCache()
}

beforeEach(async () => {
  clearCache()
  for (const t of ['posts', 'pages', 'settings']) db().run(`delete from ${t}`)
  await savePost({
    title: 'A post', content: 'body', status: 'published', date: '2026-01-01T00:00:00.000Z',
  })
})

describe('the switch', () => {
  it('is off on a fresh install', async () => {
    // A service worker outlives the page that installs it. Defaulting it on would put one
    // on every existing blog's readers because the software updated.
    expect((await getSettings()).features.offline).toBe(false)
  })

  it('adds data-sw to a listing and to an article, and only when on', async () => {
    for (const path of ['/', '/a-post']) {
      expect(await (await get(path)).text()).not.toContain('data-sw')
    }
    await setOffline(true)
    for (const path of ['/', '/a-post']) {
      const html = await (await get(path)).text()
      // Both, because the switch can only take effect on a page the reader happens to
      // load, and most of those are listings.
      expect(html).toContain('data-sw=')
      expect(html).toContain('/sw.js?v=')
    }
    await setOffline(false)
    expect(await (await get('/')).text()).not.toContain('data-sw')
  })
})

describe('/sw.js', () => {
  it('is served from the root, whatever the setting says', async () => {
    // The ROUTE is unconditional; the SETTING decides whether any reader is pointed at it.
    // A worker registered by an earlier visit re-fetches its own script, and answering 404
    // there is how a worker gets left running with no way to update it.
    const res = await get('/sw.js')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/javascript')
  })

  it('revalidates rather than being immutable', async () => {
    // The one file whose staleness a reload cannot fix: the browser serves from the worker
    // it already has.
    const cc = (await get('/sw.js')).headers.get('cache-control') ?? ''
    expect(cc).toContain('no-cache')
    expect(cc).not.toContain('immutable')
    expect((await get('/sw.js')).headers.get('service-worker-allowed')).toBe('/')
  })

  it('carries the build in the query, not in the path', async () => {
    // `/assets/sw.<hash>.js` would scope the worker to /assets/ and it would see no page.
    expect(SW_PATH.startsWith('/sw.js?v=')).toBe(true)
    expect(SW_PATH.slice('/sw.js?v='.length).length).toBeGreaterThan(4)
  })
})

describe('what the worker will not touch', () => {
  // Read off the shipped BUNDLE rather than the source, because the bundle is what runs —
  // and matched against minified output, so nothing here may depend on a name or a quote
  // style the minifier is free to change.
  it('refuses the owner\'s surfaces and every non-GET', () => {
    for (const path of ['admin', 'api', 'preview', 'setup', 'login']) {
      expect(SW_BODY).toContain(path)
    }
    expect(SW_BODY).toMatch(/method!==["']GET["']/)
  })

  it('never precaches: nothing is fetched that the reader did not ask for', () => {
    // ADR 0039's first rule, checked where it would actually be broken: the `install`
    // handler is the one place a worker warms a cache, and this one does nothing but take
    // over. A body assertion, not a name assertion — `addAll` is an API name and survives
    // minification, but so would a hand-rolled loop, and the handler being empty rules out
    // both.
    const install = /addEventListener\(["']install["'],\s*\(\)\s*=>\s*\{([^}]*)\}\)/.exec(SW_BODY)
    expect(install).not.toBeNull()
    expect(install?.[1]?.replace(/\s/g, '')).toBe('self.skipWaiting()')
    expect(SW_BODY).not.toContain('addAll')
  })
})
