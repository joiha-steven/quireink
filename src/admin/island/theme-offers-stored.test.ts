// What the form shows is what a save stores, when the row holds an installed theme's choices that
// are not on offer now, and when two installed themes name a palette or a font alike (ADR 0072,
// T2c part 2). The server's own markup, the islands that wire it, and the form's own diff.
//
// The row can hold a theme's palette and fonts while another theme is chosen: removing the worn
// theme does that, and so does an MCP call that changes only the theme. The page draws the
// defaults then and keeps the ids; choosing their theme again makes them valid again.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { THEME_PRESETS } from '@/content/themes'
import type { ThemeOffer } from '@/content/installed-themes'
import type { SiteSettings } from '@/types'
import { appearanceTab } from '@/web/admin/screens/settings-appearance'
import { wireControls } from './lib/settings-controls'
import { changedCount, fieldsIn, partialOf, settle } from './lib/settings-form'
import { wireTheme } from './lib/settings-theme'
import { wireOffers } from './lib/settings-offers'
import { INKWELL, INKWELL_OFFER } from '@/test/theme-offer'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const t = adminT('en')
/** A second theme, written apart from the first, naming its palettes and fonts the same. */
const QUILL: ThemeOffer = { ...INKWELL_OFFER, id: 'quill', name: 'Quill', hash: 'f'.repeat(64) }
const DORMANT = { themePreset: 'ink-night', fontPreset: 'ink-serif', chromeFont: 'ink-sans' }

let box: HTMLElement
function draw(over: Partial<SiteSettings>, offers: ThemeOffer[] = [INKWELL_OFFER]): void {
  document.body.innerHTML = ''
  const screen = document.createElement('div')
  screen.dataset.screen = 'settings'
  box = document.createElement('div')
  box.setAttribute('data-settings-panels', '')
  box.innerHTML = appearanceTab(t, { ...DEFAULT_SETTINGS, ...over },
    { presets: THEME_PRESETS, installed: offers.map((o) => ({ ...INKWELL, id: o.id })), offers, health: { ok: true } })
  screen.appendChild(box)
  document.body.appendChild(screen)
  wireControls(box, () => {})
  wireTheme(screen)
  wireOffers(screen)
}
const tile = (id: string) => box.querySelector<HTMLElement>(`[data-choice-track][data-k="theme"] [data-choice="${id}"]`)!
const key = (k: string, id: string) => [...box.querySelectorAll<HTMLElement>(`[data-choice-track][data-k="${k}"] [data-choice="${id}"]`)].find((el) => !el.hidden)!
const shown = () => ({
  themePreset: box.querySelector<HTMLInputElement>('input[data-k="themePreset"]')!.value,
  fontPreset: [...box.querySelectorAll<HTMLElement>('[data-k="fontPreset"] [aria-pressed="true"]')].find((el) => !el.hidden)?.dataset.choice,
  chromeFont: [...box.querySelectorAll<HTMLElement>('[data-k="chromeFont"] [aria-pressed="true"]')].find((el) => !el.hidden)?.dataset.choice,
})
const partial = () => partialOf(fieldsIn(box))
const count = () => changedCount(fieldsIn(box))

