// The envelope a backup archive travels in, when the owner has asked for one (ADR 0060).
//
// WHAT THIS PROTECTS AND WHAT IT CANNOT. The archive is a `VACUUM INTO` of both databases
// plus the uploads tree, so it carries `smtp_pass`, the AI key, the Cloudflare token, the S3
// pair, `users.totp_secret`, the fediverse actor's private key and every subscriber's address.
// It is also the one artifact here that LEAVES the machine: up to a bucket, and down to the
// owner's laptop and onward. This closes that, and only that. A reader with root on the box
// still reads the live database, and no envelope changes it.
//
// ⚠️ THE SERVER CANNOT OPEN WHAT IT SEALS, and that is the whole design rather than a flourish.
// A passphrase kept on the box so the schedule can run unattended is a passphrase an attacker
// who has the box also has, which would leave this feature protecting nothing it claims to.
// So both recipients are X25519 PUBLIC keys and the private halves live with the owner:
//
//   1. an identity, generated here and shown ONCE, never stored — the `mcp/tokens.ts` bargain;
//   2. a passphrase, typed once, from which a keypair is derived and only the PUBLIC half kept.
//      Recovery re-derives the private half from the passphrase and the stored salt.
//
// Either one opens the archive. Two, because one is a file that can be lost and the other is
// a memory that can be forgotten, and losing an archive nobody can read is the failure this
// feature would otherwise introduce while claiming to prevent one.
//
// NO DEPENDENCY, per ADR 0053, and the shape was chosen after measuring rather than by taste.
// `age` would have been the better file format — a decade of tooling already reads it — and it
// is not available: Bun ships no ChaCha20-Poly1305, in `node:crypto` or in WebCrypto, so an
// age-compatible payload would need a hand-written stream cipher on the owner's whole blob
// store. That is exactly the surface ADR 0053 keeps `sharp` for. AES-256-GCM is in the floor
// and measured at 5.5 GB/s in 64 KiB chunks against 87 ms of gzip over the same 256 MB, so the
// cipher disappears into the tar that has to happen anyway.
//
// The format is written out in ADR 0060 so that it can be reimplemented from the document
// alone. That matters more than elegance: ADR 0035 says a restore is a shell act on a stopped
// service, so the day this is needed there may be no Quire Ink running to ask.

import {
  createCipheriv, createDecipheriv, createHmac, createPrivateKey, createPublicKey,
  diffieHellman, generateKeyPairSync, hkdfSync, randomBytes, scryptSync, timingSafeEqual,
  type KeyObject,
} from 'node:crypto'

export const MAGIC = 'QUIREBAK1'
/** 64 KiB, which is age's choice and for its reasons: bounded memory, bounded damage. */
export const CHUNK = 65_536
const TAG = 16
const KEY_PREFIX = 'quire-backup-key-1'
const PUB_PREFIX = 'quire-backup-pub-1'

/**
 * scrypt, at a cost measured on this runtime rather than copied from a blog post.
 *
 * ⚠️ `maxmem` IS LOAD-BEARING AND ITS FAILURE IS SILENT. N=2^16 with r=8 wants 64 MB and
 * Node's default ceiling is 32, so without a raised limit this throws; and raising it too far
 * is worse than too little — `maxmem: 512 << 20` KILLED the Bun process outright, exit 0, no
 * exception to catch. 2^16 costs 77 ms here, which is enough against an offline guess at a
 * passphrase a person actually typed, and is not felt on a once-a-setup derivation.
 */
const KDF = { N: 65_536, r: 8, p: 1, maxmem: 128 << 20 } as const

// The DER preambles for a raw X25519 key. `node:crypto` has no raw import for these, and the
// alternative is carrying a PEM around in a settings field for the sake of 32 bytes.
const PKCS8 = Buffer.from('302e020100300506032b656e04220420', 'hex')
const SPKI = Buffer.from('302a300506032b656e032100', 'hex')

const secretFromSeed = (seed: Uint8Array): KeyObject =>
  createPrivateKey({ key: Buffer.concat([PKCS8, Buffer.from(seed)]), format: 'der', type: 'pkcs8' })

const publicFromRaw = (raw: Uint8Array): KeyObject =>
  createPublicKey({ key: Buffer.concat([SPKI, Buffer.from(raw)]), format: 'der', type: 'spki' })

