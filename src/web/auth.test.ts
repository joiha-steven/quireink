// The sign-in flow, driven through the real router.
//
// These exist because the unit tests could not have caught the bug that shipped into this
// file's first draft: enrolment verified the confirming TOTP code but never advanced the
// replay floor, so the code used to SET UP two-factor sign-in could immediately be
// replayed to sign in with it. Every part was individually correct. Only the sequence was
// wrong, and only running the sequence showed it.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { codeForStep, stepAt } from '@/auth/totp'
import { resetPending } from '@/auth/login'
import { resetEnrolment } from '@/web/auth-routes'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { payload } from '@/test/api'

const DIR = './.tmp-test-auth-routes'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PASSWORD = 'wandering violet cassette'
const app = createApp()

const post = (path: string, data: Record<string, string>, headers: Record<string, string> = {}) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(data),
  })

const json = (path: string, data: Record<string, string>) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })

beforeEach(async () => {
  for (const table of ['sessions', 'recovery_codes', 'users', 'activity_log', 'server_secrets']) {
    db().run(`delete from ${table}`)
  }
  resetPending()
  resetEnrolment()
  resetSecretCache()
  resetLimits()
  await createUser({ username: 'hung', email: 'h@example.com', password: PASSWORD })
})

/** Password step, returning the enrolment ticket and the secret shown on screen. */
async function startEnrolment(): Promise<{ ticket: string; secret: string }> {
  const res = await post('/api/auth/login', { username: 'hung', password: PASSWORD })
  const html = await res.text()
  return {
    ticket: html.match(/name="ticket" value="([^"]+)"/)?.[1] ?? '',
    secret: (html.match(/<code>([A-Z2-7 ]+)<\/code>/)?.[1] ?? '').replace(/ /g, ''),
  }
}

/** The whole first run, ending signed in. Returns the cookie and the recovery codes. */
async function enrolFully(): Promise<{ cookie: string; codes: string[]; secret: string }> {
  const { ticket, secret } = await startEnrolment()
  const enrolled = await post('/api/auth/enrol', { ticket, code: codeForStep(secret, stepAt(Date.now()))! })
  const html = await enrolled.text()
  const codes = [...html.matchAll(/<li><code>([2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5})<\/code><\/li>/g)]
    .map((m) => m[1])
  const done = await post('/api/auth/enrol/done', { ticket, saved: '1' })
  return { cookie: (done.headers.get('set-cookie') ?? '').split(';')[0], codes, secret }
}

describe('GET /login', () => {
  it('renders a form that works without JavaScript', async () => {
    const html = await (await app.request('/login')).text()
    expect(html).toContain('action="/api/auth/login"')
    expect(html).toContain('method="post"')
    // The attributes a password manager needs. One missing and it stops filling, which
    // reads to the owner as the site being untrustworthy.
    expect(html).toContain('autocomplete="username"')
    expect(html).toContain('autocomplete="current-password"')
  })

  it('is noindex', async () => {
    expect(await (await app.request('/login')).text()).toContain('name="robots" content="noindex"')
  })

  it('redirects someone who is already signed in', async () => {
    const { cookie } = await enrolFully()
    const res = await app.request('/login', { headers: { cookie } })
    expect(res.status).toBe(302)
  })
})

