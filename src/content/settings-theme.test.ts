// `settings.theme`, and the old name it replaced (ADR 0072). No migration rewrites a row: the
// theme is READ from whichever name the row carries, and every save writes BOTH, so a blog that
// goes back to a build from before the rename still wears what its owner chose.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { one } from '@/store/query'
import { resetSettingsCache, getSettings, saveSettings } from '@/content/settings'
import { describeSettingsSave } from '@/content/settings-diff'

const DIR = './.tmp/test-settings-theme'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => {
  db().run(`delete from settings`)
  resetSettingsCache()
})

const write = (data: unknown) => {
  db().run(`insert or replace into settings (id, data) values (1, ?)`, [JSON.stringify(data)])
  resetSettingsCache()
}
const stored = (): Record<string, unknown> =>
  JSON.parse(one<{ data: string }>(`select data from settings where id = 1`)!.data) as Record<string, unknown>

describe('reading the theme', () => {
  it('is plain on a fresh install', async () => {
    const s = await getSettings()
    expect(s.theme).toBe('plain')
    expect(s.look).toBe('plain')
  })

  it('takes a stored theme over anything else in the row', async () => {
    write({ theme: 'notes', look: 'code', ideChrome: true })
    const s = await getSettings()
    expect(s.theme).toBe('notes')
    expect(s.look).toBe('notes')
  })

  it('reads a row from before the rename by its look', async () => {
    write({ look: 'paper' })
    expect((await getSettings()).theme).toBe('paper')
  })

  it('reads a row from before looks by its ideChrome switch, as it always did', async () => {
    write({ ideChrome: true })
    expect((await getSettings()).theme).toBe('code')
    write({ ideChrome: false })
    expect((await getSettings()).theme).toBe('plain')
  })

  it('keeps a well-formed theme this build does not ship, and its look says plain', async () => {
    // A later build installed it from a zip; coming back here must not lose it.
    write({ theme: 'broadsheet', look: 'paper' })
    const s = await getSettings()
    expect(s.theme).toBe('broadsheet')
    expect(s.look).toBe('plain')
  })

  it('does not keep a value that is not an id, and reads the look instead', async () => {
    for (const bad of [42, "bad'id", 'Has Space', 'UPPER', '-lead', 'two--hyphens', 'x'.repeat(41), { id: 'paper' }]) {
      write({ theme: bad })
      expect({ bad, theme: (await getSettings()).theme }).toEqual({ bad, theme: 'plain' })
    }
    write({ theme: "bad'id", look: 'notes' })
    expect((await getSettings()).theme).toBe('notes')
    write({ theme: 'x'.repeat(40) })
    expect((await getSettings()).theme).toBe('x'.repeat(40))
  })
})

describe('saving the theme', () => {
  it('writes theme AND look, equal for a built-in, so an older build keeps the choice', async () => {
    await saveSettings({ theme: 'paper' })
    expect((await getSettings()).theme).toBe('paper')
    const row = stored()
    expect(row.theme).toBe('paper')
    expect(row.look).toBe('paper')
  })

  it('still takes look, the old name, from a door that sends it', async () => {
    await saveSettings({ look: 'notes' })
    expect((await getSettings()).theme).toBe('notes')
    expect(stored().theme).toBe('notes')
  })

  it('reads a whole object sent back with only look edited as a change of look', async () => {
    // What a script does: read the settings, change one field, save the lot. The stored theme
    // rides along unchanged and must not be read as "keep the theme".
    const before = await getSettings()
    await saveSettings({ ...before, look: 'code' })
    expect((await getSettings()).theme).toBe('code')
  })

  it('lets theme win when both name a change', async () => {
    await saveSettings({ theme: 'paper', look: 'notes' })
    expect((await getSettings()).theme).toBe('paper')
  })

  it('keeps the current theme when the write names none at all', async () => {
    await saveSettings({ theme: 'code' })
    await saveSettings({ theme: "bad'id" })
    await saveSettings({ theme: 42 } as never)
    await saveSettings({ look: 'nonsense' } as never)
    await saveSettings({ title: 'Unrelated' })
    expect((await getSettings()).theme).toBe('code')
    expect(stored().look).toBe('code')
  })

  it('keeps a theme this build does not ship across an unrelated save', async () => {
    write({ theme: 'abc', look: 'paper' })
    await saveSettings({ title: 'x' })
    expect((await getSettings()).theme).toBe('abc')
    const row = stored()
    expect(row.theme).toBe('abc')
    expect(row.look).toBe('plain')
    // ...and across the whole object sent back, which carries look: plain beside it.
    await saveSettings({ ...(await getSettings()), title: 'y' })
    expect((await getSettings()).theme).toBe('abc')
  })

  it('ignores a write naming a theme this build does not ship, however well-formed', async () => {
    // A typo from any door (admin, MCP, the settings route, setup) must not blank the site.
    await saveSettings({ theme: 'paper' })
    await saveSettings({ theme: 'papr' })
    expect(stored()).toMatchObject({ theme: 'paper', look: 'paper' })
    // ...and beside a theme already kept from a later build, it changes nothing either.
    write({ theme: 'abc', look: 'plain' })
    await saveSettings({ theme: 'papr' })
    expect(stored()).toMatchObject({ theme: 'abc', look: 'plain' })
  })

  it('puts one change in the log, not the field and its mirror', async () => {
    const before = await getSettings()
    const after = await saveSettings({ theme: 'notes' })
    expect(describeSettingsSave(before, after)).toBe('theme')
  })

  it('two saves at once land one after the other, never a mix of the two', async () => {
    // The save queue serialises writes; theme and look must come from the same one.
    await Promise.all([saveSettings({ theme: 'paper' }), saveSettings({ look: 'notes' })])
    const row = stored()
    expect(row.theme).toBe(row.look)
    expect(row.theme).toBe('notes')
  })
})
