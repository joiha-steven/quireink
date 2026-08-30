// The gate itself, driven with a router nobody ships.
//
// `admin.test.ts` next door proves the real routes are behind the gate. This file proves what
// the gate DOES once a request is through it, which needs a handler written to misbehave — one
// that deliberately forgets `clearCache()`, and one that only reads. Neither can exist in
// `src/`, so they are built here.
//
// Both promises live on the same line of `web/guard.ts`, and until 2026-08-30 only one of them
// was pinned. Broadening that line to flush on ANY successful request through the gate left
// all 2377 tests green: nothing would have crashed, the reader's page cache would simply have
// been emptied every time the owner opened an admin screen.

import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { Hono } from 'hono'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { pageCache } from '@/server/cache'
import { OwnerRouter } from '@/web/guard'

const DIR = './.tmp/test-guard'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

let cookie = ''

beforeEach(async () => {
  for (const table of ['sessions', 'users', 'server_secrets']) db().run(`delete from ${table}`)
  resetSecretCache()
  pageCache.clear()
  const user = await createUser({ username: 'owner', email: 'o@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
})

/** A gated app holding one write route and one read route, both of which do nothing. */
function gated(): Hono {
  const router = new OwnerRouter()
  router.post('/api/forgetful-write', async (c) => c.json({ ok: true }))
  router.get('/api/reads-nothing', async (c) => c.json({ ok: true }))
  const app = new Hono()
  app.route('/', router.routes)
  return app
}

describe('Invariant 1, held by the gate rather than by the handler', () => {
  it('flushes even when the handler itself never calls clearCache', async () => {
    const app = gated()
    pageCache.set('/stale', '<html>old</html>')
    const res = await app.request('/api/forgetful-write', {
      method: 'POST', headers: { cookie, 'sec-fetch-site': 'same-origin' },
    })
    expect(res.status).toBe(200)
    expect(pageCache.size).toBe(0)
  })

  // A 4xx changed no state, and flushing on it would let an unauthenticated POST empty the
  // cache at will — a way to make the site render every page from scratch, on demand.
  it('flushes nothing when the write is REFUSED', async () => {
    const app = gated()
    pageCache.set('/stale', '<html>old</html>')
    const res = await app.request('/api/forgetful-write', {
      method: 'POST', headers: { 'sec-fetch-site': 'same-origin' },
    })
    expect(res.status).toBe(401)
    expect(pageCache.size).toBe(1)
  })

  // The half nothing was watching. Reading a screen is not a write, and the reader's cache
  // is not the owner's to empty by looking at things.
  it('flushes nothing when the owner merely READS a screen', async () => {
    const app = gated()
    pageCache.set('/warm', '<html>warm</html>')
    const res = await app.request('/api/reads-nothing', { headers: { cookie } })
    expect(res.status).toBe(200)
    expect(pageCache.size).toBe(1)
  })

  it('flushes nothing when the read is refused either', async () => {
    const app = gated()
    pageCache.set('/warm', '<html>warm</html>')
    expect((await app.request('/api/reads-nothing')).status).toBe(401)
    expect(pageCache.size).toBe(1)
  })
})
