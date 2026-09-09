// `touchView`: a screen that changed the truth refetches every reader of a view that is on
// screen, without the epoch — so the write pane learns of a save while the editor beside it
// keeps its cursor.
//
// happy-dom for THIS FILE ONLY, the island rule.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

let served = 0
mock.module('@/admin/api', () => ({
  view: async () => ({ served: ++served }),
}))
mock.module('@/admin/router', () => ({
  useRefreshEpoch: () => 0,
}))

beforeAll(() => {
  GlobalRegistrator.register()
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterAll(() => GlobalRegistrator.unregister())

const settle = () => new Promise((r) => setTimeout(r, 20))

describe('touchView', () => {
  it('refetches a mounted reader and leaves its data on screen until the answer lands', async () => {
    const { createElement } = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { act } = await import('react')
    const { useView, touchView } = await import('@/admin/useView')
    const seen: unknown[] = []
    function Reader() {
      const { data } = useView('content')
      seen.push(data)
      return createElement('p', null, data ? String((data as unknown as { served: number }).served) : 'loading')
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => { root.render(createElement(Reader)); await settle() })
    expect(host.textContent).toBe('1')

    await act(async () => { touchView('content'); await settle() })
    expect(host.textContent).toBe('2')
    // Between the touch and the answer the reader never showed "loading" again.
    expect(seen.filter((d) => d === null).length).toBe(1)

    // A reader that has unmounted is no longer on the list.
    await act(async () => { root.unmount() })
    touchView('content')
    await settle()
    expect(served).toBe(2)
  })
})
