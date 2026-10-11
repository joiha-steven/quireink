// What an installed theme adds to the palette and font pickers, on the form (ADR 0072, T2c part 2):
// the server's own markup (`appearanceTab`, `postTab`), the islands that wire it, and the form's
// own diff, which is what the Save key counts and sends.
//
// Proved here: pressing the theme's tile offers its palettes and fonts and pressing another takes
// them away; a pick of one goes back to what is stored, or to the default the page would draw, and
// comes back with its theme; the suggestion key shows only when it would change something and
// moves all three; the settings the theme draws itself are hidden as the Newspaper's are; a face
// that does not load says so; and a redraw of the list brings a new theme's options.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { THEME_PRESETS } from '@/content/themes'
import type { ThemeOffer } from '@/content/installed-themes'
import type { SiteSettings } from '@/types'
import { appearanceTab } from '@/web/admin/screens/settings-appearance'
import { postTab } from '@/web/admin/screens/settings-post'
import { applyGates, wireControls } from './lib/settings-controls'
import { changedCount, fieldsIn, partialOf } from './lib/settings-form'
import { wireTheme } from './lib/settings-theme'
import { wireType } from './lib/settings-type'
import { swapOffers, wireOffers } from './lib/settings-offers'
import { INKWELL, INKWELL_OFFER } from '@/test/theme-offer'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const t = adminT('en')
const markup = (s: SiteSettings, offers: ThemeOffer[] = [INKWELL_OFFER]): string =>
  appearanceTab(t, s, { presets: THEME_PRESETS, installed: offers.map((o) => ({ ...INKWELL, id: o.id })), offers, health: { ok: true } })
  + postTab(t, s)

let screen: HTMLElement
let box: HTMLElement
function draw(over: Partial<SiteSettings> = {}): void {
  document.body.innerHTML = ''
  screen = document.createElement('div')
  screen.dataset.screen = 'settings'
  box = document.createElement('div')
  box.setAttribute('data-settings-panels', '')
  box.innerHTML = markup({ ...DEFAULT_SETTINGS, ...over })
  screen.appendChild(box)
  document.body.appendChild(screen)
  wireControls(box, () => {})
  wireType(screen)
  wireTheme(screen)
  wireOffers(screen)
}

const tile = (id: string) => box.querySelector<HTMLElement>(`[data-choice-track][data-k="theme"] [data-choice="${id}"]`)!
const key = (k: string, id: string) => box.querySelector<HTMLElement>(`[data-choice-track][data-k="${k}"] [data-choice="${id}"]`)!
const pick = (k: string) => box.querySelector<HTMLElement>(`[data-choice-track][data-k="${k}"] [aria-pressed="true"]`)?.dataset.choice
const shown = (sel: string) => [...box.querySelectorAll<HTMLElement>(sel)].filter((el) => !el.hidden)
const partial = () => partialOf(fieldsIn(box))
const count = () => changedCount(fieldsIn(box))
const preset = () => box.querySelector<HTMLInputElement>('input[data-k="themePreset"]')!.value
/** Make `id` the default palette the way the owner does: open its card, then "Set as default". */
function makeDefault(id: string): void {
  box.querySelector<HTMLElement>(`[data-palette-pick="${id}"]`)!.click()
  box.querySelector<HTMLElement>('[data-palette-make-default]')!.click()
}
const suggestRow = () => box.querySelector<HTMLElement>('[data-theme-suggest-row]')!

beforeEach(() => draw())

