// The admin application: the shell the frozen tree's `/admin/layout.tsx` was, plus the
// route table its directory structure was.
//
// The auth guard is NOT here. The server refuses to serve this bundle's HTML to anyone who
// is not the owner, which is the same gate every write route sits behind (Invariant 4) — a
// check in the client would be decoration.

import { Suspense, lazy, type ComponentType, type ReactNode } from 'react'
import { RouterProvider, usePathname, useNavSeq } from '@/admin/router'
import { useView } from '@/admin/useView'
import { AdminI18nProvider, useAdminT } from '@/admin/components/I18nProvider'
import { ToastProvider } from '@/admin/ui/Toast'
import { ConfirmProvider } from '@/admin/ui/ConfirmDialog'
import { ThemeProvider } from '@/admin/ui/ThemeProvider'
import { TopProgress } from '@/admin/ui/TopProgress'
import { ErrorBoundary } from '@/admin/ui/ErrorBoundary'
import { throughDeploys } from '@/admin/ui/stale-build'
import { Failed, Loading } from '@/admin/pages/state'
import { isSiteLang } from '@/locales/langs'
import type { SiteLang } from '@/types'
import { AdminSidebar } from '@/admin/components/AdminSidebar'
import { CommandPalette } from '@/admin/components/CommandPalette'
import { ShortcutSheet } from '@/admin/components/ShortcutSheet'
import { WritePane } from '@/admin/components/WritePane'
import { useFocusMode } from '@/admin/components/useFocusMode'

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
  noteEditor: () => import('@/admin/pages/NoteEditor'),
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
const NoteEditor = lazy(throughDeploys(load.noteEditor))
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
  if (p === '/admin/note-editor' || p.startsWith('/admin/note-editor/')) return load.noteEditor
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
  if (path === '/admin/note-editor' || path.startsWith('/admin/note-editor/')) return <NoteEditor />
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
    <main id="admin-content" className="admin-canvas min-w-0 flex-1 lg:h-[100dvh] lg:overflow-y-auto lg:overscroll-y-contain">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-7 lg:px-10 lg:py-9 xl:px-12">{children}</div>
    </main>
  )
}

/** The four routes that are the writing screen: the list, and the three editors. */
const WRITING = /^\/admin\/(content|editor|page-editor|note-editor)(\/|$)/

/**
 * The write pane, drawn HERE and not by the pages it appears on.
 *
 * It was rendered by each of the three pages, which meant it was destroyed and rebuilt on
 * every click inside itself: a route change swaps the page component, and `ErrorBoundary` is
 * keyed by path, so the whole subtree goes. The list came back looking the same and scrolled
 * back to the top — on the one screen whose entire job is picking something out of a list.
 *
 * Out here it is mounted once for the whole writing session. Clicking a row changes the sheet
 * beside it and nothing else: the scroll stays, the search box keeps what was typed, and the
 * selected row moves the moment the click lands rather than after a round trip, because
 * `activeSlug` is read from the PATH and not from a payload.
 *
 * The pane fetches its own list, so this knows nothing about content — only which routes have
 * one, and that focus mode puts it away BESIDE A SHEET.
 *
 * ⚠️ On the Write screen itself the pane is not chrome beside the writing, it IS the screen:
 * the sheet there holds one line and two buttons. Focus mode hid it on all three routes, so
 * turning it on inside an editor emptied the Write screen for every later visit — the list
 * gone, `Content.tsx`'s invitation still saying to pick something on the left, and below
 * `xl` (where that invitation is hidden because the pane is normally the whole width) a
 * blank page. It also took the way back out with it: `Mod-\` is registered by the editor's
 * action line, so the screen that had lost its list had no switch on it either.
 */
function WriteLayout({ path, children }: { path: string; children: ReactNode }) {
  const [focus] = useFocusMode()
  if (!WRITING.test(path)) return <>{children}</>
  const list = path === '/admin/content'
  const slug = decodeURIComponent(path.replace(/^\/admin\/(editor|page-editor)\/?/, ''))
  return (
    <div className="flex items-start gap-6">
      {(list || !focus) && <WritePane activeSlug={list ? undefined : slug || undefined} always={list} />}
      {children}
    </div>
  )
}

async function signOut(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
  location.href = '/'
}

/** The language the server painted the shell in, for the one screen that cannot ask. */
function shellLang(): SiteLang {
  const said = document.documentElement.lang
  return isSiteLang(said) ? said : 'en'
}

