// Pressing a theme's tile moves the chrome font to what the theme suggests, on the form and
// unsaved, unless the owner has already picked one in the same edit. The theme tiles are the
// server's own markup (`lookPicker`), so the suggestion reaches the island the way it does on
// the real screen: through `data-suggests`, with no table of themes in the browser.
import { describe, expect, it, beforeAll, afterAll, beforeEach, spyOn } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { wireControls } from '@/admin/island/lib/settings-controls'
import { changedCount, fieldsIn, partialOf, settle } from '@/admin/island/lib/settings-form'
import { lookPicker } from '@/web/admin/screens/settings-appearance-look'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const CHROME = (was: string) => `<div data-choice-track data-k="chromeFont" data-was="${was}">`
  + ['inter', 'reading', 'plex-mono', 'jetbrains-mono']
    .map((id) => `<button type="button" data-choice="${id}" aria-pressed="${id === was}"></button>`).join('')
  + '</div>'

let root: HTMLElement
function draw(theme = 'plain', chromeFont = 'inter'): void {
  document.body.innerHTML = ''
  root = document.createElement('div')
  root.innerHTML = lookPicker(adminT('en'), { ...DEFAULT_SETTINGS, theme, chromeFont }) + CHROME(chromeFont)
  document.body.appendChild(root)
  wireControls(root, () => {})
}
const press = (k: string, value: string) =>
  root.querySelector<HTMLElement>(`[data-choice-track][data-k="${k}"] [data-choice="${value}"]`)!.click()
const chrome = () => root.querySelector<HTMLElement>('[data-k="chromeFont"] [aria-pressed="true"]')?.dataset.choice
const partial = () => partialOf(fieldsIn(root))

beforeEach(() => draw())

describe('a theme tile and the chrome font', () => {
  it("carries the theme's suggestion in its markup, and plain an empty one", () => {
    const tile = (id: string) => root.querySelector<HTMLElement>(`[data-k="theme"] [data-choice="${id}"]`)!
    expect(JSON.parse(tile('code').dataset.suggests!)).toEqual({ chromeFont: 'jetbrains-mono' })
    expect(JSON.parse(tile('notes').dataset.suggests!)).toEqual({ chromeFont: 'inter' })
    expect(JSON.parse(tile('plain').dataset.suggests!)).toEqual({})
  })

  it('moves the chrome font on screen, unsaved, so one Save sends both', () => {
    press('theme', 'code')
    expect(chrome()).toBe('jetbrains-mono')
    expect(partial()).toEqual({ theme: 'code', chromeFont: 'jetbrains-mono' })
  })

  it('leaves a chrome font the owner picked in the same edit alone, before or after', () => {
    press('chromeFont', 'plex-mono')
    press('theme', 'code')
    expect(chrome()).toBe('plex-mono')
    draw()
    press('theme', 'code')
    press('chromeFont', 'reading')
    press('theme', 'notes')
    expect(chrome()).toBe('reading')
    expect(partial()).toEqual({ theme: 'notes', chromeFont: 'reading' })
  })

  it('puts back the saved font when the owner tries a theme and moves to one with no suggestion', () => {
    press('theme', 'code')
    press('theme', 'plain')
    expect(chrome()).toBe('inter')
    expect(partial()).toEqual({})
  })

  it('follows the next suggestion, and counts nothing when it is already the saved font', () => {
    press('theme', 'code')
    press('theme', 'notes')
    expect(chrome()).toBe('inter')
    expect(changedCount(fieldsIn(root))).toBe(1)
    // Between two built-in themes only what moved is sent; the chrome font is back on the saved one.
    expect(partial()).toEqual({ theme: 'notes' })
  })

  it('suggests again after a save, because the owner\'s pick belonged to the edit before it', () => {
    press('chromeFont', 'plex-mono')
    settle(fieldsIn(root))
    press('theme', 'code')
    expect(chrome()).toBe('jetbrains-mono')
  })

  it('moves nothing for a suggestion that does not parse, and says so in the console', () => {
    const tile = root.querySelector<HTMLElement>('[data-k="theme"] [data-choice="code"]')!
    tile.dataset.suggests = '{not json'
    const err = spyOn(console, 'error').mockImplementation(() => {})
    tile.click()
    expect(chrome()).toBe('inter')
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('ignores a suggested value the font row does not offer', () => {
    root.querySelector<HTMLElement>('[data-k="theme"] [data-choice="code"]')!.dataset.suggests = '{"chromeFont":"comic"}'
    press('theme', 'code')
    expect(chrome()).toBe('inter')
  })
})
