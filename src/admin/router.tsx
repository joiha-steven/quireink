// The router, in place of `next/link` and `next/navigation`.
//
// The admin is one static bundle served under `/admin/*`, so routing is a listener on
// `popstate` plus `history.pushState`. That is the whole of what the ported components
// used Next's router for: a `<Link>`, the current path, the query string, and a
// programmatic push or refresh.
//
// `refresh()` is the one that needed thought. In Next it re-ran the server component and
// streamed fresh props in; here there is no server render, so it bumps a counter that the
// page shells depend on, which re-runs their fetch. Same effect, one concept fewer.

import {
  createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState,
  useTransition,
} from 'react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

type RouterState = {
  path: string
  search: string
  /** Bumped by `refresh()`. Page shells list it as a dependency of their data fetch. */
  epoch: number
}

type RouterApi = RouterState & {
  push: (href: string) => void
  replace: (href: string) => void
  back: () => void
  refresh: () => void
  /** True while a route change is waiting on its chunk. Drives the top progress bar. */
  pending: boolean
}

const RouterContext = createContext<RouterApi | null>(null)

/**
 * What a screen with unsaved work says when the reader tries to leave it.
 *
 * `blocked()` is asked on every push and replace; when it answers true the navigation is held
 * and `ask()` decides. Resolving true lets it through, false leaves the reader where they are.
 *
 * ONE guard at a time, and that is a fact about the admin rather than a simplification: the
 * only screens that can hold unsaved work are a settings form and an editor, and neither is
 * ever mounted inside the other. A stack would be dead code with a second failure mode.
 */
type NavGuard = { blocked: () => boolean; ask: () => Promise<boolean> }
const GuardContext = createContext<{ set: (g: NavGuard | null) => void } | null>(null)

const readLocation = (): { path: string; search: string } => ({
  path: location.pathname,
  search: location.search,
})

export function RouterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RouterState>(() => ({ ...readLocation(), epoch: 0 }))
  const [pending, startNavigation] = useTransition()
  // A REF, not state: registering a guard must not re-render the whole admin, and `go` needs
  // the value at the moment of the click rather than the value the last render closed over.
  const guard = useRef<NavGuard | null>(null)
  const guardApi = useMemo(() => ({ set: (g: NavGuard | null) => { guard.current = g } }), [])


  /**
   * The route change runs inside a transition, and that is the whole of why the admin stopped
   * feeling like a reload.
   *
   * Every page is a `lazy()` import, so the first visit to one suspends. Outside a transition
   * React answers a suspension by swapping the subtree for the Suspense fallback — and then
   * throttles putting the real content back, by a fixed 300ms, so a fallback that appears is
   * never a flicker. Measured before this change: the first click on any admin route took
   * 330-390ms, of which ~300ms was that throttle with the CPU idle and the network silent,
   * and the page's own data fetch could not even START until the throttle let it mount. The
   * same route clicked again, chunk already resolved, took 23-35ms.
   *
   * Inside a transition there is no fallback: React keeps the current page on screen until
   * the new one is ready. No fallback shown, no reveal to throttle. `pending` is what the
   * progress bar reads in the meantime.
   */
  const commit = useCallback((href: string, mode: 'push' | 'replace') => {
    // The URL changes NOW, not when the transition commits. A pending navigation that has
    // not yet rendered still has to be the address the reader sees and can copy.
    if (mode === 'push') history.pushState(null, '', href)
    else history.replaceState(null, '', href)
    startNavigation(() => setState((s) => ({ ...readLocation(), epoch: s.epoch })))
  }, [])

  // Where the reader is, for the one thing that needs it outside a render: putting the
  // address back when they answer a guard by staying.
  const here = useRef(state)
  here.current = state

  useEffect(() => {
    /**
     * Back and Forward go through the guard too.
     *
     * They did not, and the gap was the whole of it: a settings form with five changes on it
     * unmounted silently on the browser's Back button, because `beforeunload` does not fire
     * for a same-document history move and only `go()` asked the question. The click that
     * asks and the gesture that does not were the same navigation to the reader.
     *
     * The order is forced by what has already happened. `popstate` fires AFTER the address
     * has moved, so staying means pushing the old address back on before the question is
     * asked, and leaving means going to the answer the reader gave rather than the one the
     * browser assumed.
     */
    const onPop = () => {
      const g = guard.current
      const to = readLocation()
      if (!g?.blocked()) {
        startTransition(() => setState((s) => ({ ...to, epoch: s.epoch })))
        return
      }
      const from = here.current
      history.pushState(null, '', from.path + from.search)
      void g.ask().then((leave) => {
        if (!leave) return
        guard.current = null
        commit(to.path + to.search, 'push')
      })
    }
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [commit])

  /**
   * ⚠️ The URL must NOT move before the question is answered.
   *
   * That is the whole reason the address change moved down into `commit`: the guard's dialog
   * takes as long as a person takes, and pushing the new path first would put the address of a
   * page the reader has not gone to in the bar behind the question — and leave it there if
   * they chose to stay.
   */
  const go = useCallback((href: string, mode: 'push' | 'replace') => {
    const g = guard.current
    if (g && g.blocked()) {
      void g.ask().then((leave) => { if (leave) commit(href, mode) })
      return
    }
    commit(href, mode)
  }, [commit])

  // Scrolling belongs AFTER the commit, not beside the click. During a transition the old
  // page is still the one on screen, and yanking it to the top while the reader is still
  // looking at it is the jolt this whole change exists to remove.
  useEffect(() => {
    scrollTo(0, 0)
    // From lg up the canvas is the scroller, not the window (App.tsx) — reset it too, or
    // every navigation lands mid-page wherever the last one left off.
    document.querySelector('main.admin-canvas')?.scrollTo(0, 0)
  }, [state.path])

  const api = useMemo<RouterApi>(() => ({
    ...state,
    pending,
    push: (href) => go(href, 'push'),
    replace: (href) => go(href, 'replace'),
    back: () => history.back(),
    refresh: () => setState((s) => ({ ...s, epoch: s.epoch + 1 })),
  }), [state, go, pending])

  return (
    <RouterContext.Provider value={api}>
      <GuardContext.Provider value={guardApi}>{children}</GuardContext.Provider>
    </RouterContext.Provider>
  )
}

