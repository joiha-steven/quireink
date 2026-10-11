// A theme preview and the caches (ADR 0072, T2c). The page cache is keyed by path alone, so one
// previewed page stored there would be served to every reader after it; and the warm, which a
// flush inside a previewed request can schedule, would render the whole site in the previewed
// theme if it ran inside that request's context. Neither may happen.
import { afterEach, describe, expect, it } from 'bun:test'
import { pageCache } from '@/server/cache'
import { warmThenPurge } from '@/server/warm'
import { withThemePreview } from '@/server/theme-preview-scope'
import { PUBLIC } from '@/web/cache-headers'
import { MANIFEST, themeZip } from '@/theme/test-zip'
import { db } from '@/test/sqlite'
import { forgetInstalledTheme, resolveTheme } from '@/content/chosen-theme'
import { htmlTag, themeBlog } from '@/test/installed-theme'
import { PREVIEW_COOKIE } from '@/web/theme-preview-paths'

const { app, install, page, sessionCookie } = themeBlog('./.tmp/test-theme-preview-cache')

const previewed = async (path: string, themeId = 'broadsheet') => {
  const res = await app.request(path, { headers: { cookie: `${sessionCookie()}; ${PREVIEW_COOKIE}=${themeId}` } })
  return { res, html: await res.text() }
}

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

describe('the page cache and a preview', () => {
  for (const path of ['/', '/a-post']) {
    it(`normal, preview, normal on ${path}: the two normal pages are one page, and the cache never holds the preview`, async () => {
      await install(themeZip())
      const first = await page(path)
      expect(pageCache.get(path)).toBe(first.html)
      const preview = await previewed(path)
      expect(htmlTag(preview.html)).toContain(' data-theme="broadsheet"')
      expect(preview.res.headers.get('cache-control')).toBe('private, no-store')
      // The preview was rendered fresh, not served from the cache, and left the cache as it was.
      expect(preview.html).not.toBe(first.html)
      expect(pageCache.get(path)).toBe(first.html)
      const again = await app.request(path)
      expect(await again.text()).toBe(first.html)
      expect(again.headers.get('cache-control')).toBe(PUBLIC)
    })

    it(`a preview first on a cold cache on ${path} stores nothing, and the next reader gets the reader's page`, async () => {
      await install(themeZip())
      expect(pageCache.has(path)).toBe(false)
      const preview = await previewed(path)
      expect(preview.html).toContain('data-theme-preview="broadsheet"')
      expect(pageCache.has(path)).toBe(false)
      const reader = await page(path)
      expect(htmlTag(reader.html)).toContain(' data-theme="plain"')
      expect(reader.html).not.toContain('theme-preview')
      expect(pageCache.get(path)).toBe(reader.html)
    })
  }

  it('keeps readers and the owner apart when their requests are in flight together', async () => {
    await install(themeZip())
    const asks = Array.from({ length: 12 }, (_, i) => i % 2 === 0
      ? previewed(i % 4 === 0 ? '/' : '/a-post').then(({ html }) => ({ preview: true, html }))
      : Promise.resolve(app.request(i % 4 === 1 ? '/' : '/a-post')).then(async (res) => ({ preview: false, html: await res.text() })))
    for (const { preview, html } of await Promise.all(asks)) {
      expect(htmlTag(html)).toContain(preview ? ' data-theme="broadsheet"' : ' data-theme="plain"')
      expect(html.includes('data-theme-preview=')).toBe(preview)
    }
    for (const path of ['/', '/a-post']) expect(pageCache.get(path) ?? '').not.toContain('theme-preview')
  })

  it('is neither read nor written inside a preview scope, whoever the caller is', () => {
    pageCache.set('/held', 'reader page')
    withThemePreview({ themeId: 'paper', path: '/held' }, () => {
      expect(pageCache.get('/held')).toBeUndefined()
      pageCache.set('/held', 'previewed page')
      expect(pageCache.offer('/other', 'previewed page')).toBe(false)
    })
    expect(pageCache.get('/held')).toBe('reader page')
    expect(pageCache.has('/other')).toBe(false)
  })
})

describe('the kept installed themes and a preview', () => {
  it('keep each id\'s answer, so a broken saved theme warns once while previews of another interleave', async () => {
    await install(themeZip())
    await install(themeZip({ 'theme.json': { ...MANIFEST, id: 'ledger', name: 'Ledger' } }))
    db().run(`update themes set manifest = '{not json' where theme_id = 'broadsheet'`)
    forgetInstalledTheme()
    const warned: string[] = []
    const warn = console.warn
    console.warn = (message: string) => { warned.push(message) }
    try {
      for (let i = 0; i < 4; i++) {
        expect(resolveTheme({ theme: 'broadsheet' }).id).toBe('plain')
        expect(withThemePreview({ themeId: 'ledger', path: '/' }, () => resolveTheme({ theme: 'broadsheet' })).id).toBe('ledger')
      }
    } finally {
      console.warn = warn
    }
    expect(warned.filter((line) => line.includes('theme broadsheet'))).toHaveLength(1)
  })
})

describe('the warm and the purge', () => {
  it('render the reader\'s pages and fetch nothing, even when started inside a previewed request', async () => {
    await install(themeZip())
    const fetched: string[] = []
    globalThis.fetch = (async (input: string | URL | Request) => {
      fetched.push(String(input))
      return new Response('{}')
    }) as typeof fetch
    // What a flush inside a previewed request does: its debounced timer inherits the request's
    // context, and the warm-then-purge runs there.
    await withThemePreview({ themeId: 'broadsheet', path: '/' }, () => warmThenPurge('a test'))
    const home = pageCache.get('/') ?? ''
    expect(htmlTag(home)).toContain(' data-theme="plain"')
    expect(home).not.toContain('theme-preview')
    expect(htmlTag(pageCache.get('/a-post') ?? '')).toContain(' data-theme="plain"')
    // No purge is configured here, so the purge is a no-op; and the warm renders in process.
    expect(fetched).toEqual([])
  })
})
