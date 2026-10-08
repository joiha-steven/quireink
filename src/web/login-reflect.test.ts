// A refused password is never written back into the page, and its error sits on the field.
// Driven through the real router, on a blog nobody has claimed.

import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createApp } from '@/web/app'
import { resetPending } from '@/auth/login'
import { resetEnrolment } from '@/web/enrol-routes'
import { resetLimits } from '@/server/rate-limit'
import { setupToken, forgetSetupToken } from '@/server/setup-token'

const DIR = './.tmp/test-login-reflect'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const post = (path: string, data: Record<string, string>) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data),
  })

beforeEach(() => {
  db().run(`delete from users`)
  db().run(`delete from sessions`)
  db().run(`delete from settings`)
  resetPending()
  resetEnrolment()
  resetLimits()
  forgetSetupToken()
})

describe('a refused password', () => {
  const typed = 'tiny-pw-xyz'
  it('is not echoed by the claim form, and the error is on the field', async () => {
    const html = await (await post('/api/setup/claim', {
      token: setupToken(), username: 'owner', email: 'owner@example.com', password: typed,
    })).text()
    expect(html).not.toContain(typed)
    expect(html).toContain('id="password-error"')
  })
  it('is not echoed by the sign-in form, and the error is on the field', async () => {
    const html = await (await post('/api/auth/login', { username: 'owner', password: typed })).text()
    expect(html).not.toContain(typed)
    expect(html).toContain('id="password-error"')
  })
})
