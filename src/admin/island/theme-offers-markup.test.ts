// What an installed theme adds to the Appearance pickers, as the server draws it (ADR 0072, T2c
// part 2): its palettes and reading and chrome fonts sit in the built-in options' own grids, after
// them, marked as the theme's and shown only when it is the theme the form opens on; its tile
// carries the settings it draws itself and what it suggests. The island's half is
// `theme-offers.test.ts` beside this file.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { THEME_PRESETS } from '@/content/themes'
import type { SiteSettings } from '@/types'
import { appearanceTab } from '@/web/admin/screens/settings-appearance'
import { INK_NIGHT, INK_PAPER, INKWELL, INKWELL_OFFER, LONG_PALETTE_NAME } from '@/test/theme-offer'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const t = adminT('en')

function draw(over: Partial<SiteSettings> = {}): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = appearanceTab(t, { ...DEFAULT_SETTINGS, ...over }, {
    presets: THEME_PRESETS, installed: [INKWELL], offers: [INKWELL_OFFER], health: { ok: true },
  })
  return root
}
const options = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-theme-option]')]
const track = (root: HTMLElement, k: string) => root.querySelector<HTMLElement>(`[data-choice-track][data-k="${k}"]`)!
const ids = (box: HTMLElement, attr: string) => [...box.querySelectorAll<HTMLElement>(`[${attr}]`)].map((el) => el.getAttribute(attr))

