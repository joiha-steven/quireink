// THE FONT TILES: each carries both faces for `pressKey`, and picking a face says out loud when
// it rewrote the type table (a live region that stays in the page) and stays silent when it did not.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { appearanceTab } from '@/web/admin/screens/settings-appearance'
import { wireControls } from './lib/settings-controls'
import { wireType } from './lib/settings-type'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const t = adminT('en')
let screen: HTMLElement
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))
const tile = (k: string, v: string): HTMLElement =>
  screen.querySelector<HTMLElement>(`[data-choice-track][data-k="${k}"] [data-choice="${v}"]`)!
const line = (): HTMLElement => screen.querySelector<HTMLElement>('[data-font-applied]')!

beforeEach(() => {
  document.body.innerHTML = `<div id="s">${appearanceTab(t, DEFAULT_SETTINGS, { presets: [] })}</div>`
  screen = document.getElementById('s')!
  wireControls(screen, () => {})
  wireType(screen)
})

describe('the font and header/menu tiles', () => {
  it('carry a sunken face and a flat one, so the pressed look can follow aria-pressed', () => {
    for (const k of ['fontPreset', 'chromeFont']) {
      const tiles = screen.querySelectorAll<HTMLElement>(`[data-choice-track][data-k="${k}"] [data-choice]`)
      expect(tiles.length).toBeGreaterThan(1)
      for (const el of tiles) {
        expect(el.dataset.on).toContain('shadow-[inset')
        expect(el.dataset.off).not.toContain('shadow-[inset')
      }
    }
  })

  it('swap faces on a click: the old tile goes flat, the new one sinks', () => {
    const was = DEFAULT_SETTINGS.chromeFont
    const other = [...screen.querySelectorAll<HTMLElement>('[data-choice-track][data-k="chromeFont"] [data-choice]')]
      .find((b) => b.dataset.choice !== was)!
    other.click()
    expect(other.className).toContain('shadow-[inset')
    expect(tile('chromeFont', was).className).not.toContain('shadow-[inset')
  })
})

describe('the line under the reading fonts', () => {
  it('stays in the page as a live region, empty until a pick rewrites the table', () => {
    expect(line().getAttribute('role')).toBe('status')
    expect(line().textContent).toBe('')
  })

  it('says so after a pick that changed the figures, and again on the next one', async () => {
    const other = ['inter', 'source-sans', 'literata', 'source-serif']
      .find((v) => v !== DEFAULT_SETTINGS.fontPreset && v !== 'inter')!
    tile('fontPreset', other).click()
    await tick(); await tick()
    expect(line().hidden).toBe(false)
    expect(line().textContent).toBe(t.fontPresetApplied)
    // Typing in the table makes the sentence stale.
    const box = screen.querySelector<HTMLInputElement>('input[data-k^="typography.roles."]')!
    box.value = '9'
    box.dispatchEvent(new Event('input', { bubbles: true }))
    expect(line().hidden).toBe(true)
    expect(line().textContent).toBe('')
  })

  it('stays quiet when the pick leaves the table as it was', async () => {
    tile('fontPreset', DEFAULT_SETTINGS.fontPreset || 'inter').click()
    await tick(); await tick()
    expect(line().hidden).toBe(true)
    expect(line().textContent).toBe('')
  })
})
