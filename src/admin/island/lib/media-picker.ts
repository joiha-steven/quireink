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
import { NOTE_TEXT } from '@/admin-shared/scale'
import { refusalWords, uploadImages } from '@/admin/upload-client'
import { mediaTileMark, type MediaWords } from '@/admin-shared/media-marks'
import { elOf } from './mark-dom'
import { wireGrid } from './media-grid'
import { say } from './media-bridge'
import { composing } from '@/admin/components/composing'

export type PickWords = MediaWords & {
  title: string; titleMulti: string; hintMulti: string; add: string; close: string
  loadFailed: string
  /**
   * AN ASKER THAT NAMES THESE GETS AN UPLOAD KEY AND AN EMPTY STATE. A first-time writer on
   * an empty library got a title and Close, and had to leave the piece for Library to put a
   * picture in it. The upload is the library's own (`upload-client.ts`), refusals and all.
   */
  upload?: string; uploading?: string; empty?: string; emptyHint?: string
  badType?: string; tooLarge?: string; noRoom?: string; uploadFailed?: string
}

export type PickRequest = {
  multi?: boolean
  words: PickWords
  /** One picture, several, or nothing at all when the owner closed it. */
  respond: (answer: { url: string; alt?: string } | { urls: string[] } | null) => void
}

const GRID = 'grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4'
/** What the library's own well accepts (`screens/media-images.ts`): the formats it can vary. */
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/svg+xml,image/gif'

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
  // `gap-3`: with the upload key in it the head's two ends met on a phone (title 37-144, key
  // from 144), and a long title wraps rather than shoving the keys off the panel.
  head.className = 'mb-4 flex items-center justify-between gap-3'
  const title = document.createElement('h2')
  title.className = 'min-w-0 text-lg font-bold'
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

  // ---- the upload key, and the empty state it is the answer to -------------------------------

  const w = req.words
  const file = document.createElement('input')
  file.type = 'file'
  file.accept = IMAGE_ACCEPT
  file.multiple = multi
  file.hidden = true
  const uploadKeys: HTMLButtonElement[] = []
  const uploadKey = (variant: 'primary' | 'secondary'): HTMLButtonElement => {
    const key = document.createElement('button')
    key.type = 'button'
    key.className = buttonClass(variant)
    key.textContent = w.upload ?? ''
    key.addEventListener('click', () => file.click())
    uploadKeys.push(key)
    return key
  }
  const headUpload = w.upload ? uploadKey('secondary') : null
  if (headUpload) keys.prepend(headUpload)

  // The library's empty state in this panel's own shape (`web/admin/kit.ts` `emptyState`):
  // what the state is, why it does not matter, and the one thing to do about it.
  const empty = document.createElement('div')
  empty.className = 'flex flex-col items-center justify-center px-6 py-16 text-center'
  empty.hidden = true
  if (w.empty) {
    const said = document.createElement('p')
    said.className = 'text-sm font-medium text-neutral-700 dark:text-neutral-300'
    said.textContent = w.empty
    empty.append(said)
    if (w.emptyHint && w.upload) {
      const why = document.createElement('p')
      why.className = `${NOTE_TEXT} mt-1.5 max-w-sm`
      why.textContent = w.emptyHint
      empty.append(why)
    }
    if (w.upload) {
      const row = document.createElement('div')
      row.className = 'mt-4'
      row.append(uploadKey('primary'))
      empty.append(row)
    }
  }

  const hint = document.createElement('p')
  hint.className = 'mb-3 text-sm leading-6 text-neutral-500 dark:text-neutral-400'
  hint.textContent = req.words.hintMulti
  hint.hidden = !multi

  const body = document.createElement('div')
  body.className = 'overflow-y-auto'
  const grid = document.createElement('div')
  grid.className = GRID
  body.append(empty, grid)

  panel.append(head, hint, body, file)
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
    if (composing(e)) return
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

  const tile = (m: MediaItem): Node => elOf(mediaTileMark(m, req.words, {
    mode: 'picker',
    tickable: multi,
    sizeLabel: formatBytes(m.size),
    title: m.filename,
  }))

  // ⚠️ A REFUSAL IS A FAILURE, NOT AN EMPTY LIBRARY. A `success: false` (a session that expired,
  // a 500) used to read as no pictures at all, and the empty state then offered an upload to a
  // writer whose library was full and whose session was gone.
  try {
    const res = await fetch('/api/media')
    const json = await res.json() as { success?: boolean; data?: MediaItem[] }
    if (!res.ok || !json.success || !Array.isArray(json.data)) throw new Error('media list refused')
    for (const m of json.data) grid.append(tile(m))
  } catch {
    say(req.words.loadFailed, 'error')
    finish(null)
    return
  }

  /** Nothing to choose from: say so, and keep the head's key out of the way of the big one. */
  const sayEmpty = (): void => {
    const none = grid.childElementCount === 0
    empty.hidden = !none || !w.empty
    if (headUpload) headUpload.hidden = none && Boolean(w.empty)
  }
  sayEmpty()

  const wired = wireGrid(grid)

  /**
   * UPLOAD, AND THEN THE ANSWER. One picture asked for is the picture uploaded — the writer
   * chose it by choosing the file. Several asked for come back as tiles already ticked, so the
   * gallery's Add key is one press away and the rest of the library is still on offer.
   */
  const busy = (on: boolean): void => {
    for (const key of uploadKeys) {
      key.disabled = on
      key.textContent = (on ? w.uploading : w.upload) ?? ''
    }
    panel.setAttribute('aria-busy', String(on))
  }
  file.addEventListener('change', () => {
    const files = [...(file.files ?? [])]
    file.value = ''
    if (files.length === 0) return
    busy(true)
    void uploadImages(multi ? files : files.slice(0, 1))
      .then((items) => {
        const first = items[0]
        if (!multi && first) { finish({ url: first.url, alt: first.alt || undefined }); return }
        for (const m of [...items].reverse()) grid.prepend(tile(m))
        for (const m of items) wired.pick(m.url, false)
        sayEmpty()
      })
      .catch((err: unknown) => {
        say(refusalWords(err, {
          badType: w.badType, tooLarge: w.tooLarge, noRoom: w.noRoom, failed: w.uploadFailed,
        }), 'error')
      })
      .finally(() => { if (!answered) busy(false) })
  })
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
    const chosen = hit.closest<HTMLElement>('[data-media]')
    finish({ url: hit.dataset.open, alt: chosen?.dataset.alt })
  })
}
