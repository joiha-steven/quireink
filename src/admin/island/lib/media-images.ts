// The pictures tab's behaviour: choosing, narrowing, sorting, uploading, deleting, sweeping.
//
// ⚠️ TWO OF THE CONTROLS IN HERE COST REAL MONEY OR REAL ROWS, and both are one click:
// `/api/media/describe-missing` answers 200 at once and then loops the owner's paid vision model
// over every undescribed picture in the background, and "Delete all unused" soft-deletes a batch.
// The delete asks first; the describe does not, and that is how the React face had it.
//
// NOTHING HERE REBUILDS A TILE THE SERVER SENT. Narrowing hides, sorting moves, choosing swaps
// two class strings. The one thing it builds is a tile for a picture that did not exist when the
// page was drawn — an upload — and it builds it from the same description the server drew the
// others from (`admin-shared/media-marks.ts`).
import type { MediaItem, SiteLang } from '@/types'
import { formatBytes, formatDate } from '@/i18n/format'
import { DROPZONE_IDLE, DROPZONE_OVER } from '@/admin-shared/kit'
import { mediaTileMark, type MediaWords } from '@/admin-shared/media-marks'
import { elOf } from './mark-dom'
import { wireGrid } from './media-grid'
import { ask, owned, say, sendImages, wellIn, wireWell, type Words } from './media-bridge'

const show = (el: Element | null, on: boolean): void => {
  if (el instanceof HTMLElement) el.hidden = !on
}

