// THE ATTRIBUTES PANEL'S CONTROLS, wired to the draft.
//
// Every field the server drew carries `data-k`, which is the draft key it writes; the four
// shapes that are more than a value — a set of terms, a name with suggestions, a picture, a date
// — carry a wrapper instead and are wired by hand below. Nothing here BUILDS a control: the
// markup is complete and this only listens to it, shows and hides.
import type { SheetDraft, SheetWords } from '@/admin-shared/sheet-wire'
import type { SiteLang } from '@/types'
import { CONTROL } from '@/admin-shared/kit'
import { el } from '@/admin/components/node-dom'
import { wireDate, type DateField } from './sheet-calendar'
import { safeImageSrc } from '@/md/html-rules'

export type Picked = { url: string; alt?: string } | { urls: string[] } | null

/**
 * ASK FOR A PICTURE. The overlay lives in the rail's island and answers a `CustomEvent`.
 *
 * ⚠️ IF NOTHING ANSWERS, NOTHING HAPPENS. A page whose island failed to load must not leave a
 * caller awaiting a promise that never settles, so an unheard ask resolves null — the same
 * answer as closing it.
 */
export function askForPicture(t: SheetWords, multi = false): Promise<Picked> {
  return new Promise<Picked>((resolve) => {
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
  })
}

type Edit = (patch: Partial<SheetDraft>) => void

/** The plain fields: one element, one key, one value. */
function wirePlain(root: HTMLElement, draft: SheetDraft, edit: Edit): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-k]')) {
    const key = node.dataset.k as keyof SheetDraft
    if (!key || node.closest('[data-chips]') || node.closest('[data-pick]')) continue
    if (node instanceof HTMLInputElement && node.type === 'radio') {
      node.addEventListener('change', () => {
        if (node.checked) edit({ [key]: node.value } as Partial<SheetDraft>)
      })
      continue
    }
    if (node instanceof HTMLInputElement && node.dataset.dateBox !== undefined) continue
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      const numeric = node instanceof HTMLInputElement && node.type === 'number'
      node.addEventListener('input', () => {
        edit({ [key]: numeric ? Number(node.value) || 0 : node.value } as Partial<SheetDraft>)
      })
    }
    void draft
  }
}

/**
 * A SET OF TERMS. Every term not yet chosen is on offer — no cap, because a taxonomy the writer
 * cannot see is one they re-create by typing a near-miss of a category that already exists — and
 * the box filters those offers by substring as it is typed into.
 */
function wireChips(
  box: HTMLElement, draft: SheetDraft, edit: Edit, removeAria: string,
): () => void {
  const key = box.dataset.chips as 'categories' | 'tags'
  const chosen = box.querySelector<HTMLElement>('[data-chip-chosen]')
  const offers = box.querySelector<HTMLElement>('[data-chip-offers]')
  const entry = box.querySelector<HTMLInputElement>('[data-chip-box]')
  if (!chosen || !offers || !key) return () => {}
  const lower = box.querySelector('[data-chip-add]')?.className.includes('lowercase') ?? false

  const paint = (): void => {
    const held = draft[key]
    chosen.replaceChildren()
    for (const term of held) {
      const chip = el('span', {
        className: 'flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-xs'
          + ` text-white dark:bg-neutral-200 dark:text-neutral-900${lower ? ' lowercase' : ''}`,
        'data-chip': term,
      })
      chip.textContent = term
      const drop = el('button', { type: 'button', 'data-chip-drop': '', 'aria-label': removeAria })
      drop.textContent = '×'
      drop.addEventListener('click', () => { edit({ [key]: held.filter((x) => x !== term) } as Partial<SheetDraft>); paint() })
      chip.appendChild(drop)
      chosen.appendChild(chip)
    }
    const needle = (entry?.value ?? '').trim().toLowerCase()
    let any = false
    for (const offer of offers.querySelectorAll<HTMLElement>('[data-chip-add]')) {
      const term = offer.dataset.chipAdd ?? ''
      const show = !held.includes(term) && (!needle || term.toLowerCase().includes(needle))
      offer.hidden = !show
      any = any || show
    }
    offers.hidden = !any
  }

  const add = (term: string): void => {
    const value = term.trim()
    const held = draft[key]
    if (!value || held.includes(value)) return
    edit({ [key]: [...held, value] } as Partial<SheetDraft>)
    if (entry) entry.value = ''
    paint()
  }

  for (const offer of offers.querySelectorAll<HTMLElement>('[data-chip-add]')) {
    offer.addEventListener('click', () => add(offer.dataset.chipAdd ?? ''))
  }
  entry?.addEventListener('input', paint)
  entry?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    add(entry.value)
  })
  paint()
  // Handed back so a whole draft pushed in from outside — a revision, a restored snapshot —
  // repaints the terms too. It used not to, and a restore that changed the categories left the
  // old chips on screen over a draft that no longer held them: the one state on this panel that
  // is not an input's `value` and so not covered by the loop that writes them.
  return paint
}

