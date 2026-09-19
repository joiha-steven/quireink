// THE LOCK, CHECKED BOTH WAYS.
//
// There is no second server here to talk to, so the honest test is the round trip: sign with a
// private key, verify with its public half, and then break one thing at a time. Every case
// below is a refusal somebody else's server would hand back as a silent 401 — which is exactly
// why they are asserted here rather than discovered in production.
import { describe, expect, it } from 'bun:test'
import { generateKeyPairSync } from 'node:crypto'
import {
  digestOf, parseSignature, signingString, signRequest, verifySignature,
} from '@/ap/signature'

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

const KEY_ID = 'https://blog.example/ap/actor#main-key'
const INBOX = 'https://elsewhere.test/users/someone/inbox'
const NOW = new Date('2026-09-19T12:00:00.000Z')
const BODY = JSON.stringify({ type: 'Follow', actor: 'https://blog.example/ap/actor' })

/** A signed POST, taken apart into what a receiving server would see. */
const incoming = (over: { body?: string; now?: Date } = {}) => {
  const signed = signRequest({
    method: 'POST', url: INBOX, body: over.body ?? BODY,
    keyId: KEY_ID, privateKeyPem: privateKey, now: over.now ?? NOW,
  })
  return {
    method: 'POST',
    path: new URL(INBOX).pathname,
    headers: signed.headers,
    body: over.body ?? BODY,
    publicKeyPem: publicKey,
    now: NOW,
  }
}

describe('a request this blog signed', () => {
  it('verifies against the public half of its own key', () => {
    expect(verifySignature(incoming())).toBeNull()
  })

  it('covers the method and the PATH, not the whole URL', () => {
    // ⚠️ THE MOST COMMON WAY TO GET THIS WRONG, and it fails in silence: a signature built over
    // the full URL verifies against nothing on the far end, which answers 202 and drops the
    // delivery. The line is asserted literally.
    const line = signingString(['(request-target)'], 'POST', '/users/someone/inbox', {})
    expect(line).toBe('(request-target): post /users/someone/inbox')
  })

  it('names the four headers a POST is expected to cover, in order', () => {
    const parsed = parseSignature(incoming().headers.signature)!
    expect(parsed.headers).toEqual(['(request-target)', 'host', 'date', 'digest'])
    expect(parsed.keyId).toBe(KEY_ID)
    expect(parsed.algorithm).toBe('rsa-sha256')
  })

  it('leaves the digest off a GET, which has no body to bind', () => {
    const signed = signRequest({
      method: 'GET', url: 'https://elsewhere.test/users/someone', keyId: KEY_ID,
      privateKeyPem: privateKey, now: NOW,
    })
    expect(parseSignature(signed.headers.signature)!.headers).toEqual(['(request-target)', 'host', 'date'])
    expect(signed.headers.digest).toBeUndefined()
    // It still asks for the right media types: a document served under the wrong one is a
    // document the far end declines to parse.
    expect(signed.headers.accept).toContain('application/activity+json')
  })

  it('sends the date in the form HTTP asks for', () => {
    // `toUTCString`, never a locale format: `19/09/2026` is refused by every implementation.
    expect(incoming().headers.date).toBe('Sat, 19 Sep 2026 12:00:00 GMT')
  })
})

describe('a request this blog refuses', () => {
  it('refuses a body that is not the one signed for', () => {
    const req = incoming()
    expect(verifySignature({ ...req, body: '{"type":"Delete"}' })).toBe('bad-digest')
  })

  it('refuses a signature made with another key', () => {
    const other = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    expect(verifySignature({ ...incoming(), publicKeyPem: other.publicKey })).toBe('bad-signature')
  })

  it('refuses a request signed two hours ago, and accepts one signed ten minutes ago', () => {
    const old = new Date(NOW.getTime() - 2 * 60 * 60 * 1000)
    expect(verifySignature({ ...incoming({ now: old }), headers: incoming({ now: old }).headers }))
      .toBe('stale-date')
    // ⚠️ THE COUNTER-TEST IS THE POINT OF THE WINDOW BEING WIDE. Two servers' clocks drift, and
    // a window tight enough to look rigorous refuses everything from a machine two minutes out
    // — which its operator experiences as "the blog stopped federating", with no error anywhere.
    const recent = new Date(NOW.getTime() - 10 * 60 * 1000)
    expect(verifySignature(incoming({ now: recent }))).toBeNull()
  })

  it('refuses a signature that does not cover the date or the target', () => {
    // A signature over `host` alone is one that can be lifted off this request and replayed
    // against every other route on this server, forever.
    const req = incoming()
    for (const list of ['host', '(request-target) host', 'host date']) {
      const headers = {
        ...req.headers,
        signature: req.headers.signature!.replace(/headers="[^"]*"/, `headers="${list}"`),
      }
      expect(verifySignature({ ...req, headers })).toBe('missing-header')
    }
  })

  it('refuses a request with no signature at all', () => {
    const req = incoming()
    const headers = { ...req.headers }
    delete headers.signature
    expect(verifySignature({ ...req, headers })).toBe('no-signature')
  })

  it('refuses an algorithm it does not speak', () => {
    const req = incoming()
    const headers = {
      ...req.headers,
      signature: req.headers.signature!.replace('rsa-sha256', 'hmac-sha256'),
    }
    expect(verifySignature({ ...req, headers })).toBe('bad-algorithm')
  })
})

describe('reading a Signature header', () => {
  it('does not cut a signature in half at a comma', () => {
    // ⚠️ BASE64 CONTAINS `+` AND `/` AND, IN SOME ENCODERS, NOTHING ELSE — but the header's own
    // grammar is `key="value"` pairs separated by commas, and a naive split on commas cuts any
    // signature whose base64 happens to contain one of the quoted commas other fields may
    // carry. Matching whole pairs is what makes this robust rather than usually-right.
    const header = 'keyId="https://a.test/u#main-key",algorithm="rsa-sha256",'
      + 'headers="(request-target) host date digest",signature="AAA,BBB+CCC/DDD=="'
    const parsed = parseSignature(header)!
    expect(parsed.signature).toBe('AAA,BBB+CCC/DDD==')
    expect(parsed.keyId).toBe('https://a.test/u#main-key')
    expect(parsed.headers).toHaveLength(4)
  })

  it('defaults the algorithm, because several implementations leave it out', () => {
    expect(parseSignature('keyId="k",headers="date",signature="s"')?.algorithm).toBe('rsa-sha256')
  })

  it('answers null for anything that is not a signature', () => {
    expect(parseSignature(undefined)).toBeNull()
    expect(parseSignature('Bearer abc123')).toBeNull()
    expect(parseSignature('keyId="k"')).toBeNull()
  })

  it('digests the exact bytes, so one changed character is a different digest', () => {
    expect(digestOf('{"a":1}')).not.toBe(digestOf('{"a":2}'))
    expect(digestOf('')).toBe('SHA-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=')
  })
})