function Shell() {
  // One round trip before anything renders, for the two facts the whole shell needs. The
  // frozen tree read them in the layout's server component; there is nowhere else to put
  // them now, and a language flash is worse than a blank frame.
  const { data, error, reload } = useView('shell')
  // Read here rather than inside the boundary: it is the boundary's KEY, so it has to change
  // in the tree that renders it.
  const path = usePathname()
  // The other half of that key. The path alone cannot tell a second visit from the first, and
  // one screen needs it to: the editor moves the address itself after a first save, so a click
  // on New post afterwards is a push to the path this router still believes it is on. Keyed on
  // the path alone, nothing remounted and the blank sheet came up holding the saved piece.
  const nav = useNavSeq()
  // A shell that cannot load is not a slow shell. `error` and `reload` were both being
  // thrown away here, so a 500 from `/api/admin/view/shell` — a locked database, a settings
  // blob that will not parse — left the owner on an empty grey page with no message, no way
  // to try again, and no clue that anything had happened. Every screen BELOW this one has
  // had a retry since the day `Failed` was written; the one that decides whether they mount
  // at all had none.
  //
  // The language comes off `<html lang>` because the answer that would have carried it is
  // the one that failed. `spa.ts` writes it into the served shell for exactly this kind of
  // first paint.
  if (error) {
    return (
      <AdminI18nProvider lang={shellLang()}>
        <div className="mx-auto max-w-md p-8"><Failed error={error} onRetry={reload} /></div>
      </AdminI18nProvider>
    )
  }
  if (!data) return <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950" />
  return (
    <AdminI18nProvider lang={data.language}>
      {/* Toasts are ADMIN-only (save and upload feedback), so the provider lives here. */}
      <ToastProvider>
        {/* Asking before something is lost, in this product's own grammar rather than the
            browser's. OUTSIDE the error boundary and outside the route, for the same reason
            the palette is: the navigation guard asks its question WHILE a page is being left,
            so the thing drawing it cannot be the thing being unmounted. */}
        <ConfirmProvider>
        {/* From lg up the shell is the INSTRUMENT PANEL: locked to the viewport, nothing on it
            moves. Only the canvas scrolls — so the rail, the write pane and the editor's
            sticky rows hold still while the paper passes, and a rubber-band at the top of a
            page bounces the paper, never the frame. Below lg the page scrolls as pages do:
            a phone drawer inside a height-locked shell is a trap.
            ⚠️ `dvh`, NEVER `vh`, and it is the whole fix on an iPad. Mobile Safari resolves
            `100vh` against the viewport it would have WITH THE TOOLBAR HIDDEN, so a shell
            told to be `h-screen` is taller than the glass by exactly that toolbar — and the
            page scrolls that much, carrying the rail and the editor's frame up with it while
            the "locked" panel looked locked on every desktop it was tested on. `dvh` is the
            height that is actually visible right now. Reported from an iPad in Safari. */}
        <div className="admin-shell admin-case min-h-screen lg:flex lg:h-[100dvh] lg:overflow-hidden">
          {/* THE FIRST STOP, and it was missing. The rail holds four destinations, a group of
              seven and six footer controls, so reaching the page itself from the keyboard cost
              up to eighteen presses of Tab on every single visit. It is invisible until it has
              focus, which is the whole convention: the people who need it find it with the
              first key they press, and nobody else ever sees it. */}
          <a
            href="#admin-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:border-neutral-300 focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-neutral-900 focus:shadow-lg dark:focus:border-neutral-700 dark:focus:bg-neutral-900 dark:focus:text-neutral-100"
          >
            <SkipLabel />
          </a>
          <AdminSidebar lang={data.language} signOut={signOut} aiConfigured={data.aiConfigured} navOrder={data.navOrder} avatar={data.avatar} />
          {/* Outside the canvas and outside the error boundary: it is how you LEAVE a screen
              that has gone wrong, so it must not be inside the thing that went wrong. */}
          <CommandPalette />
          {/* `?` from anywhere. Its own component for the same reason the palette is one:
              the rail is drawn at the top of the shell and this at the bottom, and a key
              listener that has to live inside a screen is a key that stops working on the
              screens that screen is not. */}
          <ShortcutSheet />
          <Canvas>
            {/* One page may fail without taking the admin with it. INSIDE the canvas and
                outside the sidebar, so the rail still works and the owner can leave; keyed by
                path, so leaving is also what resets it. Before this existed, a parser that
                threw while opening a post unmounted everything and left a white page
                (`ui/ErrorBoundary.tsx`). */}
            {/* The pane is OUTSIDE the boundary and outside the route: it must survive both
                a navigation and a page that threw, because it is how you get to another one. */}
            <WriteLayout path={path}>
              {/* KEYED BY PATH, which is what makes the arrival possible: a new key mounts a
                  new subtree, and `@starting-style` only fires on something that has just
                  come into existence. The boundary was already keyed this way for its own
                  reason — leaving a broken page is what resets it — so the class rides along
                  rather than adding a wrapper. */}
              <ErrorBoundary key={`${path}#${nav}`}>
              {/* ⚠️ `min-w-0`, and it is load-bearing rather than tidy. A flex item defaults
                  to `min-width: auto`, which refuses to shrink below its content's intrinsic
                  minimum — so this wrapper, added only to carry the entrance, took the
                  editor's own shrink chain out and the phone scrolled sideways by 591px.
                  The same declaration is the fix in three other places in this admin. */}
              <div className="admin-enter min-w-0">
              {/* Reached on the FIRST paint only. Every later route change runs inside a
                  transition, which keeps the current page on screen instead of falling back
                  here — see the note in `router.tsx`. */}
              {/* `Loading` with no shape — the shared ellipsis, not a second hand-typed one.
                  This fallback is reached on the FIRST paint only, before the route's chunk
                  has arrived, so the shell does not yet know whether a list or a form is
                  coming; the page's own `View` draws the right skeleton a moment later. */}
              <Suspense fallback={<Loading />}>
                <Route />
              </Suspense>
              </div>
              </ErrorBoundary>
            </WriteLayout>
          </Canvas>
        </div>
        </ConfirmProvider>
      </ToastProvider>
    </AdminI18nProvider>
  )
}

/** Its own component so the shell need not become a consumer of the dictionary. */
function SkipLabel() {
  return <>{useAdminT().skipToContent}</>
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
