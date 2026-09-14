// CHOOSING A PICTURE, for whichever screen asked.
//
// The library page draws its own grid; this is the same grid in an overlay, opened over the
// editor, over Settings, over anything. It is reached only through `quire:pick-media`, which is
// the fourth bridge ADR 0054 defines — the first one that answers back.
//
// ⚠️ IT IS A REAL DIALOG NOW, and the React picker was not. That one had no `role`, no
// `aria-modal`, no Escape, no focus trap and no focus restore: it was a `fixed inset-0` div with
// a Close button, so a keyboard was free to tab into the page behind it and Escape did nothing.
//
// Loaded on demand. The rail island is on every admin page and imports this only when the event
// arrives, so a page that never opens a picker never downloads one.
import type { MediaItem } from '@/types'
import { formatBytes } from '@/i18n/format'
import { OVERLAY, buttonClass } from '@/admin-shared/kit'
import { mediaTileMark, type MediaWords } from '@/admin-shared/media-marks'
import { elOf } from './mark-dom'
import { wireGrid } from './media-grid'
import { say } from './media-bridge'

export type PickWords = MediaWords & {
  title: string; titleMulti: string; hintMulti: string; add: string; close: string
  loadFailed: string
}

export type PickRequest = {
  multi?: boolean
  words: PickWords
  /** One picture, several, or nothing at all when the owner closed it. */
  respond: (answer: { url: string; alt?: string } | { urls: string[] } | null) => void
}

const GRID = 'grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4'

let open: HTMLElement | null = null

export async function openPicker(req: PickRequest): Promise<void> {
  if (open) return
  const multi = Boolean(req.multi)
  const came = document.activeElement
  let answered = false

  const scrim = document.createElement('div')
  scrim.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
  const panel = document.createElement('div')
  panel.className = `flex max-h-[85vh] w-full max-w-3xl flex-col p-5 ${OVERLAY}`
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-label', multi ? req.words.titleMulti : req.words.title)

  const head = document.createElement('div')
  head.className = 'mb-4 flex items-center justify-between'
  const title = document.createElement('h2')
  title.className = 'text-lg font-bold'
  title.textContent = multi ? req.words.titleMulti : req.words.title
  const keys = document.createElement('div')
  keys.className = 'flex items-center gap-2'
  const add = document.createElement('button')
  add.type = 'button'
  add.className = buttonClass('primary')
  add.hidden = true
  const shutKey = document.createElement('button')
  shutKey.type = 'button'
  shutKey.className = buttonClass('ghost')
  shutKey.textContent = req.words.close
  keys.append(add, shutKey)
  head.append(title, keys)

  const hint = document.createElement('p')
  hint.className = 'mb-3 text-sm leading-6 text-neutral-500 dark:text-neutral-400'
  hint.textContent = req.words.hintMulti
  hint.hidden = !multi

  const body = document.createElement('div')
  body.className = 'overflow-y-auto'
  const grid = document.createElement('div')
  grid.className = GRID
  body.append(grid)

  panel.append(head, hint, body)
  scrim.append(panel)
  document.body.append(scrim)
  open = scrim

  function finish(answer: Parameters<PickRequest['respond']>[0]): void {
    if (answered) return
    answered = true
    scrim.remove()
    open = null
    document.removeEventListener('keydown', onKey, true)
    if (came instanceof HTMLElement) came.focus()
    req.respond(answer)
  }

  /** Escape closes; Tab is kept inside, which is what `aria-modal` promises. */
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); finish(null); return }
    if (e.key !== 'Tab') return
    const stops = [...panel.querySelectorAll<HTMLElement>(
      'button:not([hidden]):not([disabled]), input:not([disabled]), a[href]',
    )].filter((el) => el.offsetParent !== null)
    if (stops.length === 0) return
    const first = stops[0]!
    const last = stops[stops.length - 1]!
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  document.addEventListener('keydown', onKey, true)
  scrim.addEventListener('click', (e) => { if (e.target === scrim) finish(null) })
  shutKey.addEventListener('click', () => finish(null))
  shutKey.focus()

  // ---- the pictures ----------------------------------------------------------------------

  try {
    const res = await fetch('/api/media')
    const json = await res.json() as { success?: boolean; data?: MediaItem[] }
    const items = json.data ?? []
    for (const m of items) {
      grid.append(elOf(mediaTileMark(m, req.words, {
        mode: 'picker',
        tickable: multi,
        sizeLabel: formatBytes(m.size),
        title: m.filename,
      })))
    }
  } catch {
    say(req.words.loadFailed, 'error')
    finish(null)
    return
  }

  const wired = wireGrid(grid)
  if (multi) {
    wired.onChange(() => {
      const n = wired.picked().length
      add.hidden = n === 0
      add.textContent = `${req.words.add} (${n})`
    })
    add.addEventListener('click', () => finish({ urls: wired.picked() }))
  }

  // A tile chooses rather than zooms here. In `multi` the tick is the control and the picture
  // toggles it, which is what the React face did.
  grid.addEventListener('click', (e) => {
    const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-open]')
    if (!hit?.dataset.open) return
    if (multi) { wired.pick(hit.dataset.open, false); return }
    const tile = hit.closest<HTMLElement>('[data-media]')
    finish({ url: hit.dataset.open, alt: tile?.dataset.alt })
  })
}