/**
 * The 32 raw bytes of a public key.
 *
 * ⚠️ Bun REFUSES `createPublicKey()` on a key object that is already public
 * (`ERR_CRYPTO_INVALID_KEY_OBJECT_TYPE`), which Node allows, so the branch is not tidiness.
 */
const rawPublic = (key: KeyObject): Buffer =>
  (key.type === 'private' ? createPublicKey(key) : key)
    .export({ type: 'spki', format: 'der' }).subarray(12)

const b64 = (b: Uint8Array): string => Buffer.from(b).toString('base64')
const un64 = (s: string): Buffer => Buffer.from(s, 'base64')

/** One recipient's public half, as it is written down. */
export const encodePublic = (raw: Uint8Array): string => PUB_PREFIX + Buffer.from(raw).toString('base64url')
/** The private half, as the owner saves it. Prefixed so it is recognisable in a file of junk. */
export const encodeSecret = (seed: Uint8Array): string => KEY_PREFIX + Buffer.from(seed).toString('base64url')

export function decodePublic(text: string): Buffer {
  const raw = Buffer.from(text.trim().slice(PUB_PREFIX.length), 'base64url')
  if (!text.trim().startsWith(PUB_PREFIX) || raw.length !== 32) throw new Error('not-a-public-key')
  return raw
}

export function decodeSecret(text: string): Buffer {
  const seed = Buffer.from(text.trim().slice(KEY_PREFIX.length), 'base64url')
  if (!text.trim().startsWith(KEY_PREFIX) || seed.length !== 32) throw new Error('not-an-identity')
  return seed
}

/** A fresh identity. The secret is returned to be shown once and is never written down here. */
export function newIdentity(): { secret: string; publicKey: string } {
  const seed = randomBytes(32)
  return { secret: encodeSecret(seed), publicKey: encodePublic(rawPublic(secretFromSeed(seed))) }
}

/**
 * The passphrase recipient: derive a keypair, hand back only what may be stored.
 *
 * The salt is returned with it and is NOT a secret — it travels in every archive's header,
 * because recovery needs it and recovery may have nothing but the file. What stands between a
 * stolen archive and a weak passphrase is the scrypt cost above, and saying so is the honest
 * version of this feature: a passphrase of two words is two words whatever is wrapped round it.
 */
export function passphraseRecipient(
  passphrase: string, salt: Uint8Array = randomBytes(16),
): { publicKey: string; salt: string } {
  const seed = scryptSync(passphrase, Buffer.from(salt), 32, KDF)
  return { publicKey: encodePublic(rawPublic(secretFromSeed(seed))), salt: b64(salt) }
}

/**
 * The cost an archive was WRITTEN with, as its own header states it.
 *
 * ⚠️ THE HEADER CARRIED THESE THREE FROM THE START AND NOTHING READ THEM. `unseal` took the
 * salt out of the header and the other three out of the module constant above, so the format
 * was self-describing on paper and pinned to one build in fact: the day anybody raised `N` —
 * which is the ordinary answer as hardware gets faster — every archive already written would
 * have stopped opening by passphrase, and the error it fails with is `no-matching-key`, which
 * reads to the person holding it as "wrong passphrase". On the worst day, about the one file
 * that was supposed to survive it.
 */
export type Cost = { n: number; r: number; p: number }

/**
 * A cost this reader is willing to spend, from a header it has not authenticated yet.
 *
 * ⚠️ THE HEADER IS NOT TRUSTED AND CANNOT BE AT THIS POINT. The passphrase path reads `kdf`
 * out of the JSON BEFORE any key exists, so the MAC has not been checked — an archive that
 * asks for `n: 2 ** 30` is asking the person restoring it to allocate a terabyte, and scrypt
 * would try. The bounds are the whole defence: 2^14 is below anything this has ever written
 * and 2^20 is 1 GB at r=8, which is past what this product runs on (`docs/delivery.md`: the
 * floor is 192 MB) and far past what it will ever write.
 */
