// The screen that decides whether any other screen mounts.
//
// `useView('shell')` answers the two facts the whole admin needs, and its `error` and
// `reload` were both being thrown away: a 500 from that one endpoint — a locked database, a
// settings blob that will not parse — left the owner on an empty grey page with no message
// and no way to ask again. Every screen below this one has had a retry since `Failed` was
// written; this one had none.
import { describe, expect, it, beforeAll, afterAll, afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const restores: (() => void)[] = []
afterEach(() => { for (const r of restores.splice(0)) r() })

describe('the admin shell', () => {
  it('says so and offers a retry when its own view will not load', async () => {
    const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
    const { App } = await import('@/admin/App')
    const wasLang = document.documentElement.lang
    document.documentElement.lang = 'en'
    restores.push(() => { document.documentElement.lang = wasLang })
    let calls = 0
    const fetchMock = installFetchMock(() => {
      calls++
      throw new Error('the database is locked')
    })
    restores.push(fetchMock.restore)

    const m = await mountAdmin(<App />)
    await m.flush()
    await new Promise((r) => setTimeout(r, 30))
    await m.flush()

    const text = m.container.textContent ?? ''
    expect(text).not.toBe('')
    const retry = [...m.container.querySelectorAll('button')]
      .find((b) => /retry|try again/i.test(b.textContent ?? ''))
    expect(retry).toBeTruthy()

    // ⚠ The CLICK is not asserted here, and that is a limit of the harness rather than a
    // gap in the cover. React delegates its listeners to the root container, and a second
    // mount test in the same process re-registers happy-dom's globals under it: driven from
    // this file alone the retry refetches, and driven after another mount file the synthetic
    // click reaches no handler at all. What this file is for is the state that had no screen
    // — a message and a way out where there used to be a blank page — and the button's own
    // wiring is `Failed`'s, which every other screen exercises.
    expect(retry!.disabled).toBe(false)
    expect(calls).toBe(1)
    await m.unmount()
  })
})
