// The admin application: the shell the frozen tree's `/admin/layout.tsx` was, plus the
// route table its directory structure was.
//
// The auth guard is NOT here. The server refuses to serve this bundle's HTML to anyone who
// is not the owner, which is the same gate every write route sits behind (Invariant 4) — a
// check in the client would be decoration.

import { Suspense, lazy, type ComponentType, type ReactNode } from 'react'
import { RouterProvider, usePathname } from '@/admin/router'
import { useView } from '@/admin/useView'
import { AdminI18nProvider } from '@/admin/components/I18nProvider'
import { ToastProvider } from '@/admin/ui/Toast'
import { ThemeProvider } from '@/admin/ui/ThemeProvider'
import { TopProgress } from '@/admin/ui/TopProgress'
import { ErrorBoundary } from '@/admin/ui/ErrorBoundary'
import { throughDeploys } from '@/admin/ui/stale-build'
import { AdminSidebar } from '@/admin/components/AdminSidebar'

// The editor pulls in Tiptap and its extensions, which is most of the bundle. Splitting it
// out means the dashboard, the settings and every table load without paying for an editor
// nobody has opened.
//
// The loaders are named separately from the `lazy()` wrappers so the first one can be
// STARTED before React asks for it — see `preloadRoute` below.
type Loader = () => Promise<{ default: ComponentType }>

const load = {
  dashboard: () => import('@/admin/pages/Dashboard'),
  content: () => import('@/admin/pages/Content'),
  postEditor: () => import('@/admin/pages/PostEditor'),
  pageEditor: () => import('@/admin/pages/PageEditor'),
  media: () => import('@/admin/pages/Media'),
  comments: () => import('@/admin/pages/Comments'),
  newsletter: () => import('@/admin/pages/Newsletter'),
  analytics: () => import('@/admin/pages/Analytics'),
  log: () => import('@/admin/pages/Log'),
  trash: () => import('@/admin/pages/Trash'),
  settings: () => import('@/admin/pages/Settings'),
  help: () => import('@/admin/pages/Help'),
  assistant: () => import('@/admin/pages/Assistant'),
  notFound: () => import('@/admin/pages/NotFound'),
} satisfies Record<string, Loader>

// `throughDeploys` sits between the loader and React, and it is not error handling — it is
// the one failure whose cure is known. A chunk filename carries a content hash, so a new
// build on the server DELETES the file this tab is about to ask for; the fix is to fetch the
// new bundle, which is a reload. `ui/stale-build.ts` carries the reasoning and the loop
// guard. Everything else a page can throw still goes to the boundary, unchanged.
const Dashboard = lazy(throughDeploys(load.dashboard))
const Content = lazy(throughDeploys(load.content))
const PostEditor = lazy(throughDeploys(load.postEditor))
const PageEditor = lazy(throughDeploys(load.pageEditor))
const Media = lazy(throughDeploys(load.media))
const Comments = lazy(throughDeploys(load.comments))
const Newsletter = lazy(throughDeploys(load.newsletter))
const Analytics = lazy(throughDeploys(load.analytics))
const Log = lazy(throughDeploys(load.log))
const Trash = lazy(throughDeploys(load.trash))
const Settings = lazy(throughDeploys(load.settings))
const Help = lazy(throughDeploys(load.help))
const NotFound = lazy(throughDeploys(load.notFound))
const Assistant = lazy(throughDeploys(load.assistant))

/** Which loader serves a path. The single place the route table's shape is decided. */
function loaderFor(path: string): Loader {
  const p = path.replace(/\/+$/, '') || '/admin'
  if (p === '/admin') return load.dashboard
  if (p === '/admin/content') return load.content
  if (p === '/admin/editor' || p.startsWith('/admin/editor/')) return load.postEditor
  if (p === '/admin/page-editor' || p.startsWith('/admin/page-editor/')) return load.pageEditor
  if (p === '/admin/media') return load.media
  if (p === '/admin/comments') return load.comments
  if (p === '/admin/newsletter') return load.newsletter
  if (p === '/admin/analytics') return load.analytics
  if (p === '/admin/log') return load.log
  if (p === '/admin/trash') return load.trash
  if (p === '/admin/settings') return load.settings
  if (p === '/admin/help') return load.help
  if (p === '/admin/assistant') return load.assistant
  return load.notFound
}

