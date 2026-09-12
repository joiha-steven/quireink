// Three states, and one field decides all of them.
//
// This is a panel that INTERRUPTS somebody, so the expensive failure is not that it looks
// wrong — it is that it appears when it should not. A blog on the release it is running must
// never see it, and a blog that has already been asked which dialect it wears must never be
// asked twice. Both are a string comparison, and a string comparison is exactly the kind of
// thing that survives a refactor while meaning the opposite.
//
// It already cost something: the panel is modal, so on a fixture whose settings row had no
// `seenRelease` it opened over every admin screen of the browser tour and ate the first click
// on each — two flows went red, one of them reporting that the site was wearing no dialect
// at all, because a click meant for the page underneath had landed on Plain paper.
//
// EVERY query is scoped to this mount's own container. Bun runs a file's tests in one
// process and a stray panel from an earlier test would be found by a document-wide selector,
// which is how the close test first passed alone and failed in the suite.
import { describe, expect, it, beforeAll, afterAll, afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const restores: (() => void)[] = []
afterEach(() => { for (const r of restores.splice(0)) r() })

const panel = (c: HTMLElement) => c.querySelector('[data-whats-new]')
/** The dialect buttons, which only the never-asked state carries. */
const looks = (c: HTMLElement) => [...c.querySelectorAll('[data-whats-new] [aria-pressed]')]

describe('the what\'s-new panel', () => {
  it('says nothing at all on the release it is already running', async () => {
    const { mountAdmin } = await import('@/admin/test-mount')
    const { WhatsNew } = await import('@/admin/components/WhatsNew')
    const m = await mountAdmin(<WhatsNew version="2.2.10" seen="2.2.10" look="plain" />)
    expect(panel(m.container)).toBeNull()
    m.unmount()
  })

  it('carries the news alone for a blog that has already been asked', async () => {
    // `seen` is an older release: this blog went through setup, answered the dialect
    // question there, and is now being told what it just upgraded into. Asking again would
    // be the panel nagging about a choice its owner already made.
    const { mountAdmin } = await import('@/admin/test-mount')
    const { WhatsNew } = await import('@/admin/components/WhatsNew')
    const m = await mountAdmin(<WhatsNew version="2.2.10" seen="2.2.9" look="code" />)
    expect(panel(m.container)).not.toBeNull()
    expect(looks(m.container)).toHaveLength(0)
    m.unmount()
  })

  it('asks the dialect question only when the blog has never been asked', async () => {
    // EMPTY means the settings row predates the field — a blog installed before the four
    // dialects existed, whose owner never saw the setup step that asks. It is the one case
    // the panel carries the question, and it offers all four with the current one pressed.
    const { mountAdmin } = await import('@/admin/test-mount')
    const { WhatsNew } = await import('@/admin/components/WhatsNew')
    const m = await mountAdmin(<WhatsNew version="2.2.10" seen="" look="paper" />)
    const buttons = looks(m.container)
    expect(buttons).toHaveLength(4)
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
    expect(buttons.find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent)
      .toBe('Newspaper')
    m.unmount()
  })

  it('saves a dialect on the press, and the release on Done', async () => {
    // Two writes, in that order and to that route. The dialect goes on the press rather than
    // on Done so the choice survives a panel dismissed with Escape or a reload — and so the
    // blog is already wearing it when they go and look.
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { WhatsNew } = await import('@/admin/components/WhatsNew')
    const net = installFetchMock(() => ({ ok: true }))
    restores.push(net.restore)

    const m = await mountAdmin(<WhatsNew version="2.2.10" seen="" look="plain" />)
    const notes = looks(m.container).find((b) => b.textContent === 'Notebook')
    ;(notes as HTMLButtonElement).click()
    await m.flush()
    expect(net.calls).toEqual([
      { url: '/api/settings', method: 'PUT', body: { look: 'notes' } },
    ])

    const done = [...m.container.querySelectorAll('[data-whats-new] button')].at(-1)
    ;(done as HTMLButtonElement).click()
    await m.flush()
    expect(net.calls[1]).toEqual({
      url: '/api/settings', method: 'PUT', body: { seenRelease: '2.2.10' },
    })
    expect(panel(m.container)).toBeNull()
    m.unmount()
  })

  it('closes even when the write that records it fails', async () => {
    // The news is worth showing twice; trapping somebody behind a modal because a PUT did
    // not land is not a trade this panel gets to make.
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { WhatsNew } = await import('@/admin/components/WhatsNew')
    const net = installFetchMock(() => new Response('no', { status: 500 }))
    restores.push(net.restore)

    const m = await mountAdmin(<WhatsNew version="2.2.10" seen="2.2.9" look="plain" />)
    const done = [...m.container.querySelectorAll('[data-whats-new] button')].at(-1)
    ;(done as HTMLButtonElement).click()
    await m.flush()
    expect(panel(m.container)).toBeNull()
    m.unmount()
  })

  it('links the notes for the release it is announcing, not for the latest one', async () => {
    // The update check tells a blog when something NEWER exists; this tells it what the one
    // it just installed is. A link to `latest` would be the other message.
    const { mountAdmin } = await import('@/admin/test-mount')
    const { WhatsNew } = await import('@/admin/components/WhatsNew')
    const m = await mountAdmin(<WhatsNew version="2.2.10" seen="2.2.9" look="plain" />)
    const href = m.container.querySelector('[data-whats-new] a')?.getAttribute('href') ?? ''
    expect(href.endsWith('/releases/tag/v2.2.10')).toBe(true)
    m.unmount()
  })
})
