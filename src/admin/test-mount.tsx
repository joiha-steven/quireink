// A REAL MOUNT, in happy-dom, for the admin components — the layer `check:all` admits it
// cannot see ("a column collapsed to reader@e…", CLAUDE.md). The unit suites here test
// parsers and pure logic; the tour tests a real browser but needs a seeded server. This
// sits between: React 19's own createRoot against happy-dom's DOM, so a test can mount
// CommentsTable with three rows and read what an owner would actually be shown.
//
// EVERY test file that uses this must register happy-dom itself (the per-file pattern of
// `editor-corpus.test.ts`) and import this module DYNAMICALLY inside a test or beforeAll —
// static imports are evaluated before beforeAll runs, and react-dom's client entry expects
// a document to exist by the time a root is created.
//
// NOT under dist/, and never imported by `main.tsx`: this is test scaffolding, and the
// `check:bundle` guard reads the built output, which must never contain it.

import type { ReactElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AdminI18nProvider } from '@/admin/components/I18nProvider'
import { ToastProvider } from '@/admin/ui/Toast'
import { RouterProvider } from '@/admin/router'

/**
 * The browser corners happy-dom does not fill in. Each shim is inert on purpose: these
 * tests assert what is RENDERED, not what a ResizeObserver measured — a component that
 * mounts one just needs the constructor to exist.
 */
function ensureBrowserShims(): void {
  const g = globalThis as Record<string, unknown>
  // React's act() refuses to run silently without this flag.
  g.IS_REACT_ACT_ENVIRONMENT = true
  if (typeof g.ResizeObserver === 'undefined') {
    g.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
  }
  if (typeof g.IntersectionObserver === 'undefined') {
    g.IntersectionObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): unknown[] { return [] }
    }
  }
}

/** One recorded request the component made through the mocked global fetch. */
export type FetchCall = {
  url: string
  method: string
  /** JSON-parsed request body, or undefined when the request carried none. */
  body: unknown
}

/**
 * Replace the global fetch with a recording mock. The handler answers by URL/init and
 * returns either a plain value (wrapped as a 200 `{...}` JSON response — hand it the
 * envelope `{ success: true, data }` the admin API speaks) or a full Response.
 *
 * Restore is NOT optional: bun runs every test file in one process, so a mock left in
 * place bleeds into the next suite. Call `restore()` in afterEach/afterAll.
 */
export function installFetchMock(
  handler: (url: string, init?: RequestInit) => unknown,
): { calls: FetchCall[]; restore: () => void } {
  const original = globalThis.fetch
  const calls: FetchCall[] = []
  const mock = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const rawBody = typeof init?.body === 'string' ? init.body : undefined
    calls.push({
      url,
      method: (init?.method ?? 'GET').toUpperCase(),
      body: rawBody === undefined ? undefined : (JSON.parse(rawBody) as unknown),
    })
    const out = handler(url, init)
    if (out instanceof Response) return out
    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  globalThis.fetch = mock as typeof fetch
  return { calls, restore: () => { globalThis.fetch = original } }
}

export type Mounted = {
  container: HTMLElement
  /** Re-render a new element into the same providers/root. */
  rerender: (node: ReactElement) => Promise<void>
  /** Let pending effects and resolved promises (a mocked fetch) commit. */
  flush: () => Promise<void>
  /** Click an element inside act(), so the state it changes is committed on return. */
  click: (el: Element) => Promise<void>
  /** Set a controlled input/textarea/select value the way a user's keystroke would. */
  type: (el: Element, value: string) => Promise<void>
  /** The first <button> whose visible text is exactly `text`, or throw — a missing
   *  control should fail the test loudly, not as an undefined deref three lines later. */
  button: (text: string) => HTMLButtonElement
  text: () => string
  unmount: () => Promise<void>
}

/**
 * React's controlled inputs instrument `value` on the element instance to drop events
 * that did not change anything. Writing through the PROTOTYPE setter bypasses that
 * tracker, so the 'input' event dispatched next is seen as a real change — the same
 * trick testing-library uses. Plain `el.value = x` goes through the tracker and the
 * event is then swallowed as a no-op.
 */
function setNativeValue(el: Element, value: string): void {
  const proto = Object.getPrototypeOf(el) as object
  const desc = Object.getOwnPropertyDescriptor(proto, 'value')
  if (desc?.set) desc.set.call(el, value)
  else (el as HTMLInputElement).value = value
}

/**
 * Mount a node inside the providers the admin shell always supplies (App.tsx):
 * Router → I18n (en) → Toast. Theme and the progress bar are left out — nothing a
 * component asserts on reads them, and each drags in scheme-preference plumbing.
 */
export async function mountAdmin(node: ReactElement): Promise<Mounted> {
  ensureBrowserShims()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  const render = (n: ReactElement): Promise<void> =>
    act(async () => {
      root.render(
        <RouterProvider>
          <AdminI18nProvider lang="en">
            <ToastProvider>{n}</ToastProvider>
          </AdminI18nProvider>
        </RouterProvider>,
      )
    })
  await render(node)
  return {
    container,
    rerender: render,
    flush: () => act(async () => {}),
    click: (el) => act(async () => { (el as HTMLElement).click() }),
    type: (el, value) =>
      act(async () => {
        setNativeValue(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }),
    button: (text) => {
      const hit = [...container.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === text,
      )
      if (!hit) throw new Error(`no <button> with text "${text}"`)
      return hit as HTMLButtonElement
    },
    text: () => container.textContent ?? '',
    unmount: async () => {
      await act(async () => { root.unmount() })
      container.remove()
    },
  }
}
