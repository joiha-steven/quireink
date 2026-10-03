// The two WebAuthn ceremonies, checked: a passkey made (registration) and a passkey used
// (assertion). Level 3 of the spec, §7.1 and §7.2, the steps that apply to a blog with one owner.
//
// Pure: bytes in, a verdict out. Which challenge was issued, which credential is on file and what
// its counter says are the caller's to look up (`passkeys.ts`, `passkey-login.ts`); this file only
// answers whether these bytes are what an honest authenticator would have sent for them.
//
// ⚠️ EVERY REFUSAL HAS A NAME, and the names stay on the server. They go into the activity log so
// an owner reading "a sign-in was refused" can see WHY; the browser only ever hears that the
// passkey did not work, the same one answer the password step gives.
//
// WHAT IS DELIBERATELY NOT CHECKED: the attestation statement. Registration asks for
// `attestation: 'none'`, and whatever format comes back is accepted unverified. Attestation proves
// which MODEL of authenticator made the key, which is a question for an employer handing out
// security keys; it says nothing about whether the person is the owner, and the owner is already
// proven by the password typed in the same request. Verifying it would mean shipping the root
// certificates of every vendor and refusing the passkey providers that send none.
import { CborError, decodeCbor, decodeCborPrefix } from './cbor'
import { importCoseKey, own, verifySignature } from './cose'

export const FLAG_UP = 0x01 // user present: somebody touched it
export const FLAG_UV = 0x04 // user verified: by fingerprint, face or PIN
export const FLAG_BE = 0x08 // backup eligible: a synced passkey
export const FLAG_AT = 0x40 // attested credential data follows
export const FLAG_ED = 0x80 // extensions follow

export type Refusal =
  | 'malformed' | 'type' | 'challenge' | 'origin' | 'cross-origin' | 'rp-id'
  | 'not-present' | 'not-verified' | 'no-credential' | 'algorithm' | 'signature' | 'counter'

export type AuthData = {
  rpIdHash: Uint8Array
  flags: number
  signCount: number
  /** Only in a registration: the new credential's id and its COSE public key. */
  credential?: { id: Uint8Array; publicKey: Uint8Array }
}

/**
 * The authenticator data (§6.1): a hash of the RP ID, a byte of flags, a counter, and on
 * registration the new key. Nothing may follow what the flags announce.
 */
export function parseAuthData(bytes: Uint8Array): AuthData {
  if (bytes.length < 37) throw new CborError('webauthn: authenticator data shorter than 37 bytes')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const flags = bytes[32]!
  const out: AuthData = { rpIdHash: bytes.slice(0, 32), flags, signCount: view.getUint32(33) }
  let at = 37
  if (flags & FLAG_AT) {
    // 16 bytes of AAGUID (which model, unverified and unused), then the id's length and the id.
    if (bytes.length < at + 18) throw new CborError('webauthn: attested credential data cut short')
    const idLength = view.getUint16(at + 16)
    at += 18
    // §5.8.3: a credential id is at most 1023 bytes. It is also a primary key here.
    if (idLength < 16 || idLength > 1023 || bytes.length < at + idLength) throw new CborError('webauthn: a credential id of the wrong length')
    const id = bytes.slice(at, at + idLength)
    at += idLength
    const { end } = decodeCborPrefix(bytes, at)
    out.credential = { id, publicKey: bytes.slice(at, end) }
    at = end
  }
  if (flags & FLAG_ED) at = decodeCborPrefix(bytes, at).end
  if (at !== bytes.length) throw new CborError('webauthn: bytes after the authenticator data')
  return out
}

export type ClientData = { type: string; challenge: string; origin: string; crossOrigin?: boolean }

/** `clientDataJSON` (§5.8.1), which the BROWSER writes and the authenticator signs a hash of. */
export function parseClientData(bytes: Uint8Array): ClientData {
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes))
  if (parsed === null || typeof parsed !== 'object') throw new CborError('webauthn: client data is not an object')
  const o = parsed as Record<string, unknown>
  if (typeof o.type !== 'string' || typeof o.challenge !== 'string' || typeof o.origin !== 'string') {
    throw new CborError('webauthn: client data without its type, challenge or origin')
  }
  return { type: o.type, challenge: o.challenge, origin: o.origin, crossOrigin: o.crossOrigin === true }
}

/**
 * Whether the page that asked was this blog's.
 *
 * The browser has already refused to use a passkey for any origin outside its RP ID, so this is
 * the second lock on the same door: the origin's host must BE the RP ID or sit under it, and it
 * must be HTTPS, except on `localhost`, which browsers treat as a secure context and where a
 * blog tried on a laptop lives. A port is allowed either way; the RP ID never carries one.
 */
export function originMatches(origin: string, rpId: string): boolean {
  let url: URL
  try { url = new URL(origin) } catch { return false }
  const host = url.hostname
  const local = host === 'localhost' || host.endsWith('.localhost')
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return false
  return host === rpId || host.endsWith(`.${rpId}`)
}

