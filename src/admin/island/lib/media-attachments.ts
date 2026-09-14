// The videos and files tabs: tick rows, delete a batch, copy a URL, add more.
//
// One function for both, because they are the same list twice — the same store, the same
// delete, the same upload — drawn as players on one tab and as rows on the other. The React
// face had them as two components with the fetch, the selection and the delete written out
// separately in each.
//
// `POST /api/files/delete` is a SOFT delete: the trash gives an attachment back until it is
// purged. It still asks first.
import type { FileItem } from '@/types'
import { DROPZONE_IDLE, DROPZONE_OVER } from '@/admin-shared/kit'
import { ask, owned, say, sendFiles, wellIn, wireWell, type Words } from './media-bridge'

const show = (el: Element | null, on: boolean): void => {
  if (el instanceof HTMLElement) el.hidden = !on
}

export function wireAttachments(panel: HTMLElement, w: Words, kind: 'video' | 'file'): void {
  const list = panel.querySelector<HTMLElement>(`[data-${kind}-list]`)
  const empty = panel.querySelector<HTMLElement>(`[data-${kind}-empty]`)
  const bar = panel.querySelector<HTMLElement>(`[data-${kind}-bar]`)
  const count = bar?.querySelector<HTMLElement>('[data-pick-count]') ?? null

  const rows = (): HTMLElement[] => [...panel.querySelectorAll<HTMLElement>('[data-file]')]
  const boxes = (): HTMLInputElement[] => [...panel.querySelectorAll<HTMLInputElement>('input[data-pick]')]
  const picked = (): string[] => boxes().filter((b) => b.checked).map((b) => b.dataset.pick ?? '')

  function retell(): void {
    const n = picked().length
    if (count) count.textContent = String(n)
    show(bar, n > 0)
  }

  function recount(): void {
    // The icons list is not deletable and is not counted here: it belongs to Settings, and this
    // tab lists it only so the owner can see the space being used.
    const left = list?.querySelectorAll('[data-file]').length ?? 0
    show(list, left > 0)
    const icons = panel.querySelectorAll('[data-file]').length - left
    show(empty, left === 0 && icons === 0)
    show(panel.querySelector('[data-file-lists]'), left > 0 || icons > 0)
    show(panel.querySelector('[data-video-list]'), left > 0)
  }

  panel.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).matches('input[data-pick]')) retell()
  })

  bar?.querySelector('[data-pick-clear]')?.addEventListener('click', () => {
    for (const b of boxes()) b.checked = false
    retell()
  })

  bar?.querySelector('[data-pick-delete]')?.addEventListener('click', async () => {
    const urls = picked()
    if (urls.length === 0) return
    if (!await ask(w, (w.askMany ?? '').replace('{n}', String(urls.length)), w.noUndo ?? '')) return
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ urls }),
      })
      if (!await owned(res)) return
      const json = await res.json() as { success?: boolean; data?: FileItem[] }
      if (!json.success || !json.data) throw new Error('failed')
      const alive = new Set(json.data.map((f) => f.url))
      for (const row of rows()) if (!alive.has(row.dataset.file ?? '')) row.remove()
      retell()
      recount()
      say(w.trashed ?? '')
    } catch {
      say(w.deleteFailed ?? '', 'error')
    }
  })

  panel.addEventListener('click', (e) => {
    const copy = (e.target as HTMLElement).closest<HTMLElement>('[data-copy]')
    if (copy?.dataset.copy) void navigator.clipboard.writeText(copy.dataset.copy).then(() => say(w.copied ?? ''))
  })

  const well = wellIn(panel, 'file')
  if (well && list) {
    wireWell(well, { idle: DROPZONE_IDLE, over: DROPZONE_OVER }, (files) => {
      void sendFiles(well, files, w).then((items) => {
        if (!items) return
        // A page load is the honest answer here: which of the two tabs a new attachment belongs
        // on is `isVideoAttachment`'s decision, and that lives on the server. Reloading puts
        // every one of them where the server says it goes, and an upload is rare enough that
        // one page load costs nothing.
        location.reload()
      })
    })
  }

  retell()
  recount()
}