/**
 * Hold a route change until the screen says it may happen, and warn the browser too.
 *
 * `beforeunload` covers what the router cannot see — a reload, a typed address, the tab being
 * closed — and it can only ever raise the browser's own generic warning; the router half is
 * what makes a click on the rail ask a question this product wrote. Both are needed, and a
 * screen that registers only one of them loses work through the other.
 */
export function useNavigationGuard(blocked: boolean, ask: () => Promise<boolean>): void {
  const ctx = useContext(GuardContext)
  // The latest `ask` without re-registering on every render: the callback usually closes over
  // form state, so it is a new function each keystroke, and re-registering per keystroke would
  // make the guard's identity churn for no reason.
  const askRef = useRef(ask)
  askRef.current = ask
  useEffect(() => {
    if (!ctx) return
    if (!blocked) { ctx.set(null); return }
    ctx.set({ blocked: () => true, ask: () => askRef.current() })
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    addEventListener('beforeunload', onUnload)
    return () => {
      ctx.set(null)
      removeEventListener('beforeunload', onUnload)
    }
  }, [ctx, blocked])
}

function useRouterContext(): RouterApi {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider')
  return ctx
}

export const useRouter = useRouterContext
export const usePathname = (): string => useRouterContext().path

/**
 * A read-only `URLSearchParams` for the current query, matching the subset of Next's
 * hook the ported components actually call: `get`, `has` and `toString`.
 */
export function useSearchParams(): URLSearchParams {
  const { search } = useRouterContext()
  return useMemo(() => new URLSearchParams(search), [search])
}

/** The epoch a `refresh()` bumps. A page shell refetches when this changes. */
export const useRefreshEpoch = (): number => useRouterContext().epoch

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  children: ReactNode
  /** Accepted and ignored: Next prefetches, this bundle is already loaded. */
  prefetch?: boolean
  scroll?: boolean
  replace?: boolean
}

/**
 * An anchor that routes in place. A real `href` throughout, so middle-click, Ctrl-click
 * and "open in new tab" all keep working — which is why the modifier check below is not
 * optional. An external or non-admin href falls through to the browser.
 */
export function Link({ href, children, prefetch, scroll, replace, onClick, ...rest }: LinkProps) {
  const router = useRouterContext()
  void prefetch
  void scroll
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        // Let the browser handle anything that is not a plain left click, and anything
        // that leaves the admin.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        if (!href.startsWith('/') || href.startsWith('//')) return
        if (!href.startsWith('/admin')) return
        e.preventDefault()
        if (replace) router.replace(href)
        else router.push(href)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

export default Link
