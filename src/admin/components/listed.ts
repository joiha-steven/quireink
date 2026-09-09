// The row a piece has in the write pane, and the save that changes it.
//
// A save bumps no epoch (`useView.ts` says why: the editor would remount), so the pane
// beside the editor kept the list from before. A first save put the new piece nowhere and
// left no row selected; a rename left the row under its old name; a title typed and saved
// never reached the column standing beside it. `touchView('content')` is the fix, and this
// is the gate on it: the pane refetches only when something the ROW shows has changed —
// slug, title, status, the standing line — not on every autosave of the body, which would
// fetch the whole list (about 430 bytes a post) every few seconds while writing.
import { useCallback, useRef } from 'react'
import { touchView } from '@/admin/useView'

/**
 * Returns a function to call after every successful save with what the row now shows.
 * `opened` is what the row showed when the editor opened, so the first save of a piece that
 * did not change any of it costs nothing; `null` for a piece that has no row yet.
 */
export function useListedRow(opened: (string | null | undefined)[] | null): (row: (string | null | undefined)[]) => void {
  const last = useRef(opened === null ? '' : JSON.stringify(opened))
  return useCallback((row) => {
    const sig = JSON.stringify(row)
    if (sig === last.current) return
    last.current = sig
    touchView('content')
  }, [])
}

/**
 * The piece the address bar says is open, for the pane's selected row.
 *
 * The router's path is not it: a first save and a rename move the address with
 * `history.replaceState` and deliberately leave the router alone (`PostForm` says why), so
 * the router still names the slug from before the save — the row of a piece just created
 * or renamed matched nothing, and the pane showed no selection while the editor sat open
 * on it. The bar is synced on every save, so the bar is what is open.
 */
export function pieceAtPath(pathname: string): { kind: 'post' | 'page' | 'note'; slug: string } | null {
  const m = /^\/admin\/(editor|page-editor|note-editor)\/([^/?#]+)/.exec(pathname)
  if (!m) return null
  const kind = m[1] === 'editor' ? 'post' : m[1] === 'page-editor' ? 'page' : 'note'
  try {
    return { kind, slug: decodeURIComponent(m[2]!) }
  } catch {
    return null
  }
}
