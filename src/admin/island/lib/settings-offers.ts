// WHAT AN INSTALLED THEME ADDS TO THE PICKERS, on the form (ADR 0072, T2c part 2).
//
// The server draws every installed theme's palettes and reading and chrome fonts into the pickers,
// each marked `data-theme-option="<theme id>"` (`web/admin/screens/settings-appearance-offers.ts`).
// They are choices only while their theme is the chosen one, so here they show only while its tile
// is the pressed one, saved or not, and this keeps WHAT THE FORM SHOWS THE SAME AS WHAT A SAVE STORES:
//
//   · A pick that is no longer on offer goes back to the drawn baseline when that is on offer, else
//     to the engine's default, which is what the page would draw.
//   · The row's own value (`data-stored`) may be a theme's palette or font drawn as the default
//     while another theme was chosen; the server keeps it, and it is valid again the moment its
//     theme is. So when the pressed theme offers it, it is pressed again, unless the owner has
//     picked something in this edit.
//   · While the pressed theme is not the saved one, the palette, the reader's palettes and both
//     fonts are sent as shown (`data-k-force`, read by `partialOf`), so a stored value the screen
//     does not show can never be the one the page draws after the save.
//   · Two themes are written apart and may name a palette or a font alike, so every lookup asks for
//     an option that is ON OFFER (not hidden as another theme's), never for the first with an id.
//   · A theme font's tile is set in its own face. When the browser cannot load that face, the tile
//     says so in the admin's face rather than let a fallback pass for the theme's.
//   · One key moves the palette and both fonts to what the pressed theme suggests, unsaved, shown
//     only while some suggestion on offer differs from the pick.
//
// `applyThemeOffers` runs inside `applyGates` (`settings-controls.ts`), so every press of a tile and
// every redraw of the list passes through it; it is idempotent, and reads every answer off the DOM.
import { DEFAULT_CHROME_FONT, DEFAULT_FONT_PRESET, DEFAULT_PRESET_ID } from '@/content/themes'
import { pressKey } from './press-key'
import { isBuiltinThemeId } from '@/content/themes-builtin'
import { makeDefaultPalette, openPalette, openPaletteId, shownCard, tellEnabled } from './settings-theme'

type Suggested = { palette?: unknown; readingFont?: unknown; chromeFont?: unknown }

/** The two font tracks, by settings key, with the default the page draws when a pick is not on offer. */
const FONT_TRACKS = { fontPreset: DEFAULT_FONT_PRESET, chromeFont: DEFAULT_CHROME_FONT } as const
type FontKey = keyof typeof FONT_TRACKS
/** Which track each suggestion moves. */
const SUGGESTED_TRACK: Record<'readingFont' | 'chromeFont', FontKey> = { readingFont: 'fontPreset', chromeFont: 'chromeFont' }

const themeTile = (root: ParentNode): HTMLElement | null =>
  root.querySelector<HTMLElement>('[data-choice-track][data-k="theme"] [aria-pressed="true"]')