export function costFrom(kdf: unknown): Cost {
  const k = kdf as Partial<Record<'n' | 'r' | 'p', unknown>>
  const num = (v: unknown, lo: number, hi: number): number => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < lo || v > hi) throw new Error('bad-kdf')
    return v
  }
  const n = num(k?.n, 1 << 14, 1 << 20)
  // scrypt requires a power of two and reports it as an obscure OpenSSL error; say so here.
  if ((n & (n - 1)) !== 0) throw new Error('bad-kdf')
  return { n, r: num(k?.r, 1, 16), p: num(k?.p, 1, 16) }
}

/** What this build writes. Readers take the archive's word instead (`costFrom`). */
export const COST: Cost = { n: KDF.N, r: KDF.r, p: KDF.p }

/**
 * The private half of that same recipient, months later, from the passphrase and the salt.
 *
 * `maxmem` is DERIVED rather than fixed, because it has to move with `n` and `r` or a lawful
 * archive written at a higher cost throws instead of opening — scrypt needs `128 * n * r` and
 * refuses when that is over the ceiling. Twice the requirement, not more: the constant above
 * records that `512 << 20` killed the Bun process outright, exit 0 and no exception, so this is
 * a number to keep proportional rather than generous.
 */
export const passphraseIdentity = (
  passphrase: string, salt: Uint8Array, cost: Cost = COST,
): KeyObject =>
  secretFromSeed(scryptSync(passphrase, Buffer.from(salt), 32, {
    N: cost.n, r: cost.r, p: cost.p, maxmem: 256 * cost.n * cost.r,
  }))

type Stanza = { t: 'x25519'; eph: string; key: string; tag: string }
type Header = { v: 1; recipients: Stanza[]; kdf: { n: number; r: number; p: number; salt: string }; chunk: number }

/**
 * The key that wraps the file key for one recipient.
 *
 * Both public keys go in as the HKDF salt, which binds a stanza to the recipient it was
 * written for: a stanza moved into another archive's header derives a different key and fails
 * its tag, rather than quietly decrypting to rubbish.
 */
const wrapKey = (shared: Uint8Array, eph: Uint8Array, recipient: Uint8Array): Buffer =>
  Buffer.from(hkdfSync('sha256', shared, Buffer.concat([Buffer.from(eph), Buffer.from(recipient)]),
    'quire-backup-v1 wrap', 32))

const headerKey = (fileKey: Uint8Array): Buffer =>
  Buffer.from(hkdfSync('sha256', fileKey, Buffer.alloc(0), 'quire-backup-v1 header', 32))

/**
 * The nonce for chunk `i`. The last chunk is flagged in its final byte, which is what stops a
 * TRUNCATED archive reading as a complete one: without it, lopping off the tail of a backup
 * yields a shorter archive that opens perfectly and is missing the end of somebody's blog.
 */
function nonceFor(i: number, last: boolean): Buffer {
  const n = Buffer.alloc(12)
  n.writeUInt32BE(i, 7)
  n[11] = last ? 1 : 0
  return n
}

/** Wrap the file key for one recipient. */
function seal(fileKey: Uint8Array, recipientRaw: Uint8Array): Stanza {
  const eph = generateKeyPairSync('x25519')
  const ephRaw = rawPublic(eph.publicKey)
  const shared = diffieHellman({ privateKey: eph.privateKey, publicKey: publicFromRaw(recipientRaw) })
  const c = createCipheriv('aes-256-gcm', wrapKey(shared, ephRaw, recipientRaw), Buffer.alloc(12))
  const key = Buffer.concat([c.update(Buffer.from(fileKey)), c.final()])
  return { t: 'x25519', eph: b64(ephRaw), key: b64(key), tag: b64(c.getAuthTag()) }
}

/** Try one stanza against one identity. Returns null when this identity is not its recipient. */
function open(stanza: Stanza, identity: KeyObject): Buffer | null {
  try {
    const ephRaw = un64(stanza.eph)
    const shared = diffieHellman({ privateKey: identity, publicKey: publicFromRaw(ephRaw) })
    const d = createDecipheriv('aes-256-gcm', wrapKey(shared, ephRaw, rawPublic(identity)), Buffer.alloc(12))
    d.setAuthTag(un64(stanza.tag))
    return Buffer.concat([d.update(un64(stanza.key)), d.final()])
  } catch {
    return null
  }
}

