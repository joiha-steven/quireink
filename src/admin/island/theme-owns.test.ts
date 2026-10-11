// A theme that draws tables itself takes three table controls off the screen, and brings them
// back on another theme, without touching what is saved. Both halves are the server's own
// markup (`lookPicker` and `postTab`), so the list of keys reaches the island through
// `data-owns`, with no table of themes in the browser.
import { describe, expect, it, beforeAll, afterAll, beforeEach, spyOn } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { wireControls } from '@/admin/island/lib/settings-controls'
import { fieldsIn, partialOf } from '@/admin/island/lib/settings-form'
import { lookPicker } from '@/web/admin/screens/settings-appearance-look'
import { postTab } from '@/web/admin/screens/settings-post'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { BUILTIN_THEMES } from '@/content/themes-builtin'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const OWNED = ['table.head', 'table.grid', 'table.ruleWeight']
const t = adminT('en')

let root: HTMLElement
function draw(theme = 'plain', table = DEFAULT_SETTINGS.table): void {
  document.body.innerHTML = ''
  root = document.createElement('div')
  const s = { ...DEFAULT_SETTINGS, theme, table }
  root.innerHTML = lookPicker(t, s) + postTab(t, s)
  document.body.appendChild(root)
  wireControls(root, () => {})
}
const press = (id: string) =>
  root.querySelector<HTMLElement>(`[data-choice-track][data-k="theme"] [data-choice="${id}"]`)!.click()
const control = (k: string) => root.querySelector<HTMLElement>(`[data-ownable="${k}"]`)!
const note = (k: string) => root.querySelector<HTMLElement>(`[data-owned-note="${k}"]`)!
const shownNotes = () => [...root.querySelectorAll<HTMLElement>('[data-owned-note]')].filter((n) => !n.hidden)

beforeEach(() => draw())

describe('table controls a theme owns', () => {
  it('every tile lists what its theme owns, and only paper owns anything', () => {
    for (const th of BUILTIN_THEMES) {
      const tile = root.querySelector<HTMLElement>(`[data-k="theme"] [data-choice="${th.id}"]`)!
      expect(JSON.parse(tile.dataset.owns!)).toEqual(th.ownsSettings)
    }
    expect(JSON.parse(root.querySelector<HTMLElement>('[data-k="theme"] [data-choice="paper"]')!.dataset.owns!)).toEqual(OWNED)
  })

  it('shows all three controls and no note on plain', () => {
    for (const k of OWNED) expect(control(k).hidden).toBe(false)
    expect(shownNotes()).toHaveLength(0)
  })

  it('hides each control with its label and shows ONE line naming the theme and the parts, unsaved', () => {
    press('paper')
    for (const k of OWNED) expect(control(k).hidden).toBe(true)
    expect(shownNotes()).toHaveLength(1)
    // At the first hidden control.
    expect(shownNotes()[0]).toBe(note('table.head'))
    expect(note('table.head').textContent).toBe(
      t.themeOwnsSetting.replace('{theme}', t.lookPaper)
        .replace('{parts}', `${t.tableHead}, ${t.tableGrid}, and ${t.tableRuleWeight}`),
    )
    // The three that stay the owner's are not touched.
    for (const k of ['table.firstColumn', 'table.padding', 'table.narrow', 'table.stripe']) {
      expect(root.querySelector(`[data-k="${k}"]`)!.closest('[hidden]')).toBeNull()
    }
  })

  it('brings them back on another theme', () => {
    press('paper')
    press('code')
    for (const k of OWNED) expect(control(k).hidden).toBe(false)
    expect(shownNotes()).toHaveLength(0)
  })

  it('is already hidden when the screen opens on paper', () => {
    draw('paper')
    for (const k of OWNED) expect(control(k).hidden).toBe(true)
  })

  it('keeps the saved values: hiding a control changes nothing the form would send', () => {
    draw('plain', { ...DEFAULT_SETTINGS.table, head: 'ink', grid: 'none', ruleWeight: 'bold' })
    press('paper')
    expect(partialOf(fieldsIn(root))).toEqual({ theme: 'paper' })
    const head = root.querySelector<HTMLElement>('[data-k="table.head"] [aria-pressed="true"]')!
    expect(head.dataset.choice).toBe('ink')
    press('plain')
    expect(partialOf(fieldsIn(root))).toEqual({})
  })

  it('puts the one line at the first control that is actually hidden', () => {
    root.querySelector<HTMLElement>('[data-k="theme"] [data-choice="paper"]')!.dataset.owns = '["table.grid","table.ruleWeight"]'
    press('paper')
    expect(control('table.head').hidden).toBe(false)
    expect(shownNotes()).toEqual([note('table.grid')])
  })

  it('owns nothing when the list does not parse, and says so in the console', () => {
    root.querySelector<HTMLElement>('[data-k="theme"] [data-choice="paper"]')!.dataset.owns = '{nope'
    const err = spyOn(console, 'error').mockImplementation(() => {})
    press('paper')
    expect(control('table.head').hidden).toBe(false)
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })
})
