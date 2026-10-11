// The chrome font a blog from before themes reads (ADR 0072). Through 2.2.19 the three built-in
// sheets each set the chrome in a face of their own and the stored chrome font drew nothing
// there. Now that the sheets leave the chrome to the setting, a row from then reads the face
// its readers actually saw, so nothing on a running blog changes; a row written since keeps
// what the owner chose. Read, never migrated.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { one } from '@/store/query'
import { resetSettingsCache, getSettings, saveSettings } from '@/content/settings'
import { BUILTIN_THEMES } from '@/content/themes-builtin'
import { isChromeFontId } from '@/content/fonts'

const DIR = './.tmp/test-settings-chrome-legacy'
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
const storedRow = (): Record<string, unknown> =>
  JSON.parse(one<{ data: string }>(`select data from settings where id = 1`)!.data) as Record<string, unknown>
const chromeOf = async (row: unknown) => {
  write(row)
  return (await getSettings()).chromeFont
}

describe('a row from before themes (no theme key)', () => {
  it('reads the face each theme drew its chrome in, whatever it stored', async () => {
    expect(await chromeOf({ look: 'code', chromeFont: 'inter' })).toBe('jetbrains-mono')
    expect(await chromeOf({ look: 'code', chromeFont: 'reading' })).toBe('jetbrains-mono')
    expect(await chromeOf({ look: 'paper', chromeFont: 'jetbrains-mono' })).toBe('inter')
    expect(await chromeOf({ look: 'notes', chromeFont: 'plex-mono' })).toBe('inter')
  })

  it('reads the source-code theme from the switch older still, and its face with it', async () => {
    expect(await chromeOf({ ideChrome: true, chromeFont: 'reading' })).toBe('jetbrains-mono')
    expect(await chromeOf({ ideChrome: false, chromeFont: 'plex-mono' })).toBe('plex-mono')
  })

  it('wins over the boolean the chrome font replaced', async () => {
    expect(await chromeOf({ look: 'notes', fontChromeInter: false })).toBe('inter')
    expect(await chromeOf({ look: 'code', fontChromeInter: true })).toBe('jetbrains-mono')
  })

  it('keeps the stored choice on plain, which always drew it', async () => {
    expect(await chromeOf({ look: 'plain', chromeFont: 'plex-mono' })).toBe('plex-mono')
    expect(await chromeOf({ chromeFont: 'reading' })).toBe('reading')
    expect(await chromeOf({ look: 'plain', fontChromeInter: false })).toBe('reading')
  })

  it('counts a theme value that is not an id as no theme key, as the theme itself does', async () => {
    expect(await chromeOf({ theme: "bad'id", look: 'code', chromeFont: 'inter' })).toBe('jetbrains-mono')
    expect(await chromeOf({ theme: 42, look: 'notes', chromeFont: 'plex-mono' })).toBe('inter')
  })

  it('is read, not written: the row is untouched until the owner saves', async () => {
    write({ look: 'code', chromeFont: 'inter' })
    await getSettings()
    expect(storedRow()).toEqual({ look: 'code', chromeFont: 'inter' })
  })

  it('is what the first save after it writes, beside the theme, so it holds from then on', async () => {
    write({ look: 'notes', chromeFont: 'jetbrains-mono', title: 'Before' })
    await saveSettings({ title: 'After' })
    expect(storedRow()).toMatchObject({ theme: 'notes', chromeFont: 'inter', title: 'After' })
    expect((await getSettings()).chromeFont).toBe('inter')
  })

  it('gives way to a chrome font the owner chooses, and that choice stays', async () => {
    write({ look: 'code', chromeFont: 'inter' })
    await saveSettings({ chromeFont: 'plex-mono' })
    expect(storedRow()).toMatchObject({ theme: 'code', chromeFont: 'plex-mono' })
    expect((await getSettings()).chromeFont).toBe('plex-mono')
  })

  it('never takes back a choice saved at the same moment as an unrelated save', async () => {
    // The save queue runs these one after the other; whichever order, the explicit choice is
    // the one in the row afterwards, never the derived face.
    write({ look: 'paper', chromeFont: 'jetbrains-mono' })
    await Promise.all([saveSettings({ title: 'One' }), saveSettings({ chromeFont: 'plex-mono' })])
    expect(storedRow()).toMatchObject({ theme: 'paper', chromeFont: 'plex-mono' })
    write({ look: 'paper', chromeFont: 'jetbrains-mono' })
    await Promise.all([saveSettings({ chromeFont: 'plex-mono' }), saveSettings({ title: 'Two' })])
    expect(storedRow()).toMatchObject({ theme: 'paper', chromeFont: 'plex-mono' })
  })
})

describe('a row written since themes (theme key present)', () => {
  it('keeps the chrome font it stored, on every theme', async () => {
    expect(await chromeOf({ theme: 'code', look: 'code', chromeFont: 'inter' })).toBe('inter')
    expect(await chromeOf({ theme: 'paper', look: 'paper', chromeFont: 'jetbrains-mono' })).toBe('jetbrains-mono')
    expect(await chromeOf({ theme: 'notes', look: 'notes', chromeFont: 'reading' })).toBe('reading')
    expect(await chromeOf({ theme: 'plain', look: 'plain', chromeFont: 'plex-mono' })).toBe('plex-mono')
  })

  it('keeps it beside a theme this build does not ship, whatever look rides along', async () => {
    expect(await chromeOf({ theme: 'broadsheet', look: 'paper', chromeFont: 'plex-mono' })).toBe('plex-mono')
  })

  it('a fresh install reads the default, not a theme\'s face', async () => {
    expect((await getSettings()).chromeFont).toBe('inter')
  })
})

describe('the registry the rule reads', () => {
  it('names a real chrome font for every theme with a sheet, and none for plain', () => {
    for (const theme of BUILTIN_THEMES) {
      if (theme.sheet === null) expect(theme.legacyChromeFont).toBeNull()
      else expect(`${theme.id} ${isChromeFontId(theme.legacyChromeFont)}`).toBe(`${theme.id} true`)
    }
  })

  it('suggests a real chrome font wherever it suggests one', () => {
    for (const theme of BUILTIN_THEMES) {
      if (theme.suggests.chromeFont !== undefined) expect(isChromeFontId(theme.suggests.chromeFont)).toBe(true)
    }
  })
})