/** Free text with a list under it: a series that may already exist, or may be new. */
function wirePick(box: HTMLElement, edit: Edit): void {
  const key = box.dataset.pick as keyof SheetDraft
  const entry = box.querySelector<HTMLInputElement>('[data-pick-box]')
  const list = box.querySelector<HTMLElement>('[data-pick-list]')
  if (!entry || !list || !key) return

  const paint = (): void => {
    const needle = entry.value.trim().toLowerCase()
    let shown = 0
    for (const row of list.querySelectorAll<HTMLElement>('[data-pick-one]')) {
      const term = (row.dataset.pickOne ?? '').toLowerCase()
      // An exact match is dropped: there is nothing left to pick.
      const show = shown < 8 && term.includes(needle) && term !== needle
      row.parentElement!.hidden = !show
      if (show) shown += 1
    }
    list.hidden = shown === 0
  }
  const shut = (): void => { list.hidden = true }

  for (const row of list.querySelectorAll<HTMLElement>('[data-pick-one]')) {
    // `mousedown`, not `click`, so the pick lands before the blur closes the list.
    row.addEventListener('mousedown', (e) => {
      e.preventDefault()
      entry.value = row.dataset.pickOne ?? ''
      edit({ [key]: entry.value } as Partial<SheetDraft>)
      shut()
    })
  }
  entry.addEventListener('input', () => { edit({ [key]: entry.value } as Partial<SheetDraft>); paint() })
  entry.addEventListener('focus', paint)
  entry.addEventListener('keydown', (e) => { if (e.key === 'Escape') shut() })
  document.addEventListener('mousedown', (e) => { if (!box.contains(e.target as Node)) shut() })
  shut()
}

/** A picture: both slots are in the markup, so this only swaps which one is hidden. */
function wirePicture(box: HTMLElement, t: SheetWords, edit: Edit): void {
  const key = box.dataset.picture as keyof SheetDraft
  const shot = box.querySelector<HTMLImageElement>('[data-picture-shot]')
  const empty = box.querySelector<HTMLElement>('[data-picture-empty]')
  const drop = box.querySelector<HTMLButtonElement>('[data-picture-drop]')
  const pick = box.querySelector<HTMLButtonElement>('[data-picture-pick]')
  if (!shot || !empty || !drop || !pick || !key) return

  const show = (url: string): void => {
    shot.src = url
    shot.hidden = !url
    empty.hidden = !!url
    drop.hidden = !url
    edit({ [key]: url } as Partial<SheetDraft>)
  }
  pick.addEventListener('click', () => {
    void askForPicture(t).then((got) => {
      if (got && 'url' in got) show(got.url)
    })
  })
  drop.addEventListener('click', () => show(''))
}

export type PanelFields = {
  /** Push a whole draft in — a revision loaded, or a snapshot restored. */
  apply: (draft: SheetDraft) => void
  destroy: () => void
}

/** Wire every control on the panel. `edit` is called with the keys that changed, and nothing else. */
export function wireFields(
  root: HTMLElement, t: SheetWords, lang: SiteLang, draft: SheetDraft, edit: Edit,
): PanelFields {
  wirePlain(root, draft, edit)
  const chips: (() => void)[] = []
  for (const box of root.querySelectorAll<HTMLElement>('[data-chips]')) {
    chips.push(wireChips(box, draft, edit, t.removeAria))
  }
  for (const box of root.querySelectorAll<HTMLElement>('[data-pick]')) wirePick(box, edit)
  for (const box of root.querySelectorAll<HTMLElement>('[data-picture]')) wirePicture(box, t, edit)

  const dates: DateField[] = []
  for (const box of root.querySelectorAll<HTMLElement>('[data-date]')) {
    dates.push(wireDate(box, t, lang, draft.date, (next) => edit({ date: next }), CONTROL))
  }

  // Drawn and hidden: an order with no series to order is a question about nothing.
  const order = root.querySelector<HTMLElement>('[data-series-order]')
  const seriesBox = root.querySelector<HTMLInputElement>('[data-pick="series"] [data-pick-box]')
  const syncOrder = (): void => { if (order) order.hidden = (seriesBox?.value ?? '').trim() === '' }
  seriesBox?.addEventListener('input', syncOrder)

  return {
    apply: (next: SheetDraft) => {
      for (const node of root.querySelectorAll<HTMLElement>('[data-k]')) {
        const key = node.dataset.k as keyof SheetDraft
        if (!key || !(key in next)) continue
        if (node instanceof HTMLInputElement && node.type === 'radio') {
          node.checked = String(next[key]) === node.value
        } else if (node instanceof HTMLInputElement && node.dataset.dateBox !== undefined) {
          // The date field writes its own box, in the shape it accepts.
        } else if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
          node.value = String(next[key] ?? '')
        }
      }
      for (const field of dates) field.setValue(next.date)
      for (const repaint of chips) repaint()
      for (const box of root.querySelectorAll<HTMLElement>('[data-picture]')) {
        const key = box.dataset.picture as keyof SheetDraft
        // ⚠️ THE PAGE'S OWN GUARD, not a second one. A draft's picture field is a stored
        // string and this line puts it straight into an `<img src>`; the published page has
        // scheme-checked an image address since 2026-09-04 and this side never did. No
        // browser executes a `javascript:` URL in `src`, so this closes a disagreement rather
        // than a hole — and the disagreement is the thing that drifts (CodeQL alert 44).
        const url = safeImageSrc(String(next[key] ?? ''))
        const shot = box.querySelector<HTMLImageElement>('[data-picture-shot]')
        const empty = box.querySelector<HTMLElement>('[data-picture-empty]')
        const drop = box.querySelector<HTMLElement>('[data-picture-drop]')
        if (shot) { shot.src = url; shot.hidden = !url }
        if (empty) empty.hidden = !!url
        if (drop) drop.hidden = !url
      }
      syncOrder()
    },
    destroy: () => { for (const field of dates) field.destroy() },
  }
}
