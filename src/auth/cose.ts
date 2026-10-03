// A passkey's public key, from COSE (RFC 9052/9053) into Web Crypto, and its signature checked.
//
// Web Crypto (`crypto.subtle`) and not `node:crypto`, because it is the one verifier both runtimes
// have natively: Bun implements it, and workerd implements it as its own crypto rather than as a
// shim (`scripts/cf-test/passkey.ts` holds that). No port is needed, and so none is added.
//
// THREE ALGORITHMS, the three every platform offers:
//   ES256  (-7)    P-256 ECDSA. What every passkey provider and every security key can do.
//   EdDSA  (-8)    Ed25519. Some security keys prefer it.
//   RS256  (-257)  RSA PKCS#1 v1.5. Windows Hello, on machines whose TPM signs nothing else.
// The registration options offer exactly these, in this order, so a key in any other algorithm
// is one this blog never asked for and is refused.
//
// ⚠️ THE KEY'S OWN `alg` IS CHECKED AGAINST ITS SHAPE. A COSE key states both what it is (kty,
// crv) and what it signs with (alg). Trusting `alg` alone would let a key say "RSA" and carry an
// EC point, and the import would then fail somewhere far less obvious than here.
import { CborError, decodeCbor, type CborValue } from './cbor'

export const ES256 = -7
export const EDDSA = -8
export const RS256 = -257
/** What the registration offers, in preference order. */
export const ALGORITHMS = [ES256, EDDSA, RS256] as const

export type PublicKey = { alg: number; key: CryptoKey }

const b64url = (b: Uint8Array): string => Buffer.from(b).toString('base64url')

/**
 * A copy on a plain ArrayBuffer. Web Crypto's types refuse a view that might sit on a
 * SharedArrayBuffer, and a slice of a request body is typed as one that might; the copy is a few
 * dozen bytes.
 */
export const own = (b: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(b)

type ImportAlgorithm = Parameters<typeof crypto.subtle.importKey>[2]

const bytesAt = (m: Map<number | string, CborValue>, k: number, len?: number): Uint8Array => {
  const v = m.get(k)
  if (!(v instanceof Uint8Array) || (len !== undefined && v.length !== len)) {
    throw new CborError(`cose: field ${k} is not ${len === undefined ? 'a byte string' : `${len} bytes`}`)
  }
  return v
}

/**
 * Ed25519 under the name the platform knows. The standard name is `Ed25519`; workerd shipped
 * it first as `NODE-ED25519`, and a Worker built against an older compatibility date still only
 * answers to that. Tried in that order, once each.
 */
async function importEd25519(raw: Uint8Array): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey('raw', own(raw), { name: 'Ed25519' }, false, ['verify'])
  } catch {
    return crypto.subtle.importKey('raw', own(raw), { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' } as ImportAlgorithm, false, ['verify'])
  }
}

/** The COSE key bytes a passkey registered with, as a key that can verify. Throws on anything else. */
export async function importCoseKey(cose: Uint8Array): Promise<PublicKey> {
  const m = decodeCbor(cose)
  if (!(m instanceof Map)) throw new CborError('cose: the key is not a map')
  const kty = m.get(1)
  const alg = m.get(3)
  const crv = m.get(-1)
  if (kty === 2 && alg === ES256 && crv === 1) {
    // Uncompressed point, 0x04 || x || y: the one raw form every Web Crypto accepts for P-256.
    const point = new Uint8Array(65)
    point[0] = 4
    point.set(bytesAt(m, -2, 32), 1)
    point.set(bytesAt(m, -3, 32), 33)
    return { alg, key: await crypto.subtle.importKey('raw', point, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']) }
  }
  if (kty === 1 && alg === EDDSA && crv === 6) {
    return { alg, key: await importEd25519(bytesAt(m, -2, 32)) }
  }
  if (kty === 3 && alg === RS256) {
    const n = bytesAt(m, -1)
    // 2048 bits at the least: what Windows Hello makes, and NIST's floor since 2013.
    if (n.length < 256) throw new CborError('cose: an RSA modulus shorter than 2048 bits')
    const jwk = { kty: 'RSA', n: b64url(n), e: b64url(bytesAt(m, -2)), alg: 'RS256', ext: true }
    return { alg, key: await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']) }
  }
  throw new CborError(`cose: kty ${String(kty)} with alg ${String(alg)} is not one this blog offers`)
}

/**
 * An ECDSA signature as WebAuthn sends it (ASN.1 DER, `SEQUENCE { INTEGER r, INTEGER s }`) in
 * the form Web Crypto verifies (r and s, 32 bytes each, back to back).
 *
 * Strict on purpose: the short form of each length only, no trailing bytes, nothing longer than
 * 33 bytes for an integer. A signature that is not exactly this shape is not a P-256 signature.
 */
export function derToRaw(der: Uint8Array): Uint8Array {
  let at = 0
  const fail = (why: string): never => { throw new CborError(`cose: a malformed ECDSA signature (${why})`) }
  if (der[at++] !== 0x30) fail('no sequence')
  const total = der[at++]
  if (total === undefined || total > 0x7f || at + total !== der.length) fail('the sequence length')
  const out = new Uint8Array(64)
  for (const slot of [0, 32]) {
    if (der[at++] !== 0x02) fail('no integer')
    const len = der[at++]
    if (len === undefined || len < 1 || len > 33 || at + len > der.length) fail('an integer length')
    let int = der.subarray(at, at + len!)
    at += len!
    // A leading zero only says "positive"; strip it, and then the integer must fit in 32 bytes.
    while (int.length > 1 && int[0] === 0) int = int.subarray(1)
    if (int.length > 32) fail('an integer longer than the curve')
    out.set(int, slot + 32 - int.length)
  }
  if (at !== der.length) fail('bytes after the integers')
  return out
}

/** True when `signature` is `key`'s signature over `data`. A malformed signature is simply false. */
export async function verifySignature(pk: PublicKey, signature: Uint8Array, data: Uint8Array): Promise<boolean> {
  try {
    if (pk.alg === ES256) return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pk.key, own(derToRaw(signature)), own(data))
    if (pk.alg === RS256) return await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, pk.key, own(signature), own(data))
    // The name the key was imported under, which is `Ed25519` or workerd's older `NODE-ED25519`.
    if (pk.alg === EDDSA) return await crypto.subtle.verify(pk.key.algorithm, pk.key, own(signature), own(data))
  } catch {
    return false
  }
  return false
}
