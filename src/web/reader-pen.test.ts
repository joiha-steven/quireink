// The reader's pen reaches the page only through the owner's switch — and when it does, it
// arrives with everything the island needs and takes the quote gesture with it.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { PEN_LINES_SHEET, PEN_MARKS_SHEET } from '@/web/assets'

const DIR = './.tmp/test-reader-pen'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)

beforeEach(async () => {
  clearCache()
  for (const t of ['posts', 'post_terms', 'post_revisions', 'settings']) db().run(`delete from ${t}`)
  await savePost({ title: 'Marked', content: 'A plain paragraph with no ink on it.', status: 'published',
    date: '2020-01-01T00:00:00.000Z' })
})

describe("the reader's pen on a post page", () => {
  it('is on by default: the bundle, the two sheet names, the five inks and its words', async () => {
    const html = await get('/marked').then((r) => r.text())
    expect(html).toContain('data-reader-pen="1"')
    expect(html).toContain(`data-pen-sheets="${PEN_MARKS_SHEET} ${PEN_LINES_SHEET}"`)
    expect(html).toContain('data-pen-inks="d5f856,aaef83,faaad9,8ed6f9,fac881"')
    expect(html).toContain('data-reader-pen-note-hint=')
    expect(html).toContain('data-reader-pen-send="Send to my notebook"')
    // Tier two's words travel too; Google is a door only when the owner has configured it.
    expect(html).toContain('data-reader-pen-keep="Keep on every device"')
    expect(html).not.toContain('data-reader-pen-google')
    expect(html).toMatch(/<script src="\/assets\/reader-pen\.[a-z0-9]+\.js" defer><\/script>/)
    // A page with no ink still links no pen sheet: the island links them itself, later.
    expect(html).not.toMatch(/<link[^>]*pen-marks\./)
  })

  it('leaves nothing on the page when the owner turns it off', async () => {
    const s = await getSettings()
    await saveSettings({ features: { ...s.features, readerPen: false } })
    const html = await get('/marked').then((r) => r.text())
    expect(html).not.toContain('data-reader-pen')
    expect(html).not.toContain('reader-pen.')
    expect(html).not.toContain('data-pen-sheets')
  })

  it('stays off a listing: it is a gesture on an article, not on a feed', async () => {
    const html = await get('/').then((r) => r.text())
    expect(html).not.toContain('reader-pen.')
  })
})
