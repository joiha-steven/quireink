// Signing in with a passkey: a challenge out, an assertion back, a session (ADR 0071).
//
// ONE STEP, NOT TWO. The password sign-in needs a second screen because a password is one factor;
// a passkey created with `userVerification: 'required'` is two at once (the device, and the
// fingerprint, face or PIN that unlocked it) and it cannot be phished, because the browser will
// not use it for any origin but this blog's. So a verified assertion goes straight to a session,
// with no code screen after it. That is the whole of the "fast path".
//
// The rules that shape `login.ts` hold here too:
//   - a caller learns whether the sign-in worked, never which check failed. The reason goes to
//     the activity log, where the owner can read it.
//   - limits are checked before the attempt and charged only when it FAILS, so the owner signing
//     in from a new device for the sixth time is never throttled by their own success.

import { clearLimit, overLimit, recordHit } from '@/server/rate-limit'
import { logAuthEvent } from '@/server/activity'
import { createSession } from './sessions'
import { getUser } from './users'
import { mintChallenge, passkeyById, takeChallenge, touchPasskey, userHandle } from './passkeys'
import { parseClientData, verifyAssertion, type Refusal } from './webauthn'

const FIFTEEN_MIN = 15 * 60 * 1000

/** What the browser is handed for `navigator.credentials.get()`. Every field is plain JSON. */
export type SignInOptions = {
  challenge: string
  rpId: string
  timeout: number
  userVerification: 'required'
  /**
   * EMPTY, on purpose. A discoverable passkey names itself, so the page never has to say which
   * credentials exist — and listing them to an anonymous visitor would hand out the owner's
   * credential ids. Conditional UI (the passkey in the username box's autofill) requires it.
   */
  allowCredentials: []
}

export type BeginOutcome = { status: 'ok'; options: SignInOptions } | { status: 'rate-limited'; retryAfter: number }

/**
 * A challenge for the sign-in page. Asked on every load where the browser offers passkeys in the
 * autofill, so it is cheap and capped per address: sixty in a quarter hour is a page reloaded once
 * every fifteen seconds, which nobody does by hand.
 */
export function beginPasskeySignIn(input: { ip: string; rpId: string; now?: number }): BeginOutcome {
  const key = `passkey:options:${input.ip}`
  if (overLimit(key, 60, FIFTEEN_MIN)) return { status: 'rate-limited', retryAfter: FIFTEEN_MIN / 1000 }
  recordHit(key, FIFTEEN_MIN)
  const challenge = mintChallenge('sign-in', { rpId: input.rpId }, input.now)
  return { status: 'ok', options: { challenge, rpId: input.rpId, timeout: 5 * 60 * 1000, userVerification: 'required', allowCredentials: [] } }
}

export type Assertion = {
  /** The credential id, base64url, as `PublicKeyCredential.id` names it. */
  id: string
  clientDataJSON: Uint8Array
  authenticatorData: Uint8Array
  signature: Uint8Array
  userHandle: Uint8Array | null
}

export type FinishOutcome =
  | { status: 'ok'; userId: number; token: string; expiresAt: number }
  /** Anything wrong with the passkey. One outcome, whatever the reason. */
  | { status: 'rejected' }
  /** The challenge is gone: expired, already answered, or never issued. Start again. */
  | { status: 'restart' }
  | { status: 'rate-limited'; retryAfter: number }

/** Why a refusal was refused, in the words the activity log keeps. */
const SAID: Record<Refusal | 'unknown-credential' | 'user-handle' | 'challenge-gone', string> = {
  'malformed': 'the passkey answer could not be read',
  'type': 'the passkey answer was for another ceremony',
  'challenge': 'the passkey answer was for another challenge',
  'origin': 'the passkey answer came from another address',
  'cross-origin': 'the passkey was asked for from inside another site',
  'rp-id': 'the passkey belongs to another address',
  'not-present': 'nobody touched the passkey',
  'not-verified': 'the passkey did not check a fingerprint, face or PIN',
  'no-credential': 'the passkey answer carried no key',
  'algorithm': 'the stored passkey key could not be read',
  'signature': 'the passkey signature did not verify',
  'counter': 'the passkey counter went backwards: two devices may hold the same key',
  'unknown-credential': 'a passkey this blog does not know',
  'user-handle': 'the passkey belongs to another account',
  'challenge-gone': 'the passkey challenge had expired or was already used',
}

