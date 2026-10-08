// The article head on a phone: the meta line in two short lines, the series box's head row and
// its progress bar, and the source-code look's smaller headline.
//
// The page is read as HTML and the sheets as text, which is the seam these things are decided
// at: the markup carries the pieces, the sheets decide which of them a phone shows.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { MOBILE_CSS } from '@/web/mobile.css'
import { SERIES_CSS } from '@/web/series.css'
import { LOOK_CODE_CSS } from '@/web/look-code.css'
import { BAR_MAX, seriesBar } from '@/web/series-box'

const DIR = './.tmp/test-article-meta'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))
const app = createApp()
const get = async (path: string): Promise<string> => (await app.request(path)).text()
const PAST = '2020-01-01T00:00:00.000Z'

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings', 'media', 'redirects']) {
    db().run(`delete from ${t}`)
  }
})

/** The text of the meta line's facts, the way a phone shows it: what the sheet hides, gone. */
function phoneLines(html: string): string[] {
  const facts = /<span class="post-facts">([\s\S]*?)<\/span><\/p>/.exec(html)?.[1] ?? ''
  // The book-mode key is hidden under 768px (`book.css.ts`), so a phone never shows it.
  const hideWords = facts.replace(/<span class="meta-book">[\s\S]*?<\/button><\/span>/, '').replace(/<span class="meta-words">[\s\S]*?<\/span><\/span>/, '')
  // Each .meta-by is a block of its own on a phone, and its .meta-sep is hidden.
  const parts = hideWords.replace(/<span class="meta-sep">[\s\S]*?<\/span>/, '').split('<span class="meta-by">')
  return parts.map((p) => p.replace(/<[^>]+>/g, '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim())
}

describe('the meta line on a phone', () => {
  it('is two lines, with no word count and no separator opening either', async () => {
    const base = await getSettings()
    await saveSettings({ author: { ...base.author, name: 'Ada Lovelace' } })
    await savePost({ title: 'Head', content: 'one two three four five', status: 'published', date: PAST })
    const html = await get('/head')
    // The sheet is what drops the word count and the byline's separator, and breaks the line.
    expect(MOBILE_CSS).toContain('.meta-words,.meta-by .meta-sep{display:none}')
    expect(MOBILE_CSS).toContain('.meta-by{display:block}')
    const [first, second] = phoneLines(html)
    expect(first).toMatch(/^\S.* · \d+ min read$/)
    expect(first).not.toContain('words')
    expect(second).toBe('by Ada Lovelace')
    for (const line of [first, second]) expect(line!.startsWith('·')).toBe(false)
  })

  it('keeps the word count and the one line from 640px: the hide is inside the phone media query', () => {
    const at = MOBILE_CSS.indexOf('.meta-words')
    expect(MOBILE_CSS.lastIndexOf('@media (max-width:639px)', at)).toBeGreaterThan(-1)
    expect(MOBILE_CSS.slice(MOBILE_CSS.lastIndexOf('@media (max-width:639px)', at), at)).not.toContain('@media (min')
  })

  it('has no second line without an author, and no figures with the reading time off', async () => {
    await savePost({ title: 'Plain', content: 'one two three', status: 'published', date: PAST })
    expect(phoneLines(await get('/plain'))).toHaveLength(1)
    const base = await getSettings()
    await saveSettings({ author: { ...base.author, name: 'Ada' }, features: { ...base.features, readingTime: false } })
    clearCache()
    const html = await get('/plain')
    expect(html).not.toContain('meta-words')
    expect(phoneLines(html)).toEqual([expect.stringMatching(/^\S/), 'by Ada'])
    expect(phoneLines(html)[0]).not.toContain('min read')
  })
})

describe('the series box', () => {
  const part = (title: string, order: number) =>
    savePost({ title, content: 'body', status: 'published', date: PAST, series: 'Notes', seriesOrder: order })

  it('has the name and the part on one head row, a decorative bar, and the list', async () => {
    for (const [i, n] of ['One', 'Two', 'Three', 'Four'].entries()) await part(n, i)
    const html = await get('/two')
    expect(html).toMatch(/<p class="series-head"><span class="series-name"><a [^>]*href="\/series\/notes">Notes<\/a><\/span> <span class="series-part">[^<]+ 2\/4<\/span><\/p>/)
    const bar = /<div class="series-bar[^"]*" aria-hidden="true">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? ''
    expect(bar.match(/<i/g)).toHaveLength(4)
    // The first two parts (the one read and the current one) are filled, the rest are not.
    expect(bar).toBe('<i class="on"></i><i class="on"></i><i></i><i></i>')
    expect(html).toContain('<ol><li><a href="/one">')
    expect(html).toContain('<li aria-current="page">Two</li>')
  })

  it('keeps a long series on one row: segments are capped and the gap narrows', () => {
    const short = seriesBar(4, 1)
    expect(short).not.toContain('series-bar-dense')
    const thirty = seriesBar(30, 9)
    expect(thirty.match(/<i/g)).toHaveLength(30)
    expect(thirty.match(/<i class="on">/g)).toHaveLength(10)
    expect(thirty).toContain('series-bar-dense')
    const huge = seriesBar(200, 199)
    expect(huge.match(/<i/g)).toHaveLength(BAR_MAX)
    expect(huge.match(/<i class="on">/g)).toHaveLength(BAR_MAX)
    expect(SERIES_CSS).toContain('grid-auto-columns:minmax(0,1fr)')
  })

  it('lets the name wrap, never the part indicator', () => {
    expect(SERIES_CSS).toContain('.series-part{flex:none;margin-left:auto;white-space:nowrap')
    expect(SERIES_CSS).toMatch(/\.series-name\{flex:1 1 9rem;min-width:0\}/)
  })
})

describe('the source-code look headline', () => {
  it('is derived from the owner\'s h1 and only under 640px', () => {
    const at = LOOK_CODE_CSS.indexOf('html[data-look=code] article > header h1{font-size:calc(var(--fs-h1) * .8)}')
    expect(at).toBeGreaterThan(-1)
    expect(LOOK_CODE_CSS.lastIndexOf('@media (max-width:639px)', at)).toBeGreaterThan(LOOK_CODE_CSS.lastIndexOf('}\n', at - 3) - 1)
    expect(LOOK_CODE_CSS.slice(at, at + 120)).not.toMatch(/font-size:\d/)
  })
})
