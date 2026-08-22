// The headers every response carries, and the cap the search page needed.
//
// Split out of `app.test.ts` at the 400-line limit, and the seam is a real one: nothing
// here is about what a page SAYS. It is about what the app sends alongside it, which is
// exactly the class of thing that goes missing because no page looks wrong without it.

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { clearCache } from '@/server/cache'
import { resetLimits } from '@/server/rate-limit'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-headers'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)
const PAST = '2020-01-01T00:00:00.000Z'

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings', 'media', 'redirects']) {
    db().run(`delete from ${t}`)
  }
})

describe('the headers the app owes every response', () => {
  // They were set in nginx and nowhere else, which made them a property of one
  // deployment's proxy rather than of the software.
  it('sends nosniff, DENY and a referrer policy on a page', async () => {
    await savePost({ title: 'Headed', content: 'body', status: 'published', date: PAST })
    const res = await get('/headed')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
  })

  it('sends them on an upload too, which is where nosniff earns its keep', async () => {
    // `/uploads/*` serves owner-uploaded bytes from the site's own origin, typed from the
    // file extension. This is the response whose sniffing must not be guessed at.
    expect((await get('/uploads/nope.jpg')).headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('sends NO Content-Security-Policy, on purpose', async () => {
    // A browser enforces the intersection of every CSP it receives, so a second policy
    // from the app would silently narrow the tuned one a proxy sends. It stays a
    // deployment decision (docs/self-host.md).
    await savePost({ title: 'Nocsp', content: 'body', status: 'published', date: PAST })
    expect((await get('/nocsp')).headers.get('content-security-policy')).toBeNull()
  })
})

describe('the search page is capped like its API half', () => {
  it('refuses a flood, because the query is uncached and the runtime is one thread', async () => {
    resetLimits()
    let last = await get('/search?q=a')
    for (let i = 0; i < 61 && last.status === 200; i++) last = await get(`/search?q=a${i}`)
    expect(last.status).toBe(429)
    resetLimits()
  })
})
