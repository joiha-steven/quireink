// The media grid, MOUNTED. This component (unlike CommentsTable) fetches its own list on
// mount from GET /api/media, so the thing worth testing is the seam: does the grid the
// owner sees actually reflect what that endpoint returned — every file, by name — and
// does an empty answer say "no media" instead of rendering a blank sheet.
//
// happy-dom has no layout engine, so counts and text are asserted, never pixels; the
// per-file registration pattern and the fetch-restore discipline follow
// editor-corpus.test.ts and test-mount.tsx.

import { describe, expect, it, beforeAll, afterAll, afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { MediaItem } from '@/types'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const restores: (() => void)[] = []
afterEach(() => { for (const r of restores.splice(0)) r() })

function items(): MediaItem[] {
  return [
    {
      url: '/media/sunrise-over-the-bay.jpg',
      filename: 'sunrise-over-the-bay.jpg',
      size: 245_000,
      uploadedAt: '2026-08-25T08:00:00.000Z',
      width: 1600,
      height: 900,
    },
    {
      url: '/media/portrait-of-a-cat.png',
      filename: 'portrait-of-a-cat.png',
      size: 512_000,
      uploadedAt: '2026-08-24T08:00:00.000Z',
    },
    {
      url: '/media/hand-drawn-map.webp',
      filename: 'hand-drawn-map.webp',
      size: 98_304,
      uploadedAt: '2026-08-23T08:00:00.000Z',
    },
  ]
}

describe('MediaLibrary, mounted', () => {
  it('renders one card per item from GET /api/media, filename visible', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { MediaLibrary } = await import('@/admin/components/MediaLibrary')
    const fetchMock = installFetchMock((url) => {
      if (url === '/api/media') return { success: true, data: items() }
      throw new Error(`unexpected fetch: ${url}`)
    })
    restores.push(fetchMock.restore)

    const m = await mountAdmin(<MediaLibrary />)
    await m.flush() // let the mount fetch resolve and the grid commit

    expect(fetchMock.calls.map((c) => c.url)).toEqual(['/api/media'])
    const text = m.text()
    for (const it of items()) expect(text).toContain(it.filename)
    // One <img> per item — a grid that printed three names over one thumbnail would
    // still pass a text assertion, so count the pictures too.
    const imgs = m.container.querySelectorAll('img')
    expect(imgs.length).toBe(3)
    await m.unmount()
  })

  it('an empty library says so instead of rendering a blank sheet', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { MediaLibrary } = await import('@/admin/components/MediaLibrary')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: true, data: [] }))
    restores.push(fetchMock.restore)

    const m = await mountAdmin(<MediaLibrary />)
    await m.flush()
    expect(m.text()).toContain(t.noMedia)
    expect(m.container.querySelectorAll('img').length).toBe(0)
    await m.unmount()
  })

  it('a failed load surfaces the error toast, not a silent empty grid', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { MediaLibrary } = await import('@/admin/components/MediaLibrary')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    // A 500 whose body is not JSON: `r.json()` rejects, the catch runs.
    const fetchMock = installFetchMock(() => new Response('boom', { status: 500 }))
    restores.push(fetchMock.restore)

    const m = await mountAdmin(<MediaLibrary />)
    await m.flush()
    expect(m.text()).toContain(t.loadMediaFailed)
    await m.unmount()
  })

  it('the name filter narrows the grid to matching filenames', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { MediaLibrary } = await import('@/admin/components/MediaLibrary')
    const fetchMock = installFetchMock(() => ({ success: true, data: items() }))
    restores.push(fetchMock.restore)

    const m = await mountAdmin(<MediaLibrary />)
    await m.flush()
    const search = m.container.querySelector('input[type="search"]')
    expect(search).not.toBeNull()
    await m.type(search as Element, 'cat')
    expect(m.text()).toContain('portrait-of-a-cat.png')
    expect(m.text()).not.toContain('sunrise-over-the-bay.jpg')
    expect(m.container.querySelectorAll('img').length).toBe(1)
    await m.unmount()
  })
})
