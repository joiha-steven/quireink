// The passkey rows, the challenges, and the sign-in machine below the router.
//
// The cases here are the ones the route tests cannot reach cheaply: a challenge that expires, one
// spent on the wrong ceremony, one answered on another host, a handle from another account, and
// the cap that keeps both the list and the challenge map bounded.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createUser, getUser } from './users'
import { resetSecretCache } from './secret'
import { resetLimits } from '@/server/rate-limit'
import {
  addPasskey, CHALLENGE_MS, cleanName, listPasskeys, MAX_PASSKEYS, mintChallenge, passkeyById,
  resetChallenges, takeChallenge, userHandle,
} from './passkeys'
import { beginPasskeySignIn, finishPasskeySignIn } from './passkey-login'
import { assert, softKey, type SoftKey } from '@/test/webauthn'

const DIR = './.tmp/test-passkeys-unit'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

let userId = 0
let key: SoftKey
const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64url')

beforeEach(async () => {
  for (const t of ['passkeys', 'sessions', 'users', 'activity_log', 'server_secrets']) db().run(`delete from ${t}`)
  resetChallenges()
  resetLimits()
  resetSecretCache()
  userId = (await createUser({ username: 'owner', email: 'o@example.com', password: 'a long enough passphrase' })).id
  key = await softKey()
  addPasskey({ userId, id: b64(key.credentialId), publicKey: key.cose, signCount: 0, transports: [], name: 'Laptop' })
})

/** A sign-in on `localhost`, from options to verdict. */
async function signIn(over: { rpId?: string; answerRpId?: string; handle?: Uint8Array | null; challenge?: string } = {}) {
  const begun = beginPasskeySignIn({ ip: '203.0.113.9', rpId: over.rpId ?? 'localhost' })
  if (begun.status !== 'ok') throw new Error('rate limited')
  const challenge = over.challenge ?? begun.options.challenge
  const a = await assert(key, { rpId: 'localhost', origin: 'http://localhost:3000', challenge })
  return finishPasskeySignIn({
    id: b64(key.credentialId), ...a, userHandle: over.handle ?? null, ip: '203.0.113.9', rpId: over.answerRpId ?? 'localhost',
  })
}

describe('challenges', () => {
  it('answer once', () => {
    const c = mintChallenge('sign-in', { rpId: 'localhost' })
    expect(takeChallenge(c, 'sign-in')).not.toBeNull()
    expect(takeChallenge(c, 'sign-in')).toBeNull()
  })

  it('expire after five minutes', () => {
    const c = mintChallenge('sign-in', { rpId: 'localhost' }, 1_000)
    expect(takeChallenge(c, 'sign-in', 1_000 + CHALLENGE_MS)).toBeNull()
  })

  it('spent on the wrong ceremony are spent all the same', () => {
    const c = mintChallenge('register', { rpId: 'localhost', userId })
    expect(takeChallenge(c, 'sign-in')).toBeNull()
    expect(takeChallenge(c, 'register')).toBeNull()
  })

  it('are bounded: past the cap the oldest goes, not the newest', () => {
    const first = mintChallenge('sign-in', { rpId: 'localhost' })
    let last = ''
    for (let i = 0; i < 600; i++) last = mintChallenge('sign-in', { rpId: 'localhost' })
    expect(takeChallenge(first, 'sign-in')).toBeNull()
    expect(takeChallenge(last, 'sign-in')).not.toBeNull()
  })
})

describe('the rows', () => {
  it('keep at most twenty, and refuse an id twice', () => {
    expect(addPasskey({ userId, id: b64(key.credentialId), publicKey: key.cose, signCount: 0, transports: [], name: '' })).toBe('exists')
    for (let i = 1; i < MAX_PASSKEYS; i++) {
      expect(addPasskey({ userId, id: `id-number-${String(i).padStart(8, '0')}`, publicKey: key.cose, signCount: 0, transports: [], name: '' })).toBe('ok')
    }
    expect(addPasskey({ userId, id: 'one-too-many-xxxxx', publicKey: key.cose, signCount: 0, transports: [], name: '' })).toBe('full')
    expect(listPasskeys(userId)).toHaveLength(MAX_PASSKEYS)
  })

  it('a name is one line of at most sixty characters, and never empty', () => {
    expect(cleanName('  a\tb\n c ')).toBe('a b c')
    expect(cleanName('')).toBe('Passkey')
    expect([...cleanName('é'.repeat(100))]).toHaveLength(60)
  })

  it('the user handle is opaque, sixteen bytes, and the same every time for the same account', () => {
    const user = getUser(userId)!
    expect(userHandle(user)).toHaveLength(16)
    expect([...userHandle(user)]).toEqual([...userHandle(user)])
    expect(Buffer.from(userHandle(user)).toString('latin1')).not.toContain('owner')
  })

  it('the key goes back out exactly as it came in, for the restore and for the verifier', () => {
    expect([...passkeyById(b64(key.credentialId))!.publicKey]).toEqual([...key.cose])
  })
})

describe('finishPasskeySignIn', () => {
  it('signs in with the handle this account files passkeys under, or with none', async () => {
    expect((await signIn({ handle: userHandle(getUser(userId)!) })).status).toBe('ok')
    expect((await signIn({ handle: null })).status).toBe('ok')
  })

  it('refuses a handle that belongs to another account', async () => {
    expect((await signIn({ handle: new Uint8Array(16).fill(1) })).status).toBe('rejected')
  })

  it('refuses an answer arriving on another host than the one that asked', async () => {
    expect((await signIn({ answerRpId: 'elsewhere.example' })).status).toBe('restart')
  })

  it('refuses a challenge it never issued', async () => {
    expect((await signIn({ challenge: 'made-up' })).status).toBe('restart')
  })

  it('throttles the options per address', () => {
    let last = ''
    for (let i = 0; i < 61; i++) last = beginPasskeySignIn({ ip: '198.51.100.1', rpId: 'localhost' }).status
    expect(last).toBe('rate-limited')
  })
})