const trackOf = (root: ParentNode, k: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-choice-track][data-k="${CSS.escape(k)}"]`)

const pickIn = (track: HTMLElement): string =>
  track.querySelector<HTMLElement>('[data-choice][aria-pressed="true"]')?.dataset.choice ?? ''

/** The key for `value` that is on offer: drawn, and not hidden as another theme's. */
const shownKey = (track: HTMLElement, value: string): HTMLElement | null =>
  value ? [...track.querySelectorAll<HTMLElement>('[data-choice]')].find((k) => k.dataset.choice === value && !k.hidden) ?? null : null

const paletteField = (root: ParentNode): HTMLInputElement | null =>
  root.querySelector<HTMLInputElement>('input[data-k="themePreset"]')

const offered = (root: ParentNode, id: string): boolean => id !== '' && shownCard(root, id) !== null

/** Press `value` in a choice track, each key wearing its own face, as `pickChoice` does. */
function press(track: HTMLElement, value: string): void {
  for (const b of track.querySelectorAll<HTMLElement>('[data-choice]')) pressKey(b, b.dataset.choice === value)
  track.dataset.value = value
}

/** One font track after the tile moved (the rules at the top of the file). */
function settleTrack(root: HTMLElement, k: FontKey): void {
  const track = trackOf(root, k)
  if (!track) return
  const now = pickIn(track)
  const was = track.dataset.was ?? ''
  const stored = track.dataset.stored ?? was
  const back = shownKey(track, stored)
  if (track.dataset.pickedBy === undefined && now !== stored && back?.hasAttribute('data-theme-option')) {
    press(track, stored)
    return
  }
  const on = shownKey(track, now)
  if (on) {
    // Still on offer, perhaps as another theme's key of the same name: that one is pressed now.
    if (on.getAttribute('aria-pressed') !== 'true') press(track, now)
    return
  }
  press(track, shownKey(track, was) ? was : FONT_TRACKS[k])
  // The pick on screen is no longer anybody's hand.
  delete track.dataset.pickedBy
}

/** The default palette after the tile moved: the same rules, on the hidden field that holds it. */
function settlePalette(root: HTMLElement): void {
  const field = paletteField(root)
  if (!field) return
  const was = field.dataset.was ?? ''
  const stored = field.dataset.stored ?? was
  if (field.dataset.pickedBy === undefined && field.value !== stored && shownCard(root, stored)?.hasAttribute('data-theme-option')) {
    makeDefaultPalette(root, stored)
  } else if (!offered(root, field.value)) {
    makeDefaultPalette(root, offered(root, was) ? was : DEFAULT_PRESET_ID)
    delete field.dataset.pickedBy
  }
  // The card being looked at went with its theme: look at the blog's palette instead.
  if (!offered(root, openPaletteId(root))) openPalette(root, field.value)
}

/**
 * While the pressed theme is not the saved one, and an installed theme is either of them, the four
 * values go as shown (`data-k-force`): that is when a stored id the form does not show can come
 * back into force. Between two built-in themes nothing is forced, so a save sends only what the
 * owner moved and cannot write back a palette or font another tab or MCP changed meanwhile.
 */
function tellForce(root: HTMLElement): void {
  const track = trackOf(root, 'theme')
  if (!track) return
  const pressed = themeTile(root)?.dataset.choice ?? ''
  const was = track.dataset.was ?? ''
  const moved = pressed !== was && !(isBuiltinThemeId(pressed) && isBuiltinThemeId(was))
  const fields = [trackOf(root, 'fontPreset'), trackOf(root, 'chromeFont'), paletteField(root),
    root.querySelector<HTMLElement>('input[data-k="enabledPalettes"]')]
  for (const el of fields) el?.toggleAttribute('data-k-force', moved)
}

/** A theme font's tile whose face the browser could not load: said, in the admin's own face. */
function unloaded(tile: HTMLElement): void {
  console.warn(`settings: the font ${tile.dataset.themeFace ?? ''} of an installed theme did not load; its tile shows no sample`)
  tile.style.fontFamily = ''
  for (const el of tile.querySelectorAll<HTMLElement>('[data-theme-face-sample]')) el.hidden = true
  for (const el of tile.querySelectorAll<HTMLElement>('[data-theme-face-unloaded]')) el.hidden = false
}

/**
 * Ask the browser for the face of every theme font tile now shown, once each. A face that does not
 * load answers no face, or a rejection; either is said on the tile. `data-theme-face` is the family
 * the screen declares it under, one per package (`offerFamily`).
 */
function checkFaces(root: HTMLElement): void {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
  if (!fonts || typeof fonts.load !== 'function') return
  for (const tile of root.querySelectorAll<HTMLElement>('[data-theme-face]:not([hidden]):not([data-face-checked])')) {
    tile.setAttribute('data-face-checked', '')
    fonts.load(`16px "${tile.dataset.themeFace ?? ''}"`)
      .then((faces) => { if (faces.length === 0) unloaded(tile) }, () => unloaded(tile))
  }
}

function suggestedBy(tile: HTMLElement | null): Suggested {
  try {
    const parsed: unknown = JSON.parse(tile?.dataset.suggested || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Suggested : {}
  } catch {
    console.error('settings: a theme tile carries data-suggested that is not JSON', tile?.dataset.suggested)
    return {}
  }
}

type Move = { palette: string } | { track: HTMLElement; value: string }

/** What the pressed theme suggests that is on offer and is not the pick now. */
function pending(root: HTMLElement): Move[] {
  const wanted = suggestedBy(themeTile(root))
  const out: Move[] = []
  const palette = wanted.palette
  if (typeof palette === 'string' && offered(root, palette) && paletteField(root)?.value !== palette) out.push({ palette })
  for (const key of ['readingFont', 'chromeFont'] as const) {
    const value = wanted[key]
    const track = trackOf(root, SUGGESTED_TRACK[key])
    if (typeof value === 'string' && track && shownKey(track, value) && pickIn(track) !== value) out.push({ track, value })
  }
  return out
}

/** The suggestion key shows only while it would change something. */
export function tellSuggest(root: HTMLElement): void {
  const row = root.querySelector<HTMLElement>('[data-theme-suggest-row]')
  if (row) row.hidden = pending(root).length === 0
}

/** The pressed theme's options shown, every other theme's hidden, and the picks kept honest. */
export function applyThemeOffers(root: HTMLElement): void {
  const theme = themeTile(root)?.dataset.choice ?? ''
  for (const el of root.querySelectorAll<HTMLElement>('[data-theme-option]')) el.hidden = el.dataset.themeOption !== theme
  settleTrack(root, 'fontPreset')
  settleTrack(root, 'chromeFont')
  settlePalette(root)
  // The reader's palettes as the ticks on offer now say: the pressed theme's in, another's out.
  tellEnabled(root)
  tellForce(root)
  checkFaces(root)
  tellSuggest(root)
}

/** The boxes that hold what the installed themes add, beside the built-in options. */
const HOSTS = [
  '[data-choice-track][data-k="fontPreset"]', '[data-choice-track][data-k="chromeFont"]',
  '[data-palette-track]', '[data-palette-tables]',
]
const ADDED = ':scope > [data-theme-option], :scope > [data-theme-palette-note]'

/** The baseline and the row's value, taken from the fresh draw. */
function takeBaseline(here: HTMLElement | null, there: HTMLElement | null): void {
  if (!here || !there) return
  if (there.dataset.was !== undefined) here.dataset.was = there.dataset.was
  if (there.dataset.stored !== undefined) here.dataset.stored = there.dataset.stored
}

/**
 * After the Look card is drawn again (`settings-themes.ts`, `refresh`): what the installed themes
 * add is swapped for the fresh draw's in each picker, because a theme installed, rolled back or
 * removed adds or takes away options there too. The built-in options and every pick on the form
 * stay; `applyGates` then settles whatever went off offer. The baselines move to the fresh draw's,
 * as the theme track's does: removing the worn theme puts the page on the defaults while the row
 * keeps its ids, and the form should not call that an unsaved change of the owner's.
 */
export function swapOffers(root: HTMLElement, fresh: ParentNode): void {
  const looked = openPaletteId(root)
  for (const sel of HOSTS) {
    const here = root.querySelector<HTMLElement>(sel)
    const there = fresh.querySelector<HTMLElement>(sel)
    if (!here || !there) continue
    const pick = here.matches('[data-choice-track]') ? pickIn(here) : null
    if (pick !== null) takeBaseline(here, there)
    for (const old of here.querySelectorAll(ADDED)) old.remove()
    for (const el of there.querySelectorAll(ADDED)) here.append(document.importNode(el, true))
    // The fresh tiles are pressed as the STORED value is; the form's pick is what stays.
    if (pick !== null) press(here, pick)
  }
  const field = paletteField(root)
  takeBaseline(field, paletteField(fresh))
  takeBaseline(root.querySelector<HTMLElement>('input[data-k="enabledPalettes"]'), fresh.querySelector<HTMLElement>('input[data-k="enabledPalettes"]'))
  if (field) makeDefaultPalette(root, field.value)
  openPalette(root, offered(root, looked) ? looked : field?.value ?? '')
}

/** The suggestion key. Each move is made as the owner's own press would make it, so it counts. */
export function wireOffers(screen: HTMLElement): void {
  screen.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-theme-suggest]')) return
    for (const move of pending(screen)) {
      if ('palette' in move) {
        const field = paletteField(screen)
        if (field) field.dataset.pickedBy = 'owner'
        openPalette(screen, move.palette)
        makeDefaultPalette(screen, move.palette)
      } else {
        shownKey(move.track, move.value)?.click()
      }
    }
    tellSuggest(screen)
    // The key has just hidden itself; focus goes back to the tile whose suggestion it was.
    themeTile(screen)?.focus()
  })
  // A palette made the default, or anything else moved, may make the key true or false.
  screen.addEventListener('input', () => tellSuggest(screen))
}
