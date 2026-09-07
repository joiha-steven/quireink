// Back and Forward are navigations too.
//
// A settings form with unsaved work on it registers a guard, and `go()` has always asked it.
// The browser's own Back button does not go through `go()`, and `beforeunload` does not fire
// for a same-document history move — so the one gesture people use most to leave a screen
// was the one that never asked. This is the whole of what that costs and what fixes it.
import { describe, expect, it, beforeAll, afterAll, afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { useNavigationGuard, usePathname } from '@/admin/router'

// A real origin: `history.pushState` on `about:blank` leaves `location.pathname` as
// "blank", and the whole point here is what the address bar says.
beforeAll(() => {
  // Registered WITHOUT options, like every other mount test: passing a url here re-registers
  // the globals when another file in the same process has already registered plain ones, and
  // the references those files captured stop being the ones in play. The address is set
  // afterwards instead, which is the same result and touches nothing else.
  GlobalRegistrator.register()
  ;(window as unknown as { happyDOM: { setURL: (u: string) => void } }).happyDOM.setURL('http://localhost/admin/settings')
})
afterAll(() => GlobalRegistrator.unregister())

const restores: (() => void)[] = []
afterEach(() => { for (const r of restores.splice(0)) r() })

/** A screen that says it is holding work, and answers the question the way the test wants. */
function Guarded({ answer }: { answer: boolean }) {
  useNavigationGuard(true, async () => answer)
  return <p>{usePathname()}</p>
}

const back = async (): Promise<void> => {
  history.back()
  // happy-dom moves the address synchronously and dispatches popstate; the guard's answer is
  // a promise, so one turn of the microtask queue plus a frame is what it takes to land.
  await new Promise((r) => setTimeout(r, 30))
}

describe('the navigation guard', () => {
  it('puts the address back when the reader chooses to stay', async () => {
    const { mountAdmin } = await import('@/admin/test-mount')
    history.pushState(null, '', '/admin/settings')
    const m = await mountAdmin(<Guarded answer={false} />)
    await m.flush()
    history.pushState(null, '', '/admin/media')
    history.pushState(null, '', '/admin/settings')

    await back()

    expect(location.pathname).toBe('/admin/settings')
    await m.unmount()
  })

  it('lets the reader through when they answer that they are leaving', async () => {
    const { mountAdmin } = await import('@/admin/test-mount')
    history.pushState(null, '', '/admin/settings')
    const m = await mountAdmin(<Guarded answer={true} />)
    await m.flush()
    history.pushState(null, '', '/admin/media')
    history.pushState(null, '', '/admin/settings')

    await back()
    await m.flush()

    expect(location.pathname).toBe('/admin/media')
    await m.unmount()
  })
})
