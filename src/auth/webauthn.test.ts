// The two ceremonies, checked against frozen bytes (`src/test/passkey-vectors.ts`) for what must
// pass, and against the software authenticator for each thing that must not.
//
// Every refusal below is one a real attack or a real broken client produces: a challenge from
// another ceremony, a page on another origin, an authenticator that skipped the fingerprint, a
// signature over different bytes, a cloned key whose counter did not move.
import { describe, expect, it } from 'bun:test'
import { decodeCbor } from './cbor'
import { derToRaw, importCoseKey } from './cose'
import { FLAG_UP, originMatches, parseAuthData, verifyAssertion, verifyRegistration } from './webauthn'
import { REGISTER_CHALLENGE, RP_ID, SIGN_IN_CHALLENGE, VECTORS } from '@/test/passkey-vectors'
import { assert, attest, b64url, encodeCbor, fromB64url, rawToDer, softKey } from '@/test/webauthn'

const register = (v: (typeof VECTORS)['es256'], over: Partial<{ challenge: string; rpId: string }> = {}) =>
  verifyRegistration({
    clientDataJSON: fromB64url(v.attClientData), attestationObject: fromB64url(v.attestationObject),
    challenge: over.challenge ?? REGISTER_CHALLENGE, rpId: over.rpId ?? RP_ID,
  })

const use = (v: (typeof VECTORS)['es256'], over: Partial<{ storedCount: number; signature: Uint8Array; publicKey: Uint8Array }> = {}) =>
  verifyAssertion({
    clientDataJSON: fromB64url(v.getClientData), authenticatorData: fromB64url(v.authenticatorData),
    signature: over.signature ?? fromB64url(v.signature), challenge: SIGN_IN_CHALLENGE, rpId: RP_ID,
    publicKey: over.publicKey ?? fromB64url(v.cose), storedCount: over.storedCount ?? 0,
  })

describe('the frozen vectors', () => {
  for (const [name, v] of Object.entries(VECTORS)) {
    it(`${name}: the registration yields the credential id and COSE key it carries`, async () => {
      const r = await register(v)
      if (!r.ok) throw new Error(r.reason)
      expect(r.credential.id).toBe(v.credentialId)
      expect(b64url(r.credential.publicKey)).toBe(v.cose)
      expect(r.credential.signCount).toBe(0)
    })

    it(`${name}: the assertion verifies and reports its counter`, async () => {
      const r = await use(v)
      expect(r).toEqual({ ok: true, signCount: v.signCount })
    })

    it(`${name}: one flipped bit of signature is refused`, async () => {
      const sig = fromB64url(v.signature)
      sig[sig.length - 1]! ^= 1
      expect(await use(v, { signature: sig })).toEqual({ ok: false, reason: 'signature' })
    })
  }

  it('a key from another passkey does not verify this one\'s signature', async () => {
    expect(await use(VECTORS.es256, { publicKey: fromB64url(VECTORS.eddsa.cose) })).toEqual({ ok: false, reason: 'signature' })
  })

  it('the challenge and the RP ID are each part of what was signed for', async () => {
    expect(await register(VECTORS.es256, { challenge: SIGN_IN_CHALLENGE })).toEqual({ ok: false, reason: 'challenge' })
    expect(await register(VECTORS.es256, { rpId: 'other.example' })).toEqual({ ok: false, reason: 'origin' })
  })
})

describe('the counter', () => {
  const v = VECTORS.es256 // signs with 7
  it('moving up from what is stored passes', async () => expect(await use(v, { storedCount: 6 })).toEqual({ ok: true, signCount: 7 }))
  it('the same value again is a clone', async () => expect(await use(v, { storedCount: 7 })).toEqual({ ok: false, reason: 'counter' }))
  it('a lower value is a clone', async () => expect(await use(v, { storedCount: 40 })).toEqual({ ok: false, reason: 'counter' }))
  it('0 against a stored 0 is a synced passkey, and fine', async () => {
    expect(await use(VECTORS.eddsa, { storedCount: 0 })).toEqual({ ok: true, signCount: 0 })
  })
  it('0 against a stored count is refused, since the count was real', async () => {
    expect(await use(VECTORS.eddsa, { storedCount: 3 })).toEqual({ ok: false, reason: 'counter' })
  })
  it('the signature is judged first, so a bad one never reaches the counter', async () => {
    const sig = fromB64url(v.signature)
    sig[10]! ^= 0xff
    expect(await use(v, { storedCount: 99, signature: sig })).toEqual({ ok: false, reason: 'signature' })
  })
})