export function wireImages(panel: HTMLElement, tools: HTMLElement | null, w: Words, lang: SiteLang): void {
  const grid = wireGrid(panel)
  const host = panel.querySelector<HTMLElement>('[data-media-grid]')
  const empty = panel.querySelector<HTMLElement>('[data-media-empty]')
  const none = panel.querySelector<HTMLElement>('[data-media-none]')
  const actions = panel.querySelector<HTMLElement>('[data-media-actions]')
  const pickedN = panel.querySelector<HTMLElement>('[data-media-picked]')
  const unusedN = panel.querySelector<HTMLElement>('[data-media-unused]')
  const countN = tools?.querySelector<HTMLElement>('[data-media-count]') ?? null
  const bytesN = tools?.querySelector<HTMLElement>('[data-media-bytes]') ?? null
  const find = tools?.querySelector<HTMLInputElement>('[data-media-find]') ?? null
  const sort = tools?.querySelector<HTMLSelectElement>('[data-media-sort]') ?? null
  const onlyUnused = panel.querySelector<HTMLElement>('[data-media-only-unused]')

  const words: MediaWords = {
    copyUrl: w.copyUrl ?? '', download: w.download ?? '', delete: w.delete ?? '',
    unusedBadge: w.unusedBadge ?? '',
  }

  /** How many pictures there are, and what they weigh — over the WHOLE library, not the view. */
  function retotal(): void {
    const all = grid.tiles()
    if (countN) countN.textContent = String(all.length)
    if (bytesN) bytesN.textContent = formatBytes(all.reduce((n, el) => n + Number(el.dataset.size ?? 0), 0))
    show(tools, all.length > 0)
    show(actions, all.length > 0)
    show(host, all.length > 0)
    show(empty, all.length === 0)
  }

  /** Narrow, then say which of the two empty states applies. */
  function refilter(): void {
    const left = grid.narrow(find?.value ?? '')
    const any = grid.tiles().length > 0
    show(host, any && left > 0)
    show(none, any && left === 0)
    show(empty, !any)
  }

  grid.onChange(() => {
    const n = grid.picked().length
    if (pickedN) pickedN.textContent = String(n)
    show(panel.querySelector('[data-media-clear]'), n > 0)
    show(panel.querySelector('[data-media-del-picked]'), n > 0)
  })

  find?.addEventListener('input', refilter)
  sort?.addEventListener('change', () => {
    const by = sort.value
    grid.order(by === 'name' || by === 'size' ? by : 'new')
  })
  panel.querySelector('[data-media-clear]')?.addEventListener('click', () => grid.clear())

  // ---- what leaves the library ----------------------------------------------------------

  /** The server's post-delete list is the truth: it is built from the rows it just wrote. */
  function keepOnly(urls: string[]): void {
    const alive = new Set(urls)
    for (const el of grid.tiles()) if (!alive.has(el.dataset.media ?? '')) el.remove()
    retotal()
    refilter()
  }

  async function remove(urls: string[], title: string): Promise<void> {
    if (!await ask(w, title, w.noUndo ?? '')) return
    try {
      const res = urls.length === 1
        ? await fetch(`/api/media/by?url=${encodeURIComponent(urls[0]!)}`, { method: 'DELETE' })
        : await fetch('/api/media/delete', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ urls }),
        })
      if (!await owned(res)) return
      const json = await res.json() as { success?: boolean; data?: MediaItem[] }
      if (!json.success || !json.data) throw new Error('failed')
      keepOnly(json.data.map((m) => m.url))
      // If a url is STILL in the returned list the server matched nothing — say so loudly
      // rather than leaving the picture silently sitting there.
      if (urls.some((u) => json.data!.some((m) => m.url === u))) { say(w.noMatch ?? '', 'error'); return }
      grid.clear()
      say(w.trashed ?? '')
    } catch {
      say(w.deleteFailed ?? '', 'error')
    }
  }

  panel.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const copy = target.closest<HTMLElement>('[data-copy]')
    if (copy?.dataset.copy) {
      void navigator.clipboard.writeText(copy.dataset.copy).then(() => say(w.copied ?? ''))
      return
    }
    const del = target.closest<HTMLElement>('[data-del]')
    if (del?.dataset.del) {
      const name = del.dataset.del.split('/').pop() ?? del.dataset.del
      void remove([del.dataset.del], (w.askOne ?? '').replace('{name}', name))
    }
  })

  panel.querySelector('[data-media-del-picked]')?.addEventListener('click', () => {
    const urls = grid.picked()
    if (urls.length === 0) return
    void remove(urls, (w.askMany ?? '').replace('{n}', String(urls.length)))
  })

  // ---- what arrives ----------------------------------------------------------------------

  const well = wellIn(panel, 'media')
  if (well) {
    wireWell(well, { idle: DROPZONE_IDLE, over: DROPZONE_OVER }, (files) => {
      void sendImages(well, files, w).then((items) => {
        if (!items || !host) return
        // Newest first, which is the order the library is drawn in and the sort it opens on.
        for (const m of [...items].reverse()) host.prepend(elOf(mediaTileMark(m, words, {
          mode: 'page',
          tickable: true,
          sizeLabel: formatBytes(m.size),
          title: `${m.filename}\n${m.width && m.height ? `${m.width}×${m.height} · ` : ''}`
            + `${formatBytes(m.size)} · ${formatDate(m.uploadedAt, lang)}`,
        })))
        retotal()
        refilter()
      })
    })
  }

  // ---- the three sweeps ------------------------------------------------------------------

  const mark = (urls: Set<string>): void => {
    for (const el of grid.tiles()) {
      const hit = urls.has(el.dataset.media ?? '')
      el.dataset.unusedNow = hit ? '1' : '0'
      show(el.querySelector('[data-unused]'), hit)
    }
    if (unusedN) unusedN.textContent = String(urls.size)
    show(panel.querySelector('[data-media-del-unused]'), urls.size > 0)
    show(onlyUnused, urls.size > 0)
  }

  panel.querySelector('[data-media-check]')?.addEventListener('click', async () => {
    const button = panel.querySelector<HTMLButtonElement>('[data-media-check]')
    if (button) button.disabled = true
    try {
      const res = await fetch('/api/media/unused')
      if (!await owned(res)) return
      const json = await res.json() as { success?: boolean; data?: string[] }
      if (!json.success || !json.data) throw new Error('failed')
      mark(new Set(json.data))
      if (json.data.length === 0) { say(w.none ?? ''); return }
      // Finding them turns the filter ON, because the answer to "which are unused" is the list.
      for (const el of grid.tiles()) el.dataset.onlyUnused = '1'
      if (onlyUnused) onlyUnused.textContent = onlyUnused.dataset.on ?? ''
      refilter()
      say(`${w.found ?? ''}: ${json.data.length}`)
    } catch {
      say(w.checkFailed ?? '', 'error')
    } finally {
      if (button) button.disabled = false
    }
  })

  onlyUnused?.addEventListener('click', () => {
    const on = grid.tiles()[0]?.dataset.onlyUnused === '1'
    for (const el of grid.tiles()) el.dataset.onlyUnused = on ? '0' : '1'
    onlyUnused.textContent = (on ? onlyUnused.dataset.off : onlyUnused.dataset.on) ?? ''
    refilter()
  })

  panel.querySelector('[data-media-del-unused]')?.addEventListener('click', () => {
    const urls = grid.tiles().filter((el) => el.dataset.unusedNow === '1').map((el) => el.dataset.media ?? '')
    if (urls.length === 0) return
    void remove(urls, (w.askUnused ?? '').replace('{n}', String(urls.length))).then(() => {
      for (const el of grid.tiles()) el.dataset.onlyUnused = '0'
      mark(new Set())
      refilter()
    })
  })

  panel.querySelector('[data-media-describe]')?.addEventListener('click', async () => {
    const button = panel.querySelector<HTMLButtonElement>('[data-media-describe]')
    if (button) button.disabled = true
    try {
      const res = await fetch('/api/media/describe-missing', { method: 'POST' })
      if (!await owned(res)) return
      const json = await res.json() as { success?: boolean; data?: { queued: number }; error?: string }
      if (!json.success || !json.data) {
        const why = json.error === 'ai_cannot_see_images' ? w.noVision : w.noModel
        say(why ?? '', 'error')
        return
      }
      say(`${w.describing ?? ''}: ${json.data.queued}`)
    } catch {
      say(w.deleteFailed ?? '', 'error')
    } finally {
      if (button) button.disabled = false
    }
  })

  // ---- the picture, full size -------------------------------------------------------------

  panel.addEventListener('click', (e) => {
    const open = (e.target as HTMLElement).closest<HTMLElement>('[data-open]')
    if (!open?.dataset.open) return
    const tile = open.closest<HTMLElement>('[data-media]')
    zoom(open.dataset.open, tile?.dataset.name ?? '', open.getAttribute('aria-label') ?? '')
  })

  /** The scrim closes it; the picture does not, so a click to look closer is not a click away. */
  function zoom(url: string, _name: string, label: string): void {
    const scrim = document.createElement('div')
    scrim.className = 'fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 p-4'
    const img = document.createElement('img')
    img.src = url
    img.alt = label
    img.className = 'max-h-[85vh] max-w-full rounded-lg object-contain'
    img.addEventListener('click', (e) => e.stopPropagation())
    scrim.append(img)
    const shut = (): void => { scrim.remove(); document.removeEventListener('keydown', onKey) }
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') shut() }
    scrim.addEventListener('click', shut)
    document.addEventListener('keydown', onKey)
    document.body.append(scrim)
  }

  retotal()
}
