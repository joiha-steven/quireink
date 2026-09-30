// The blank bar the server draws and the bar the island builds are one shape (2026-09-30).
// If a key is added to a cluster and not to TOOLBAR_CLUSTERS, the held place is the wrong
// width, wraps at a different point, and the paper jumps again on a slow load.
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
    const counts = [...run.children].map((cluster) => cluster.querySelectorAll('button').length)
    expect(counts).toEqual([...TOOLBAR_CLUSTERS])
    bar.destroy()
    editor.destroy()
  })
})
