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
  }

  strip?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')
    if (b?.dataset.tab) swap(b.dataset.tab)
  })

  for (const panel of panels) {
    const kind = panel.dataset.mediaPanel
    if (kind === 'images') wireImages(panel, tools, words, lang)
    else if (kind === 'videos') wireAttachments(panel, words, 'video')
    else if (kind === 'files') wireAttachments(panel, words, 'file')
  }
}
