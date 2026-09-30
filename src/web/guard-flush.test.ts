// A write that changes nothing a reader sees does not flush (2026-09-30). Every flush also
// purges the CDN and re-warms the site, and the editor's autosave, every 15 seconds while the
// owner typed, did both.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetLimits } from '@/server/rate-limit'
import { onFlush } from '@/server/cache'
import { savePost } from '@/content/posts'

const DIR = './.tmp/test-guard-flush'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
let flushes = 0
onFlush(() => { flushes++ })
let cookie = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'posts', 'post_terms']) db().run(`delete from ${t}`)
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
  await savePost({ title: 'Live one', content: 'body', status: 'published', date: '2020-01-01T00:00:00.000Z' })
  flushes = 0
})

const asOwner = (path: string, method: string, body: unknown) =>
  app.request(path, {
    method,
    headers: { cookie, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('the flush at the gate', () => {
  it('is skipped by an autosave, which only the owner can read back', async () => {
    const res = await asOwner('/api/posts/live-one/autosave', 'POST', { snapshot: JSON.stringify({ title: 'Live one', content: 'typing' }) })
    expect(res.status).toBe(200)
    expect(flushes).toBe(0)
  })

  it('still happens on a save a reader will see', async () => {
    const res = await asOwner('/api/posts/live-one', 'PUT', { title: 'Live one', content: 'changed', status: 'published' })
    expect(res.status).toBeLessThan(400)
    expect(flushes).toBeGreaterThan(0)
  })
})
