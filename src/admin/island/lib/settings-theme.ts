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

const hidden = (root: ParentNode, k: string): HTMLInputElement | null =>
  root.querySelector<HTMLInputElement>(`input[data-k="${k}"]`)

const trackIn = (root: ParentNode): HTMLElement | null => root.querySelector<HTMLElement>('[data-palette-track]')

/**
 * A card on offer: drawn and not hidden as another installed theme's. Two themes may both name a
 * palette `night`, so a card is never found by its id alone (`settings-offers.ts`).
 */
export const shownCard = (root: ParentNode, id: string): HTMLElement | null =>
  [...root.querySelectorAll<HTMLElement>('[data-palette-card]')].find((c) => c.dataset.paletteCard === id && !c.hidden) ?? null

/** The card being LOOKED at, whose table is on screen. */
export const openPaletteId = (root: ParentNode): string =>
  [...trackIn(root)?.querySelectorAll<HTMLElement>('[data-palette-pick][aria-pressed="true"]') ?? []]
    .find((k) => !k.closest<HTMLElement>('[data-palette-card]')?.hidden)?.dataset.palettePick ?? ''

/**
 * Which card is being LOOKED at, and which table is therefore on screen.
 *
 * `root` is any box that holds the palette card: the screen, or the panels `settings-controls.ts`
 * is wired on. Module functions rather than closures, because what an installed theme adds to the
 * grid comes and goes with its tile (`settings-offers.ts`), and that code moves the same state.
 */
export function openPalette(root: HTMLElement, id: string): void {
  const track = trackIn(root)
  if (!track) return
  const ON = track.dataset.cardOn ?? ''
  const OFF = track.dataset.cardOff ?? ''
  for (const key of track.querySelectorAll<HTMLElement>('[data-palette-pick]')) {
    const on = key.dataset.palettePick === id
    key.setAttribute('aria-pressed', String(on))
    // The two faces come off the TRACK, and each card keeps its own `border-dashed`: that
    // dash says "a reader cannot choose this one", and copying a face off a sibling would
    // spread one palette's visibility to all six. `data-card-extra` is a card's own layout
    // (an installed theme's card stretches to its row), kept the same way.
    const dashed = key.closest<HTMLElement>('[data-palette-card]')?.dataset.paletteHidden === '1'
    const extra = key.dataset.cardExtra ? ` ${key.dataset.cardExtra}` : ''
    key.className = `${on ? ON : OFF}${dashed ? ' border-dashed' : ''}${extra}`
    const card = key.closest<HTMLElement>('[data-palette-card]')
    for (const face of card?.querySelectorAll<HTMLElement>('[data-card-name]') ?? []) {
      face.hidden = (face.dataset.cardName === 'on') !== on
    }
  }
  // A theme's note opens with ITS card, not with a card of another theme that shares the id.
  const owner = shownCard(root, id)?.dataset.themeOption ?? ''
  for (const table of root.querySelectorAll<HTMLElement>('[data-palette-table]')) {
    table.hidden = table.dataset.paletteTable !== id || (table.dataset.themePaletteNote ?? '') !== owner
  }
  tellDefault(root)
}

/** The "Set as default" row shows only while the card being looked at is not the blog's. */
function tellDefault(root: HTMLElement): void {
  const row = root.querySelector<HTMLElement>('[data-palette-setdefault]')
  if (row) row.hidden = openPaletteId(root) === (hidden(root, 'themePreset')?.value ?? '')
}

/**
 * WHICH PALETTES A READER MAY CHOOSE, rewritten from the ticks on offer in their order: the
 * built-in ones, then the pressed theme's (`settings-offers.ts` shows and hides those). A card
 * hidden as another theme's is not on offer and is left out; the save keeps such ids where the
 * row has them (`enabledPalettesFor`).
 *
 * The blog's own is always in the list, whatever its tick says: a reader switching away from
 * a palette that is not offered has nothing to switch back to. Its tick ships `disabled` for
 * the same reason.
 */
export function tellEnabled(root: HTMLElement): void {
  const field = hidden(root, 'enabledPalettes')
  if (!field) return
  const wearing = hidden(root, 'themePreset')?.value ?? ''
  const on: string[] = []
  for (const tick of root.querySelectorAll<HTMLInputElement>('[data-palette-shown]')) {
    const id = tick.dataset.paletteShown ?? ''
    const card = tick.closest<HTMLElement>('[data-palette-card]')
    if (card?.hidden) continue
    if (tick.checked || id === wearing) on.push(id)
    if (card) card.dataset.paletteHidden = tick.checked || id === wearing ? '0' : '1'
  }
  const value = on.join(' ')
  if (field.value !== value) {
    field.value = value
    moved(field)
  }
  openPalette(root, openPaletteId(root))
}

/** Make `id` the blog's default palette, on the form and unsaved, as "Set as default" does. */
export function makeDefaultPalette(root: HTMLElement, id: string): void {
  const field = hidden(root, 'themePreset')
  if (!field || !id) return
  field.value = id
  moved(field)
  for (const pill of root.querySelectorAll<HTMLElement>('[data-card-default]')) {
    pill.hidden = pill.closest<HTMLElement>('[data-palette-card]')?.dataset.paletteCard !== id
  }
  // The blog's own palette is always offered, and its tick stops being pressable. A tick that was
  // pressed only because its palette was the default goes back, when the default leaves it, to what
  // the owner had: their tick from before it became the default, else the saved list (`data-shown-saved`). Left pressed,
  // a theme palette that was never shown to visitors came back ticked with its theme.
  for (const tick of root.querySelectorAll<HTMLInputElement>('[data-palette-shown]')) {
    const mine = tick.dataset.paletteShown === id
    if (mine && !tick.disabled) tick.dataset.wasChecked = tick.checked ? '1' : '0'
    if (!mine && tick.disabled) {
      const before = tick.dataset.wasChecked
      tick.checked = before === undefined ? tick.hasAttribute('data-shown-saved') : before === '1'
      delete tick.dataset.wasChecked
    }
    tick.disabled = mine
    if (mine) tick.checked = true
  }
  tellEnabled(root)
}

export function wireTheme(screen: HTMLElement): void {
  const track = trackIn(screen)
  if (!track) return

  track.addEventListener('click', (e) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-palette-pick]')
    if (key?.dataset.palettePick) openPalette(screen, key.dataset.palettePick)
  })

  screen.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).matches('[data-palette-shown]')) tellEnabled(screen)
  })

  screen.querySelector('[data-palette-make-default]')?.addEventListener('click', () => {
    // The owner's own hand: a theme's stored palette coming back with its tile never overrides it.
    const field = hidden(screen, 'themePreset')
    if (field) field.dataset.pickedBy = 'owner'
    makeDefaultPalette(screen, openPaletteId(screen))
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

  tellDefault(screen)
}
