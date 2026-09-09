// The notebook's receiving door (ADR 0045): the owner's alone, a form that posts to itself,
// and a bookmarklet when there is nothing to keep.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { getNote, getNoteIndex } from '@/content/notes'
import { clearCache } from '@/server/cache'

const DIR = './.tmp/test-clip'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
let cookie = ''

beforeEach(async () => {
  clearCache()
  for (const t of ['sessions', 'users', 'notes', 'activity_log', 'server_secrets']) db().run(`delete from ${t}`)
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
})

const asOwner = async (path: string, init: RequestInit = {}): Promise<Response> =>
  app.request(path, { ...init, headers: { cookie, 'sec-fetch-site': 'same-origin', ...(init.headers as Record<string, string> ?? {}) } })

const QUERY = '?url=https%3A%2F%2Fexample.com%2Freed&title=The%20reed%20pen&quote=every%20stroke%20starts%20wet&note=remember%20this'

describe('/notes/clip', () => {
  it('sends a stranger to sign in, and brings them back here afterwards', async () => {
    const res = await app.request(`/notes/clip${QUERY}`)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(`/login?next=${encodeURIComponent(`/notes/clip${QUERY}`)}`)
  })

  it('shows the owner the passage, its source and one form, with every field escaped', async () => {
    const res = await asOwner(`${QUERY.replace('title=The%20reed%20pen', 'title=%3Cb%3Ex%3C%2Fb%3E')}`.replace(/^\?/, '/notes/clip?'))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-robots-tag')).toBe('noindex')
    const html = await res.text()
    expect(html).toContain('<blockquote class="note-quote"><p>every stroke starts wet</p></blockquote>')
    expect(html).toContain('href="https://example.com/reed"')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('<form class="clip-form" method="post" action="/notes/clip">')
    expect(html).toContain('name="status" value="draft" checked')
    expect(html).toContain('remember this')
    // No inline script on the door: a form, and nothing a browser would run.
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)/)
  })

  it('refuses a source that is not http(s), and keeps the passage without it', async () => {
    const html = await asOwner('/notes/clip?url=javascript%3Aalert(1)&quote=kept').then((r) => r.text())
    expect(html).not.toContain('javascript:alert')
    expect(html).toContain('kept')
  })

  it('keeps the passage as a draft note on Keep, and shows the way to it', async () => {
    const body = new URLSearchParams({
      url: 'https://example.com/reed', title: 'The reed pen', quote: 'every stroke starts wet',
      note: 'remember this', status: 'draft',
    })
    const res = await asOwner('/notes/clip', {
      method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' },
    })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/notes/clip?saved=the-reed-pen')
    const note = await getNote('the-reed-pen')
    expect(note).toMatchObject({
      title: 'The reed pen', status: 'draft', content: 'remember this',
      sourceUrl: 'https://example.com/reed', sourceTitle: 'The reed pen', quote: 'every stroke starts wet',
    })
    const after = await asOwner('/notes/clip?saved=the-reed-pen').then((r) => r.text())
    expect(after).toContain('href="/notes/the-reed-pen"')
  })

  it('keeps a second passage from the same page under a dated name rather than refusing it', async () => {
    const body = () => new URLSearchParams({ url: 'https://example.com/reed', title: 'The reed pen', quote: 'one', status: 'draft' })
    const post = () => asOwner('/notes/clip', { method: 'POST', body: body(), headers: { 'content-type': 'application/x-www-form-urlencoded' } })
    await post()
    const second = await post()
    expect(second.status).toBe(303)
    expect(second.headers.get('location')).toMatch(/^\/notes\/clip\?saved=clip-\d+$/)
    expect((await getNoteIndex()).length).toBe(2)
  })

  it('refuses a Keep from anyone but the owner', async () => {
    const res = await app.request('/notes/clip', {
      method: 'POST', body: new URLSearchParams({ quote: 'x' }),
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin' },
    })
    expect(res.status).toBe(401)
    expect(await getNoteIndex()).toEqual([])
  })

  it('is the bookmarklet page when there is nothing to keep', async () => {
    const html = await asOwner('/notes/clip').then((r) => r.text())
    expect(html).toContain('class="clip-tool"')
    expect(html).toContain('href="javascript:')
    expect(html).toContain('%2Fnotes%2Fclip%3Furl%3D')
  })
})
