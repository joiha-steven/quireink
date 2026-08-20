// The reader's palette switcher.
//
// Six palettes had shipped on every page since M2 with nothing anywhere able to select one:
// `data-palette` was set by no code at all, so the CSS was unreachable and the control the
// owner had turned on in Settings did not exist for readers. The owner's decision on
// 2026-08-11 was to make it work rather than to stop shipping it.
//
// What these pin is mostly the SHAPE of the deal with `content/themes.ts`: the button renders
// only above two enabled palettes, which is exactly when the per-palette CSS is emitted, and
// the default gets a block of its own so switching back has somewhere to land.

import { beforeEach, describe, expect, it } from 'bun:test'
import { palette, theme } from './theme'
import { page, useDom } from './test-dom'

useDom()

const OPTIONS = 'mono:Mono|sepia:Sepia|ocean:Ocean'

/** The header button as `web/chrome.ts` renders it. */
function withButton(options = OPTIONS, dflt = 'mono'): void {
  page(
    `<button data-palettes="${options}" data-palette-default="${dflt}"`
    + ` aria-haspopup="true" aria-expanded="false">icon</button>`,
    { palette: 'Palette' },
  )
  document.documentElement.removeAttribute('data-palette')
}

const rows = () => [...document.querySelectorAll<HTMLButtonElement>('.theme-menu button')]
const current = () => document.documentElement.dataset.palette

beforeEach(() => {
  localStorage.clear()
  withButton()
})

describe('the palette switcher', () => {
  it('does nothing at all when the button is not on the page', () => {
    page('<p>no control here</p>')
    expect(() => palette()).not.toThrow()
    expect(document.querySelector('.theme-menu')).toBeNull()
  })

  /** One palette is not a choice, and a one-row menu is a dead control. */
  it('refuses to build a menu for fewer than two palettes', () => {
    withButton('mono:Mono')
    palette()
    expect(document.querySelector('.theme-menu')).toBeNull()
  })

  it('builds a row per palette, named by the server', () => {
    palette()
    expect(rows().map((r) => r.textContent)).toEqual(['Mono', 'Sepia', 'Ocean'])
    // No locale table in the bundle: the names came off the button.
    expect(rows().map((r) => r.dataset.id)).toEqual(['mono', 'sepia', 'ocean'])
  })

  it("applies the owner's default before the reader has chosen anything", () => {
    palette()
    expect(current()).toBe('mono')
    expect(rows()[0]!.getAttribute('aria-pressed')).toBe('true')
  })

  /**
   * The default is NOT always first in `enabledPalettes` — that list keeps the picker's
   * display order — which is why the button names it separately.
   */
  it('honours a default that is not first in the list', () => {
    withButton(OPTIONS, 'ocean')
    palette()
    expect(current()).toBe('ocean')
    expect(rows()[2]!.getAttribute('aria-pressed')).toBe('true')
  })

  it('switches on click, and ticks the row a screen reader can hear', () => {
    palette()
    rows()[1]!.click()
    expect(current()).toBe('sepia')
    expect(rows().map((r) => r.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    expect(rows()[1]!.classList.contains('is-current')).toBe(true)
  })

  it('remembers the choice, and applies it on the next page', () => {
    palette()
    rows()[2]!.click()
    expect(localStorage.getItem('palette')).toBe('ocean')

    withButton() // a fresh page, same reader
    palette()
    expect(current()).toBe('ocean')
  })

  /**
   * A palette the owner has since turned OFF must not be applied: its CSS is no longer
   * emitted, so honouring the stored value would leave the reader on tokens that resolve to
   * nothing.
   */
  it('falls back to the default when the stored palette is no longer enabled', () => {
    localStorage.setItem('palette', 'amber')
    palette()
    expect(current()).toBe('mono')
  })

  it('opens and closes, and closes on Escape', () => {
    palette()
    const button = document.querySelector<HTMLButtonElement>('[data-palettes]')!
    const menu = document.querySelector<HTMLElement>('.theme-menu')!
    expect(menu.hidden).toBe(true)

    button.click()
    expect(menu.hidden).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('true')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(menu.hidden).toBe(true)
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes after a choice rather than leaving the menu open', () => {
    palette()
    document.querySelector<HTMLButtonElement>('[data-palettes]')!.click()
    rows()[1]!.click()
    expect(document.querySelector<HTMLElement>('.theme-menu')!.hidden).toBe(true)
  })

  /** Storage can be denied. The choice is then simply not remembered, and nothing throws. */
  it('survives localStorage being unavailable', () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new Error('denied') },
    })
    try {
      expect(() => { palette(); rows()[1]!.click() }).not.toThrow()
      expect(current()).toBe('sepia')
    } finally {
      if (real) Object.defineProperty(globalThis, 'localStorage', real)
    }
  })
})