/**
 * The assertion, checked against the challenge it answers and the credential it names.
 *
 * The challenge is spent FIRST, before anything else is looked at, so an assertion is good for one
 * attempt whatever that attempt's outcome. The session is created only after the counter has been
 * moved on, so a session can never exist for a signature the counter would refuse next time.
 */
export async function finishPasskeySignIn(input: Assertion & {
  ip: string
  rpId: string
  userAgent?: string
  now?: number
}): Promise<FinishOutcome> {
  // Two windows, the password step's shape: one per address, and one across every address that a
  // RIGHT passkey still passes. A distributed guesser gains nothing by guessing at signatures, but
  // each attempt costs a signature verification, and the wide cap is what bounds that bill.
  const ipKey = `passkey:ip:${input.ip}`
  const allKey = 'passkey:all'
  if (overLimit(ipKey, 10, FIFTEEN_MIN)) {
    logAuthEvent('auth.login.failed', 'passkey: rate limited')
    return { status: 'rate-limited', retryAfter: FIFTEEN_MIN / 1000 }
  }
  const crowded = overLimit(allKey, 50, FIFTEEN_MIN)
  const refuse = (why: keyof typeof SAID, status: 'rejected' | 'restart' = 'rejected'): FinishOutcome => {
    recordHit(ipKey, FIFTEEN_MIN)
    recordHit(allKey, FIFTEEN_MIN)
    if (why === 'counter') console.warn(`[WARN] auth.passkey: credential ${input.id.slice(0, 12)}… sent a sign count that did not go up`)
    logAuthEvent('auth.login.failed', `passkey: ${SAID[why]}`)
    if (crowded) return { status: 'rate-limited', retryAfter: FIFTEEN_MIN / 1000 }
    return { status }
  }

  let challenge: string
  try { challenge = parseClientData(input.clientDataJSON).challenge } catch { return refuse('malformed') }
  const issued = takeChallenge(challenge, 'sign-in', input.now)
  // The RP ID is the one the challenge was issued under. A request that arrives on another host
  // than the one that asked is answering somebody else's question.
  if (issued === null || issued.rpId !== input.rpId) return refuse('challenge-gone', 'restart')

  const stored = passkeyById(input.id)
  if (stored === null) return refuse('unknown-credential')
  const user = getUser(stored.userId)
  if (user === null) return refuse('unknown-credential')
  // Optional in the spec for a credential the server named, required here in spirit: the handle,
  // when sent, must be the one this account files its passkeys under.
  if (input.userHandle !== null && input.userHandle.length > 0) {
    const want = userHandle(user)
    if (input.userHandle.length !== want.length || !input.userHandle.every((b, i) => b === want[i])) return refuse('user-handle')
  }

  const result = await verifyAssertion({
    clientDataJSON: input.clientDataJSON,
    authenticatorData: input.authenticatorData,
    signature: input.signature,
    challenge,
    rpId: input.rpId,
    publicKey: stored.publicKey,
    storedCount: stored.signCount,
  })
  if (!result.ok) return refuse(result.reason)

  touchPasskey(stored.id, result.signCount)
  // Whatever came before from this address was this person fumbling, as after a right password.
  clearLimit(ipKey)
  const session = createSession(stored.userId, { ip: input.ip, userAgent: input.userAgent })
  logAuthEvent('auth.login', 'via passkey')
  return { status: 'ok', userId: stored.userId, token: session.token, expiresAt: session.expiresAt }
}
