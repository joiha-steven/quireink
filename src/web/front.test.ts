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

const DIR = './.tmp/test-front'
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
await savePost({ title: 'Tagged', slug: 'tagged', status: 'published', date: day(5),
  content: 'x', excerpt: 'The tagged thing.', categories: ['Film'],
  tags: ['the web', 'craft', 'writing'] })

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
    // The row HEADER specifically, and matched as an ELEMENT rather than as a class name
    // loose in the document. "Money" still appears on the lead as its own category label,
    // so asserting on the bare word passes for the wrong reason — and the class name alone
    // now also appears in the head, because the mono-chrome tracking correction has to name
    // `.front-label` in its selector list. A substring test against a whole document will
    // eventually match the stylesheet; this one did.
    expect(html).not.toContain('<h2 class="front-label"')
  })

  it('draws a category row that still has posts', async () => {
    const html = await front({
      lead: { on: false, source: 'latest', slug: '', secondary: 0 },
      strips: [{ category: 'Film', count: 3, columns: 3 }],
    })
    expect(html).toContain('<h2 class="front-label"')
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

// A heading is a promise about where it goes, and the continuation is the one way off the
// page. Both were wrong: every heading linked to the post list, so "Featured" handed the
// reader every post the blog has, and the way to that list was a bare link stranded under
// the last row.
describe('the headings and the way on', () => {
  /**
   * The document OUTLINE, which no screenshot shows and no size assertion catches.
   *
   * `.fc-title` sets every headline's size by class, so a wrong level is invisible on the
   * page and wrong in every outline built from it — a screen reader's rotor, a reader-mode
   * extension, an outline crawler. The lead row prints no label, so its stacked headlines
   * have nothing but the h1 above them; at h3 the page read h1 → h3 → h3 → h2, skipping a
   * level and then filing its most important stories below the section names underneath.
   */
  it('descends one level at a time, with the lead stack directly under the h1', async () => {
    const html = await front({
      lead: { on: true, source: 'latest', slug: '', secondary: 2 },
      strips: [{ category: 'Film', count: 2, columns: 3 }],
      latest: { on: false, count: 6, columns: 3 },
    })
    const levels = [...html.matchAll(/<h([1-6])[ >]/g)].map((m) => Number(m[1]))
    expect(levels[0]).toBe(1) // exactly one h1, and it is the lead
    expect(levels.filter((n) => n === 1)).toHaveLength(1)
    // No step DOWN the outline may skip a level. A step back up is ordinary.
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
    }
    // ...and specifically: the lead's stack is h2, level with the section labels that follow
    // rather than two steps below them.
    expect(levels.slice(0, 3)).toEqual([1, 2, 2])
  })

  it('links a category heading, because a category has a page', async () => {
    const html = await front({
      lead: { on: false, source: 'latest', slug: '', secondary: 0 },
      strips: [{ category: 'Film', count: 3, columns: 3 }],
      latest: { on: false, count: 6, columns: 3 },
    })
    expect(html).toContain(`<h2 class="front-label"><a class="link-accent" href="/category/film">Film</a>`)
  })

  it('leaves Featured and Most read as plain text, since neither names a page', async () => {
    const current = await getSettings()
    await saveSettings({ ...current, featured: ['third'] })
    const html = await front({
      lead: { on: false, source: 'latest', slug: '', secondary: 0 },
      featured: { on: true, count: 3, columns: 3 },
      latest: { on: false, count: 6, columns: 3 },
    })
    expect(html).toContain(`<h2 class="front-label">Featured</h2>`)
  })

  it('puts exactly one way on to the archive, on the last heading', async () => {
    const html = await front({
      lead: { on: true, source: 'latest', slug: '', secondary: 1 },
      strips: [{ category: 'Film', count: 2, columns: 2 }],
      latest: { on: true, count: 6, columns: 3 },
    })
    expect(html.split('front-more').length - 1).toBe(1)
    // Inside the LAST row's heading, which is what makes it part of the page rather than a
    // link left behind under it.
    const more = html.indexOf('front-more')
    const lastLabel = html.lastIndexOf('<h2 class="front-label"')
    expect(more).toBeGreaterThan(lastLabel)
    expect(html.indexOf('front-row', more)).toBe(-1)
  })

  it('draws no continuation when the only row is the lead', async () => {
    const html = await front({
      lead: { on: true, source: 'latest', slug: '', secondary: 3 },
      featured: { on: false, count: 3, columns: 3 },
      latest: { on: false, count: 6, columns: 3 },
    })
    expect(html).not.toContain('front-more')
  })
})

// Four cards across three columns is a full line and then ONE card with two thirds of the
// row empty beside it, which is what the Latest row looked like on a blog of any real size.
describe('how many columns a row gets', () => {
  const cols = (html: string) => [...html.matchAll(/front-grid cols-(\d)/g)].map((m) => m[1])

  it('drops a column rather than leave one card alone on the last line', async () => {
    const html = await front({
      lead: { on: false, source: 'latest', slug: '', secondary: 0 },
      featured: { on: false, count: 3, columns: 3 },
      latest: { on: true, count: 4, columns: 3 },
    })
    expect(cols(html)).toEqual(['2'])
  })

  it('keeps its columns when dropping one would not help', async () => {
    // Seven across three leaves one alone; across two it leaves one alone as well, so the
    // row keeps the three it was asked for rather than trading a ragged line for a taller row.
    for (const n of [7, 5, 3]) {
      await savePost({ title: `Filler ${n}`, slug: `filler-${n}`, status: 'published',
        date: day(1), content: 'x', excerpt: `Filler ${n}.` })
    }
    const html = await front({
      lead: { on: false, source: 'latest', slug: '', secondary: 0 },
      featured: { on: false, count: 3, columns: 3 },
      latest: { on: true, count: 5, columns: 3 },
    })
    expect(cols(html)).toEqual(['3'])
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

describe('the topic links beside a category heading', () => {
  // Every other tag surface prints a multi-word tag with dashes, because five of them in a
  // row with only a gap between them read as one sentence. This row was written without it
  // and shipped "the web" where the listing sidebar and the tag page both say "the-web".
  it('prints a multi-word tag the way the rest of the site does', async () => {
    const html = await front({
      lead: { on: false, source: 'latest', slug: '', secondary: 0 },
      strips: [{ category: 'Film', count: 3, columns: 3 }],
      tagLinks: true,
    })
    expect(html).toContain('>the-web</a>')
    expect(html).not.toContain('>the web</a>')
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

// Quire Ink auto-extracts an excerpt from the first paragraph when the author leaves it empty,
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
