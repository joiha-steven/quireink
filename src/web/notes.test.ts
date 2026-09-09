// The notebook on the reading side (ADR 0044): its own address, apart from the posts.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { saveNote } from '@/content/notes'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-notes-web'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)
const PAST = '2020-01-01T00:00:00.000Z'

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'post_terms', 'pages', 'notes', 'redirects']) db().run(`delete from ${t}`)
})

describe('/notes', () => {
  it('lists published notes newest first, a clip with where it came from, and never a draft', async () => {
    await saveNote({ title: 'Older thought', content: 'x', status: 'published', date: PAST })
    await saveNote({ title: 'Newer thought', content: 'x', status: 'published', date: '2021-01-01T00:00:00.000Z' })
    await saveNote({ title: 'Private', content: 'x', status: 'draft', date: '2022-01-01T00:00:00.000Z' })
    await saveNote({ content: 'kept', status: 'published', date: '2020-06-01T00:00:00.000Z',
      sourceUrl: 'https://example.com/reed', sourceTitle: 'The reed pen', quote: 'every stroke starts wet' })
    const html = await get('/notes').then((r) => r.text())
    expect(html.indexOf('Newer thought')).toBeLessThan(html.indexOf('Older thought'))
    expect(html).not.toContain('Private')
    expect(html).toContain('href="/notes/the-reed-pen"')
    expect(html).toContain('href="https://example.com/reed"')
    expect(html).toContain('every stroke starts wet')
  })

  it('says so when there is nothing yet', async () => {
    const html = await get('/notes').then((r) => r.text())
    expect(html).toContain('No notes yet.')
  })

  it('serves one note with its passage above the owner words, and 404s a draft or a future one', async () => {
    await saveNote({ title: 'Kept', content: 'My own words.', status: 'published', date: PAST,
      sourceUrl: 'https://example.com/a', sourceTitle: 'Source A', quote: 'The passage.' })
    await saveNote({ title: 'Hidden', content: 'x', status: 'draft', date: PAST })
    await saveNote({ title: 'Later', content: 'x', status: 'published', date: '2999-01-01T00:00:00.000Z' })
    const res = await get('/notes/kept')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html.indexOf('The passage.')).toBeLessThan(html.indexOf('My own words.'))
    expect(html).toContain('From <a class="link-accent u-quotation-of" href="https://example.com/a"')
    expect(html).toContain('<link rel="canonical" href="http://localhost:3000/notes/kept">')
    expect((await get('/notes/hidden')).status).toBe(404)
    expect((await get('/notes/later')).status).toBe(404)
    expect((await get('/notes/nothing-here')).status).toBe(404)
  })

  it('keeps a note out of the post namespace, the post feed and the home page', async () => {
    await savePost({ title: 'A post', content: 'post body', status: 'published', date: PAST })
    await saveNote({ title: 'A note', content: 'note body', status: 'published', date: PAST })
    expect((await get('/a-note')).status).toBe(404)
    expect(await get('/').then((r) => r.text())).not.toContain('A note')
    expect(await get('/feed.xml').then((r) => r.text())).not.toContain('A note')
  })

  it('names the notebook and each note in the sitemap, under /notes/', async () => {
    await saveNote({ title: 'Listed', content: 'x', status: 'published', date: PAST })
    const xml = await get('/sitemap.xml').then((r) => r.text())
    expect(xml).toContain('<loc>http://localhost:3000/notes</loc>')
    expect(xml).toContain('<loc>http://localhost:3000/notes/listed</loc>')
  })

  it('follows a rename with a permanent redirect', async () => {
    await saveNote({ title: 'First', content: 'x', status: 'published', date: PAST })
    await saveNote({ title: 'Second', content: 'x', status: 'published', date: PAST }, 'first')
    clearCache()
    const res = await get('/notes/first')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/notes/second')
  })
})
