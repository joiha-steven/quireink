// EVERY ROW OF THE SETTINGS SEARCH LANDS SOMEWHERE, checked against the tabs as the server draws
// them. A row whose words match nothing on its own tab opens that tab and points at nothing —
// and, for a setting folded under Advanced, leaves it behind a shut key. This found two such rows
// the day it was written (a switch whose label carries a badge, and a card named by its title).
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { freshDatabase, dropDatabase } from '@/test/db'
import { getSettings } from '@/content/settings'
import { settingsScreen } from '@/web/admin/screens/settings'
import { SETTINGS_INDEX } from '@/admin-shared/settings-index'
import { findSetting } from './settings-find'

const DIR = './.tmp/test-settings-find'
freshDatabase(DIR)
beforeAll(async () => {
  GlobalRegistrator.register()
  document.body.innerHTML = await settingsScreen(await getSettings(), new URLSearchParams())
})
afterAll(async () => { await GlobalRegistrator.unregister(); dropDatabase(DIR) })

describe('the settings search', () => {
  it('has one row per index entry, each naming its key and its words', () => {
    const rows = [...document.querySelectorAll<HTMLElement>('[data-found]')]
    expect(rows.length).toBe(SETTINGS_INDEX.length)
    for (const row of rows) expect(row.dataset.label).toBeTruthy()
  })

  it('finds every one of them on its own tab', () => {
    const none: string[] = []
    for (const row of document.querySelectorAll<HTMLElement>('[data-found]')) {
      const panel = document.querySelector(`[data-settings-panel="${row.dataset.found}"]`)!
      if (!findSetting(panel, row.dataset.label ?? '')) none.push(`${row.dataset.found}:${row.dataset.setting}`)
    }
    expect(none).toEqual([])
  })

  it('lands inside the Advanced band for a setting folded there', () => {
    const panel = document.querySelector('[data-settings-panel="server"]')!
    const band = panel.querySelector('[data-advanced-body]')!
    const words = (key: string) => document.querySelector<HTMLElement>(`[data-setting="${key}"]`)!.dataset.label!
    for (const key of ['seoOgImage', 'seoAutoSchema', 'mcpEnable', 'apiEnable', 'customHeadLabel', 'redirectSource']) {
      expect({ key, inBand: band.contains(findSetting(panel, words(key))) }).toEqual({ key, inBand: true })
    }
  })
})
