// The editor screen, MOUNTED — the deepest smoke the suite has: PostForm brings up the
// REAL Tiptap editor (the same `editorExtensions` set editor-corpus.test.ts round-trips),
// and it turns out ProseMirror's view mounts fine under happy-dom: the .ProseMirror
// surface renders the parsed document, so the assertions below are against real editor
// output, not a stub. What happy-dom still cannot do is layout and selection geometry —
// so no caret, focus-mode or toolbar-position assertions live here; those stay with the
// tour. Key sound is 'off' so no AudioContext is ever asked for.
//
// The save test is the one that pays rent: dirty the form, press Save draft, and the PUT
// must go to /api/posts/{slug} carrying the edited title AND the markdown the editor
// holds — the whole title→state→editor→serialize→request seam in one pass.

import { describe, expect, it, beforeAll, afterAll, afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { PostWithContent } from '@/types'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const restores: (() => void)[] = []
afterEach(() => { for (const r of restores.splice(0)) r() })

function post(): PostWithContent {
  return {
    title: 'A field guide to mornings',
    slug: 'field-guide-mornings',
    date: '2026-08-01T09:00:00.000Z',
    status: 'draft',
    categories: ['essays'],
    tags: ['morning'],
    content: '# Dawn\n\nThe first paragraph of the field guide, in plain words.',
  }
}

function form(initial: PostWithContent) {
  return import('@/admin/components/PostForm').then(({ PostForm }) => (
    <PostForm
      initial={initial}
      allCategories={['essays']}
      allTags={['morning']}
      allSeries={[]}
      contentWidth={672}
      keySound={{ mode: 'off', volume: 0 }}
      autosaveSeconds={120} autosaveAt={null}
    />
  ))
}

describe('PostForm, mounted', () => {
  it('shows the title in the sheet and the body inside a live ProseMirror', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const fetchMock = installFetchMock(() => ({ success: true }))
    restores.push(fetchMock.restore)

    const m = await mountAdmin(await form(post()))
    await m.flush()

    // SheetTitle is a textarea whose value is the post title, whole.
    const title = m.container.querySelector('textarea')
    expect((title as HTMLTextAreaElement).value).toBe('A field guide to mornings')

    // The editor view mounted: one .ProseMirror surface holding the parsed document —
    // the heading text and the paragraph text, and the heading as an actual <h1>.
    const pm = m.container.querySelector('.ProseMirror')
    expect(pm).not.toBeNull()
    expect(pm?.textContent).toContain('Dawn')
    expect(pm?.textContent).toContain('The first paragraph of the field guide, in plain words.')
    expect(pm?.querySelector('h1')?.textContent).toBe('Dawn')

    // Mounting an editor is not a request: nothing may hit the server until a save.
    expect(fetchMock.calls.length).toBe(0)
    await m.unmount()
  })

  it('a new post (no initial) mounts empty without throwing', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { PostForm } = await import('@/admin/components/PostForm')
    const fetchMock = installFetchMock(() => ({ success: true }))
    restores.push(fetchMock.restore)

    const m = await mountAdmin(
      <PostForm
        allCategories={[]} allTags={[]} allSeries={[]}
        contentWidth={672} keySound={{ mode: 'off', volume: 0 }} autosaveSeconds={120} autosaveAt={null}
      />,
    )
    await m.flush()
    expect((m.container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('')
    expect(m.container.querySelector('.ProseMirror')).not.toBeNull()
    await m.unmount()
  })

  it('editing the title and pressing Save draft PUTs title + markdown to the post', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => (
      { success: true, data: { slug: 'field-guide-mornings' } }
    ))
    restores.push(fetchMock.restore)

    const m = await mountAdmin(await form(post()))
    await m.flush()

    // Save draft is DISABLED until something changes — asserted, because a button that
    // saves nothing must not invite a click.
    expect(m.button(t.saveDraft).disabled).toBe(true)
    await m.type(m.container.querySelector('textarea') as Element, 'A field guide to evenings')
    expect(m.button(t.saveDraft).disabled).toBe(false)

    await m.click(m.button(t.saveDraft))
    await m.flush()

    expect(fetchMock.calls.length).toBe(1)
    const call = fetchMock.calls[0]
    expect(call.method).toBe('PUT')
    expect(call.url).toBe('/api/posts/field-guide-mornings')
    const body = call.body as Partial<PostWithContent>
    expect(body.title).toBe('A field guide to evenings')
    expect(body.slug).toBe('field-guide-mornings') // an existing slug is not renamed by a title edit
    expect(body.status).toBe('draft')
    // The content came out of the LIVE editor's markdown serializer, not a cached prop.
    expect(body.content).toContain('# Dawn')
    expect(body.content).toContain('The first paragraph of the field guide, in plain words.')
    expect(m.text()).toContain(t.savedDraft) // the toast
    await m.unmount()
  })

  it('a failed save says so and the button stays armed for a retry', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: false, error: 'nope' }))
    restores.push(fetchMock.restore)

    const m = await mountAdmin(await form(post()))
    await m.flush()
    await m.type(m.container.querySelector('textarea') as Element, 'Still unsaved')
    await m.click(m.button(t.saveDraft))
    await m.flush()
    expect(m.text()).toContain(t.saveFailed)
    // Still dirty — the failed save must not clear the flag that lets the owner retry.
    expect(m.button(t.saveDraft).disabled).toBe(false)
    await m.unmount()
  })
})
