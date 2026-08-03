// The two endpoints a reader can WRITE to: comments and newsletter sign-up.
//
// Everything else on the public site is a read. These two accept input from anyone on the
// internet, so the assertions worth having are about what they refuse: a comment on a
// draft, a flood, a `javascript:` website, an unsubscribe on GET.

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { payload } from '@/test/api'

const DIR = './.tmp/test-interactive'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const PAST = '2020-01-01T00:00:00.000Z'
const FUTURE = '2099-01-01T00:00:00.000Z'

/**
 * A POST from a reader.
 *
 * Every case passes its OWN ip. `rateLimited` keeps module-level state that outlives a
 * test, so a shared default silently accumulates hits from earlier cases and later ones
 * start failing with 429 for reasons that have nothing to do with what they assert.
 */
const post = (path: string, body: unknown, ip = '203.0.113.1'): Promise<Response> =>
  Promise.resolve(app.request(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  }))

const get = async (path: string): Promise<Response> => app.request(path)

const COMMENT = { name: 'Reader', email: 'reader@example.com', content: 'Nice post' }

/**
 * Put a subscriber straight into the table.
 *
 * Via `query().run()` rather than `db().run()`: the latter types its rest parameter as an
 * array OF binding arrays, which no spread of plain values satisfies. Same trap as
 * `store/query.ts`.
 */
const seedSubscriber = (email: string, status: string, token: string) =>
  db().query(
    `insert into subscribers (email, status, token, created_at) values ($email, $status, $token, $at)`,
  ).run({ email, status, token, at: Date.now() })

beforeEach(async () => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings', 'comments', 'subscribers']) {
    db().run(`delete from ${t}`)
  }
  const { comments } = await getSettings()
  await saveSettings({ comments: { ...comments, enabled: true, turnstile: false } })
})

describe('POST /api/comments', () => {
  const publish = () => savePost({ title: 'A Post', content: 'body', status: 'published', date: PAST })

  it('accepts a comment on a published post', async () => {
    await publish()
    const res = await post('/api/comments', { postSlug: 'a-post', ...COMMENT }, '203.0.113.11')
    expect(res.status).toBe(200)
    const { comment } = await payload<{ comment: Record<string, unknown> }>(res)
    expect(comment.name).toBe('Reader')
    expect(comment.contentHtml).toContain('Nice post')
  })

  it('never returns an email address to a reader', async () => {
    await publish()
    await post('/api/comments', { postSlug: 'a-post', ...COMMENT }, '203.0.113.12')
    const body = await get('/api/comments?post=a-post').then((r) => r.text())
    // The address is stored, for reply notifications. It must not leave the server.
    expect(body).toContain('Nice post')
    expect(body).not.toContain('reader@example.com')
  })

  it('refuses a comment on a draft or a future-dated post', async () => {
    await savePost({ title: 'Draft', content: 'x', status: 'draft', date: PAST })
    await savePost({ title: 'Later', content: 'x', status: 'published', date: FUTURE })
    // Otherwise an unpublished slug is a place to store text on someone else's server.
    expect((await post('/api/comments', { postSlug: 'draft', ...COMMENT }, '203.0.113.13')).status).toBe(404)
    expect((await post('/api/comments', { postSlug: 'later', ...COMMENT }, '203.0.113.14')).status).toBe(404)
    expect((await post('/api/comments', { postSlug: 'nope', ...COMMENT }, '203.0.113.15')).status).toBe(404)
  })

  it('requires a name and a plausible email', async () => {
    await publish()
    const bad = [
      { ...COMMENT, name: '' },
      { ...COMMENT, name: 'x'.repeat(81) },
      { ...COMMENT, email: 'not-an-email' },
      { ...COMMENT, content: '' },
    ]
    for (const [i, body] of bad.entries()) {
      expect((await post('/api/comments', { postSlug: 'a-post', ...body }, `203.0.113.2${i}`)).status).toBe(400)
    }
  })

  it('strips a javascript: website rather than storing it', async () => {
    await publish()
    // A stored `javascript:` URL rendered as a link is an XSS on every reader of the post.
    const res = await post('/api/comments', {
      postSlug: 'a-post', ...COMMENT, website: 'javascript:alert(1)',
    }, '203.0.113.16')
    expect(res.status).toBe(200)
    const body = await get('/api/comments?post=a-post').then((r) => r.text())
    expect(body).not.toContain('javascript:')
  })

  it('keeps an http website', async () => {
    await publish()
    await post('/api/comments', { postSlug: 'a-post', ...COMMENT, website: 'https://example.com' }, '203.0.113.17')
    expect(await get('/api/comments?post=a-post').then((r) => r.text())).toContain('example.com')
  })

  it('caps one IP', async () => {
    await publish()
    const statuses: number[] = []
    for (let i = 0; i < 9; i++) {
      statuses.push((await post('/api/comments', { postSlug: 'a-post', ...COMMENT, content: `c${i}` }, '198.51.100.9')).status)
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0)
  })

  it('is off entirely when the owner turns comments off', async () => {
    await publish()
    const { comments } = await getSettings()
    await saveSettings({ comments: { ...comments, enabled: false } })
    expect((await post('/api/comments', { postSlug: 'a-post', ...COMMENT }, '203.0.113.18')).status).toBe(403)
    // And the read side returns an empty list rather than an error, so the island renders
    // nothing and the page is unaffected.
    expect(await payload<{ comments: unknown[] }>(get('/api/comments?post=a-post'))).toEqual({ comments: [] })
  })
})

