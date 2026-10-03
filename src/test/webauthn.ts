// A software authenticator, for tests: it makes a key, answers a registration with an attestation
// object, and answers a sign-in with an assertion, byte for byte as WebAuthn lays them out.
//
// Web Crypto only, so the same helper runs under `bun test` and inside workerd
// (`scripts/cf-test/passkey.ts`). The CBOR encoder below writes the canonical subset the decoder
// in `auth/cbor.ts` reads; it is test-only because the server never has anything to encode.

export type Alg = -7 | -8 | -257

const enc = new TextEncoder()
export const b64url = (b: Uint8Array): string => Buffer.from(b).toString('base64url')
export const fromB64url = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'base64url'))

type Cbor = number | string | boolean | null | Uint8Array | Cbor[] | Map<number | string, Cbor>

function head(major: number, n: number): number[] {
  if (n < 24) return [(major << 5) | n]
  if (n < 0x100) return [(major << 5) | 24, n]
  if (n < 0x10000) return [(major << 5) | 25, n >> 8, n & 0xff]
  return [(major << 5) | 26, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
}

/** CBOR, definite lengths only, which is all CTAP2 ever sends. */
export function encodeCbor(v: Cbor): Uint8Array {
  const out: number[] = []
  const put = (x: Cbor): void => {
    if (typeof x === 'number') out.push(...(x >= 0 ? head(0, x) : head(1, -1 - x)))
    else if (typeof x === 'string') { const b = enc.encode(x); out.push(...head(3, b.length), ...b) }
    else if (typeof x === 'boolean') out.push(x ? 0xf5 : 0xf4)
    else if (x === null) out.push(0xf6)
    else if (x instanceof Uint8Array) out.push(...head(2, x.length), ...x)
    else if (Array.isArray(x)) { out.push(...head(4, x.length)); x.forEach(put) }
    else { out.push(...head(5, x.size)); for (const [k, val] of x) { put(k); put(val) } }
  }
  put(v)
  return new Uint8Array(out)
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}

const sha256 = async (b: Uint8Array): Promise<Uint8Array> => new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(b)))

/** Raw r||s (what Web Crypto signs) as the ASN.1 DER WebAuthn sends. */
export function rawToDer(raw: Uint8Array): Uint8Array {
  const int = (b: Uint8Array): number[] => {
    let i = 0
    while (i < b.length - 1 && b[i] === 0) i++
    const v = [...b.subarray(i)]
    return v[0]! & 0x80 ? [0x02, v.length + 1, 0, ...v] : [0x02, v.length, ...v]
  }
  const body = [...int(raw.subarray(0, 32)), ...int(raw.subarray(32))]
  return new Uint8Array([0x30, body.length, ...body])
}

export type SoftKey = {
  alg: Alg
  credentialId: Uint8Array
  cose: Uint8Array
  sign: (data: Uint8Array) => Promise<Uint8Array>
}

/** A fresh key pair in one of the three algorithms, with its COSE public key and a random id. */
export async function softKey(alg: Alg = -7): Promise<SoftKey> {
  const credentialId = crypto.getRandomValues(new Uint8Array(32))
  if (alg === -7) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer)
    const cose = encodeCbor(new Map<number, Cbor>([[1, 2], [3, -7], [-1, 1], [-2, raw.slice(1, 33)], [-3, raw.slice(33, 65)]]))
    return {
      alg, credentialId, cose,
      sign: async (d) => rawToDer(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new Uint8Array(d)))),
    }
  }
  if (alg === -8) {
    const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as unknown as CryptoKeyPair
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer)
    const cose = encodeCbor(new Map<number, Cbor>([[1, 1], [3, -8], [-1, 6], [-2, raw]]))
    return { alg, credentialId, cose, sign: async (d) => new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, pair.privateKey, new Uint8Array(d))) }
  }
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'],
  ) as CryptoKeyPair
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey) as { n: string; e: string }
  const cose = encodeCbor(new Map<number, Cbor>([[1, 3], [3, -257], [-1, fromB64url(jwk.n)], [-2, fromB64url(jwk.e)]]))
  return { alg, credentialId, cose, sign: async (d) => new Uint8Array(await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, pair.privateKey, new Uint8Array(d))) }
}

export type Ceremony = {
  rpId: string
  origin: string
  challenge: string
  /** Defaults: user present and verified. */
  flags?: number
  signCount?: number
  type?: string
  crossOrigin?: boolean
}

const clientData = (c: Ceremony, type: string): Uint8Array =>
  enc.encode(JSON.stringify({ type: c.type ?? type, challenge: c.challenge, origin: c.origin, crossOrigin: c.crossOrigin ?? false }))

const counter = (n: number): Uint8Array => new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff])

/** What `navigator.credentials.create()` returns, as the two byte strings the server reads. */
export async function attest(key: SoftKey, c: Ceremony): Promise<{ clientDataJSON: Uint8Array; attestationObject: Uint8Array }> {
  const flags = (c.flags ?? 0x05) | 0x40
  const idLen = new Uint8Array([key.credentialId.length >> 8, key.credentialId.length & 0xff])
  const authData = concat(await sha256(enc.encode(c.rpId)), new Uint8Array([flags]), counter(c.signCount ?? 0),
    new Uint8Array(16), idLen, key.credentialId, key.cose)
  const attestationObject = encodeCbor(new Map<string, Cbor>([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]))
  return { clientDataJSON: clientData(c, 'webauthn.create'), attestationObject }
}

/** What `navigator.credentials.get()` returns. */
export async function assert(key: SoftKey, c: Ceremony): Promise<{ clientDataJSON: Uint8Array; authenticatorData: Uint8Array; signature: Uint8Array }> {
  const clientDataJSON = clientData(c, 'webauthn.get')
  const authenticatorData = concat(await sha256(enc.encode(c.rpId)), new Uint8Array([c.flags ?? 0x05]), counter(c.signCount ?? 0))
  const signature = await key.sign(concat(authenticatorData, await sha256(clientDataJSON)))
  return { clientDataJSON, authenticatorData, signature }
}
