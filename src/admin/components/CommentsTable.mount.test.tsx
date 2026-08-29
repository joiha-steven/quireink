// The moderation queue, MOUNTED — what an owner is shown, not what the module exports.
//
// The class of bug this file exists for already shipped: a column that collapsed to
// "reader@e…" passed every suite because no suite ever rendered the rows. happy-dom cannot
// measure CSS truncation (no layout engine), so what CAN be asserted honestly is one level
// down: the FULL name, email and comment text must reach the DOM intact — a row whose
// markup only ever contained "reader@e…" is unfixable by CSS, and that is the failure this
// catches. The visual half stays with the tour/screenshots, as CLAUDE.md says it must.
//
// happy-dom is registered for THIS FILE ONLY, the pattern of editor-corpus.test.ts, and
// everything React-shaped is imported dynamically so nothing touches the DOM before it exists.

import { describe, expect, it, beforeAll, afterAll, afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { AdminComment } from '@/types'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const restores: (() => void)[] = []
afterEach(() => { for (const r of restores.splice(0)) r() })

function rows(): AdminComment[] {
  return [
    {
      id: 1,
      postSlug: 'first-post',
      postTitle: 'The first post',
      name: 'Nguyễn Thị Ngọc Ánh',
      email: 'reader@example.com',
      provider: 'manual',
      content: 'A long thoughtful reply that must be shown whole, not clipped to a stub.',
      ip: '203.0.113.7',
      country: 'VN',
      createdAt: '2026-08-20T09:30:00.000Z',
    },
    {
      id: 2,
      postSlug: 'second-post',
      postTitle: 'The second post',
      name: 'Bob',
      email: 'bob@example.org',
      provider: 'google',
      content: 'Short and to the point.',
      createdAt: '2026-08-21T10:00:00.000Z',
    },
  ]
}

describe('CommentsTable, mounted', () => {
  it('renders every row whole: full name, full email, full text', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { CommentsTable } = await import('@/admin/components/CommentsTable')
    const fetchMock = installFetchMock(() => ({ success: true }))
    restores.push(fetchMock.restore)

    const m = await mountAdmin(<CommentsTable initial={rows()} />)
    const text = m.text()
    // The exact strings, uncut. "reader@e…" would fail here — the ellipsis bug's DNA.
    expect(text).toContain('Nguyễn Thị Ngọc Ánh')
    expect(text).toContain('reader@example.com')
    expect(text).toContain('A long thoughtful reply that must be shown whole, not clipped to a stub.')
    expect(text).toContain('The first post')
    expect(text).toContain('bob@example.org')
    expect(text).toContain('Short and to the point.')
    // Nothing phoned home just to render a list it was handed as a prop.
    expect(fetchMock.calls.length).toBe(0)
    await m.unmount()
  })

  it('delete calls DELETE /api/comments/:id and drops the row on success', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { CommentsTable } = await import('@/admin/components/CommentsTable')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: true }))
    restores.push(fetchMock.restore)
    // The component guards deletion behind confirm(); the test is about the request and
    // the row, not the dialog, so the dialog always says yes.
    window.confirm = () => true

    const m = await mountAdmin(<CommentsTable initial={rows()} />)
    // Two rows, two delete buttons: click the FIRST (id 1).
    const del = [...m.container.querySelectorAll('button')]
      .filter((b) => b.textContent?.trim() === t.commentsColDelete)
    expect(del.length).toBe(2)
    await m.click(del[0])
    await m.flush()

    expect(fetchMock.calls).toEqual([
      { url: '/api/comments/1', method: 'DELETE', body: undefined },
    ])
    const text = m.text()
    expect(text).not.toContain('Nguyễn Thị Ngọc Ánh')
    expect(text).toContain('Short and to the point.') // the other row stays
    await m.unmount()
  })

  it('keeps the row and reports the failure when the server says no', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { CommentsTable } = await import('@/admin/components/CommentsTable')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: false, error: 'nope' }))
    restores.push(fetchMock.restore)
    window.confirm = () => true

    const m = await mountAdmin(<CommentsTable initial={rows()} />)
    await m.click(m.button(t.commentsColDelete))
    await m.flush()
    // A failed delete must not pretend: the row stays, and the error toast is announced.
    expect(m.text()).toContain('Nguyễn Thị Ngọc Ánh')
    expect(m.text()).toContain(t.deleteFailed)
    await m.unmount()
  })

  it('search narrows to matching rows; empty initial shows the empty state', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { CommentsTable } = await import('@/admin/components/CommentsTable')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')
    const fetchMock = installFetchMock(() => ({ success: true }))
    restores.push(fetchMock.restore)

    const m = await mountAdmin(<CommentsTable initial={rows()} />)
    const search = m.container.querySelector('input[type="search"]')
    expect(search).not.toBeNull()
    // Accent-folded search: "ngoc" must find "Ngọc".
    await m.type(search as Element, 'ngoc')
    expect(m.text()).toContain('Nguyễn Thị Ngọc Ánh')
    expect(m.text()).not.toContain('Short and to the point.')
    await m.unmount()

    const empty = await mountAdmin(<CommentsTable initial={[]} />)
    expect(empty.text()).toContain(t.commentsEmpty)
    await empty.unmount()
  })
})
