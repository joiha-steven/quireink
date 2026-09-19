// THE ONE SECRET IN THIS FEATURE, and the only file that reads it.
//
// ADR 0059. An actor's private key is what proves a delivery came from this blog. Whoever holds
// it can post as this blog to every follower it has, and unlike every other credential in this
// product it is not one the owner pasted in and can rotate at a provider: it IS the identity.
//
// ⚠️ ITS OWN TABLE, NOT `integration_keys`. That table is read whole by the settings screen's
// status call, which then hand-projects a safe subset — a correct design that works because
// somebody remembers to update the projection. A new column there is one forgotten line away
// from a PEM in a client payload. `ap_keys` is read by this module and by nothing else, so
// there is no payload for it to be swept into.
//
// ⚠️ AND IT IS NEVER RETURNED FROM ANYTHING SHAPED LIKE A GETTER. `publicKeyPem()` exists;
// there is no `privateKeyPem()`. What needs to sign asks this module to sign.

import { generateKeyPairSync } from 'node:crypto'
import { one, run } from '@/store/query'
import { nowMs } from '@/store/db'
import { signRequest, type SignedRequest } from '@/ap/signature'

type KeyRow = { private_pem: string; public_pem: string; created_at: number }

const read = (): KeyRow | null => one<KeyRow>(`select * from ap_keys where id = 1`)

/**
 * The blog's keypair, made once and kept.
 *
 * 2048 bits: what every implementation in the fediverse accepts, and what Mastodon itself uses.
 * A larger key is refused by some servers outright, which is a worse failure than a smaller
 * margin — this key signs public posts, it does not protect anything secret in transit.
 *
 * `insert or ignore` then RE-READ, which is the shape `auth/secret.ts` already uses: two
 * requests can reach a fresh install at once, and the loser of that race must return the key
 * that was actually stored rather than the one it generated and threw away. A blog whose actor
 * advertises one public key and signs with another is a blog nobody can verify.
 */
export function ensureKeys(): { publicPem: string; createdAt: number } {
  const existing = read()
  if (existing) return { publicPem: existing.public_pem, createdAt: existing.created_at }
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  run(
    `insert or ignore into ap_keys (id, private_pem, public_pem, created_at) values (1, ?, ?, ?)`,
    privateKey, publicKey, nowMs(),
  )
  const settled = read()
  return { publicPem: settled?.public_pem ?? publicKey, createdAt: settled?.created_at ?? nowMs() }
}

/** The half that goes in the actor document. '' before the key exists, which is not an error. */
export const publicKeyPem = (): string => read()?.public_pem ?? ''

/** True when this blog has an identity at all. */
export const hasKeys = (): boolean => read() !== null

/**
 * Sign a request AS this blog.
 *
 * ⚠️ THE SIGNING HAPPENS HERE SO THE KEY NEVER LEAVES. `ap/signature.ts` takes a PEM as an
 * argument and is pure; this is the one place that fetches one out of the database and hands it
 * over, which keeps the number of code paths that have touched the private key at exactly two.
 *
 * `null` when there is no key yet: the caller has nothing to deliver in that case either, and a
 * thrown error here would be a boot-time failure on a blog that has never switched the feature
 * on.
 */
export function signAs(args: {
  method: 'GET' | 'POST'
  url: string
  body?: string
  keyId: string
  now?: Date
}): SignedRequest | null {
  const row = read()
  if (!row) return null
  return signRequest({ ...args, privateKeyPem: row.private_pem })
}

/**
 * Forget the identity entirely.
 *
 * ⚠️ SWITCHING THE FEATURE OFF DOES NOT CALL THIS, and that is deliberate. An identity in the
 * fediverse is its key: throw it away and every follower this blog has must find it and follow
 * again, which most of them will never do. Off means the doors stop answering and nothing is
 * delivered — a decision the owner can take back. Losing four hundred followers is not.
 *
 * It exists for a test, and for a future "start again as somebody else" the owner would have to
 * ask for by name.
 */
export const forgetKeys = (): void => { run(`delete from ap_keys where id = 1`) }
