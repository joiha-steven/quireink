// Whether the chosen theme is the one the site draws (ADR 0072, T2c): a built-in always is, an
// installed one is when its live row reads and its sheet is in the store, and each of the three
// ways it is not gets its own answer, because the admin tells the owner which one it is.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { getSettings, resetSettingsCache, saveSettings } from '@/content/settings'
import { forgetInstalledTheme } from '@/content/chosen-theme'
import { installTheme, removeTheme } from '@/content/installed-themes'
import { chosenThemeHealth } from '@/content/theme-health'
import { themeZip } from '@/theme/test-zip'

const DIR = './.tmp/test-theme-health'
const STORE = join(process.cwd(), '.tmp/test-theme-health-store')
process.env.STORAGE_LOCAL_DIR = STORE
freshDatabase(DIR)
afterAll(() => {
  dropDatabase(DIR)
  try { rmSync(STORE, { recursive: true, force: true }) } catch { /* test hygiene only */ }
})

beforeEach(() => {
  for (const t of ['themes', 'settings']) db().run(`delete from ${t}`)
  rmSync(STORE, { recursive: true, force: true })
  mkdirSync(STORE, { recursive: true })
  resetSettingsCache()
  forgetInstalledTheme()
})

/** Install the test package and choose it through the ordinary settings write. */
async function wearInstalled(): Promise<string> {
  const result = await installTheme(themeZip())
  if (!result.ok) throw new Error('the test package was refused')
  await saveSettings({ theme: result.id })
  expect((await getSettings()).theme).toBe(result.id)
  return result.hash
}

/** What a backup or a hand edit can leave: a stored id the sanitizer would not have let in. */
function storeThemeId(id: string): void {
  db().run(`update settings set data = json_set(data, '$.theme', ?) where id = 1`, [id])
  resetSettingsCache()
  forgetInstalledTheme()
}

describe('chosenThemeHealth', () => {
  it('says a built-in theme is healthy without looking anything up', async () => {
    for (const theme of ['plain', 'code', 'paper', 'notes']) {
      expect(await chosenThemeHealth({ theme })).toEqual({ ok: true })
    }
  })

  it('says a live installed theme with its sheet in the store is healthy', async () => {
    await wearInstalled()
    expect(await chosenThemeHealth(await getSettings())).toEqual({ ok: true })
  })

  it('says missing when the chosen id has no live version', async () => {
    await saveSettings({ theme: 'plain' })
    storeThemeId('broadsheet')
    expect(await chosenThemeHealth(await getSettings())).toEqual({ ok: false, id: 'broadsheet', why: 'missing' })
  })

  it('says missing when every version was soft-deleted under a stored choice', async () => {
    await wearInstalled()
    await removeTheme('broadsheet')
    // `removeTheme` puts the blog back on plain; a backup taken before that could still name it.
    storeThemeId('broadsheet')
    expect(await chosenThemeHealth(await getSettings())).toEqual({ ok: false, id: 'broadsheet', why: 'missing' })
  })

  it('says unreadable when the live row holds a manifest the renderer refuses', async () => {
    await wearInstalled()
    db().run(`update themes set manifest = '{not json' where theme_id = 'broadsheet'`)
    forgetInstalledTheme()
    expect(await chosenThemeHealth(await getSettings())).toEqual({ ok: false, id: 'broadsheet', why: 'unreadable' })
  })

  it('says sheet_missing when theme.css is not in the blob store', async () => {
    const hash = await wearInstalled()
    rmSync(join(STORE, 'themes', hash, 'theme.css'))
    expect(await chosenThemeHealth(await getSettings())).toEqual({ ok: false, id: 'broadsheet', why: 'sheet_missing' })
  })

  it('does not blame a theme that is installed but not chosen', async () => {
    const hash = await wearInstalled()
    await saveSettings({ theme: 'paper' })
    rmSync(join(STORE, 'themes', hash, 'theme.css'))
    expect(await chosenThemeHealth(await getSettings())).toEqual({ ok: true })
  })
})
