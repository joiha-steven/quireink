// The account routes, which is the first time this product has had any.
//
// Everything here is about what a STOLEN SESSION can and cannot do. That is the threat these
// controls answer — an owner reaches for them because they think somebody else is inside —
// so the tests are written from the attacker's side: holding a valid cookie and not knowing
// the password.

import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession, listSessions } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { verifyPassword } from '@/auth/password'
import { passwordHashFor, totpStateFor } from '@/auth/users'
import { remainingCodes } from '@/auth/recovery'
import { codeForStep, generateSecret, stepAt } from '@/auth/totp'

const DIR = './.tmp/test-security'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PASSWORD = 'wandering violet cassette'
const app = createApp()
let cookie = ''
let userId = 0
let otherId = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'recovery_codes', 'server_secrets', 'activity_log']) {
    db().run(`delete from ${t}`)
  }
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'owner', email: 'o@example.com', password: PASSWORD })
  userId = user.id
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
  // A second device, so "sign out everywhere else" has something to end.
  otherId = createSession(user.id, { userAgent: 'Mozilla/5.0 (iPhone) Safari' }).token
})

const call = (path: string, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: {
      cookie, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin',
      ...(init.headers as Record<string, string> ?? {}),
    },
  })

const post = (path: string, data: unknown) =>
  call(path, { method: 'POST', body: JSON.stringify(data) })

const payload = async <T>(res: Response): Promise<T> =>
  ((await res.json()) as { data: T }).data

describe('the gate', () => {
  it('refuses every account route without a session', async () => {
    for (const [method, path] of [
      ['GET', '/api/security'],
      ['POST', '/api/security/password'],
      ['POST', '/api/security/recovery'],
      ['POST', '/api/security/totp/start'],
      ['POST', '/api/security/totp/confirm'],
      ['POST', '/api/security/sessions/revoke-others'],
      ['DELETE', '/api/security/sessions/anything'],
    ] as const) {
      const res = await app.request(path, {
        method,
        headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
        ...(method === 'GET' || method === 'DELETE' ? {} : { body: '{}' }),
      })
      expect(`${method} ${path} -> ${res.status}`).toBe(`${method} ${path} -> 401`)
    }
  })
})

describe('what the screen is told', () => {
  it('lists the sessions and marks which one is asking', async () => {
    const data = await payload<{ sessions: { current: boolean }[]; totpEnabled: boolean; recoveryLeft: number }>(
      await call('/api/security'),
    )
    expect(data.sessions).toHaveLength(2)
    expect(data.sessions.filter((s) => s.current)).toHaveLength(1)
  })

  // The session table stores a salted IP hash and a coarse device bucket. Neither is a thing
  // to hand back to a browser, and the raw user agent was never stored in the first place.
  it('sends no address and no secret', async () => {
    const text = await (await call('/api/security')).text()
    expect(text).not.toContain('ip_hash')
    expect(text).not.toContain('ipHash')
    expect(text.toLowerCase()).not.toContain('secret')
  })
})

describe('THE STOLEN SESSION: a valid cookie is not the password', () => {
  for (const [what, path, sent] of [
    ['change the password', '/api/security/password', { current: 'wrong', next: 'lantern moth quiet harbour' }],
    ['mint recovery codes', '/api/security/recovery', { current: 'wrong' }],
    ['start a 2FA re-enrol', '/api/security/totp/start', { current: 'wrong' }],
  ] as const) {
    it(`cannot ${what}`, async () => {
      const res = await post(path, sent)
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ success: false, error: 'wrong_password' })
    })
  }

  it('leaves the password alone when the confirmation is wrong', async () => {
    await post('/api/security/password', { current: 'wrong', next: 'lantern moth quiet harbour' })
    const stored = passwordHashFor('owner')!
    expect(await verifyPassword(stored.hash, PASSWORD)).toBe(true)
  })

  // Ten tries per five minutes, from inside the admin. Without it a stolen cookie is an
  // unlimited offline-speed guessing oracle against the password.
  it('stops guessing after ten attempts', async () => {
    for (let i = 0; i < 10; i++) await post('/api/security/recovery', { current: `guess-${i}` })
    const res = await post('/api/security/recovery', { current: PASSWORD })
    expect(res.status).toBe(429)
  })
})

