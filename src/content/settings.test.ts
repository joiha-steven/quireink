// Settings is one JSON blob in one row, so the risk is not the query: it is that a
// malformed or partial blob silently reshapes the site. These cover the read contract
// (never throw, always merge over defaults) and Invariant 3 across the store boundary.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

describe('a blob that has gone wrong', () => {
  it('refuses a value of the wrong type instead of storing it', async () => {
    // The route hands over parsed JSON, and JSON has no types worth trusting. A number in
    // `title` used to throw inside `.trim()` and come back a 500; a number in `description`
    // was stored, and then every public page threw at `escapeHtml` until somebody put a
    // string back through the API — which the settings screen could not do, because it loads
    // the same block.
    const wrong = { title: 5, description: 5, footer: 5, showLogo: 'yes', postsPerPage: 'lots' }
    const saved = await saveSettings(wrong as unknown as Parameters<typeof saveSettings>[0])
    expect(saved.title).toBe(DEFAULT_SETTINGS.title)
    expect(saved.description).toBe(DEFAULT_SETTINGS.description)
    expect(saved.footer).toBe(DEFAULT_SETTINGS.footer)
    expect(saved.showLogo).toBe(DEFAULT_SETTINGS.showLogo)
    expect(saved.postsPerPage).toBe(DEFAULT_SETTINGS.postsPerPage)
    expect((await getSettings()).description).toBe(DEFAULT_SETTINGS.description)
  })

  it('clamps a stored scalar on the way OUT as well', async () => {
    // Nothing writes these any more, but a blob is also a file on disk, an import and a row
    // written by an older version. `postsPerPage: 0` reached the paginator and made the page
    // count Infinity.
    write({ postsPerPage: 0, contentWidth: 20, relatedCount: 'many', title: 5 })
    const s = await getSettings()
    // Clamped to the floor, the same answer the write path gives the same value. What
    // matters is that it is a number the paginator can divide by.
    expect(s.postsPerPage).toBe(1)
    expect(s.contentWidth).toBe(360)
    // Not a number at all, so the default rather than an edge of the range.
    expect(s.relatedCount).toBe(DEFAULT_SETTINGS.relatedCount)
    expect(s.title).toBe(DEFAULT_SETTINGS.title)
  })

  it('keeps a copy of an unreadable blob before writing over it', async () => {
    // Reading it answers with the defaults, and this is what writes them back: one corrupt
    // byte turned the next press of Save into a factory reset with nothing to go back to.
    db().run(`insert into settings (id, data) values (1, 'not json, and full of choices')`)
    await saveSettings({ title: 'Starting again' })

    const kept = readdirSync(DIR).filter((f) => f.startsWith('settings-unreadable-'))
    expect(kept).toHaveLength(1)
    expect(readFileSync(`${DIR}/${kept[0]}`, 'utf8')).toBe('not json, and full of choices')
    expect(existsSync(`${DIR}/quire.db`)).toBe(true)
  })
})

describe('two saves at once', () => {
  it('does not let the second silently erase the first', async () => {
    // A read-modify-write with several awaits in the middle: the whole block is read, a logo
    // may be re-rendered, and only then is everything written back from what was read at the
    // start. The rail saves on every drag and the MCP tools call this too, so two in flight
    // is not a hypothetical.
    await saveSettings({ title: 'A blog', description: 'about things' })
    const [a, b] = await Promise.all([
      saveSettings({ title: 'A new name' }),
      saveSettings({ description: 'about other things' }),
    ])
    const after = await getSettings()
    expect(after.title).toBe('A new name')
    expect(after.description).toBe('about other things')
    // And whichever ran second saw the first: no answer is missing half the change.
    expect([a?.title, b?.title]).toContain('A new name')
  })
})
