// THE PALETTE EDITOR: six cards, six colour tables, and the two lists behind them.
//
// Two settings with no control of their own live here. `themePreset` is which palette the blog
// wears; `enabledPalettes` is which of them a reader may switch to. Both ride hidden fields
// carrying `data-was`, because an `input[type=hidden]` keeps `value` and `defaultValue` in
// lockstep and could otherwise never be seen to change.
//
// ⚠️ WHICH CARD IS OPEN IS NOT A SETTING. Pressing a card opens its colour table; it does not
// make that palette the blog's. Making it the blog's is a second, named press — and the row
// holding it appears only while the two disagree, so a card pressed to LOOK at a palette cannot
// quietly become a card that changed the site.
import { THEME_PRESETS } from '@/content/themes'

const moved = (el: HTMLElement): void => { el.dispatchEvent(new Event('input', { bubbles: true })) }

const hidden = (screen: HTMLElement, k: string): HTMLInputElement | null =>
  screen.querySelector<HTMLInputElement>(`input[data-k="${k}"]`)

export function wireTheme(screen: HTMLElement): void {
  const found = screen.querySelector<HTMLElement>('[data-palette-track]')
  if (!found) return
  const track: HTMLElement = found
  const ON = track.dataset.cardOn ?? ''
  const OFF = track.dataset.cardOff ?? ''

  const openId = (): string =>
    track.querySelector<HTMLElement>('[data-palette-pick][aria-pressed="true"]')?.dataset.palettePick ?? ''

  /** Which card is being LOOKED at, and which table is therefore on screen. */
  function open(id: string): void {
    for (const key of track.querySelectorAll<HTMLElement>('[data-palette-pick]')) {
      const on = key.dataset.palettePick === id
      key.setAttribute('aria-pressed', String(on))
      // The two faces come off the TRACK, and each card keeps its own `border-dashed`: that
      // dash says "a reader cannot choose this one", and copying a face off a sibling would
      // spread one palette's visibility to all six.
      const dashed = key.closest<HTMLElement>('[data-palette-card]')?.dataset.paletteHidden === '1'
      key.className = `${on ? ON : OFF}${dashed ? ' border-dashed' : ''}`
      const card = key.closest<HTMLElement>('[data-palette-card]')
      for (const face of card?.querySelectorAll<HTMLElement>('[data-card-name]') ?? []) {
        face.hidden = (face.dataset.cardName === 'on') !== on
      }
    }
    for (const table of screen.querySelectorAll<HTMLElement>('[data-palette-table]')) {
      table.hidden = table.dataset.paletteTable !== id
    }
    tellDefault()
  }

  /** The "Set as default" row shows only while the card being looked at is not the blog's. */
  function tellDefault(): void {
    const row = screen.querySelector<HTMLElement>('[data-palette-setdefault]')
    if (row) row.hidden = openId() === (hidden(screen, 'themePreset')?.value ?? '')
  }

  /**
   * WHICH PALETTES A READER MAY CHOOSE, rewritten from the ticks in preset order.
   *
   * The blog's own is always in the list, whatever its tick says: a reader switching away from
   * a palette that is not offered has nothing to switch back to. Its tick ships `disabled` for
   * the same reason.
   */
  function tellEnabled(): void {
    const field = hidden(screen, 'enabledPalettes')
    if (!field) return
    const wearing = hidden(screen, 'themePreset')?.value ?? ''
    const on: string[] = []
    for (const tick of screen.querySelectorAll<HTMLInputElement>('[data-palette-shown]')) {
      const id = tick.dataset.paletteShown ?? ''
      if (tick.checked || id === wearing) on.push(id)
      const card = tick.closest<HTMLElement>('[data-palette-card]')
      if (card) card.dataset.paletteHidden = tick.checked || id === wearing ? '0' : '1'
    }
    field.value = on.join(' ')
    moved(field)
    open(openId())
  }

  track.addEventListener('click', (e) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-palette-pick]')
    if (key?.dataset.palettePick) open(key.dataset.palettePick)
  })

  screen.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).matches('[data-palette-shown]')) tellEnabled()
  })

  screen.querySelector('[data-palette-make-default]')?.addEventListener('click', () => {
    const id = openId()
    const field = hidden(screen, 'themePreset')
    if (!field || !id) return
    field.value = id
    moved(field)
    for (const pill of screen.querySelectorAll<HTMLElement>('[data-card-default]')) {
      pill.hidden = pill.closest<HTMLElement>('[data-palette-card]')?.dataset.paletteCard !== id
    }
    // The blog's own palette is always offered, and its tick stops being pressable.
    for (const tick of screen.querySelectorAll<HTMLInputElement>('[data-palette-shown]')) {
      const mine = tick.dataset.paletteShown === id
      tick.disabled = mine
      if (mine) tick.checked = true
    }
    tellEnabled()
  })

  /** Back to the palette's own built-in inks, in both the hex field and the picker beside it. */
  screen.addEventListener('click', (e) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-reset-palette]')
    const id = key?.dataset.resetPalette
    if (!id) return
    const preset = THEME_PRESETS.find((p) => p.id === id)
    if (!preset) return
    const table = screen.querySelector<HTMLElement>(`[data-palette-table="${id}"]`)
    for (const field of table?.querySelectorAll<HTMLInputElement>('input[data-k]') ?? []) {
      const path = (field.dataset.k ?? '').split('.')
      const scheme = path[path.length - 2] as 'light' | 'dark'
      const name = path[path.length - 1] ?? ''
      const colours = (preset as unknown as Record<string, Record<string, string>>)[scheme]
      const built = colours?.[name]
      if (built === undefined) continue
      field.value = built.replace(/^#/, '').toUpperCase()
      moved(field)
      const echo = table?.querySelector<HTMLInputElement>(`input[data-k-echo="${field.dataset.k}"]`)
      if (echo) {
        echo.value = built.startsWith('#') ? built : `#${built}`
        const well = echo.parentElement
        if (well instanceof HTMLElement) well.style.background = echo.value
      }
    }
  })

  tellDefault()
}
