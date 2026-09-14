// ASKING FOR A PICTURE, from a screen that is still React.
//
// The picker is a plain-TS overlay now (`island/lib/media-picker.ts`), lent to whoever asks by
// the rail island. React reaches it the way every island reaches React: a CustomEvent on
// `window` — except this one answers back, so the detail carries a callback and the hook wraps
// the pair in a promise.
//
// The words travel WITH the ask. The overlay opens over the editor and over Settings, neither
// of which carries the library's own `data-*` words, and a translation table in the island
// would be a second copy of eleven dictionaries.
import { useCallback } from 'react'
import { useAdminT } from './I18nProvider'

export type Picked = { url: string; alt?: string } | { urls: string[] } | null

/**
 * Opens the picker and resolves with what was chosen, or `null` if it was closed.
 *
 * ⚠️ IF NOTHING ANSWERS, NOTHING HAPPENS. The overlay lives in an island; a page whose island
 * failed to load must not leave a caller awaiting a promise that never settles, so an unheard
 * ask resolves `null` — the same answer as closing it.
 */
export function usePickMedia(): (multi?: boolean) => Promise<Picked> {
  const t = useAdminT()
  return useCallback((multi = false) => new Promise<Picked>((resolve) => {
    const heard = !window.dispatchEvent(new CustomEvent('quire:pick-media', {
      cancelable: true,
      detail: {
        multi,
        words: {
          title: t.mediaTitle, titleMulti: t.galleryPickTitle, hintMulti: t.galleryPickHint,
          add: t.galleryAdd, close: t.close, loadFailed: t.loadMediaFailed,
          copyUrl: t.copyUrl, download: t.download, delete: t.delete, unusedBadge: t.unusedBadge,
        },
        respond: resolve,
      },
    }))
    if (!heard) resolve(null)
  }), [t])
}
