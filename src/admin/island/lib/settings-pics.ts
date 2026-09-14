// THE THREE WAYS A PICTURE GETS INTO SETTINGS, wired.
//
// A logo, a portrait and the sharing fallback come out of the media library, which is an overlay
// island now — asked for with `quire:pick-media`, the fourth bridge (ADR 0054). The favicon and
// the app icon do not: they go straight to the files store, deliberately, because a favicon is
// not a picture in the blog and putting it in the library would leave it there to be deleted by
// somebody tidying up.
//
// ⚠️ THE VALUE LIVES IN A HIDDEN FIELD, AND THE HIDDEN FIELD CARRIES `data-was`. An
// `input[type=hidden]` keeps `value` and `defaultValue` in lockstep, so without that baseline a
// chosen logo is drawn on screen and never sent.
import { say } from './media-bridge'

export type PicWords = Partial<Record<string, string>>

const show = (el: Element | null, on: boolean): void => {
  if (el instanceof HTMLElement) el.hidden = !on
}

/** Tell the form something moved, in the language every other control speaks. */
const moved = (el: HTMLElement): void => {
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Put a url into one picture block and make every part of it agree. */
function paint(box: HTMLElement, url: string): void {
  const field = box.querySelector<HTMLInputElement>('input[data-k]')
  if (field) { field.value = url; moved(field) }
  const img = box.querySelector<HTMLImageElement>('[data-pick-preview], [data-icon-preview]')
  if (img) { img.src = url; img.hidden = url === '' }
  show(box.querySelector('[data-pick-slot], [data-icon-slot]'), url === '')
  show(box.querySelector('[data-pick-none], [data-icon-none]'), url === '')
  show(box.querySelector('[data-pick-clear], [data-icon-clear]'), url !== '')
}

export function wirePics(screen: HTMLElement, w: PicWords): void {
  screen.addEventListener('click', (e) => {
    const target = e.target as HTMLElement

    const open = target.closest<HTMLElement>('[data-pick-open]')
    if (open) {
      const box = open.closest<HTMLElement>('[data-pick-image]')
      if (box) void fromLibrary(box, w)
      return
    }

    const clear = target.closest<HTMLElement>('[data-pick-clear], [data-icon-clear]')
    if (clear) {
      const box = clear.closest<HTMLElement>('[data-pick-image], [data-icon]')
      if (box) paint(box, '')
      return
    }

    const choose = target.closest<HTMLElement>('[data-icon-open]')
    if (choose) {
      choose.closest<HTMLElement>('[data-icon]')?.querySelector<HTMLInputElement>('[data-icon-file]')?.click()
    }
  })

  screen.addEventListener('change', (e) => {
    const input = e.target
    if (!(input instanceof HTMLInputElement) || !input.dataset.iconFile) return
    const box = input.closest<HTMLElement>('[data-icon]')
    const file = input.files?.[0]
    if (box && file) void toFileStore(box, file, w)
    input.value = ''
  })
}

/**
 * ASK THE LIBRARY, which is an island of its own.
 *
 * ⚠️ IF NOTHING ANSWERS, NOTHING HAPPENS. The overlay is loaded on demand by the rail island; a
 * page whose island failed to load must not leave this awaiting a promise that never settles, so
 * an unheard ask resolves the same way closing it does.
 */
function fromLibrary(box: HTMLElement, w: PicWords): Promise<void> {
  return new Promise((resolve) => {
    const heard = !window.dispatchEvent(new CustomEvent('quire:pick-media', {
      cancelable: true,
      detail: {
        multi: false,
        words: {
          title: w.pickTitle ?? '', titleMulti: w.pickTitleMulti ?? '', hintMulti: w.pickHint ?? '',
          add: w.pickAdd ?? '', close: w.close ?? '', loadFailed: w.loadFailed ?? '',
          copyUrl: w.copyUrl ?? '', download: w.download ?? '', delete: w.delete ?? '',
          unusedBadge: w.unusedBadge ?? '',
        },
        respond: (answer: { url?: string } | null) => {
          if (answer && answer.url) paint(box, answer.url)
          resolve()
        },
      },
    }))
    if (heard) resolve()
  })
}

/**
 * A SITE ICON goes straight to the files store.
 *
 * `POST /api/files/upload` takes the file and the kind; nothing about it touches the media
 * library, and the settings record only ever holds the url that comes back.
 */
async function toFileStore(box: HTMLElement, file: File, w: PicWords): Promise<void> {
  const key = box.querySelector<HTMLButtonElement>('[data-icon-open]')
  const label = key?.textContent ?? ''
  if (key) { key.disabled = true; key.textContent = w.loading ?? '' }
  try {
    const body = new FormData()
    body.append('file', file)
    body.append('kind', box.dataset.icon ?? '')
    const res = await fetch('/api/files/upload', { method: 'POST', body })
    if (res.status === 401) {
      location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
      return
    }
    const json = await res.json() as { success?: boolean; data?: { url: string } }
    if (!json.success || !json.data) throw new Error('failed')
    paint(box, json.data.url)
    say(w.uploaded ?? '')
  } catch {
    say(w.uploadFailed ?? '', 'error')
  } finally {
    if (key) { key.disabled = false; key.textContent = label }
  }
}
