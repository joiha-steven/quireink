// The admin application: the shell the frozen tree's `/admin/layout.tsx` was, plus the
// route table its directory structure was.
//
// The auth guard is NOT here. The server refuses to serve this bundle's HTML to anyone who
// is not the owner, which is the same gate every write route sits behind (Invariant 4) — a
// check in the client would be decoration.

import { Suspense, lazy, type ComponentType, type ReactNode } from 'react'
import { RouterProvider, usePathname, useNavSeq } from '@/admin/router'
import { useView } from '@/admin/useView'
import { AdminI18nProvider } from '@/admin/components/I18nProvider'
import { ToastProvider } from '@/admin/ui/Toast'
import { ConfirmProvider } from '@/admin/ui/ConfirmDialog'
import { WhatsNew } from '@/admin/components/WhatsNew'
import { TopProgress } from '@/admin/ui/TopProgress'
import { ErrorBoundary } from '@/admin/ui/ErrorBoundary'
import { throughDeploys } from '@/admin/ui/stale-build'
import { Failed, Loading } from '@/admin/pages/state'
import { isSiteLang } from '@/locales/langs'
import type { SiteLang } from '@/types'
import { CommandPalette } from '@/admin/components/CommandPalette'
import { ShortcutSheet } from '@/admin/components/ShortcutSheet'

// The editor pulls in Tiptap and its extensions, which is most of the bundle. Splitting it
// out means the dashboard, the settings and every table load without paying for an editor
// nobody has opened.
//
// The loaders are named separately from the `lazy()` wrappers so the first one can be
// STARTED before React asks for it — see `preloadRoute` below.
type Loader = () => Promise<{ default: ComponentType }>

// `/admin/log` and `/admin/help` are not here: they are screens the SERVER draws (ADR 0054, step 1), and
// `web/admin/screens/index.ts` is the table that says so. A converted screen leaves this map in
// the same commit that adds it there, so the two can never both claim one address.
const load = {
  postEditor: () => import('@/admin/pages/PostEditor'),
  pageEditor: () => import('@/admin/pages/PageEditor'),
  noteEditor: () => import('@/admin/pages/NoteEditor'),
  notFound: () => import('@/admin/pages/NotFound'),
} satisfies Record<string, Loader>

// `throughDeploys` sits between the loader and React, and it is not error handling — it is
// the one failure whose cure is known. A chunk filename carries a content hash, so a new
// build on the server DELETES the file this tab is about to ask for; the fix is to fetch the
// new bundle, which is a reload. `ui/stale-build.ts` carries the reasoning and the loop
// guard. Everything else a page can throw still goes to the boundary, unchanged.
const PostEditor = lazy(throughDeploys(load.postEditor))
const PageEditor = lazy(throughDeploys(load.pageEditor))
const NoteEditor = lazy(throughDeploys(load.noteEditor))
const NotFound = lazy(throughDeploys(load.notFound))

/** Which loader serves a path. The single place the route table's shape is decided. */
function loaderFor(path: string): Loader {
  const p = path.replace(/\/+$/, '') || '/admin'
  if (p === '/admin/editor' || p.startsWith('/admin/editor/')) return load.postEditor
  if (p === '/admin/page-editor' || p.startsWith('/admin/page-editor/')) return load.pageEditor
  if (p === '/admin/note-editor' || p.startsWith('/admin/note-editor/')) return load.noteEditor
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
  // Nothing to warm for a screen the server draws: it arrives finished, in one response.
  if (document.documentElement.dataset.adminScreen) return
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
  // THE SERVER GOT THERE FIRST (ADR 0054). A screen it drew is already in the canvas above
  // this div, so React draws nothing and goes on providing the overlays that are still its:
  // the palette, the shortcut sheet, the confirm dialog, the toast. Read off `<html>` rather
  // than from a list in this file, because a second list is a second thing to keep in step —
  // and the one that decides is the one that rendered.
  // ⚠️ EXCEPT WHERE THE SERVER LEFT A SHEET. The three editor addresses are server-drawn
  // FRAMES — rail, write column, paper — with `#admin` inside the paper rather than beside it,
  // because ProseMirror is an application and ADR 0054 keeps it for last and on its own. So on
  // exactly those three, React still draws a route: the sheet's contents, and nothing around
  // them. `data-admin-react` is the server saying so, and it leaves when the editor converts.
  const sheet = document.documentElement.dataset.adminReact === 'sheet'
  if (document.documentElement.dataset.adminScreen && !sheet) return null
  if (path === '/admin/editor' || path.startsWith('/admin/editor/')) return <PostEditor />
  if (path === '/admin/page-editor' || path.startsWith('/admin/page-editor/')) return <PageEditor />
  if (path === '/admin/note-editor' || path.startsWith('/admin/note-editor/')) return <NoteEditor />
  return <NotFound />
}

// THE CANVAS AND THE FRAME AROUND IT ARE THE SERVER'S since ADR 0054's step 0. `<main
// id="admin-content">`, its max-width wrapper, the shell that locks the panel to the viewport,
// the skip link and the rail are all written by `web/admin/spa.ts` and arrive with the page.
// What is left below mounts into `#admin`, which is the one div inside that canvas.

