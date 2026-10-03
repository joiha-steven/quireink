// The owner's gate in front of "Delete this blog from Cloudflare" (`cloudflare-update.ts`): the
// password, and the blog's address typed back. The Worker deletes nothing unless this says yes
// (`install/cloudflare/self.ts`), so what it accepts is the whole of the confirmation.
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { saveSettings } from '@/content/settings'

const DIR = './.tmp/test-cloudflare-leave'
freshDatabase(DIR)
const before = process.env.QUIREINK_PACKAGE
let cookie = ''
let app: ReturnType<typeof createApp>

beforeAll(async () => {
  process.env.QUIREINK_PACKAGE = 'cloudflare'
  app = createApp()
  await saveSettings({ siteUrl: 'https://blog.example.com' })
  const user = await createUser({ username: 'owner', email: 'o@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
})
afterAll(() => {
  if (before === undefined) delete process.env.QUIREINK_PACKAGE
  else process.env.QUIREINK_PACKAGE = before
  dropDatabase(DIR)
})

const authorize = (confirm: string, current = 'wandering violet cassette') => app.request('/api/cloudflare/uninstall/authorize', {
  method: 'POST',
  headers: { cookie, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
  body: JSON.stringify({ current, confirm }),
})

describe('confirming the blog to delete', () => {
  it('takes the address however it was copied: bare, with https:// or with a trailing slash', async () => {
    for (const typed of ['blog.example.com', 'https://blog.example.com', 'https://Blog.Example.com/', ' blog.example.com ']) {
      expect((await authorize(typed)).status).toBe(200)
    }
  })

  it('refuses another address, and the right one with the wrong password', async () => {
    expect((await authorize('example.com')).status).toBe(400)
    expect((await authorize('https://blog.example.com.evil')).status).toBe(400)
    expect((await authorize('blog.example.com', 'not the password')).status).toBe(403)
  })
})