/**
 * Start fetching a route's chunk without waiting for React to render it.
 *
 * On a cold load the shell blocks on ONE round trip before any page is mounted, and until
 * that returned nothing had even asked for the page's chunk: measured, the chunk request
 * left at +151ms when the bundle had been parsed at +40ms. Calling the loader here overlaps
 * the two. The bundler hands out the same module promise for a repeat call, so the `lazy()`
 * wrapper below resolves against this one rather than starting a second fetch.
 */
export function preloadRoute(path: string): void {
  void loaderFor(path)().catch(() => {
    /* the render will surface it; a warm-up must never be the thing that throws */
    /* NOT wrapped in `throughDeploys`, deliberately: this fires on hover and on mount, and a
       tab that reloaded itself because a pointer crossed a link would be worse than the bug
       it is curing. The reload belongs to the navigation the owner actually made, which is
       the `lazy()` above. */
  })
}

/**
 * The route table. Order matters only in that the longest prefix has to be tested first,
 * which is why this is a list and not an object.
 */
function Route(): ReactNode {
  const path = usePathname().replace(/\/+$/, '') || '/admin'
  if (path === '/admin') return <Dashboard />
  if (path === '/admin/content') return <Content />
  if (path === '/admin/editor' || path.startsWith('/admin/editor/')) return <PostEditor />
  if (path === '/admin/page-editor' || path.startsWith('/admin/page-editor/')) return <PageEditor />
  if (path === '/admin/media') return <Media />
  if (path === '/admin/comments') return <Comments />
  if (path === '/admin/newsletter') return <Newsletter />
  if (path === '/admin/analytics') return <Analytics />
  if (path === '/admin/log') return <Log />
  if (path === '/admin/trash') return <Trash />
  if (path === '/admin/settings') return <Settings />
  if (path === '/admin/help') return <Help />
  if (path === '/admin/assistant') return <Assistant />
  return <NotFound />
}

/**
 * The padded canvas, right of the sidebar.
 *
 * EVERY page sits in it, the editor included. An earlier version of this file made the
 * editor an exception and let it run edge to edge, which is not what the frozen tree does —
 * its admin layout wraps `children` in this div unconditionally. The sidebar already gets
 * out of the editor's way by publishing `--admin-nav-w: 0px`, so the editor is wide without
 * needing the padding removed as well, and removing it was the whole of "the editor page
 * looks wrong". Ported behaviour, not improved behaviour.
 */
function Canvas({ children }: { children: ReactNode }) {
  return (
    <main className="admin-canvas min-w-0 flex-1">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-7 lg:px-10 lg:py-9 xl:px-12">{children}</div>
    </main>
  )
}

async function signOut(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
  location.href = '/'
}

function Shell() {
  // One round trip before anything renders, for the two facts the whole shell needs. The
  // frozen tree read them in the layout's server component; there is nowhere else to put
  // them now, and a language flash is worse than a blank frame.
  const { data } = useView('shell')
  // Read here rather than inside the boundary: it is the boundary's KEY, so it has to change
  // in the tree that renders it.
  const path = usePathname()
  if (!data) return <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950" />
  return (
    <AdminI18nProvider lang={data.language}>
      {/* Toasts are ADMIN-only (save and upload feedback), so the provider lives here. */}
      <ToastProvider>
        <div className="admin-shell min-h-screen bg-neutral-100 lg:flex dark:bg-neutral-950">
          <AdminSidebar lang={data.language} signOut={signOut} />
          <Canvas>
            {/* One page may fail without taking the admin with it. INSIDE the canvas and
                outside the sidebar, so the rail still works and the owner can leave; keyed by
                path, so leaving is also what resets it. Before this existed, a parser that
                threw while opening a post unmounted everything and left a white page
                (`ui/ErrorBoundary.tsx`). */}
            <ErrorBoundary key={path}>
              {/* Reached on the FIRST paint only. Every later route change runs inside a
                  transition, which keeps the current page on screen instead of falling back
                  here — see the note in `router.tsx`. */}
              <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500 dark:text-neutral-400">…</div>}>
                <Route />
              </Suspense>
            </ErrorBoundary>
          </Canvas>
        </div>
      </ToastProvider>
    </AdminI18nProvider>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider>
        <TopProgress />
        <Shell />
      </RouterProvider>
    </ThemeProvider>
  )
}