/**
 * The write column is the SERVER's now (ADR 0054).
 *
 * It was `WriteLayout` here plus `WritePane`, 399 lines, mounted outside the router so that a
 * route change did not destroy it — the list came back looking the same and scrolled to the
 * top, on the one screen whose entire job is picking something out of a list. Under this ADR a
 * row click is a real navigation, so there is nothing to keep alive across one and nothing for
 * this layer to hold: `web/admin/screens/content-pane.ts` draws the column on all four writing
 * addresses and `island/content.ts` gives the search, the filters and the selection back.
 *
 * Focus mode is the island's too, and the rule it has to keep is the one that was a bug here:
 * the column goes away BESIDE A SHEET and never on the write screen itself, where it IS the
 * screen. Hiding it on all three emptied that screen for every later visit and took the way
 * back out with it, because the chord is registered by the editor's action line.
 */

/** The language the server painted the shell in, for the one screen that cannot ask. */
function shellLang(): SiteLang {
  const said = document.documentElement.lang
  return isSiteLang(said) ? said : 'en'
}

function Shell() {
  // One round trip for the two facts this level still needs — the language and what the
  // what's-new panel compares against. It does not WAIT for one: `spa.ts` writes the same
  // payload into the page and `useView` seeds itself from it at epoch 0.
  const { data, error, reload } = useView('shell')
  // Read here rather than inside the boundary: it is the boundary's KEY, so it has to change
  // in the tree that renders it.
  const path = usePathname()
  // The other half of that key. The path alone cannot tell a second visit from the first, and
  // one screen needs it to: the editor moves the address itself after a first save, so a click
  // on New post afterwards is a push to the path this router still believes it is on. Keyed on
  // the path alone, nothing remounted and the blank sheet came up holding the saved piece.
  const nav = useNavSeq()
  // A shell that cannot load is not a slow shell. A 500 from `/api/admin/view/shell` — a
  // locked database, a settings blob that will not parse — left the owner on an empty grey
  // page with no message and no way to try again.
  //
  // The language comes off `<html lang>` because the answer that would have carried it is the
  // one that failed. `spa.ts` writes it into the served shell for exactly this kind of paint.
  if (error) {
    return (
      <AdminI18nProvider lang={shellLang()}>
        <div className="mx-auto max-w-md p-8"><Failed error={error} onRetry={reload} /></div>
      </AdminI18nProvider>
    )
  }
  if (!data) return null
  return (
    <AdminI18nProvider lang={data.language}>
      {/* Toasts are ADMIN-only (save and upload feedback), so the provider lives here. */}
      <ToastProvider>
        {/* Asking before something is lost, in this product's own grammar rather than the
            browser's. OUTSIDE the error boundary and outside the route, for the same reason
            the palette is: the navigation guard asks its question WHILE a page is being left,
            so the thing drawing it cannot be the thing being unmounted. */}
        <ConfirmProvider>
        {/* What changed, once, after an upgrade. Inside the providers because it saves — and
            outside the route for the reason the palette and the confirm dialog are: it is
            not about the screen somebody happens to be on. */}
        <WhatsNew version={data.version} seen={data.seenRelease} look={data.look} />
        {/* Outside the route and outside the error boundary: it is how you LEAVE a screen
            that has gone wrong, so it must not be inside the thing that went wrong. */}
        <CommandPalette />
        {/* `?` from anywhere. Its own component for the same reason the palette is one: a key
            listener that has to live inside a screen is a key that stops working on the
            screens that screen is not. */}
        <ShortcutSheet />
        {/* KEYED BY PATH, which is what makes the arrival possible: a new key mounts a new
              subtree, and `@starting-style` only fires on something that has just come into
              existence. The boundary was already keyed this way for its own reason — leaving a
              broken page is what resets it — so the class rides along rather than adding a
              wrapper. */}
          <ErrorBoundary key={`${path}#${nav}`}>
          {/* ⚠️ `min-w-0` AND `flex-1` MOVED TO THE SERVER, into the sheet column that
              `screens/content.ts` draws. Both are load-bearing and neither is tidy-up: a flex
              item defaults to `min-width:auto` and refuses to shrink below its content, which
              cost the editor its shrink chain and scrolled a phone sideways by 591px; and
              without `flex-1` the sheet sat at its content's width, 370px in a 1440px window
              with 445px of bare canvas beside it. */}
          {/* Reached on the FIRST paint only. Every later route change runs inside a
              transition, which keeps the current page on screen instead of falling back here.
              `Loading` with no shape — the shell does not yet know whether a list or a form is
              coming; the page's own `View` draws the right skeleton a moment later. */}
          <Suspense fallback={<Loading />}>
            <Route />
          </Suspense>
          </ErrorBoundary>
        </ConfirmProvider>
      </ToastProvider>
    </AdminI18nProvider>
  )
}

export function App() {
  // No `ThemeProvider`. The theme is the rail's island since ADR 0054 — it draws the control,
  // it owns the four modes, and the no-flash script in the head applies the answer before the
  // first paint. A second copy in React would be a second thing writing `.dark` on <html>.
  return (
    <RouterProvider>
      <TopProgress />
      <Shell />
    </RouterProvider>
  )
}