describe('a theme’s choices stored while another theme is chosen', () => {
  it('open as the defaults the page draws, with nothing unsaved', () => {
    draw({ theme: 'plain', ...DORMANT })
    expect(shown()).toEqual({ themePreset: 'mono', fontPreset: 'literata', chromeFont: 'inter' })
    expect(count()).toBe(0)
  })

  it('come back pressed when their theme is pressed, and the save carries exactly what is shown', () => {
    draw({ theme: 'plain', ...DORMANT })
    tile('inkwell').click()
    expect(shown()).toEqual(DORMANT)
    expect(partial()).toMatchObject({ theme: 'inkwell', ...DORMANT })
  })

  it('a default the owner picks back while the theme is pressed is sent too, though it is the baseline', () => {
    draw({ theme: 'plain', ...DORMANT })
    tile('inkwell').click()
    key('fontPreset', 'literata').click()
    expect(shown().fontPreset).toBe('literata')
    // Not sent, the row would keep ink-serif and the page would draw it under inkwell.
    expect(partial()).toMatchObject({ theme: 'inkwell', fontPreset: 'literata' })
  })

  it('every value goes as shown while an installed theme is moved off, and none is counted twice', () => {
    draw({ theme: 'inkwell', ...DORMANT })
    tile('plain').click()
    expect(partial()).toMatchObject({ theme: 'plain', themePreset: 'mono', fontPreset: 'literata', chromeFont: 'inter' })
    // After the save the form agrees with the server again, and sends nothing it did not change.
    settle(fieldsIn(box))
    expect(partial()).toEqual({})
  })

  it('between two built-in themes sends only what moved, so it cannot write back a value changed elsewhere', () => {
    draw({ theme: 'notes' })
    tile('plain').click()
    expect(count()).toBe(1)
    const sent = partial()
    expect(sent).toMatchObject({ theme: 'plain' })
    for (const k of ['themePreset', 'enabledPalettes', 'fontPreset']) expect(k in sent).toBe(false)
  })

  it('unticks a theme palette that was ticked only for being the default, once the default leaves it', () => {
    draw({ theme: 'inkwell', themePreset: 'ink-night', enabledPalettes: ['mono', 'ink-paper'] })
    const tick = (id: string) => box.querySelector<HTMLInputElement>(`[data-palette-shown="${id}"]`)!
    expect(tick('ink-night').checked).toBe(true)
    tile('plain').click()
    expect(tick('ink-night').checked).toBe(false)
    expect(tick('ink-paper').checked).toBe(true)
    tile('inkwell').click()
    expect(tick('ink-night').checked).toBe(true)
  })
})

describe('two installed themes that name a palette and fonts alike', () => {
  it('open on the second with its stored choices pressed, nothing unsaved, and its own note open', () => {
    draw({ theme: 'quill', ...DORMANT }, [INKWELL_OFFER, QUILL])
    expect(shown()).toEqual(DORMANT)
    expect(count()).toBe(0)
    const notes = [...box.querySelectorAll<HTMLElement>('[data-palette-table="ink-night"]')]
    expect(notes.filter((n) => !n.hidden).map((n) => n.dataset.themePaletteNote)).toEqual(['quill'])
  })

  it('switch between them keeping the shared choices, and only the theme changes', () => {
    draw({ theme: 'quill', ...DORMANT }, [INKWELL_OFFER, QUILL])
    tile('inkwell').click()
    expect(shown()).toEqual(DORMANT)
    expect(count()).toBe(1)
    const pressed = [...box.querySelectorAll<HTMLElement>('[data-k="fontPreset"] [aria-pressed="true"]')].find((el) => !el.hidden)!
    expect(pressed.dataset.themeOption).toBe('inkwell')
  })

  it('offer the second theme’s suggestion, and take it from that theme’s own options', () => {
    draw({ theme: 'plain' }, [INKWELL_OFFER, QUILL])
    tile('quill').click()
    const row = box.querySelector<HTMLElement>('[data-theme-suggest-row]')!
    expect(row.hidden).toBe(false)
    box.querySelector<HTMLElement>('[data-theme-suggest]')!.click()
    expect(shown()).toEqual({ themePreset: 'ink-paper', fontPreset: 'ink-serif', chromeFont: 'ink-sans' })
    expect(row.hidden).toBe(true)
    expect(partial()).toMatchObject({ theme: 'quill', themePreset: 'ink-paper', fontPreset: 'ink-serif', chromeFont: 'ink-sans' })
  })

  it('declare each theme’s faces under a name of its own, so one tile never draws the other’s file', () => {
    draw({ theme: 'quill' }, [INKWELL_OFFER, QUILL])
    const css = [...box.querySelectorAll('style')].map((s) => s.textContent).join('')
    // Each face rule names its family first: `'<family>';font-style:…`.
    const families = [...css.matchAll(/'(theme-[^']+)';font-style/g)].map((m) => m[1])
    expect(families.length).toBeGreaterThan(0)
    expect(new Set(families).size).toBe(families.length)
    for (const offer of [INKWELL_OFFER, QUILL]) {
      const serif = box.querySelector<HTMLElement>(`[data-theme-option="${offer.id}"][data-choice="ink-serif"]`)!
      expect(serif.dataset.themeFace).toBe(`theme-${offer.hash}-ink-serif`)
      expect(families).toContain(`theme-${offer.hash}-ink-serif`)
    }
  })
})
