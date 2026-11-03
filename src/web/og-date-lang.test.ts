// THE SHARE CARD DATES A PIECE IN THE PIECE'S OWN LANGUAGE (ADR 0074).
//
// An English post on a Vietnamese blog was shared as a card with an English headline and
// "1 thg 1, 2020" under it: the date was formatted in settings.language like the site's chrome,
// and the card has no chrome. A piece with no language, and a date the card's faces cannot
// draw, keep the site's.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { savePost } from '@/content/posts'
import { saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { formatDate } from '@/i18n/format'

const DIR = './.tmp/test-og-date-lang'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const SITE = 'https://blog.example.com'
const PAST = '2020-01-01T12:00:00.000Z'

/** The `date` the article's og:image hands the card. */
async function cardDate(slug: string): Promise<string | null> {
  const html = await (await app.request(`/${slug}`)).text()
  const image = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1] ?? ''
  return new URL(image.replaceAll('&amp;', '&')).searchParams.get('date')
}

beforeEach(async () => {
  clearCache()
  for (const t of ['posts', 'post_terms', 'settings']) db().run(`delete from ${t}`)
  await saveSettings({ title: 'Sổ tay', siteUrl: SITE, language: 'vi', timezone: 'UTC' })
})

describe("the share card's date", () => {
  it('is in the language the piece names', async () => {
    await savePost({ title: 'An English essay', slug: 'essay', content: 'Words.', status: 'published', date: PAST, lang: 'en' })
    expect(await cardDate('essay')).toBe(formatDate(PAST, 'en', 'UTC'))
    expect(formatDate(PAST, 'en', 'UTC')).not.toBe(formatDate(PAST, 'vi', 'UTC'))
  })

  it("is the site's for a piece that names none, as every card was before", async () => {
    await savePost({ title: 'Bài không đặt ngôn ngữ', slug: 'bai', content: 'Chữ.', status: 'published', date: PAST })
    expect(await cardDate('bai')).toBe(formatDate(PAST, 'vi', 'UTC'))
  })

  it("is the site's when the card cannot draw the piece's, rather than a card with no foot", async () => {
    await savePost({ title: 'Kanji in the date only', slug: 'nihon', content: 'Latin words.', status: 'published', date: PAST, lang: 'ja' })
    expect(formatDate(PAST, 'ja', 'UTC')).toContain('年')
    expect(await cardDate('nihon')).toBe(formatDate(PAST, 'vi', 'UTC'))
  })

  it('makes another card address when the language changes, so no card drawn before answers for it', async () => {
    await savePost({ title: 'Same words', slug: 'same', content: 'Words.', status: 'published', date: PAST })
    const before = await cardDate('same')
    await savePost({ title: 'Same words', slug: 'same', content: 'Words.', status: 'published', date: PAST, lang: 'fr' }, 'same')
    clearCache()
    const after = await cardDate('same')
    expect(after).toBe(formatDate(PAST, 'fr', 'UTC'))
    expect(after).not.toBe(before)
  })
})