describe('refusals, with a fresh key', () => {
  const rpId = 'blog.example'
  const base = { rpId, origin: 'https://blog.example', challenge: 'abc' }

  const reg = async (over: Record<string, unknown>, alg: -7 | -8 | -257 = -7) => {
    const key = await softKey(alg)
    const a = await attest(key, { ...base, ...over })
    return verifyRegistration({ ...a, challenge: 'abc', rpId })
  }
  const get = async (over: Record<string, unknown>) => {
    const key = await softKey(-7)
    const a = await assert(key, { ...base, ...over })
    return verifyAssertion({ ...a, challenge: 'abc', rpId, publicKey: key.cose, storedCount: 0 })
  }

  it('accepts a registration in each algorithm the options offer', async () => {
    for (const alg of [-7, -8, -257] as const) expect((await reg({}, alg)).ok).toBe(true)
  })
  it('a passkey that only saw a touch, with no fingerprint, face or PIN', async () => {
    expect(await reg({ flags: FLAG_UP })).toEqual({ ok: false, reason: 'not-verified' })
    expect(await get({ flags: FLAG_UP })).toEqual({ ok: false, reason: 'not-verified' })
  })
  it('a passkey nobody touched', async () => {
    expect(await get({ flags: 0x04 })).toEqual({ ok: false, reason: 'not-present' })
  })
  it('a sign-in answer offered as a registration, and the other way round', async () => {
    expect(await reg({ type: 'webauthn.get' })).toEqual({ ok: false, reason: 'type' })
    expect(await get({ type: 'webauthn.create' })).toEqual({ ok: false, reason: 'type' })
  })
  it('a page on another site, an http page, and a look-alike host', async () => {
    expect(await get({ origin: 'https://evil.example' })).toEqual({ ok: false, reason: 'origin' })
    expect(await get({ origin: 'http://blog.example' })).toEqual({ ok: false, reason: 'origin' })
    expect(await get({ origin: 'https://blog.example.evil.test' })).toEqual({ ok: false, reason: 'origin' })
    expect(await get({ origin: 'https://notblog.example' })).toEqual({ ok: false, reason: 'origin' })
  })
  it('an authenticator answering for another RP ID, from the right page', async () => {
    expect(await get({ rpId: 'other.example' })).toEqual({ ok: false, reason: 'rp-id' })
  })
  it('a request from inside somebody else\'s frame', async () => {
    expect(await get({ crossOrigin: true })).toEqual({ ok: false, reason: 'cross-origin' })
  })
  it('bytes that are not an answer at all', async () => {
    const r = await verifyAssertion({
      clientDataJSON: new Uint8Array([1, 2]), authenticatorData: new Uint8Array(10), signature: new Uint8Array(0),
      challenge: 'abc', rpId, publicKey: new Uint8Array(0), storedCount: 0,
    })
    expect(r).toEqual({ ok: false, reason: 'malformed' })
  })
  it('a key in an algorithm the options never offered, or whose shape and label disagree', async () => {
    const m = decodeCbor((await softKey(-7)).cose) as Map<number, Uint8Array | number>
    const relabel = (over: [number, number][]) => encodeCbor(new Map([...m, ...over]) as never)
    // P-256 coordinates under ES384's label, and under RS256's.
    await expect(importCoseKey(relabel([[3, -35]]))).rejects.toThrow()
    await expect(importCoseKey(relabel([[3, -257]]))).rejects.toThrow()
    // An EC2 key on P-384's curve.
    await expect(importCoseKey(relabel([[-1, 2]]))).rejects.toThrow()
    await expect(importCoseKey(new Uint8Array([0xa1, 0x01, 0x04]))).rejects.toThrow()
    // And the registration that carries one is refused at the door, not at the first sign-in.
    const key = await softKey(-7)
    key.cose = relabel([[3, -35]])
    const a = await attest(key, base)
    expect(await verifyRegistration({ ...a, challenge: 'abc', rpId })).toEqual({ ok: false, reason: 'algorithm' })
  })
})

describe('the pieces', () => {
  it('originMatches: the RP ID, a subdomain of it, and localhost over plain http', () => {
    expect(originMatches('https://blog.example', 'blog.example')).toBe(true)
    expect(originMatches('https://blog.example:8443', 'blog.example')).toBe(true)
    expect(originMatches('https://admin.blog.example', 'blog.example')).toBe(true)
    expect(originMatches('http://localhost:3000', 'localhost')).toBe(true)
    expect(originMatches('http://blog.localhost:3000', 'blog.localhost')).toBe(true)
    expect(originMatches('http://127.0.0.1:3000', '127.0.0.1')).toBe(false)
    expect(originMatches('not a url', 'blog.example')).toBe(false)
  })

  it('parseAuthData refuses trailing bytes and a credential id out of bounds', async () => {
    const authData = fromB64url(VECTORS.es256.authenticatorData)
    expect(parseAuthData(authData).signCount).toBe(7)
    expect(() => parseAuthData(new Uint8Array([...authData, 0]))).toThrow()
    expect(() => parseAuthData(authData.subarray(0, 36))).toThrow()
  })

  it('derToRaw is the inverse of DER, including integers that need a leading zero', () => {
    const raw = new Uint8Array(64).map((_, i) => (i === 0 || i === 32 ? 0x80 : i))
    expect([...derToRaw(rawToDer(raw))]).toEqual([...raw])
    const small = new Uint8Array(64)
    small[31] = 1
    small[63] = 2
    expect([...derToRaw(rawToDer(small))]).toEqual([...small])
    expect(() => derToRaw(new Uint8Array([0x30, 0x02, 0x02, 0x00]))).toThrow()
    expect(() => derToRaw(new Uint8Array([...rawToDer(raw), 0]))).toThrow()
  })
})