/**
 * Two dropdowns, one corner of the header.
 *
 * Found by clicking the real page rather than by a test: each control stopped its click from
 * reaching the document handler that closes menus, so the theme menu and the palette menu
 * could be open at the same time, overlapping each other. Neither was wrong alone — the bug
 * only exists once there are two, which is why it arrived with the palette switcher and why it
 * is pinned here rather than in the theme file.
 */
describe('only one header menu is open at a time', () => {
  const menus = () => [...document.querySelectorAll<HTMLElement>('.theme-menu')]

  beforeEach(() => {
    page(
      `<button data-theme-toggle aria-haspopup="true" aria-expanded="false"><svg></svg></button>`
      + `<button data-palettes="${OPTIONS}" data-palette-default="mono"`
      + ` aria-haspopup="true" aria-expanded="false">icon</button>`,
      { theme: 'Theme', themeLight: 'Light', themeDark: 'Dark', themeSystem: 'System', themeTime: 'By time', palette: 'Palette' },
    )
    theme()
    palette()
  })

  it('builds both menus', () => {
    expect(menus().length).toBe(2)
    expect(menus().every((m) => m.hidden)).toBe(true)
  })

  it('closes the theme menu when the palette menu opens, and the other way round', () => {
    const themeButton = document.querySelector<HTMLButtonElement>('[data-theme-toggle]')!
    const paletteButton = document.querySelector<HTMLButtonElement>('[data-palettes]')!

    themeButton.click()
    expect(menus().filter((m) => !m.hidden).length).toBe(1)

    paletteButton.click()
    const open = menus().filter((m) => !m.hidden)
    expect(open.length).toBe(1)
    expect(open[0]!.contains(document.querySelector('[data-id="sepia"]'))).toBe(true)
    // And the button that lost its menu says so, for anyone listening to it.
    expect(themeButton.getAttribute('aria-expanded')).toBe('false')
    expect(paletteButton.getAttribute('aria-expanded')).toBe('true')
  })

  it('still toggles itself shut on a second click', () => {
    const paletteButton = document.querySelector<HTMLButtonElement>('[data-palettes]')!
    paletteButton.click()
    paletteButton.click()
    expect(menus().every((m) => m.hidden)).toBe(true)
    expect(paletteButton.getAttribute('aria-expanded')).toBe('false')
  })
})

describe("the owner's default light/dark", () => {
  /** The header's theme button, plus the owner's default on <body> as chrome.ts emits it. */
  const withDefault = (scheme?: string) => {
    page('<button data-theme-toggle aria-haspopup="true" aria-expanded="false"><svg></svg></button>',
      { theme: 'Theme', themeLight: 'Light', themeDark: 'Dark', themeSystem: 'System', themeTime: 'Time',
        ...(scheme ? { defaultScheme: scheme } : {}) })
    document.documentElement.removeAttribute('data-scheme')
    document.documentElement.classList.remove('dark')
  }

  beforeEach(() => localStorage.clear())

  it('opens dark for a reader who has never chosen, when the owner says dark', () => {
    withDefault('dark')
    theme()
    expect(document.documentElement.dataset.scheme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('opens light when the owner says light, whatever the OS prefers', () => {
    withDefault('light')
    theme()
    expect(document.documentElement.dataset.scheme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it("never overrules a reader who HAS chosen — that is the whole contract", () => {
    localStorage.setItem('theme', 'light')
    withDefault('dark')
    theme()
    expect(document.documentElement.dataset.scheme).toBe('light')
  })

  it('falls back to system when the attribute is absent, so old pages behave as before', () => {
    withDefault()
    theme()
    // happy-dom reports no dark preference, so system resolves light. What matters is that
    // nothing threw and the island still wrote an answer.
    expect(['light', 'dark']).toContain(document.documentElement.dataset.scheme!)
  })
})
