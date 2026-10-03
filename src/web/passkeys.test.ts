// Passkeys through the real router (ADR 0071): added in the security card, used on the sign-in
// page, removed again, and every refusal on the way.
//
// Written from the two sides that matter. A STOLEN SESSION must not be able to add a passkey,
// which would be a way back in that outlives a password change. And a passkey must never be the
// only door: the password and the code keep working beside it, before and after.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetChallenges } from '@/auth/passkeys'
import { resetPending } from '@/auth/login'
import { resetLimits } from '@/server/rate-limit'
import { saveSettings } from '@/content/settings'
import { assert, attest, b64url, softKey, type SoftKey } from '@/test/webauthn'

const DIR = './.tmp/test-passkeys'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PASSWORD = 'wandering violet cassette'
const ORIGIN = 'http://localhost'
const app = createApp()
let cookie = ''

beforeEach(async () => {
  for (const t of ['passkeys', 'sessions', 'users', 'recovery_codes', 'server_secrets', 'activity_log']) db().run(`delete from ${t}`)
  resetSecretCache()
  resetLimits()
  resetChallenges()
  resetPending()
  await saveSettings({ siteUrl: '' })
  const user = await createUser({ username: 'owner', email: 'o@example.com', password: PASSWORD })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
})

const call = (path: string, init: RequestInit & { as?: string } = {}) =>
  app.request(`http://localhost${path}`, {
    ...init,
    headers: { cookie: init.as ?? cookie, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
  })
const post = (path: string, data: unknown, as?: string) => call(path, { method: 'POST', body: JSON.stringify(data), as })
const data = async <T>(res: Response): Promise<T> => ((await res.json()) as { data: T }).data
const log = (): { action: string; detail: string }[] => db().query('select action, detail from activity_log order by id').all() as never

type Options = { challenge: string; rp: { id: string }; user: { id: string }; excludeCredentials: { id: string }[]; authenticatorSelection: { userVerification: string; residentKey: string }; attestation: string }

/** The card's whole flow: options, the authenticator, the answer. */
async function addPasskey(key: SoftKey, opts: { name?: string; flags?: number; as?: string } = {}): Promise<Response> {
  const start = await post('/api/security/passkeys/start', { current: PASSWORD }, opts.as)
  expect(start.status).toBe(200)
  const o = await data<Options>(start)
  const a = await attest(key, { rpId: o.rp.id, origin: ORIGIN, challenge: o.challenge, flags: opts.flags })
  return post('/api/security/passkeys/finish', {
    current: PASSWORD, name: opts.name ?? 'Laptop', transports: ['internal', 'nonsense'],
    clientDataJSON: b64url(a.clientDataJSON), attestationObject: b64url(a.attestationObject),
  }, opts.as)
}

/** The sign-in page's whole flow, with no session at all. */
async function signIn(key: SoftKey, over: { signCount?: number; origin?: string; flags?: number; next?: string } = {}) {
  const res = await app.request('http://localhost/api/auth/passkey/options', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  const { challenge, rpId } = await data<{ challenge: string; rpId: string }>(res)
  const a = await assert(key, { rpId, origin: over.origin ?? ORIGIN, challenge, signCount: over.signCount, flags: over.flags })
  const body = {
    id: b64url(key.credentialId), clientDataJSON: b64url(a.clientDataJSON),
    authenticatorData: b64url(a.authenticatorData), signature: b64url(a.signature), userHandle: null, next: over.next,
  }
  const send = () => app.request('http://localhost/api/auth/passkey', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { res: await send(), again: send }
}

describe('the gate', () => {
  it('refuses the card\'s three routes without a session', async () => {
    for (const path of ['/api/security/passkeys/start', '/api/security/passkeys/finish', '/api/security/passkeys/remove']) {
      expect((await post(path, { current: PASSWORD }, 'nothing=here')).status).toBe(401)
    }
  })

  it('a session without the password cannot add a passkey, nor remove one', async () => {
    expect((await post('/api/security/passkeys/start', { current: 'not it' })).status).toBe(403)
    const key = await softKey()
    expect((await addPasskey(key)).status).toBe(200)
    const id = b64url(key.credentialId)
    expect((await post('/api/security/passkeys/remove', { current: 'not it', id })).status).toBe(403)
    expect((await data<{ passkeys: unknown[] }>(await call('/api/security'))).passkeys).toHaveLength(1)
  })
})

describe('adding a passkey', () => {
  it('offers a discoverable, user-verified passkey for this host, with no attestation asked', async () => {
    const o = await data<Options>(await post('/api/security/passkeys/start', { current: PASSWORD }))
    expect(o.rp.id).toBe('localhost')
    expect(o.authenticatorSelection).toMatchObject({ userVerification: 'required', residentKey: 'required' })
    expect(o.attestation).toBe('none')
    expect(o.user.id).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(o.excludeCredentials).toEqual([])
  })

  it('stores it, lists it with no key in sight, and records it in the log', async () => {
    const key = await softKey()
    expect((await addPasskey(key, { name: '  My\nphone  ' })).status).toBe(200)
    const res = await call('/api/security')
    const text = await res.clone().text()
    const { passkeys, passkeyRpId } = await data<{ passkeys: { id: string; name: string; lastUsedAt: null }[]; passkeyRpId: string }>(res)
    expect(passkeys).toEqual([expect.objectContaining({ id: b64url(key.credentialId), name: 'My phone', lastUsedAt: null })])
    expect(passkeyRpId).toBe('localhost')
    expect(text).not.toContain(b64url(key.cose))
    expect(log()).toContainEqual({ action: 'security.passkey.add', detail: 'My phone' })
    // Only the hints the spec defines are kept.
    expect(db().query('select transports from passkeys').get()).toEqual({ transports: 'internal' })
  })

  it('names the next ceremony\'s exclusions, and refuses the same authenticator twice', async () => {
    const key = await softKey()
    await addPasskey(key)
    const o = await data<Options>(await post('/api/security/passkeys/start', { current: PASSWORD }))
    expect(o.excludeCredentials.map((c) => c.id)).toEqual([b64url(key.credentialId)])
    const again = await addPasskey(key)
    expect(again.status).toBe(409)
    expect((await again.json() as { error: string }).error).toBe('passkey_exists')
  })

  it('refuses a passkey that did not check a fingerprint, face or PIN', async () => {
    const res = await addPasskey(await softKey(), { flags: 0x01 })
    expect(res.status).toBe(400)
    expect((await res.json() as { error: string }).error).toBe('bad_passkey')
    expect(db().query('select count(*) as n from passkeys').get()).toEqual({ n: 0 })
  })

  it('a challenge answers once, and only for the session it was issued to', async () => {
    const o = await data<Options>(await post('/api/security/passkeys/start', { current: PASSWORD }))
    const a = await attest(await softKey(), { rpId: 'localhost', origin: ORIGIN, challenge: o.challenge })
    const body = { current: PASSWORD, clientDataJSON: b64url(a.clientDataJSON), attestationObject: b64url(a.attestationObject) }
    // Another session of the same owner, holding the password too, is still somebody else's ceremony.
    const other = `${COOKIE_NAME}=${createSession((db().query('select id from users').get() as { id: number }).id).token}`
    expect((await post('/api/security/passkeys/finish', body, other)).status).toBe(400)
    // ...and that attempt spent it.
    const res = await post('/api/security/passkeys/finish', body)
    expect((await res.json() as { error: string }).error).toBe('passkey_expired')
  })

  it('refuses on a blog whose address is an IP, which no browser takes as an RP ID', async () => {
    const res = await app.request('http://192.168.1.50/api/security/passkeys/start', {
      method: 'POST', body: JSON.stringify({ current: PASSWORD }),
      headers: { cookie, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', host: '192.168.1.50' },
    })
    expect((await res.json() as { error: string }).error).toBe('passkey_needs_name')
  })
})

describe('signing in with a passkey', () => {
  it('is one step: a session, a cookie, and the log says how', async () => {
    const key = await softKey()
    await addPasskey(key)
    const { res } = await signIn(key, { next: '/admin/posts' })
    expect(res.status).toBe(200)
    expect(await res.clone().json()).toEqual({ status: 'ok', location: '/admin/posts' })
    const set = res.headers.get('set-cookie') ?? ''
    expect(set).toContain(`${COOKIE_NAME}=`)
    expect((await call('/api/security', { as: set.split(';')[0] })).status).toBe(200)
    expect(log()).toContainEqual({ action: 'auth.login', detail: 'via passkey' })
    const row = db().query('select last_used_at from passkeys').get() as { last_used_at: number | null }
    expect(row.last_used_at).toBeGreaterThan(0)
  })

  it('holds `next` to the same rule as the password form', async () => {
    const key = await softKey()
    await addPasskey(key)
    const { res } = await signIn(key, { next: '//evil.example' })
    expect((await res.json() as { location: string }).location).toBe('/admin')
  })

  it('an assertion is good once: the same bytes again are refused', async () => {
    const key = await softKey()
    await addPasskey(key)
    const { res, again } = await signIn(key)
    expect(res.status).toBe(200)
    const second = await again()
    expect(second.status).toBe(401)
    expect(second.headers.get('set-cookie')).toBeNull()
  })

  it('a passkey this blog does not know, from another site, or unverified: one answer for all', async () => {
    const known = await softKey()
    await addPasskey(known)
    const answers = [
      await signIn(await softKey()),
      await signIn(known, { origin: 'https://evil.example' }),
      await signIn(known, { flags: 0x01 }),
    ]
    const bodies = await Promise.all(answers.map(async ({ res }) => [res.status, (await res.json() as { error: string }).error]))
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1)
    expect(bodies[0]![0]).toBe(401)
    const failed = log().filter((l) => l.action === 'auth.login.failed').map((l) => l.detail)
    expect(failed.some((d) => /does not know/.test(d))).toBe(true)
    expect(failed.some((d) => /another address/.test(d))).toBe(true)
    expect(failed.some((d) => /fingerprint/.test(d))).toBe(true)
  })

  it('a counter that does not go up is refused, logged, and leaves the stored count alone', async () => {
    const key = await softKey()
    await addPasskey(key)
    expect((await signIn(key, { signCount: 5 })).res.status).toBe(200)
    const cloned = await signIn(key, { signCount: 5 })
    expect(cloned.res.status).toBe(401)
    expect(log().some((l) => l.action === 'auth.login.failed' && /counter went backwards/.test(l.detail))).toBe(true)
    expect(db().query('select sign_count from passkeys').get()).toEqual({ sign_count: 5 })
    expect((await signIn(key, { signCount: 6 })).res.status).toBe(200)
  })

  it('is rate limited per address, like the password', async () => {
    await addPasskey(await softKey())
    const stranger = await softKey()
    let last = 0
    for (let i = 0; i < 11; i++) last = (await signIn(stranger)).res.status
    expect(last).toBe(429)
  })
})

describe('removing a passkey', () => {
  it('takes it off the list and out of the sign-in, and says so in the log', async () => {
    const key = await softKey()
    await addPasskey(key, { name: 'Old phone' })
    const res = await post('/api/security/passkeys/remove', { current: PASSWORD, id: b64url(key.credentialId) })
    expect(res.status).toBe(200)
    expect((await data<{ passkeys: unknown[] }>(await call('/api/security'))).passkeys).toEqual([])
    expect(log()).toContainEqual({ action: 'security.passkey.remove', detail: 'Old phone' })
    expect((await signIn(key)).res.status).toBe(401)
    expect((await post('/api/security/passkeys/remove', { current: PASSWORD, id: b64url(key.credentialId) })).status).toBe(404)
  })
})

describe('never the only door', () => {
  it('the password still leads to the second factor with a passkey on file', async () => {
    await addPasskey(await softKey())
    const res = await app.request('http://localhost/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'owner', password: PASSWORD }),
    })
    expect(res.status).toBe(200)
    expect((await data<{ status: string }>(res)).status).toMatch(/need-(2fa|enrolment)/)
  })

  it('the sign-in page offers the passkey only once there is one, and keeps the password form', async () => {
    const before = await (await app.request('http://localhost/login')).text()
    expect(before).not.toContain('data-passkey')
    expect(before).toContain('autocomplete="username"')
    await addPasskey(await softKey())
    const after = await (await app.request('http://localhost/login')).text()
    expect(after).toContain('data-passkey hidden')
    expect(after).toContain('autocomplete="username webauthn"')
    expect(after).toContain('action="/api/auth/login"')
  })

  it('the RP ID is the address\'s host, or the request\'s when the address is unset or an IP', async () => {
    await saveSettings({ siteUrl: 'https://blog.example/' })
    const o = await data<Options>(await post('/api/security/passkeys/start', { current: PASSWORD }))
    expect(o.rp.id).toBe('blog.example')
    await saveSettings({ siteUrl: 'http://127.0.0.1:3399' })
    const p = await data<Options>(await post('/api/security/passkeys/start', { current: PASSWORD }))
    expect(p.rp.id).toBe('localhost')
  })
})