describe('switching tiles', () => {
  it('offers the theme’s palettes and fonts while its tile is pressed, and takes them away on another', () => {
    expect(shown('[data-theme-option]')).toHaveLength(0)
    tile('inkwell').click()
    expect(shown('[data-theme-option]').map((el) => el.dataset.themeOption)).toEqual(['inkwell', 'inkwell', 'inkwell', 'inkwell'])
    tile('paper').click()
    expect(shown('[data-theme-option]')).toHaveLength(0)
    expect(count()).toBe(1)
  })

  it('a theme palette and fonts picked, then another tile: the stored choices come back and only the theme is unsaved', () => {
    draw({ theme: 'notes', themePreset: 'sepia', fontPreset: 'inter', chromeFont: 'plex-mono' })
    tile('inkwell').click()
    makeDefault('ink-paper')
    key('fontPreset', 'ink-serif').click()
    key('chromeFont', 'ink-sans').click()
    expect(partial()).toMatchObject({ theme: 'inkwell', themePreset: 'ink-paper', fontPreset: 'ink-serif', chromeFont: 'ink-sans' })
    // The default joins the reader's palettes, so that list moved too.
    expect(count()).toBe(5)
    tile('plain').click()
    expect([preset(), pick('fontPreset'), pick('chromeFont')]).toEqual(['sepia', 'inter', 'plex-mono'])
    // One change, and only it is sent: the three it put back are the saved values, and between two
    // built-in themes nothing is forced.
    expect(count()).toBe(1)
    expect(partial()).toEqual({ theme: 'plain' })
    // The default's pill moved back with it, and the card being looked at is on offer.
    expect(shown('[data-card-default]').map((p) => p.closest<HTMLElement>('[data-palette-card]')!.dataset.paletteCard)).toEqual(['sepia'])
    expect(box.querySelector('[data-palette-pick][aria-pressed="true"]')!.closest('[data-palette-card]')!.hasAttribute('hidden')).toBe(false)
  })

  it('stored theme choices go to the page’s defaults on another tile, counted, and come back with the theme', () => {
    draw({ theme: 'inkwell', themePreset: 'ink-night', fontPreset: 'ink-serif', chromeFont: 'ink-sans' })
    expect(count()).toBe(0)
    tile('plain').click()
    expect([preset(), pick('fontPreset'), pick('chromeFont')]).toEqual(['mono', 'literata', 'inter'])
    expect(partial()).toMatchObject({ theme: 'plain', themePreset: 'mono', fontPreset: 'literata', chromeFont: 'inter' })
    tile('inkwell').click()
    expect([preset(), pick('fontPreset'), pick('chromeFont')]).toEqual(['ink-night', 'ink-serif', 'ink-sans'])
    expect(count()).toBe(0)
  })

  it('a pick the owner made in between is kept when the theme comes back', () => {
    draw({ theme: 'inkwell', fontPreset: 'ink-serif' })
    tile('plain').click()
    key('fontPreset', 'inter').click()
    tile('inkwell').click()
    expect(pick('fontPreset')).toBe('inter')
  })

  it('picking a theme font leaves the type sizes as they are', async () => {
    tile('inkwell').click()
    const h1 = () => box.querySelector<HTMLInputElement>('input[data-k="typography.roles.h1.size"]')!.value
    const before = h1()
    key('fontPreset', 'ink-serif').click()
    await Promise.resolve()
    await Promise.resolve()
    expect(h1()).toBe(before)
    expect(Object.keys(partial()).some((k) => k.startsWith('typography'))).toBe(false)
  })

  it('a theme palette’s tick is the reader’s choice for it, like a built-in one’s, and goes with its tile', () => {
    draw({ theme: 'notes', enabledPalettes: ['mono', 'sepia'] })
    const enabled = () => box.querySelector<HTMLInputElement>('input[data-k="enabledPalettes"]')!.value
    tile('inkwell').click()
    const tick = (id: string) => box.querySelector<HTMLInputElement>(`[data-palette-shown="${id}"]`)!
    expect([tick('ink-paper').checked, tick('ink-paper').disabled]).toEqual([false, false])
    tick('ink-paper').click()
    tick('ink-night').click()
    expect(enabled()).toBe('mono sepia ink-paper ink-night')
    expect(partial()).toMatchObject({ theme: 'inkwell', enabledPalettes: ['mono', 'sepia', 'ink-paper', 'ink-night'] })
    // The default's tick is pressed and locked, as a built-in default's is.
    makeDefault('ink-night')
    expect([tick('ink-night').checked, tick('ink-night').disabled]).toEqual([true, true])
    tile('notes').click()
    expect(enabled()).toBe('mono sepia')
    expect(preset()).toBe('mono')
    expect(count()).toBe(0)
  })
})

describe('the suggestion key', () => {
  it('shows only while the pressed theme suggests something on offer that is not the pick, and moves all three', () => {
    expect(suggestRow().hidden).toBe(true)
    tile('inkwell').click()
    expect(suggestRow().hidden).toBe(false)
    // Pressing the tile moved nothing by itself.
    expect(count()).toBe(1)
    expect(partial()).toMatchObject({ theme: 'inkwell', themePreset: 'mono', fontPreset: 'literata', chromeFont: 'inter' })
    box.querySelector<HTMLElement>('[data-theme-suggest]')!.click()
    expect([preset(), pick('fontPreset'), pick('chromeFont')]).toEqual(['ink-paper', 'ink-serif', 'ink-sans'])
    expect(partial()).toMatchObject({ theme: 'inkwell', themePreset: 'ink-paper', fontPreset: 'ink-serif', chromeFont: 'ink-sans' })
    expect(suggestRow().hidden).toBe(true)
    // Picking away from one suggestion brings the key back.
    key('chromeFont', 'inter').click()
    expect(suggestRow().hidden).toBe(false)
  })

  it('a built-in theme’s suggestion: hidden when it already moved, offered when the owner had picked their own', () => {
    tile('code').click()
    expect(pick('chromeFont')).toBe('jetbrains-mono')
    expect(suggestRow().hidden).toBe(true)
    draw()
    key('chromeFont', 'plex-mono').click()
    tile('code').click()
    expect(pick('chromeFont')).toBe('plex-mono')
    expect(suggestRow().hidden).toBe(false)
    box.querySelector<HTMLElement>('[data-theme-suggest]')!.click()
    expect(pick('chromeFont')).toBe('jetbrains-mono')
    expect(suggestRow().hidden).toBe(true)
  })
})

