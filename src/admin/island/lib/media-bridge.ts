// The three things every part of the library screen needs to ask the admin for, and one upload.
//
// The toast and the confirm dialog are still React, mounted beside this page by `App.tsx`. An
// island that imported them would pull React in behind it, so both go out as events — the
// bridge ADR 0054 established.
import type { FileItem, MediaItem } from '@/types'
import { uploadAttachments, uploadImages } from '@/admin/upload-client'

export type Words = Partial<Record<string, string>>

export const say = (message: string, kind?: 'error'): void => {
  window.dispatchEvent(new CustomEvent('quire:toast', { detail: { message, kind } }))
}

/**
 * The question, in the product's own grammar rather than the browser's.
 *
 * ⚠️ IF NOTHING ANSWERS, NOTHING HAPPENS. An unheard question is a REFUSAL, which is the only
 * outcome that cannot be regretted in front of a control that deletes in batches.
 */
export const ask = (w: Words, title: string, body: string): Promise<boolean> =>
  new Promise((resolve) => {
    const unheard = window.dispatchEvent(new CustomEvent('quire:confirm', {
      cancelable: true,
      detail: {
        request: { title, body, confirmLabel: w.yes ?? '', cancelLabel: w.no ?? '', danger: true },
        respond: (answer: string) => resolve(answer === 'confirm'),
      },
    }))
    if (unheard) resolve(false)
  })

/** A session that died while the page was open answers 401 to everything. Say so once. */
export async function owned(res: Response): Promise<boolean> {
  if (res.status !== 401) return true
  location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
  return false
}

type Well = {
  button: HTMLElement
  input: HTMLInputElement
  bar: HTMLElement
}

/** The drop well's three parts, if this panel has one. */
export function wellIn(root: ParentNode, kind: 'media' | 'file'): Well | null {
  const button = root.querySelector<HTMLElement>(`[data-${kind}-drop]`)
  const input = root.querySelector<HTMLInputElement>(`[data-${kind}-file]`)
  const bar = root.querySelector<HTMLElement>(`[data-${kind}-progress]`)
  return button && input && bar ? { button, input, bar } : null
}

/**
 * Drop, or click, or reach it with the keyboard.
 *
 * The well is a real `<button>` and the file input is hidden OUTSIDE it, because a form control
 * inside a button is not something a browser has to honour. Dragging DEEPENS the well: the two
 * faces are in `admin-shared/kit.ts` so the server and this file cannot disagree about them.
 */
export function wireWell(
  well: Well,
  classes: { idle: string; over: string },
  take: (files: File[]) => void,
): void {
  const face = (over: boolean): void => {
    well.button.className = well.button.className.replace(over ? classes.idle : classes.over,
      over ? classes.over : classes.idle)
  }
  well.button.addEventListener('click', () => well.input.click())
  well.button.addEventListener('dragover', (e) => { e.preventDefault(); face(true) })
  well.button.addEventListener('dragleave', () => face(false))
  well.button.addEventListener('drop', (e) => {
    e.preventDefault()
    face(false)
    take([...((e as DragEvent).dataTransfer?.files ?? [])])
  })
  well.input.addEventListener('change', () => {
    take([...(well.input.files ?? [])])
    well.input.value = ''
  })
}

/** A transform, not a width: the fill scales on the compositor instead of re-laying out. */
function progress(bar: HTMLElement, pct: number | null): void {
  bar.hidden = pct === null
  if (pct === null) return
  bar.setAttribute('aria-valuenow', String(Math.round(pct)))
  const fill = bar.firstElementChild
  if (fill instanceof HTMLElement) fill.style.transform = `scaleX(${pct / 100})`
}

export async function sendImages(well: Well, files: File[], w: Words): Promise<MediaItem[] | null> {
  const images = files.filter((f) => f.type.startsWith('image/'))
  if (images.length === 0) return null
  progress(well.bar, 0)
  try {
    const items = await uploadImages(images, (pct) => progress(well.bar, pct))
    say(w.uploaded ?? '')
    return items
  } catch (err) {
    const bad = err instanceof Error && err.message === 'unsupported_type'
    say((bad ? w.badType : w.uploadFailed) ?? '', 'error')
    return null
  } finally {
    progress(well.bar, null)
  }
}

export async function sendFiles(well: Well, files: File[], w: Words): Promise<FileItem[] | null> {
  if (files.length === 0) return null
  progress(well.bar, 0)
  try {
    const items = await uploadAttachments(files, (pct) => progress(well.bar, pct))
    say(w.uploaded ?? '')
    return items
  } catch {
    say(w.uploadFailed ?? '', 'error')
    return null
  } finally {
    progress(well.bar, null)
  }
}