describe('the pickers with an installed theme', () => {
  it('put its palettes and fonts after the built-in ones, in the same grids', () => {
    const root = draw({ theme: 'inkwell' })
    expect(ids(root.querySelector('[data-palette-track]')!, 'data-palette-card'))
      .toEqual([...THEME_PRESETS.map((p) => p.id), 'ink-paper', 'ink-night'])
    expect(ids(track(root, 'fontPreset'), 'data-choice').slice(-1)).toEqual(['ink-serif'])
    expect(ids(track(root, 'chromeFont'), 'data-choice').slice(-1)).toEqual(['ink-sans'])
    // The display font is no setting's value, so no picker offers it.
    expect(root.innerHTML).not.toContain('data-choice="ink-display"')
    expect(options(root)).toHaveLength(4)
    expect(options(root).every((el) => el.dataset.themeOption === 'inkwell' && !el.hidden)).toBe(true)
  })

  it('ships them hidden when the form opens on another theme', () => {
    const root = draw({ theme: 'plain' })
    expect(options(root)).toHaveLength(4)
    expect(options(root).every((el) => el.hidden)).toBe(true)
  })

  it('names the theme on every one of them, and the palettes by their own names', () => {
    const root = draw({ theme: 'inkwell' })
    for (const el of options(root)) expect(el.textContent).toContain('from Inkwell')
    const card = root.querySelector('[data-palette-card="ink-night"]')!
    expect(card.textContent).toContain(LONG_PALETTE_NAME)
  })

  it('draws a theme palette in its real colours, light and dark', () => {
    const root = draw({ theme: 'inkwell' })
    const styles = [...root.querySelectorAll('[data-palette-card="ink-paper"] [style]')].map((el) => el.getAttribute('style'))
    expect(styles).toContain(`background:${INK_PAPER.light.bg}`)
    expect(styles).toContain(`background:${INK_PAPER.dark.bg}`)
    expect(styles).toContain(`background:${INK_PAPER.light.accent}`)
    // No colour table to edit: a note saying whose colours they are takes its place.
    const note = root.querySelector<HTMLElement>('[data-palette-table="ink-night"]')!
    expect(note.matches('[data-theme-palette-note="inkwell"]')).toBe(true)
    expect(note.textContent).toContain(INK_NIGHT.name)
    expect(note.querySelector('input')).toBeNull()
  })

  it('sets each theme font tile in its own face, declared from the package directory', () => {
    const root = draw({ theme: 'inkwell' })
    const serif = track(root, 'fontPreset').querySelector<HTMLElement>('[data-choice="ink-serif"]')!
    // The theme's face, under a name its package alone has, then a generic family: never Inter.
    expect(serif.style.fontFamily.replace(/["']/g, '')).toBe(`theme-${INKWELL_OFFER.hash}-ink-serif, serif`)
    expect(serif.getAttribute('style')).not.toContain('Inter')
    expect(serif.dataset.themeFace).toBe(`theme-${INKWELL_OFFER.hash}-ink-serif`)
    expect(serif.querySelector<HTMLElement>('[data-theme-face-unloaded]')!.hidden).toBe(true)
    const faces = [...root.querySelectorAll('style')].map((s) => s.textContent).join('')
    expect(faces).toContain(`'theme-${INKWELL_OFFER.hash}-ink-serif';font-style:normal;font-weight:400;`)
    expect(faces).toContain(`url('/themes/${INKWELL_OFFER.hash}/fonts/serif.woff2') format('woff2')`)
    expect(faces).toContain(`'theme-${INKWELL_OFFER.hash}-ink-sans';font-style:normal;font-weight:400;`)
  })

  it('presses the stored theme choices while that theme is the stored one, with nothing unsaved', () => {
    const root = draw({ theme: 'inkwell', themePreset: 'ink-night', fontPreset: 'ink-serif', chromeFont: 'ink-sans' })
    expect(track(root, 'fontPreset').querySelector('[aria-pressed="true"]')!.getAttribute('data-choice')).toBe('ink-serif')
    expect(track(root, 'fontPreset').dataset.was).toBe('ink-serif')
    expect(track(root, 'chromeFont').querySelector('[aria-pressed="true"]')!.getAttribute('data-choice')).toBe('ink-sans')
    const field = root.querySelector<HTMLInputElement>('input[data-k="themePreset"]')!
    expect([field.value, field.dataset.was]).toEqual(['ink-night', 'ink-night'])
    expect(root.querySelector('[data-palette-card="ink-night"] [data-card-default]')!.hasAttribute('hidden')).toBe(false)
    // The default's tick, pressed and locked as a built-in default's; the other one is free.
    const tick = (id: string) => root.querySelector<HTMLInputElement>(`[data-palette-shown="${id}"]`)!
    expect([tick('ink-night').checked, tick('ink-night').disabled]).toEqual([true, true])
    expect([tick('ink-paper').checked, tick('ink-paper').disabled]).toEqual([false, false])
    expect(root.querySelector<HTMLInputElement>('input[data-k="enabledPalettes"]')!.value)
      .toBe(`${DEFAULT_SETTINGS.enabledPalettes.join(' ')} ink-night`)
  })

  it('draws the default, as the page does, when a stored theme choice is not on offer', () => {
    const root = draw({ theme: 'plain', themePreset: 'ink-night', fontPreset: 'ink-serif', chromeFont: 'ink-sans' })
    expect(track(root, 'fontPreset').dataset.was).toBe('literata')
    expect(track(root, 'fontPreset').querySelector('[aria-pressed="true"]')!.getAttribute('data-choice')).toBe('literata')
    expect(track(root, 'chromeFont').dataset.was).toBe('inter')
    expect(root.querySelector<HTMLInputElement>('input[data-k="themePreset"]')!.value).toBe('mono')
  })
})

describe('the installed tile', () => {
  it('carries the settings its theme draws itself, and everything it suggests', () => {
    const root = draw({ theme: 'plain' })
    const tile = root.querySelector<HTMLElement>('[data-choice-track][data-k="theme"] [data-choice="inkwell"]')!
    expect(JSON.parse(tile.dataset.owns!)).toEqual(['table.head'])
    expect(JSON.parse(tile.dataset.suggested!)).toEqual(INKWELL_OFFER.suggests)
    // Pressing it moves nothing by itself.
    expect(tile.dataset.suggests).toBe('{}')
  })

  it('a built-in tile carries its whole suggestion too', () => {
    const root = draw()
    const code = root.querySelector<HTMLElement>('[data-k="theme"] [data-choice="code"]')!
    expect(JSON.parse(code.dataset.suggested!)).toEqual({ chromeFont: 'jetbrains-mono' })
  })

  it('draws the suggestion key hidden, outside the part a redraw replaces', () => {
    const root = draw({ theme: 'inkwell' })
    const row = root.querySelector<HTMLElement>('[data-theme-suggest-row]')!
    expect(row.hidden).toBe(true)
    expect(row.closest('[data-look-list]')).toBeNull()
    expect(row.textContent).toBe(t.themeSuggestUse)
  })
})