describe('changing the password', () => {
  it('sets it, and signs out every OTHER device', async () => {
    const res = await post('/api/security/password', { current: PASSWORD, next: 'lantern moth quiet harbour' })
    expect(res.status).toBe(200)
    expect((await payload<{ signedOut: number }>(res)).signedOut).toBe(1)

    const stored = passwordHashFor('owner')!
    expect(await verifyPassword(stored.hash, 'lantern moth quiet harbour')).toBe(true)
    // The point of the whole feature: the other device is gone...
    expect(listSessions(userId)).toHaveLength(1)
    // ...and the person who did it is still signed in on the page they did it from.
    expect((await call('/api/security')).status).toBe(200)
  })

  // 'passphrase' is on the deny list, which this test learned by using it as a fixture.
  it('refuses a password the strength rule refuses', async () => {
    const res = await post('/api/security/password', { current: PASSWORD, next: 'short' })
    expect(res.status).toBe(400)
    expect(listSessions(userId)).toHaveLength(2) // nothing was signed out on a refusal
  })
})

describe('recovery codes', () => {
  it('mints a fresh set and reports how many are left', async () => {
    const before = remainingCodes(userId)
    const { codes } = await payload<{ codes: string[] }>(
      await post('/api/security/recovery', { current: PASSWORD }),
    )
    expect(codes.length).toBeGreaterThan(0)
    expect(remainingCodes(userId)).toBe(codes.length)
    expect(codes.length).toBeGreaterThanOrEqual(before)
  })

  it('replaces the old set rather than adding to it', async () => {
    const first = await payload<{ codes: string[] }>(await post('/api/security/recovery', { current: PASSWORD }))
    const second = await payload<{ codes: string[] }>(await post('/api/security/recovery', { current: PASSWORD }))
    expect(second.codes).not.toEqual(first.codes)
    expect(remainingCodes(userId)).toBe(second.codes.length)
  })
})

describe('re-enrolling 2FA', () => {
  it('hands back a secret WITHOUT storing it, so walking away breaks nothing', async () => {
    const before = totpStateFor(userId)?.secret ?? null
    const { secret, uri } = await payload<{ secret: string; uri: string }>(
      await post('/api/security/totp/start', { current: PASSWORD }),
    )
    expect(secret.length).toBeGreaterThan(10)
    expect(uri).toContain('otpauth://totp/')
    // The account is exactly as it was: the old authenticator still works.
    expect(totpStateFor(userId)?.secret ?? null).toBe(before)
  })

  it('stores it only once a code proves the authenticator has it', async () => {
    const secret = generateSecret()
    const code = codeForStep(secret, stepAt(Date.now()))!
    const res = await post('/api/security/totp/confirm', { current: PASSWORD, secret, code })
    expect(res.status).toBe(200)
    expect(totpStateFor(userId)?.secret).toBe(secret)
  })

  it('refuses a wrong code and changes nothing', async () => {
    const before = totpStateFor(userId)?.secret ?? null
    const res = await post('/api/security/totp/confirm', { current: PASSWORD, secret: generateSecret(), code: '000000' })
    expect(res.status).toBe(400)
    expect(totpStateFor(userId)?.secret ?? null).toBe(before)
  })

  // The step that proved the secret is spent. Otherwise the code just typed stays live for
  // the rest of its window — the replay the login path already refuses.
  it('burns the step it accepted', async () => {
    const secret = generateSecret()
    const step = stepAt(Date.now())
    await post('/api/security/totp/confirm', { current: PASSWORD, secret, code: codeForStep(secret, step)! })
    expect(totpStateFor(userId)?.lastStep).toBe(step)
  })
})

describe('sessions', () => {
  it('ends one by id', async () => {
    const { sessions } = await payload<{ sessions: { id: string; current: boolean }[] }>(await call('/api/security'))
    const other = sessions.find((s) => !s.current)!
    expect((await call(`/api/security/sessions/${other.id}`, { method: 'DELETE' })).status).toBe(200)
    expect(listSessions(userId)).toHaveLength(1)
  })

  it('404s an id that is not this owner\'s, rather than saying whose it is', async () => {
    expect((await call('/api/security/sessions/not-a-session', { method: 'DELETE' })).status).toBe(404)
  })

  it('signs out everywhere else and keeps the current one', async () => {
    const res = await post('/api/security/sessions/revoke-others', {})
    expect((await payload<{ signedOut: number }>(res)).signedOut).toBe(1)
    expect(listSessions(userId)).toHaveLength(1)
    expect((await call('/api/security')).status).toBe(200)
  })

  // Revoking is the one thing that has to WORK from a session that may be the attacker's,
  // so it asks for no password — but it must also really end the other cookie, not just
  // remove the row from a list.
  it('really ends the revoked cookie', async () => {
    await post('/api/security/sessions/revoke-others', {})
    const res = await app.request('/api/security', {
      headers: { cookie: `${COOKIE_NAME}=${otherId}`, 'sec-fetch-site': 'same-origin' },
    })
    expect(res.status).toBe(401)
  })
})
