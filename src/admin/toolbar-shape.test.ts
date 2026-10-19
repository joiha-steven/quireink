// The bar the island builds has the clusters TOOLBAR_CLUSTERS says (2026-09-30). The overflow
// tests (`components/toolbar-fit.test.ts`) state what moves behind More at each measured width
// from that list, so a key added to a cluster and not to it makes those cases describe a row
// that is not the one on screen.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { TOOLBAR_CLUSTERS } from '@/admin-shared/toolbar-shape'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

describe('the toolbar and the place held for it', () => {
  it('has the clusters, and the keys in each, that the server draws', async () => {
    const { Editor } = await import('@/admin/editor/editor')
    const { mountToolbar } = await import('@/admin/components/editor-toolbar')
    const { adminT } = await import('@/i18n/admin-i18n')
    const { toolbarWords } = await import('@/admin/components/editor-toolbar')
    const editor = new Editor({ element: document.createElement('div'), content: 'x' })
    const host = document.createElement('div')
    host.innerHTML = '<div data-held></div>'
    const bar = mountToolbar(host, {
      editor, words: toolbarWords(adminT('en') as never), askLink: async () => null,
      onPickImage: () => {}, onPickGallery: () => {},
    })
    // The held place is REPLACED, not kept beside the bar.
    expect(host.querySelector('[data-held]')).toBeNull()
    const run = host.querySelector('[class*="flex-nowrap"]')!
    const clusters = [...run.children].filter((child) => child.hasAttribute('data-toolbar-cluster'))
    const counts = clusters.map((cluster) => cluster.querySelectorAll('button').length)
    expect(counts).toEqual([...TOOLBAR_CLUSTERS])
    // The run holds the clusters and the More key, and nothing else.
    const more = run.querySelector('[data-toolbar-more]')!
    expect(run.children.length).toBe(TOOLBAR_CLUSTERS.length + 1)
    expect(run.lastElementChild!.contains(more)).toBe(true)
    bar.destroy()
    editor.destroy()
  })
})