describe('the settings an installed theme draws itself', () => {
  it('are hidden while its tile is pressed, with the line naming it, and back on another', () => {
    const control = () => box.querySelector<HTMLElement>('[data-ownable="table.head"]')!
    const note = () => box.querySelector<HTMLElement>('[data-owned-note="table.head"]')!
    draw({ theme: 'notes' })
    expect(control().hidden).toBe(false)
    tile('inkwell').click()
    expect(control().hidden).toBe(true)
    expect(note().hidden).toBe(false)
    expect(note().textContent).toContain('Inkwell')
    expect(box.querySelector<HTMLElement>('[data-ownable="table.grid"]')!.hidden).toBe(false)
    tile('plain').click()
    expect(control().hidden).toBe(false)
    expect(count()).toBe(1)
  })
})

describe('a face that does not load', () => {
  it('drops the sample and says so, in the admin’s own face', async () => {
    const fonts = { load: () => Promise.resolve([]) }
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true })
    try {
      draw()
      tile('inkwell').click()
      await new Promise((r) => setTimeout(r, 0))
      const serif = key('fontPreset', 'ink-serif')
      expect(serif.style.fontFamily).toBe('')
      expect(serif.querySelector<HTMLElement>('[data-theme-face-sample]')!.hidden).toBe(true)
      expect(serif.querySelector<HTMLElement>('[data-theme-face-unloaded]')!.hidden).toBe(false)
    } finally {
      Reflect.deleteProperty(document, 'fonts')
    }
  })

  it('keeps the face when it loads', async () => {
    const fonts = { load: () => Promise.resolve([{}]) }
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true })
    try {
      draw()
      tile('inkwell').click()
      await new Promise((r) => setTimeout(r, 0))
      const serif = key('fontPreset', 'ink-serif')
      expect(serif.style.fontFamily).toContain(`theme-${INKWELL_OFFER.hash}-ink-serif`)
      expect(serif.querySelector<HTMLElement>('[data-theme-face-unloaded]')!.hidden).toBe(true)
    } finally {
      Reflect.deleteProperty(document, 'fonts')
    }
  })
})

describe('after the list is drawn again', () => {
  it('a removed worn theme takes its options away, and the defaults the page now draws are no unsaved change', () => {
    draw({ theme: 'inkwell', themePreset: 'ink-night', fontPreset: 'ink-serif', chromeFont: 'ink-sans' })
    // What the server draws once the theme is gone: plain, and the stored ids kept but not on offer.
    const fresh = new DOMParser().parseFromString(
      appearanceTab(t, { ...DEFAULT_SETTINGS, theme: 'plain', themePreset: 'ink-night', fontPreset: 'ink-serif', chromeFont: 'ink-sans' },
        { presets: THEME_PRESETS, installed: [], offers: [], health: { ok: true } }), 'text/html')
    box.querySelector('[data-look-list]')!.replaceWith(document.importNode(fresh.querySelector('[data-look-list]')!, true))
    swapOffers(screen, fresh)
    // As `refresh` does after a swap.
    applyGates(box)
    expect(box.querySelectorAll('[data-theme-option]')).toHaveLength(0)
    expect([preset(), pick('fontPreset'), pick('chromeFont')]).toEqual(['mono', 'literata', 'inter'])
    expect(count()).toBe(0)
  })

  it('a theme installed since brings its options, and the unsaved picks stay', () => {
    const quill: ThemeOffer = { ...INKWELL_OFFER, id: 'quill', name: 'Quill', palettes: [{ ...INKWELL_OFFER.palettes[0]!, id: 'quill-blue', name: 'Quill blue' }], fonts: [], suggests: {} }
    tile('inkwell').click()
    key('fontPreset', 'ink-serif').click()
    makeDefault('ink-paper')
    const fresh = new DOMParser().parseFromString(markup({ ...DEFAULT_SETTINGS }, [INKWELL_OFFER, quill]), 'text/html')
    swapOffers(screen, fresh)
    expect(box.querySelector('[data-palette-card="quill-blue"]')).not.toBeNull()
    expect(pick('fontPreset')).toBe('ink-serif')
    expect(box.querySelectorAll('[data-choice-track][data-k="fontPreset"] [aria-pressed="true"]')).toHaveLength(1)
    expect(preset()).toBe('ink-paper')
    expect(partial()).toMatchObject({ theme: 'inkwell', themePreset: 'ink-paper', fontPreset: 'ink-serif' })
  })
})
