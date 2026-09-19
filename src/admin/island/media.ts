// The library screen's behaviour (ADR 0054): three kinds in one sheet, and the picker it lends
// to the screens that are still React.
//
// EVERY TILE, EVERY PLAYER AND EVERY ROW ARRIVED AS MARKUP. This file hides, moves and ticks
// what the server sent; the only thing it builds is a tile for a picture that did not exist
// when the page was drawn, and it builds that from the same description the server used.
//
// ⚠️ The kind is in the ADDRESS now. `replaceState`, not `pushState`: three kinds are one
// screen, and Back should leave the library rather than walk the ones clicked through — the
// same rule the trash and the newsletter follow.
import type { SiteLang } from '@/types'
import { wireImages } from './lib/media-images'
import { wireAttachments } from './lib/media-attachments'
import type { Words } from './lib/media-bridge'
import { showTab } from './lib/tab-strip'
import { MEDIA_VIEW_KEYS, type MediaKind } from '@/admin-shared/rail'

const root = document.querySelector<HTMLElement>('[data-screen="media"]')

if (root) {
  const screen: HTMLElement = root
  const words = JSON.parse(screen.dataset.mediaWords ?? '{}') as Words
  const lang = (screen.dataset.lang ?? 'en') as SiteLang
  const panels = [...screen.querySelectorAll<HTMLElement>('[data-media-panel]')]
  const tools = screen.querySelector<HTMLElement>('[data-media-tools]')
  const strip = screen.querySelector<HTMLElement>('[data-media-tabs]')
  const ON = strip?.querySelector<HTMLElement>('[aria-pressed="true"]')?.className ?? ''
  const OFF = strip?.querySelector<HTMLElement>('[aria-pressed="false"]')?.className ?? ''

  /** How many pictures there are decides whether the tools row belongs on screen at all. */
  const anyImages = (): boolean => screen.querySelectorAll('[data-media]').length > 0

  function swap(kind: string): void {
    screen.dataset.mediaTab = kind
    const url = new URL(location.href)
    if (kind === 'images') url.searchParams.delete('tab')
    else url.searchParams.set('tab', kind)
    history.replaceState(history.state, '', url)
    for (const p of panels) p.hidden = p.dataset.mediaPanel !== kind
    // A tab that is not on screen must not leave its tools in the sheet's first row.
    if (tools) tools.hidden = kind !== 'images' || !anyImages()
    for (const b of strip?.querySelectorAll<HTMLElement>('[data-tab]') ?? []) {
      const on = b.dataset.tab === kind
      b.setAttribute('aria-pressed', String(on))
      b.className = on ? ON : OFF
    }
    showTab(strip)
  }

  // ── grid or list ──────────────────────────────────────────────────────────────────────
  // ONE ATTRIBUTE, on `<html>`, where the boot script already put it before the first paint.
  // Nothing is rebuilt and nothing is measured: the stylesheet holds both layouts for all three
  // kinds, and this only says which one is asked for.
  const viewKeys = screen.querySelector<HTMLElement>('[data-media-view-keys]')
  viewKeys?.addEventListener('click', (e) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-media-view-key]')
    const view = key?.dataset.mediaViewKey
    if (view !== 'grid' && view !== 'list') return
    // The keys belong to whichever tab is open, and the tab is already on the screen's root —
    // so the pair does not have to be redrawn when the kind changes, and the stylesheet reads
    // both facts for itself.
    const kind = screen.dataset.mediaTab as MediaKind | undefined
    if (!kind || !(kind in MEDIA_VIEW_KEYS)) return
    document.documentElement.setAttribute(`data-media-view-${kind}`, view)
    try { localStorage.setItem(MEDIA_VIEW_KEYS[kind], view) } catch { /* a private window still switches */ }
  })

  strip?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')
    if (b?.dataset.tab) swap(b.dataset.tab)
  })

  // On arrival too: the server draws the selected tab, so the painter above has never run
  // when the page opens, and a strip too wide for a phone opens showing the wrong end.
  showTab(strip)

  for (const panel of panels) {
    const kind = panel.dataset.mediaPanel
    if (kind === 'images') wireImages(panel, tools, words, lang)
    else if (kind === 'videos') wireAttachments(panel, words, 'video')
    else if (kind === 'files') wireAttachments(panel, words, 'file')
  }
}
