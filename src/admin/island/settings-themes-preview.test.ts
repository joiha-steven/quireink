// "Choose this theme" on a theme preview's bar (ADR 0072, T2c) lands on the Look card with
// `?pick-theme=<id>`: in a DOM, with the server's own markup and the islands that wire it, the tile
// is pressed as a click would press it, Save counts it, nothing is stored, and the parameter leaves
// the address so a reload does not press it again. A theme gone meanwhile, and a Preview the server
// refused (`?preview-refused=<id>&why=`), are said on the card.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import type { InstalledTheme } from '@/content/installed-themes'
import { lookPicker } from '@/web/admin/screens/settings-appearance-look'
import { wireControls } from './lib/settings-controls'
import { wireThemes } from './lib/settings-themes'

beforeAll(() => GlobalRegistrator.register({ url: 'http://localhost/' }))
afterAll(() => GlobalRegistrator.unregister())

const t = adminT('en')
const HASH = 'c'.repeat(64)
const BROADSHEET: InstalledTheme = {
  id: 'broadsheet',
  current: {
    version: '1.0.0', hash: HASH, installedAt: 1, name: 'Broadsheet', author: 'A. Writer', description: null,
    license: 'MIT', homepage: null, api: 1, screenshot: '',
  },
  previous: [],
  active: false,
  reviewed: false,
  readable: true,
}

let screen: HTMLElement
let moves: number

function mount(url: string): void {
  history.replaceState(null, '', url)
  document.body.innerHTML = `<div data-screen="settings"><div data-settings-panels>`
    + lookPicker(t, DEFAULT_SETTINGS, { installed: [BROADSHEET], health: { ok: true } })
    + `</div></div>`
  screen = document.querySelector<HTMLElement>('[data-screen]')!
  wireControls(screen.querySelector<HTMLElement>('[data-settings-panels]')!, () => { moves++ })
  wireThemes(screen)
}

const key = (id: string): HTMLElement => screen.querySelector<HTMLElement>(`[data-choice="${id}"]`)!
/** The card's error line, when it is showing. */
const shownError = (): string | null => {
  const el = screen.querySelector<HTMLElement>('[data-theme-error]')
  return el && !el.hidden ? el.textContent : null
}
const pressed = (): string[] =>
  [...screen.querySelectorAll<HTMLElement>('[data-choice][aria-pressed="true"]')].map((k) => k.dataset.choice ?? '')

beforeEach(() => { moves = 0 })

describe('arriving from a preview\'s Choose this theme', () => {
  it('presses that tile unsaved, counts it for Save, focuses it and takes the parameter out of the address', () => {
    mount('/admin/settings?tab=appearance&pick-theme=broadsheet')
    expect(pressed()).toEqual(['broadsheet'])
    expect(key('broadsheet').className).toBe(key('broadsheet').dataset.on ?? '')
    // The stored choice is still plain: the form's baseline did not move, so Save has a change to store.
    expect(screen.querySelector<HTMLElement>('[data-choice-track][data-k="theme"]')!.dataset.was).toBe(DEFAULT_SETTINGS.theme)
    expect(moves).toBeGreaterThan(0)
    expect(document.activeElement).toBe(key('broadsheet'))
    expect(location.search).toBe('?tab=appearance')
  })

  it('presses a built-in tile the same way', () => {
    mount('/admin/settings?tab=appearance&pick-theme=paper')
    expect(pressed()).toEqual(['paper'])
    expect(moves).toBeGreaterThan(0)
  })

  it('leaves the stored choice pressed when the theme is gone, and says so on the card and in the console', () => {
    const warned: string[] = []
    const warn = console.warn
    console.warn = (message: string) => { warned.push(message) }
    try {
      mount('/admin/settings?tab=appearance&pick-theme=removed-since')
    } finally {
      console.warn = warn
    }
    expect(pressed()).toEqual([DEFAULT_SETTINGS.theme])
    expect(moves).toBe(0)
    expect(warned.join('\n')).toContain('removed-since')
    expect(shownError()).toBe(t.themePreviewPickGone.replace('{theme}', 'removed-since'))
    expect(location.search).toBe('?tab=appearance')
  })

  it('does nothing without the parameter', () => {
    mount('/admin/settings?tab=appearance')
    expect(pressed()).toEqual([DEFAULT_SETTINGS.theme])
    expect(moves).toBe(0)
    expect(shownError()).toBeNull()
  })
})

describe('arriving from a Preview the server refused', () => {
  it('says the theme is not installed any more, by the id it was asked for', () => {
    mount('/admin/settings?tab=appearance&preview-refused=removed-since&why=missing')
    expect(shownError()).toBe(t.themePreviewMissing.replace('{theme}', 'removed-since'))
    expect(pressed()).toEqual([DEFAULT_SETTINGS.theme])
    expect(moves).toBe(0)
    expect(location.search).toBe('?tab=appearance')
  })

  it('says the theme cannot be read, by the name its tile carries', () => {
    mount('/admin/settings?tab=appearance&preview-refused=broadsheet&why=unreadable')
    expect(shownError()).toBe(t.themePreviewUnreadable.replace('{theme}', 'Broadsheet'))
    expect(location.search).toBe('?tab=appearance')
  })

  it('says nothing for a value that is not a theme id, and still clears the address', () => {
    mount('/admin/settings?tab=appearance&preview-refused=Your%20session%20expired%2C%20sign%20in%20at%20evil.example&why=missing')
    expect(shownError()).toBeNull()
    mount('/admin/settings?tab=appearance&pick-theme=Sign%20in%20again')
    expect(shownError()).toBeNull()
    expect(pressed()).toEqual([DEFAULT_SETTINGS.theme])
    expect(location.search).toBe('?tab=appearance')
  })
})