describe('POST /api/subscribe', () => {
  it('creates a PENDING subscriber, not a confirmed one', async () => {
    const res = await post('/api/subscribe', { email: 'new@example.com' })
    expect(res.status).toBe(200)
    // No mail server is configured here, and the row exists anyway: the owner can still
    // see the sign-up. Double opt-in means the address gets nothing until it clicks.
    const row = db().query<{ status: string }, []>(`select status from subscribers`).get()
    expect(row?.status).toBe('pending')
  })

  it('rejects an address that is not one', async () => {
    expect((await post('/api/subscribe', { email: 'nope' })).status).toBe(400)
    expect((await post('/api/subscribe', {})).status).toBe(400)
  })

  it('does not reveal whether an address is already subscribed', async () => {
    seedSubscriber('known@example.com', 'confirmed', 'tok')
    const known = await post('/api/subscribe', { email: 'known@example.com' }, '198.51.100.1')
    const fresh = await post('/api/subscribe', { email: 'unknown@example.com' }, '198.51.100.2')
    // Both 200. A different answer would make this endpoint a way to test whether a given
    // person reads this blog.
    expect(known.status).toBe(200)
    expect(fresh.status).toBe(200)
  })

  it('answers a plain form post with a page, not with JSON', async () => {
    // The form is server-rendered markup with a method and an action, so a reader without
    // JavaScript can submit it. Answering them with a page of JSON would be a defect this
    // port created rather than one it carried over.
    const res = await app.request('/api/subscribe', {
      method: 'POST',
      body: new URLSearchParams({ email: 'formuser@example.com' }),
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '198.51.100.20' },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).not.toContain('{"status"')
  })

  it('still fails a form post with 400, not a 200 that reads like success', async () => {
    // The status describes the REQUEST, not how the answer is presented. A 200 here tells
    // every log and every uptime monitor that a rejected sign-up worked.
    const res = await app.request('/api/subscribe', {
      method: 'POST',
      body: new URLSearchParams({ email: 'not-an-address' }),
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '198.51.100.21' },
    })
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('caps sign-ups per IP, because each one can email a stranger', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 8; i++) {
      statuses.push((await post('/api/subscribe', { email: `f${i}@example.com` }, '198.51.100.7')).status)
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0)
  })
})

describe('unsubscribe', () => {
  const seed = () => seedSubscriber('member@example.com', 'confirmed', 'unsub-token')
  const statusOf = () =>
    db().query<{ status: string }, []>(`select status from subscribers`).get()?.status

  it('does NOT unsubscribe on GET', async () => {
    seed()
    const res = await get('/api/newsletter/unsubscribe?token=unsub-token')
    expect(res.status).toBe(200)
    // A link scanner or mail-client prefetcher issues GETs. If this mutated, a security
    // appliance that merely looked at an inbox would remove the reader from the list.
    expect(statusOf()).toBe('confirmed')
    expect(await res.text()).toContain('<form')
  })

  it('unsubscribes on POST, and says the same thing when clicked twice', async () => {
    seed()
    const first = await app.request('/api/newsletter/unsubscribe?token=unsub-token', { method: 'POST' })
    expect(first.status).toBe(200)
    expect(statusOf()).toBe('unsubscribed')
    const second = await app.request('/api/newsletter/unsubscribe?token=unsub-token', { method: 'POST' })
    expect(second.status).toBe(200)
  })

  it('confirms a pending subscriber through the emailed link', async () => {
    seedSubscriber('pending@example.com', 'pending', 'confirm-token')
    const res = await get('/api/newsletter/confirm?token=confirm-token')
    expect(res.status).toBe(200)
    expect(statusOf()).toBe('confirmed')
  })

  it('shows a page rather than an error for a bad token', async () => {
    expect((await get('/api/newsletter/confirm?token=garbage')).status).toBe(200)
  })
})

describe('the open pixel', () => {
  it('returns a valid GIF for an unknown token, never a 404', async () => {
    // This is fetched inside somebody's inbox. A 404 there is a broken image where there
    // should be nothing visible at all.
    const res = await get('/api/newsletter/open?t=nonexistent')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/gif')
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect((await res.arrayBuffer()).byteLength).toBe(42)
  })
})
