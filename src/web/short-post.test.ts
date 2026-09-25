// A post with no title — a short post (ADR 0064). It is a post everywhere a post is, and
// every place that draws a post's name either draws its words instead or calls it by them.
// Its own file (same harness as read-next.test.ts, own database directory).
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { DEFAULT_HOME } from '@/content/settings-sanitize'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-short-post'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const text = async (path: string): Promise<string> => (await app.request(path)).text()

const WORDS = 'Just shipped the new reading mode, and it is quieter than I hoped.'
let slug = ''

beforeAll(async () => {
  await savePost({ title: 'A titled essay', content: 'Long form words.', status: 'published',
    date: '2020-01-01T00:00:00.000Z', tags: ['craft'] })
  const short = await savePost({ content: WORDS, status: 'published', date: '2020-01-02T00:00:00.000Z',
    tags: ['craft'], categories: ['Notes'] })
  slug = short.slug
  clearCache()
})

describe('a short post', () => {
  it('is addressed by its first words, not by the clock', () => {
    expect(slug).toBe('just-shipped-the-new-reading-mode')
  })

  it('reads without a headline, and the tab calls it by its words', async () => {
    const page = await text(`/${slug}`)
    expect(page).toContain(WORDS)
    expect(page).not.toContain('fs-h1 font-semibold">')
    expect(page).not.toContain('<p class="deck">')
    expect(page).toMatch(/<title>Just shipped the new reading mode, and it is quieter than I hoped\.? · /)
  })

  it('is in the blog list as its words, with the date as the way in', async () => {
    const list = await text('/')
    expect(list).toContain(`<a class="link-accent" href="/${slug}" aria-label="`)
    expect(list).toContain('Just shipped the new reading mode')
    // The titled post keeps its headline beside it.
    expect(list).toContain('>A titled essay</a>')
    expect(list).not.toContain(`href="/${slug}"></a>`)
  })

  it('is in the RSS feed with no title, its words as the description', async () => {
    const xml = await text('/feed.xml')
    const item = xml.split('<item>').find((i) => i.includes(`/${slug}</link>`)) ?? ''
    expect(item).not.toBe('')
    expect(item).not.toContain('<title>')
    expect(item).toContain('<description>Just shipped the new reading mode')
    expect(xml).toContain('<title>A titled essay</title>')
  })

  it('is in the JSON feed with no title and its words as the text', async () => {
    const feed = JSON.parse(await text('/feed.json')) as { items: Record<string, string>[] }
    const item = feed.items.find((i) => i.url?.endsWith(`/${slug}`))
    expect(item).toBeDefined()
    expect(item!.title).toBeUndefined()
    expect(item!.content_text).toStartWith('Just shipped')
  })

  it('is named by its words where a name is the only thing a line can hold', async () => {
    expect(await text('/llms.txt')).toContain(`- [Just shipped the new reading mode`)
    // The other post's "read next" points at it by its words, never by an empty link.
    const essay = await text('/a-titled-essay')
    expect(essay).toContain(`href="/${slug}">Just shipped the new reading mode`)
    expect(await text('/tag/craft')).toContain(`href="/${slug}"`)
  })

  it('shows on the composed front page as its linked words', async () => {
    const current = await getSettings()
    await saveSettings({ ...current, home: { ...current.home, mode: 'front', front: { ...DEFAULT_HOME.front } } })
    clearCache()
    const front = await text('/')
    expect(front).toContain(`<a href="/${slug}">Just shipped the new reading mode`)
    expect(front).not.toContain(`href="/${slug}"></a>`)
    await saveSettings(current)
    clearCache()
  })
})
