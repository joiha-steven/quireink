// The composed front page. ADR 0014, part 2.
//
// What is worth pinning here is not "does it render" but the three rules that are easy to
// break later and silent when broken: a post appears ONCE, a row that has run dry does not
// draw an empty heading, and the picture comes AFTER the headline in source order.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import type { FrontSettings } from '@/types'
import { DEFAULT_HOME } from '@/content/settings-sanitize'

const DIR = './.tmp-test-front'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const day = (n: number) => `2020-01-${String(n).padStart(2, '0')}T00:00:00.000Z`

await savePost({ title: 'Newest', slug: 'newest', status: 'published', date: day(9),
  content: 'x', excerpt: 'The newest thing.', categories: ['Money'] })
await savePost({ title: 'Second', slug: 'second', status: 'published', date: day(8),
  content: 'x', excerpt: 'The second thing.', categories: ['Money'] })
await savePost({ title: 'Third', slug: 'third', status: 'published', date: day(7),
  content: 'x', excerpt: 'The third thing.', categories: ['Film'] })
await savePost({ title: 'Fourth', slug: 'fourth', status: 'published', date: day(6),
  content: 'x', excerpt: 'The fourth thing.', categories: ['Film'] })

/**
 * Render `/` with a front page built from the DEFAULTS plus this patch.
 *
 * From the defaults, not from whatever the previous test left behind: merging onto the
 * stored settings made one test's `strips` leak into the next one's page, which failed as
 * a missing standfirst and looked like a renderer bug for a while.
 */
async function front(patch: Partial<FrontSettings> = {}): Promise<string> {
  const current = await getSettings()
  await saveSettings({
    ...current,
    home: { ...current.home, mode: 'front', front: { ...DEFAULT_HOME.front, ...patch } },
  })
  clearCache()
  return await (await app.request('/')).text()
}

beforeEach(async () => {
  const current = await getSettings()
  await saveSettings({ ...current, featured: [] })
  clearCache()
})

describe('the front page', () => {
  it('leads with the newest post and stacks headlines under it', async () => {
    const html = await front({ lead: { on: true, source: 'latest', slug: '', secondary: 2 } })
    expect(html).toContain('fc-lead')
    expect(html).toContain('Newest')
    expect(html).toContain('front-secondary')
  })

  it('pins the post the owner chose', async () => {
    const html = await front({ lead: { on: true, source: 'pinned', slug: 'third', secondary: 0 } })
    // The lead block is the first thing in the page body, so the pinned title precedes the
    // newest one in source order.
    expect(html.indexOf('Third')).toBeLessThan(html.indexOf('Newest'))
  })

  it('falls back to the newest post when the pinned one is not public', async () => {
    const html = await front({ lead: { on: true, source: 'pinned', slug: 'gone', secondary: 0 } })
    expect(html).toContain('Newest')
  })

  // The rule that keeps a small blog from looking like a site with three posts.
  it('never shows the same post twice', async () => {
    const html = await front({
      lead: { on: true, source: 'latest', slug: '', secondary: 1 },
      strips: [{ category: 'Money', count: 3, columns: 3 }],
      latest: { on: true, count: 6, columns: 3 },
    })
    const times = html.split('href="/newest"').length - 1
    expect(times).toBe(1)
  })

  it('skips a category row that has run dry instead of drawing an empty heading', async () => {
    // Money has two posts and both are taken by the lead and its secondary.
    const html = await front({
      lead: { on: true, source: 'latest', slug: '', secondary: 1 },
      strips: [{ category: 'Money', count: 3, columns: 3 }],
      latest: { on: false, count: 6, columns: 3 },
    })
    // The row HEADER specifically. "Money" still appears on the lead, as its own category
    // label — asserting on the bare word passes for the wrong reason.
    expect(html).not.toContain('front-label')
  })

  it('draws a category row that still has posts', async () => {
    const html = await front({
      lead: { on: false, source: 'latest', slug: '', secondary: 0 },
      strips: [{ category: 'Film', count: 3, columns: 3 }],
    })
    expect(html).toContain('front-label')
    expect(html).toContain('>Film</a>')
    expect(html).toContain('Third')
  })

  it('runs full width: the front page has no discovery rail', async () => {
    const html = await front()
    expect(html).not.toContain('rail-left')
    expect(html).not.toContain('rail-right')
  })

  it('has no h1 but the lead, so the outline has one entry point', async () => {
    const html = await front({ lead: { on: true, source: 'latest', slug: '', secondary: 0 } })
    expect(html.split('<h1').length - 1).toBe(1)
  })
})

describe('the two kinds', () => {
  // Both kinds print a standfirst on a card; the text kind prints roughly twice as much,
  // because with no picture in the row the words are the only thing filling it. The image
  // kind printed NONE until the owner looked at a real page and said it read as mostly white.
  it('gives the text kind about twice the standfirst of the image kind', async () => {
    const deck = (html: string) => {
      const m = html.match(/class="fc-deck reading-font">([^<]*)</)
      return (m?.[1] ?? '').length
    }
    const long = 'A standfirst long enough that the two kinds have to clamp it at different '
      + 'lengths, which is the whole point of the setting and cannot be seen on a short one.'
    await savePost({ title: 'Clamped', slug: 'clamped', status: 'published', date: '2020-02-01T00:00:00.000Z',
      content: 'Body.', excerpt: long })
    const image = deck(await front({ kind: 'image', lead: { on: false, source: 'latest', slug: '', secondary: 0 } }))
    const text = deck(await front({ kind: 'text', lead: { on: false, source: 'latest', slug: '', secondary: 0 } }))
    expect(image).toBeGreaterThan(0)
    expect(text).toBeGreaterThan(image)
  })

  it('marks the kind on the container, since the sheet reads it', async () => {
    expect(await front({ kind: 'text' })).toContain('front-text')
    expect(await front({ kind: 'image' })).toContain('front-image')
  })
})

describe('what an item says', () => {
  it('drops the date and the reading time when the owner turns them off', async () => {
    const on = await front({ showDate: true })
    expect(on).toContain('<time')
    const off = await front({ showDate: false, showReadingTime: false })
    expect(off).not.toContain('fc-meta')
  })
})

// Quire auto-extracts an excerpt from the first paragraph when the author leaves it empty,
// so on a normal blog the standfirst IS the first line of the piece. Printing both puts the
// same sentence on the front page twice, one under the other.
describe('the lead opening', () => {
  it('prints the body under the standfirst', async () => {
    const html = await front({ lead: { on: true, source: 'pinned', slug: 'newest', secondary: 0 } })
    expect(html).toContain('fc-intro')
  })

  it('does not repeat the standfirst when the body starts with it', async () => {
    await savePost({
      title: 'Doubled', slug: 'doubled', status: 'published', date: day(9),
      excerpt: 'A sentence that opens the piece.',
      content: 'A sentence that opens the piece. And then it carries on to a second one.',
    }, 'doubled')
    const html = await front({ lead: { on: true, source: 'pinned', slug: 'doubled', secondary: 0 } })
    expect(html.split('A sentence that opens the piece.').length - 1).toBe(1)
    expect(html).toContain('And then it carries on')
  })
})
