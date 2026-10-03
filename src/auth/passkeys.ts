// The owner's passkeys (ADR 0071): the rows, and the challenges a ceremony is answered against.
//
// A PASSKEY IS A SECOND DOOR, NEVER THE ONLY ONE. Nothing in this file, or anywhere, removes the
// password, the second factor or the recovery codes when a passkey is added, and removing the last
// passkey changes nothing about them. The blog can always be entered the way it was entered before
// passkeys existed, which is what makes a lost phone or a moved domain an inconvenience rather than
// a lockout.
//
// The public key is not a secret (it is the half anybody may hold), but it still leaves this
// module only as far as `webauthn.ts`: `PasskeyInfo`, the shape anything client-bound gets, has a
// name and three dates and no key.

import { createHash } from 'node:crypto'
import { all, one, run } from '@/store/query'
import { nowMs } from '@/store/db'

/** Enough for every device a person owns and then some; a list somebody can still read. */
export const MAX_PASSKEYS = 20
/** A name is a label on a list ("Laptop", "Phone"), not a field to store an essay in. */
export const MAX_NAME = 60

/** Safe to serialise. No key, no counter. */
export type PasskeyInfo = {
  id: string
  name: string
  createdAt: number
  lastUsedAt: number | null
}

type Row = {
  id: string
  user_id: number
  public_key: Uint8Array
  sign_count: number
  transports: string
  name: string
  created_at: number
  last_used_at: number | null
}

export function listPasskeys(userId: number): PasskeyInfo[] {
  return all<Row>(`select id, name, created_at, last_used_at from passkeys where user_id = ? order by created_at, id`, userId)
    .map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at, lastUsedAt: r.last_used_at }))
}

/** The ids and transports, for `excludeCredentials`: the authenticator that already holds one says so. */
export function credentialHints(userId: number): { id: string; transports: string[] }[] {
  return all<Row>(`select id, transports from passkeys where user_id = ? order by created_at, id`, userId)
    .map((r) => ({ id: r.id, transports: r.transports ? r.transports.split(',') : [] }))
}

/** Whether there is anything to sign in WITH. Decides whether the sign-in page offers the button. */
export function anyPasskeys(): boolean {
  return one<{ n: number }>(`select count(*) as n from passkeys`)!.n > 0
}

/** What a sign-in needs: whose it is, the key, and the counter. Internal; never returned from a route. */
export function passkeyById(id: string): { id: string; userId: number; publicKey: Uint8Array; signCount: number } | null {
  const r = one<Row>(`select id, user_id, public_key, sign_count from passkeys where id = ?`, id)
  return r === null ? null : { id: r.id, userId: r.user_id, publicKey: r.public_key, signCount: r.sign_count }
}

/**
 * Store a passkey that `verifyRegistration` accepted. Refuses a duplicate id (an authenticator
 * registering twice) and a twenty-first key.
 *
 * Transports are HINTS the browser reported (`usb`, `internal`, `hybrid`…), kept only so the next
 * `excludeCredentials` can name them. They are filtered to the closed set the spec defines, so a
 * value that rides into a later response is one this code wrote.
 */
export function addPasskey(input: {
  userId: number
  id: string
  publicKey: Uint8Array
  signCount: number
  transports: string[]
  name: string
}): 'ok' | 'exists' | 'full' {
  if (passkeyById(input.id) !== null) return 'exists'
  const have = one<{ n: number }>(`select count(*) as n from passkeys where user_id = ?`, input.userId)!.n
  if (have >= MAX_PASSKEYS) return 'full'
  const transports = input.transports.filter((t) => KNOWN_TRANSPORTS.has(t)).join(',')
  run(
    `insert into passkeys (id, user_id, public_key, sign_count, transports, name, created_at)
     values (?, ?, ?, ?, ?, ?, ?)`,
    input.id, input.userId, input.publicKey, input.signCount, transports, cleanName(input.name), nowMs(),
  )
  return 'ok'
}