describe('POST /api/auth/login', () => {
  it('answers a wrong password and an unknown user identically', async () => {
    const wrong = await json('/api/auth/login', { username: 'hung', password: 'not the password' })
    const missing = await json('/api/auth/login', { username: 'ghost', password: 'not the password' })
    expect(wrong.status).toBe(401)
    expect(missing.status).toBe(401)
    expect(await wrong.json()).toEqual(await missing.json())
  })

  // A 200 with an error inside tells every log and every monitor that a failed sign-in
  // worked. The status describes the request, not how the answer is presented.
  it('uses 401 for the form path too, not a 200 with a message', async () => {
    const res = await post('/api/auth/login', { username: 'hung', password: 'not the password' })
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('sends an un-enrolled account to enrolment, with a QR and a typeable key', async () => {
    const res = await post('/api/auth/login', { username: 'hung', password: PASSWORD })
    const html = await res.text()
    expect(html).toContain('<svg')
    expect(html).toContain('login-secret')
    expect(html).toContain('action="/api/auth/enrol"')
  })

  it('answers JSON with JSON', async () => {
    const res = await json('/api/auth/login', { username: 'hung', password: PASSWORD })
    const body = await payload<{ status: string; ticket: string }>(res)
    expect(body.status).toBe('need-enrolment')
    expect(body.ticket.length).toBeGreaterThan(10)
  })
})

describe('enrolment', () => {
  it('refuses a wrong confirmation code and does not enrol', async () => {
    const { ticket } = await startEnrolment()
    const res = await post('/api/auth/enrol', { ticket, code: '000000' })
    expect(res.status).toBe(401)
    // The secret must NOT have been stored: an account demanding codes from an app nobody
    // finished setting up can only be fixed from the command line.
    expect(db().query<{ totp_secret: string | null }, []>(`select totp_secret from users`).get()!.totp_secret)
      .toBeNull()
  })

  it('shows ten recovery codes and a download that needs no second request', async () => {
    const { ticket, secret } = await startEnrolment()
    const res = await post('/api/auth/enrol', { ticket, code: codeForStep(secret, stepAt(Date.now()))! })
    const html = await res.text()
    expect([...html.matchAll(/<li><code>[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}<\/code><\/li>/g)].length).toBe(10)
    expect(html).toContain('href="data:text/plain')
  })

  it('issues the session only after the codes are acknowledged', async () => {
    const { ticket, secret } = await startEnrolment()
    const shown = await post('/api/auth/enrol', { ticket, code: codeForStep(secret, stepAt(Date.now()))! })
    expect(shown.headers.get('set-cookie')).toBeNull()
    const done = await post('/api/auth/enrol/done', { ticket, saved: '1' })
    expect(done.status).toBe(303)
    expect(done.headers.get('set-cookie')).toContain('__Host-quire_session')
  })

  /**
   * THE BUG. `setTotpSecret` resets the replay floor to null, so the code just used to
   * confirm enrolment was still unspent and signing in with it worked.
   */
  it('spends the confirming code, so it cannot be replayed to sign in', async () => {
    const { ticket, secret } = await startEnrolment()
    const code = codeForStep(secret, stepAt(Date.now()))!
    await post('/api/auth/enrol', { ticket, code })
    await post('/api/auth/enrol/done', { ticket, saved: '1' })

    const again = await post('/api/auth/login', { username: 'hung', password: PASSWORD })
    const ticket2 = (await again.text()).match(/name="ticket" value="([^"]+)"/)?.[1] ?? ''
    const replay = await post('/api/auth/2fa', { ticket: ticket2, code })
    expect(replay.status).toBe(401)
  })

  it('will not let one ticket produce two sessions', async () => {
    const { ticket, secret } = await startEnrolment()
    await post('/api/auth/enrol', { ticket, code: codeForStep(secret, stepAt(Date.now()))! })
    expect((await post('/api/auth/enrol/done', { ticket, saved: '1' })).status).toBe(303)
    expect((await post('/api/auth/enrol/done', { ticket, saved: '1' })).status).toBe(401)
  })
})

describe('the second factor', () => {
  it('accepts a recovery code, once', async () => {
    const { codes } = await enrolFully()
    const first = await post('/api/auth/login', { username: 'hung', password: PASSWORD })
    const t1 = (await first.text()).match(/name="ticket" value="([^"]+)"/)?.[1] ?? ''
    expect((await post('/api/auth/2fa', { ticket: t1, code: codes[0] })).status).toBe(303)

    const second = await post('/api/auth/login', { username: 'hung', password: PASSWORD })
    const t2 = (await second.text()).match(/name="ticket" value="([^"]+)"/)?.[1] ?? ''
    expect((await post('/api/auth/2fa', { ticket: t2, code: codes[0] })).status).toBe(401)
  })

  it('sends an invented ticket back to the start', async () => {
    const res = await app.request('/login/2fa?ticket=invented')
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('action="/api/auth/login"')
  })
})

describe('the redirect after signing in', () => {
  // An open redirect turns a trustworthy sign-in page into a link an attacker can send:
  // sign in on the real site, then get bounced somewhere else.
  it('refuses an absolute or protocol-relative next', async () => {
    // `/\evil.example` is in the list because a check that only rejects `//` passes it and
    // the browser normalises the backslash into exactly the same protocol-relative URL.
    for (const next of ['https://evil.example/x', '//evil.example/x', '/\\evil.example/x']) {
      // Each password step mints a NEW ticket with a NEW secret, so the secret has to be
      // read from THIS response. Reading it once outside the loop made the enrol step 401
      // and the assertion below pass through a different path entirely.
      const started = await post('/api/auth/login', { username: 'hung', password: PASSWORD, next })
      const html = await started.text()
      const ticket = html.match(/name="ticket" value="([^"]+)"/)?.[1] ?? ''
      const secret = (html.match(/<code>([A-Z2-7 ]+)<\/code>/)?.[1] ?? '').replace(/ /g, '')
      const enrolled = await post('/api/auth/enrol', { ticket, code: codeForStep(secret, stepAt(Date.now()))! })
      expect(enrolled.status).toBe(200)
      const done = await post('/api/auth/enrol/done', { ticket, saved: '1', next })
      expect(done.status).toBe(303)
      expect(done.headers.get('location')).toBe('/admin')
      // Back to un-enrolled for the next value. Without this the second pass gets the
      // two-factor screen instead of the enrolment screen, finds no secret on it, and
      // fails somewhere that has nothing to do with what is being tested.
      db().run(`delete from sessions`)
      db().run(`update users set totp_secret = null, totp_last_step = null`)
    }
  })

  // The hole the test above exposed by passing for the wrong reason: the pending ticket
  // alone used to be enough to receive a session, which skips two-factor on the one flow
  // whose entire purpose is that two-factor is not optional.
  it('will not issue a session for a ticket that never finished enrolling', async () => {
    const { ticket } = await startEnrolment()
    const res = await post('/api/auth/enrol/done', { ticket, saved: '1' })
    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('honours a same-site path', async () => {
    const { ticket, secret } = await startEnrolment()
    await post('/api/auth/enrol', { ticket, code: codeForStep(secret, stepAt(Date.now()))! })
    const done = await post('/api/auth/enrol/done', { ticket, saved: '1', next: '/admin/posts' })
    expect(done.headers.get('location')).toBe('/admin/posts')
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the cookie and kills the session', async () => {
    const { cookie } = await enrolFully()
    const res = await post('/api/auth/logout', {}, { cookie })
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
    // The session row is gone, so the cookie the browser still holds authenticates nobody.
    expect((await app.request('/login', { headers: { cookie } })).status).toBe(200)
  })

  it('clears the cookie even for a session that was already gone', async () => {
    const res = await post('/api/auth/logout', {})
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
  })
})
