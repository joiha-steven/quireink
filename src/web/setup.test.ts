// Claiming an install, driven through the real router.
//
// This is the one write route in the product that creates an OWNER, and it is reachable
// without a session by definition. So the tests here are mostly about refusal: the happy
// path is four lines and every other case is a door that has to stay shut.

import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { createUser, noUsersYet } from '@/auth/users'
import { saveSettings } from '@/content/settings'
import { resetPending } from '@/auth/login'
import { resetEnrolment } from '@/web/auth-routes'
import { resetLimits } from '@/server/rate-limit'
import { setupToken, forgetSetupToken } from '@/server/setup-token'

const DIR = './.tmp/test-setup'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PASSWORD = 'wandering violet cassette'
const app = createApp()

const post = (path: string, data: Record<string, string>) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data),
  })

const claim = (over: Record<string, string> = {}) =>
  post('/api/setup/claim', {
    token: setupToken(), username: 'owner', email: 'owner@example.com', password: PASSWORD, ...over,
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

describe('the unclaimed page', () => {
  it('offers no form without the token, and does not print the token either', async () => {
    const token = setupToken()
    const body = await (await app.request('/setup')).text()
    expect(body).not.toContain('/api/setup/claim')
    // The whole point of a secret in a log is that the page which mentions the log does not
    // also contain it. This assertion is the one that would catch a "helpful" template edit.
    expect(body).not.toContain(token)
  })

  it('refuses a token that is not the one this process minted', async () => {
    setupToken()
    const res = await app.request('/setup?token=not-the-one')
    expect(res.status).toBe(403)
    expect(await res.text()).not.toContain('/api/setup/claim')
  })

  it('shows the form for the real token', async () => {
    const res = await app.request(`/setup?token=${setupToken()}`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('/api/setup/claim')
  })

  it('is a 404 with no form once the blog has an owner', async () => {
    await createUser({ username: 'taken', email: 't@example.com', password: PASSWORD })
    const res = await app.request(`/setup?token=${setupToken()}`)
    expect(res.status).toBe(404)
    expect(await res.text()).not.toContain('/api/setup/claim')
  })
})

describe('claiming', () => {
  it('creates the owner and goes straight to two-factor', async () => {
    const res = await claim()
    expect(res.status).toBe(200)
    const body = await res.text()
    // Landed on enrolment, not back on a sign-in form: the password just typed is not asked
    // for a second time.
    expect(body).toContain('/api/auth/enrol')
    expect(noUsersYet()).toBe(false)
  })

  it('burns the token, so the link cannot be replayed', async () => {
    const token = setupToken()
    await claim({ token })
    db().run(`delete from users`) // the only way back to unclaimed, and it must not help
    const res = await app.request(`/setup?token=${token}`)
    expect(res.status).toBe(403)
  })

  it('refuses a wrong token and creates nothing', async () => {
    setupToken()
    expect((await claim({ token: 'wrong' })).status).toBe(403)
    expect(noUsersYet()).toBe(true)
  })

  it('refuses once an owner exists, whatever the token says', async () => {
    await createUser({ username: 'taken', email: 't@example.com', password: PASSWORD })
    expect((await claim()).status).toBe(409)
  })

  it('says WHICH password rule was broken, and creates nothing', async () => {
    const short = await claim({ password: 'short' })
    expect(short.status).toBe(400)
    // The form comes back holding what was typed, so the answer is a correction rather
    // than a restart.
    expect(await short.text()).toContain('owner@example.com')
    expect(noUsersYet()).toBe(true)

    expect((await claim({ password: 'correcthorsebatterystaple' })).status).toBe(400)
    expect(noUsersYet()).toBe(true)
  })
})

describe('deferring two-factor', () => {
  const ticketFrom = async (): Promise<string> => {
    const body = await (await claim()).text()
    return body.match(/name="ticket" value="([^"]+)"/)?.[1] ?? ''
  }

  it('lets the owner in while the blog has no public address', async () => {
    const ticket = await ticketFrom()
    const res = await post('/api/auth/enrol/skip', { ticket })
    expect(res.status).toBe(303)
    expect(res.headers.get('set-cookie') ?? '').toContain('HttpOnly')
  })

  it('offers the way out on the screen only while it would be honoured', async () => {
    expect(await (await claim()).text()).toContain('/api/auth/enrol/skip')
    db().run(`delete from users`)
    forgetSetupToken()
    await saveSettings({ siteUrl: 'https://example.com' })
    expect(await (await claim()).text()).not.toContain('/api/auth/enrol/skip')
  })

  it('REFUSES at the route once an address is set, not merely hides the button', async () => {
    // A button that is not rendered is not a check: the route is reachable by anyone who
    // read the HTML of a different install.
    const ticket = await ticketFrom()
    await saveSettings({ siteUrl: 'https://example.com' })
    const res = await post('/api/auth/enrol/skip', { ticket })
    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('writes nothing, so the next sign-in asks for enrolment again', async () => {
    const ticket = await ticketFrom()
    await post('/api/auth/enrol/skip', { ticket })
    const again = await post('/api/auth/login', { username: 'owner', password: PASSWORD })
    expect(await again.text()).toContain('/api/auth/enrol')
  })
})
