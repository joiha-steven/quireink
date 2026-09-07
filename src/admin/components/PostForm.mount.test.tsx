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
import { adminT } from '@/i18n/admin-i18n'

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
      autosaveSeconds={120} autosaveAt={null} timezone="Asia/Ho_Chi_Minh"
    />
  ))
}

const t = adminT('en')

/** The editor with no piece behind it: `/admin/editor`, before anything has been saved. */
const blank = {
  allCategories: [], allTags: [], allSeries: [], contentWidth: 672,
  keySound: { mode: 'off', volume: 0 } as const,
  autosaveSeconds: 120, autosaveAt: null, timezone: 'Asia/Ho_Chi_Minh',
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

  // The bug this pins: the writer typed, left without pressing Save, came back, and met an
  // empty page with a one-line offer above it. The text was in storage the whole time.
  it('reopens an unsaved draft into the editor instead of offering it', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { PostForm } = await import('@/admin/components/PostForm')
    const fetchMock = installFetchMock(() => ({ success: true }))
    restores.push(fetchMock.restore)
    localStorage.setItem('quire:draft:post:new', JSON.stringify({
      at: new Date().toISOString(),
      data: {
        title: 'Half a thought', slug: '', date: '2026-09-07T10:00', status: 'draft',
        categories: [], tags: [], series: '', seriesOrder: 0, featuredImage: '',
        coverImage: '', metaTitle: '', metaDescription: '', excerpt: '',
        content: 'The sentence that used to disappear.',
      },
    }))
    restores.push(() => localStorage.removeItem('quire:draft:post:new'))

    const m = await mountAdmin(
      <PostForm
        allCategories={[]} allTags={[]} allSeries={[]}
        contentWidth={672} keySound={{ mode: 'off', volume: 0 }} autosaveSeconds={120} autosaveAt={null} timezone="Asia/Ho_Chi_Minh"
      />,
    )
    await m.flush()

    expect((m.container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Half a thought')
    expect(m.container.querySelector('.ProseMirror')?.textContent)
      .toContain('The sentence that used to disappear.')
    // ...and the snapshot stays put, so a second trip through this screen finds it too.
    expect(localStorage.getItem('quire:draft:post:new')).not.toBeNull()
    await m.unmount()
  })

  // The sheet must not claim a state the server refused. Setting the status before the save
  // meant a `slug_taken` or a 500 left the meta line, the radios and the button all saying
  // Published for a post the server still had as a draft.
  it('does not say published when the server refused the save', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const fetchMock = installFetchMock(() => ({ success: false, error: 'slug_taken' }))
    restores.push(fetchMock.restore)

    const m = await mountAdmin(await form(post()))
    await m.flush()
    // TWICE, through the harness's own click (which wraps `act`): the first press opens the
    // attributes sheet and asks (ADR 0024), and only the second one saves.
    await m.click(m.button(t.publish))
    await m.click(m.button(t.publish))
    await new Promise((r) => setTimeout(r, 40))
    await m.flush()

    // The attributes sheet opens on the first Publish press, so the state is on screen. The
    // radios carry no `value`, so the checked one is read through its label.
    const checked = [...m.container.querySelectorAll('label')]
      .find((l) => (l.querySelector('input[type=radio]') as HTMLInputElement | null)?.checked)
    expect(checked?.textContent).toContain('Draft')
    expect(m.container.textContent ?? '').not.toContain('Saved at')
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
        contentWidth={672} keySound={{ mode: 'off', volume: 0 }} autosaveSeconds={120} autosaveAt={null} timezone="Asia/Ho_Chi_Minh"
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

  /**
   * LEAVING THE SCREEN IS WHAT WRITES THE SNAPSHOT, on a piece that has never been saved.
   *
   * The interval is two minutes by default, so on anything shorter than that the flush on the
   * way out is the whole of the safety net — and it is the path a writer actually takes: type
   * a few lines, click something else in the admin, come back. Reported as work lost.
   */
  it('writes an unsaved new post to storage on the way out of the screen', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { PostForm } = await import('@/admin/components/PostForm')
    const fetchMock = installFetchMock(() => ({ success: true }))
    restores.push(fetchMock.restore)
    localStorage.removeItem('quire:draft:post:new')
    restores.push(() => localStorage.removeItem('quire:draft:post:new'))

    const m = await mountAdmin(<PostForm {...blank} />)
    await m.flush()
    await m.type(m.container.querySelector('textarea') as Element, 'Half a thought')
    await m.flush()
    // Nothing yet: the first tick is two minutes away, and that is not the failure.
    expect(localStorage.getItem('quire:draft:post:new')).toBeNull()

    await m.unmount()
    const kept = JSON.parse(localStorage.getItem('quire:draft:post:new') ?? 'null') as
      { data: { title: string } } | null
    expect(kept?.data.title).toBe('Half a thought')
  })

  /**
   * THE SNAPSHOT FOLLOWS THE PIECE, not the screen it was opened on.
   *
   * The key was fixed at mount, so a new post kept writing to `…:new` after its first save.
   * Two failures came out of that one key: the editor reopening that post looked under its own
   * slug and found nothing, so the device copy was invisible; and the next blank sheet found
   * the saved post's text under `new` and reopened it as a piece of its own, which is how one
   * post becomes two.
   */
  it('files the snapshot under the post once the first save gives it a slug', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { PostForm } = await import('@/admin/components/PostForm')
    const fetchMock = installFetchMock((url, init) =>
      url === '/api/posts' && init?.method === 'POST'
        ? { success: true, data: { slug: 'half-a-thought' } }
        : { success: true })
    restores.push(fetchMock.restore)
    localStorage.removeItem('quire:draft:post:new')
    restores.push(() => {
      localStorage.removeItem('quire:draft:post:new')
      localStorage.removeItem('quire:draft:post:half-a-thought')
    })

    const m = await mountAdmin(<PostForm {...blank} />)
    await m.flush()
    await m.type(m.container.querySelector('textarea') as Element, 'Half a thought')
    await m.click(m.button(t.saveDraft))
    await m.flush()
    expect(fetchMock.calls[0]?.url).toBe('/api/posts')

    // Typed after the save, and then the screen is left.
    await m.type(m.container.querySelector('textarea') as Element, 'Half a thought, continued')
    await m.flush()
    await m.unmount()

    expect(localStorage.getItem('quire:draft:post:new')).toBeNull()
    const kept = JSON.parse(localStorage.getItem('quire:draft:post:half-a-thought') ?? 'null') as
      { data: { title: string } } | null
    expect(kept?.data.title).toBe('Half a thought, continued')
  })
})