/**
 * A sealer over a stream of arbitrary chunks.
 *
 * `tar` hands out whatever size it feels like and the payload has to be exact 64 KiB frames,
 * so this re-chunks. `header()` first, then `push()` per read, then `end()` — and `end()` is
 * what writes the final frame with its flag, so it is not optional even when the last push
 * landed exactly on a boundary.
 */
export function sealer(recipients: string[], saltB64: string): {
  header: () => Buffer
  push: (data: Uint8Array) => Buffer
  end: () => Buffer
} {
  if (recipients.length === 0) throw new Error('no-recipients')
  const fileKey = randomBytes(32)
  const head: Header = {
    v: 1,
    recipients: recipients.map((r) => seal(fileKey, decodePublic(r))),
    // `COST` and not the three fields again: the number a reader is handed has to be the
    // number the writer spent, and two copies of it are two things to keep in step.
    kdf: { ...COST, salt: saltB64 },
    chunk: CHUNK,
  }
  let held = Buffer.alloc(0)
  let i = 0
  const frame = (plain: Buffer, last: boolean): Buffer => {
    const c = createCipheriv('aes-256-gcm', fileKey, nonceFor(i++, last))
    return Buffer.concat([c.update(plain), c.final(), c.getAuthTag()])
  }
  return {
    header() {
      const json = JSON.stringify(head)
      const mac = createHmac('sha256', headerKey(fileKey)).update(MAGIC + '\n' + json + '\n').digest()
      return Buffer.from(`${MAGIC}\n${json}\n${b64(mac)}\n`)
    },
    push(data) {
      held = Buffer.concat([held, Buffer.from(data)])
      const out: Buffer[] = []
      // `>` and not `>=`: a buffer sitting exactly on a boundary may still be the last one,
      // and the final frame is the one that carries the flag. It waits for `end()`.
      while (held.length > CHUNK) {
        out.push(frame(held.subarray(0, CHUNK), false))
        held = held.subarray(CHUNK)
      }
      return out.length ? Buffer.concat(out) : Buffer.alloc(0)
    },
    end: () => frame(held, true),
  }
}

/** What an opener reports when it cannot proceed. Named, never a bare false (ADR 0060). */
export type OpenFault =
  | 'not-an-archive' | 'bad-header' | 'wrong-version' | 'no-matching-key' | 'header-tampered'

/**
 * Read the header and unwrap the file key.
 *
 * The header MAC is checked BEFORE a byte of payload is touched, so a swapped recipient list
 * is a named refusal rather than a stream that fails 40 GB later.
 */
export function unseal(head: Buffer, identity: KeyObject): { fileKey: Buffer; start: number; header: Header } {
  const text = head.toString('latin1')
  const one = text.indexOf('\n')
  const two = text.indexOf('\n', one + 1)
  const three = text.indexOf('\n', two + 1)
  if (one < 0 || two < 0 || three < 0 || text.slice(0, one) !== MAGIC) throw new Error('not-an-archive')
  let parsed: Header
  try {
    parsed = JSON.parse(text.slice(one + 1, two)) as Header
  } catch {
    throw new Error('bad-header')
  }
  if (parsed.v !== 1 || !Array.isArray(parsed.recipients)) throw new Error('wrong-version')
  let fileKey: Buffer | null = null
  for (const stanza of parsed.recipients) {
    fileKey = open(stanza, identity)
    if (fileKey) break
  }
  if (!fileKey) throw new Error('no-matching-key')
  const want = createHmac('sha256', headerKey(fileKey))
    .update(text.slice(0, two + 1)).digest()
  const got = un64(text.slice(two + 1, three))
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new Error('header-tampered')
  return { fileKey, start: three + 1, header: parsed }
}

/** The payload half, once `unseal` has the key. Throws on a bad tag, which is the point. */
export function opener(fileKey: Buffer, chunk = CHUNK): (frame: Buffer, last: boolean, i: number) => Buffer {
  return (frame, last, i) => {
    if (frame.length > chunk + TAG) throw new Error('bad-chunk')
    const d = createDecipheriv('aes-256-gcm', fileKey, nonceFor(i, last))
    d.setAuthTag(frame.subarray(frame.length - TAG))
    return Buffer.concat([d.update(frame.subarray(0, frame.length - TAG)), d.final()])
  }
}
