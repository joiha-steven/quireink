// The pictures of the built-in themes (`web/theme-shots.ts`): every one is served as the immutable
// file its URL names, small enough for a tile, and linked only where the owner picks a theme.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { savePost } from '@/content/posts'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { BUILTIN_THEMES } from '@/content/themes-builtin'
import { adminT } from '@/i18n/admin-i18n'
import { isReservedPath } from '@/server/redirect-path'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { lookPicker } from '@/web/admin/screens/settings-appearance-look'
import { lookStepScreen } from '@/web/setup-page'
import { themeShotPath, themeShotUrl, type ShotScheme } from '@/web/theme-shots'

const DIR = './.tmp/test-theme-shots'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const SCHEMES: ShotScheme[] = ['light', 'dark']
const EVERY = BUILTIN_THEMES.flatMap(({ id }) => SCHEMES.map((scheme) => ({ id, scheme })))

beforeEach(() => {
  clearCache()
  for (const table of ['posts', 'post_terms', 'settings']) db().run(`delete from ${table}`)
})

describe('the built-in theme pictures', () => {
  it('serves each one as an immutable WebP of the tile’s 480 by 288, at most 20 KB', async () => {
    for (const { id, scheme } of EVERY) {
      const res = await app.request(themeShotUrl(id, scheme))
      expect(`${id}-${scheme} ${res.status}`).toBe(`${id}-${scheme} 200`)
      expect(res.headers.get('content-type')).toBe('image/webp')
      expect(res.headers.get('cache-control')).toContain('immutable')
      const bytes = Buffer.from(await res.arrayBuffer())
      expect(bytes.length).toBeLessThanOrEqual(20 * 1024)
      const { format, width, height } = await sharp(bytes).metadata()
      expect({ format, width, height }).toEqual({ format: 'webp', width: 480, height: 288 })
    }
  })

  it('puts each file’s own hash in its URL, so a regenerated picture is a new URL', () => {
    for (const { id, scheme } of EVERY) {
      const bytes = readFileSync(`src/assets/static/theme-shots/${id}-${scheme}.webp`)
      const hash = new Bun.CryptoHasher('sha256').update(bytes).digest('hex').slice(0, 12)
      expect(themeShotUrl(id, scheme)).toBe(`${themeShotPath(id, scheme)}?v=${hash}`)
    }
  })

  it('keeps a redirect from ever taking one over', () => {
    expect(isReservedPath(themeShotPath('plain', 'light'))).toBe(true)
  })

  it('shows each built-in tile its light picture in a light admin and its dark one in a dark admin, both lazy', () => {
    const html = lookPicker(adminT('en'), DEFAULT_SETTINGS)
    for (const { id } of BUILTIN_THEMES) {
      const start = html.indexOf(`data-choice="${id}"`)
      const tile = html.slice(start, html.indexOf('</button>', start))
      const imgs = [...tile.matchAll(/<img src="([^"]+)" alt="" loading="lazy" decoding="async" data-theme-shot class="([^"]+)">/g)]
        .map(([, src, cls]) => ({ src: src!.replaceAll('&amp;', '&'), cls }))
      expect(imgs).toEqual([
        { src: themeShotUrl(id, 'light'), cls: 'absolute inset-0 dark:hidden h-full w-full rounded-md object-cover object-top ring-1 ring-black/[.07] dark:ring-white/10' },
        { src: themeShotUrl(id, 'dark'), cls: 'absolute inset-0 hidden dark:block h-full w-full rounded-md object-cover object-top ring-1 ring-black/[.07] dark:ring-white/10' },
      ])
    }
  })

  it('shows the first-run cards the picture the page’s own scheme rule picks', () => {
    const system = lookStepScreen({ ...DEFAULT_SETTINGS, defaultScheme: 'system' })
    for (const { id } of BUILTIN_THEMES) {
      expect(system).toContain(`<picture><source media="(prefers-color-scheme: dark)" srcset="${themeShotUrl(id, 'dark')}">`
        + `<img src="${themeShotUrl(id, 'light')}" alt="" loading="lazy" decoding="async"></picture>`)
    }
    const dark = lookStepScreen({ ...DEFAULT_SETTINGS, defaultScheme: 'dark' })
    expect(dark).not.toContain('<picture>')
    expect(dark).not.toContain('-light.webp')
    expect(dark).toContain(`<img src="${themeShotUrl('notes', 'dark')}" alt=""`)
    const light = lookStepScreen({ ...DEFAULT_SETTINGS, defaultScheme: 'light' })
    expect(light).not.toContain('-dark.webp')
  })

  it('is linked from no reader page', async () => {
    await savePost({ title: 'A Post', slug: 'a-post', content: 'Words.', status: 'published', date: '2020-01-01T00:00:00.000Z' })
    for (const path of ['/', '/a-post', '/archive', '/search?q=words']) {
      const res = await app.request(path)
      expect(`${path} ${res.status}`).toBe(`${path} 200`)
      expect(await res.text()).not.toContain('/theme-shots/')
    }
  })
})