const KNOWN_TRANSPORTS = new Set(['usb', 'nfc', 'ble', 'smart-card', 'hybrid', 'internal'])

/** One line, no control characters, at most `MAX_NAME` characters, and never empty. */
export function cleanName(raw: string): string {
  const name = raw.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim()
  return [...name].slice(0, MAX_NAME).join('') || 'Passkey'
}

/** Remove one. The row's name comes back so the activity log can say which. */
export function removePasskey(userId: number, id: string): string | null {
  const r = one<Row>(`select name from passkeys where id = ? and user_id = ?`, id, userId)
  if (r === null) return null
  run(`delete from passkeys where id = ? and user_id = ?`, id, userId)
  return r.name
}

/** A sign-in happened: the counter moves to what the authenticator said and the date is written. */
export function touchPasskey(id: string, signCount: number, at = nowMs()): void {
  run(`update passkeys set sign_count = ?, last_used_at = ? where id = ?`, signCount, at, id)
}

/**
 * The opaque handle WebAuthn files the owner's passkeys under (`user.id`, §5.4.3).
 *
 * The spec forbids anything personal in it, and an authenticator REPLACES a passkey that shares
 * an RP ID and a handle, so it has to be stable for the life of the account and the same after a
 * restore. A hash of the account's id and the moment it was made is both: nothing a stranger can
 * read a name out of, and nothing that changes unless the account itself is made again.
 */
export function userHandle(user: { id: number; createdAt: number }): Uint8Array {
  return new Uint8Array(createHash('sha256').update(`quire-ink passkey user ${user.id} ${user.createdAt}`).digest().subarray(0, 16))
}

// ---- challenges -------------------------------------------------------------------------

/** Long enough to find a fingerprint reader and use it; short enough that a stolen one is stale. */
export const CHALLENGE_MS = 5 * 60 * 1000
/**
 * At most this many outstanding. The sign-in page asks for one on every load (conditional UI waits
 * on it from the start), so the map is bounded rather than trusted to drain: past the cap the
 * OLDEST goes. The worst a flood can do is make a real owner press the button a second time.
 */
const MAX_CHALLENGES = 500

export type Purpose = 'register' | 'sign-in'
type Challenge = { purpose: Purpose; rpId: string; createdAt: number; userId?: number; sessionId?: string }

// In memory, like the pending sign-in ticket in `login.ts` and for the same reason: worth nothing
// after five minutes and nothing after a restart. One process on Bun, one Durable Object per blog
// on Cloudflare, so there is exactly one map for a blog on either. A Durable Object put to sleep
// between the two halves of a ceremony loses it, and the answer is the same as for an expired
// one: "try again".
const challenges = new Map<string, Challenge>()

function sweep(now: number): void {
  for (const [k, c] of challenges) if (now - c.createdAt >= CHALLENGE_MS) challenges.delete(k)
}

/** A fresh challenge, base64url of 32 random bytes, remembered for one use. */
export function mintChallenge(purpose: Purpose, bind: { rpId: string; userId?: number; sessionId?: string }, now = Date.now()): string {
  sweep(now)
  while (challenges.size >= MAX_CHALLENGES) challenges.delete(challenges.keys().next().value!)
  const challenge = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
  challenges.set(challenge, { purpose, createdAt: now, ...bind })
  return challenge
}

/**
 * Spend a challenge. It is deleted whatever happens next, including when it was issued for the
 * other ceremony: a challenge answered once has been answered, and a second answer is a replay.
 */
export function takeChallenge(challenge: string, purpose: Purpose, now = Date.now()): Challenge | null {
  sweep(now)
  const found = challenges.get(challenge)
  if (found === undefined) return null
  challenges.delete(challenge)
  return found.purpose === purpose ? found : null
}

/** Test seam: the map is process-global and would leak between test files. */
export function resetChallenges(): void {
  challenges.clear()
}
