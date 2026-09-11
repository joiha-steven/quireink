// Both copies of unsaved work, and the two ways the bar lied about them.
//
// Driven in a browser on 2026-09-12: press Restore on the device copy and the recovery bar
// comes straight back offering the server's — the same keystrokes, a second time — because
// clearing the device copy made `localAt` null and null read as "there is no device copy".
// And a writer who reopened their work met "unsaved" over text that had just been put back
// out of storage, because the bar only knew about snapshots THIS session had written.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const KEY = 'quire:draft:post:a-piece'
type Draft = { content: string }

/** A minute ago and two minutes ago, so "newer" is unambiguous. */
const NOW = Date.parse('2026-09-12T09:00:00Z')
const DEVICE_AT = NOW - 60_000
const SERVER_AT = NOW - 30_000

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(KEY, JSON.stringify({ data: { content: 'on this device' }, at: new Date(DEVICE_AT).toISOString() }))
})

/**
 * A component that is nothing but the hook, so the assertions are about the decision rather
 * than about an editor's markup.
 */
async function probe(opts?: { serverAt?: number | null }) {
  const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
  const { useDraftSafety } = await import('@/admin/components/serverDraft')
  const fetchMock = installFetchMock(() => ({ success: true, data: { json: JSON.stringify({ content: 'on the server' }), at: SERVER_AT } }))
  let last: ReturnType<typeof useDraftSafety<Draft>> | null = null
  function Probe() {
    const safety = useDraftSafety<Draft>({
      kind: 'post',
      slug: 'a-piece',
      storageKey: KEY,
      serverAt: opts?.serverAt === undefined ? SERVER_AT : opts.serverAt,
      rowSavedAt: NOW - 600_000,
      isDirty: () => true,
      snapshot: () => ({ content: 'typing' }),
      intervalMs: 60_000,
    })
    last = safety
    return <span data-from={safety.recovered?.from ?? 'none'}>{String(safety.keptAt)}</span>
  }
  const m = await mountAdmin(<Probe />)
  await m.flush()
  return {
    m,
    from: () => m.container.querySelector('span')!.getAttribute('data-from'),
    keptAt: () => m.container.querySelector('span')!.textContent,
    safety: () => last!,
    restore: fetchMock.restore,
  }
}

describe('the editor’s two copies of unsaved work', () => {
  it('reports work this session did not write, so the bar cannot call it unsaved', async () => {
    const p = await probe({ serverAt: null })
    expect(p.keptAt()).toBe(String(DEVICE_AT))
    p.restore()
    await p.m.unmount()
  })

  it('retires BOTH offers when one is taken back', async () => {
    const p = await probe()
    // The server's is newer here, so that is the one on offer.
    expect(p.from()).toBe('server')
    await p.m.rerender(<span />)
    p.restore()
    await p.m.unmount()
  })

  it('does not offer the device copy again after the server copy went in', async () => {
    const p = await probe()
    expect(p.from()).toBe('server')
    const { act } = await import('react')
    await act(async () => { await p.safety().restore() })
    await p.m.flush()
    expect(p.from()).toBe('none')
    p.restore()
    await p.m.unmount()
  })

  it('does not offer the server copy again after the device copy went in', async () => {
    // Device newer: it is the one offered, and taking it must not hand over the server's.
    const p = await probe({ serverAt: DEVICE_AT - 30_000 })
    expect(p.from()).toBe('device')
    const { act } = await import('react')
    await act(async () => { await p.safety().restore() })
    await p.m.flush()
    expect(p.from()).toBe('none')
    p.restore()
    await p.m.unmount()
  })

  it('takes both down when the offer is dismissed', async () => {
    const p = await probe()
    const { act } = await import('react')
    await act(async () => { p.safety().dismiss() })
    await p.m.flush()
    expect(p.from()).toBe('none')
    // Dismissed, not deleted: the copy is still on disk for the next trip through the screen.
    expect(localStorage.getItem(KEY)).not.toBeNull()
    p.restore()
    await p.m.unmount()
  })
})