const sha256 = async (data: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', own(data)))

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i])

/** The checks both ceremonies share (§7.1 steps 7-16, §7.2 steps 10-17). */
async function common(
  clientDataJSON: Uint8Array, authData: AuthData,
  expect: { type: string; challenge: string; rpId: string },
): Promise<Refusal | null> {
  const client = parseClientData(clientDataJSON)
  if (client.type !== expect.type) return 'type'
  if (client.challenge !== expect.challenge) return 'challenge'
  if (!originMatches(client.origin, expect.rpId)) return 'origin'
  // A passkey asked for from inside somebody else's frame. Every page here is sent with
  // `X-Frame-Options: DENY` (`web/security-headers.ts`), so an honest browser never gets here.
  if (client.crossOrigin) return 'cross-origin'
  if (!sameBytes(authData.rpIdHash, await sha256(new TextEncoder().encode(expect.rpId)))) return 'rp-id'
  if (!(authData.flags & FLAG_UP)) return 'not-present'
  // REQUIRED, not preferred. A passkey stands in for BOTH factors here, which it can only do
  // because the authenticator checked a fingerprint, a face or a PIN before it signed. A key that
  // was merely touched is one factor, and the password + code door is the one for that.
  if (!(authData.flags & FLAG_UV)) return 'not-verified'
  return null
}

export type Registered = {
  /** base64url, as the browser will name it at sign-in. */
  id: string
  /** The COSE key exactly as the authenticator sent it. Stored as is, imported when used. */
  publicKey: Uint8Array
  signCount: number
  backupEligible: boolean
}

/** §7.1: a new passkey. The caller has already matched `challenge` to one it issued. */
export async function verifyRegistration(input: {
  clientDataJSON: Uint8Array
  attestationObject: Uint8Array
  challenge: string
  rpId: string
}): Promise<{ ok: true; credential: Registered } | { ok: false; reason: Refusal }> {
  try {
    const att = decodeCbor(input.attestationObject)
    if (!(att instanceof Map) || typeof att.get('fmt') !== 'string') return { ok: false, reason: 'malformed' }
    const raw = att.get('authData')
    if (!(raw instanceof Uint8Array)) return { ok: false, reason: 'malformed' }
    const authData = parseAuthData(raw)
    const refused = await common(input.clientDataJSON, authData, { type: 'webauthn.create', challenge: input.challenge, rpId: input.rpId })
    if (refused) return { ok: false, reason: refused }
    if (!authData.credential) return { ok: false, reason: 'no-credential' }
    // Imported once now, so a key this blog cannot use is refused at the door rather than at the
    // first sign-in, when the owner would find out the hard way.
    try { await importCoseKey(authData.credential.publicKey) } catch { return { ok: false, reason: 'algorithm' } }
    return {
      ok: true,
      credential: {
        id: Buffer.from(authData.credential.id).toString('base64url'),
        publicKey: authData.credential.publicKey,
        signCount: authData.signCount,
        backupEligible: (authData.flags & FLAG_BE) !== 0,
      },
    }
  } catch {
    return { ok: false, reason: 'malformed' }
  }
}

/**
 * §7.2: a passkey used. `storedCount` is the counter on file for this credential.
 *
 * THE COUNTER (§6.1.1). An authenticator that keeps one raises it on every signature, so a value
 * that does not go up means two devices hold the same private key: a cloned security key. Synced
 * passkeys (iCloud Keychain, Google Password Manager) keep no counter and send 0 every time, and 0
 * against a stored 0 is the normal case, not a regression. The signature is checked FIRST, so
 * nobody without the key can provoke the counter's refusal.
 */
export async function verifyAssertion(input: {
  clientDataJSON: Uint8Array
  authenticatorData: Uint8Array
  signature: Uint8Array
  challenge: string
  rpId: string
  publicKey: Uint8Array
  storedCount: number
}): Promise<{ ok: true; signCount: number } | { ok: false; reason: Refusal }> {
  try {
    const authData = parseAuthData(input.authenticatorData)
    const refused = await common(input.clientDataJSON, authData, { type: 'webauthn.get', challenge: input.challenge, rpId: input.rpId })
    if (refused) return { ok: false, reason: refused }
    let key
    try { key = await importCoseKey(input.publicKey) } catch { return { ok: false, reason: 'algorithm' } }
    const signed = new Uint8Array(input.authenticatorData.length + 32)
    signed.set(input.authenticatorData)
    signed.set(await sha256(input.clientDataJSON), input.authenticatorData.length)
    if (!(await verifySignature(key, input.signature, signed))) return { ok: false, reason: 'signature' }
    if (input.storedCount > 0 && authData.signCount <= input.storedCount) return { ok: false, reason: 'counter' }
    return { ok: true, signCount: authData.signCount }
  } catch {
    return { ok: false, reason: 'malformed' }
  }
}
