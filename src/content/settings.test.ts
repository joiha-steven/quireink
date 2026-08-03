// Settings is one JSON blob in one row, so the risk is not the query: it is that a
// malformed or partial blob silently reshapes the site. These cover the read contract
// (never throw, always merge over defaults) and Invariant 3 across the store boundary.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one } from '@/store/query'
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '@/content/settings'

const DIR = './.tmp/test-settings'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => db().run(`delete from settings`))

const write = (data: unknown) =>
  db().run(`insert into settings (id, data) values (1, ?)`, [JSON.stringify(data)])

describe('getSettings', () => {
  it('returns the defaults when no row exists', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('returns the defaults rather than throwing on a malformed blob', async () => {
    db().run(`insert into settings (id, data) values (1, 'not json')`)
    expect((await getSettings()).title).toBe(DEFAULT_SETTINGS.title)
  })

  it('merges a partial blob over the defaults', async () => {
    write({ title: 'My Blog' })
    const s = await getSettings()
    expect(s.title).toBe('My Blog')
    expect(s.postsPerPage).toBe(DEFAULT_SETTINGS.postsPerPage)
  })

  it('expands store-relative image refs on read (Invariant 3)', async () => {
    write({ logoUrl: 'files/logo.png', faviconUrl: 'files/fav.ico' })
    const s = await getSettings()
    expect(s.logoUrl).toBe('/uploads/files/logo.png')
    expect(s.faviconUrl).toBe('/uploads/files/fav.ico')
  })

  it('clamps out-of-range numbers and rejects an unknown theme preset', async () => {
    write({ relatedCount: 999, excerptLength: 1, themePreset: 'not-a-preset' })
    const s = await getSettings()
    expect(s.relatedCount).toBe(12)
    expect(s.excerptLength).toBe(10)
    expect(s.themePreset).toBe(DEFAULT_SETTINGS.themePreset)
  })
})

describe('saveSettings', () => {
  it('persists a change and merges the next partial over it', async () => {
    await saveSettings({ title: 'First', description: 'kept' })
    await saveSettings({ title: 'Second' })
    const s = await getSettings()
    expect(s).toMatchObject({ title: 'Second', description: 'kept' })
  })

  it('writes image refs store-relative, keeping the returned value absolute', async () => {
    const returned = await saveSettings({ faviconUrl: '/uploads/files/fav.ico' })
    expect(returned.faviconUrl).toBe('/uploads/files/fav.ico')
    const stored = JSON.parse(one<{ data: string }>(`select data from settings`)!.data)
    expect(stored.faviconUrl).toBe('files/fav.ico')
  })

  it('falls back to the default title rather than storing an empty one', async () => {
    expect((await saveSettings({ title: '   ' })).title).toBe(DEFAULT_SETTINGS.title)
  })

  it('keeps exactly one row however many times it is called', async () => {
    await saveSettings({ title: 'A' })
    await saveSettings({ title: 'B' })
    expect(one<{ n: number }>(`select count(*) n from settings`)!.n).toBe(1)
  })

  // A partial save must not change a field it never mentioned, and "merges over current" was
  // only ever tested on `title` and `description` — both of which happened to be written
  // with a fallback. Three union fields were not: `home.mode`, `home.front.kind` and
  // `home.front.lead.source` each hard-coded their DEFAULT instead, so any patch that
  // omitted `home` moved the homepage back to the post list.
  //
  // Reachable, not theoretical: `update_settings` over MCP builds a patch of at most title,
  // description and showDescription, under a comment promising that saveSettings merges over
  // current so nothing sensitive is touched. Changing the site title turned off a composed
  // front page.
  describe('a partial save leaves everything it did not mention alone', () => {
    it('keeps the homepage mode, the front-page kind and the lead source', async () => {
      await saveSettings({
        home: {
          mode: 'front',
          page: '',
          listPath: '/post',
          front: {
            ...DEFAULT_SETTINGS.home.front,
            kind: 'text',
            lead: { on: true, source: 'pinned', slug: 'chosen', secondary: 2 },
          },
        },
      })

      await saveSettings({ title: 'Only the title changed' })

      const s = await getSettings()
      expect(s.title).toBe('Only the title changed')
      expect(s.home.mode).toBe('front')
      expect(s.home.front.kind).toBe('text')
      expect(s.home.front.lead.source).toBe('pinned')
      expect(s.home.front.lead.slug).toBe('chosen')
    })

    // The same function reads the stored blob, where "unrecognised" has to mean the DEFAULT
    // rather than the current value — there is no current value at that point. Fixing the
    // save direction must not break the read direction.
    it('still falls back to the default when the STORED blob names a mode this build cannot render', async () => {
      write({ title: 'Stored', home: { mode: 'holographic', front: { kind: 'sculpture' } } })
      const s = await getSettings()
      expect(s.home.mode).toBe('list')
      expect(s.home.front.kind).toBe('image')
    })
  })
})
