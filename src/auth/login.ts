// The sign-in state machine: password, then TOTP or a recovery code, then a session.
//
// It is split across two requests because 2FA is its own screen (06-auth.md), which means
// something has to remember "this person got the password right" in between. That
// something is a PENDING ticket: short-lived, server-side, and worth nothing on its own.
//
// The rule that shapes everything here: a caller learns whether the whole sign-in
// succeeded, never which half failed. "No such user" and "wrong password" are one outcome
// with one message and one duration.

import { clearLimit, overLimit, recordHit } from '@/server/rate-limit'
import { logAuthEvent } from '@/server/activity'
import { needsRehash, verifyPassword } from './password'
import { verifyCode } from './totp'
import { redeemCode } from './recovery'
import { createSession } from './sessions'
import { passwordHashFor, rehashPassword, setTotpLastStep, totpStateFor } from './users'

/** How long a half-finished sign-in survives. Long enough to read a code off a phone. */
const PENDING_MS = 5 * 60 * 1000
/** Wrong codes allowed against one ticket before it is destroyed and the password is needed again. */
const MAX_TOTP_ATTEMPTS = 5

const FIFTEEN_MIN = 15 * 60 * 1000
const HOUR = 60 * 60 * 1000

type Pending = {
  userId: number
  createdAt: number
  attempts: number
}

// In memory, not in the database. A pending ticket is worthless after five minutes and
// worthless after a restart, and the frozen tree's lesson about rate-limit state applies:
// per-instance is the correct scope for something this short-lived.
const pending = new Map<string, Pending>()

function sweepPending(now: number): void {
  for (const [id, p] of pending) if (now - p.createdAt >= PENDING_MS) pending.delete(id)
}

export type PasswordOutcome =
  /** Password accepted. Present `ticket` to `submitSecondFactor`. */
  | { status: 'need-2fa'; ticket: string }
  /** Password accepted, but TOTP has never been enrolled. The caller sends them to enrolment. */
  | { status: 'need-enrolment'; ticket: string }
  /** Wrong username OR wrong password. The caller must not distinguish these to the user. */
  | { status: 'rejected' }
  /** Too many attempts. `retryAfter` is seconds, for the header. */
  | { status: 'rate-limited'; retryAfter: number }

/**
 * Step one. Always spends the cost of an argon2id verification, even for a username that
 * does not exist, so response time is not an account-existence oracle.
 */
export async function submitPassword(input: {
  username: string
  password: string
  ip: string
  now?: number
}): Promise<PasswordOutcome> {
  const now = input.now ?? Date.now()
  sweepPending(now)

  // Two windows on purpose. The per-IP limit stops one machine hammering; the per-username
  // limit stops a distributed attempt on the one account that matters, which the per-IP
  // limit alone would never see.
  //
  // Both are checked before the attempt and charged only after it FAILS. A successful
  // sign-in must not spend the allowance, or the owner signing in from a new device for
  // the sixth time in a quarter of an hour locks themselves out.
  //
  // ⚠️ THE USERNAME'S OWN ALLOWANCE IS PER ADDRESS, AND THE ONE ACROSS ADDRESSES DOES NOT STOP
  // THE RIGHT PASSWORD (2026-09-30). The username bucket was shared by every client and checked
  // before the password, so five wrong guesses from anywhere — one every three minutes — kept
  // the only owner out for good, correct password or not. Now five per username per address,
  // and a wide cap across addresses that a CORRECT password still passes: a distributed guesser
  // is slowed to five per address and learns nothing, the owner signs in, and the second factor
  // is still in front of the session.
  const username = input.username.trim().toLowerCase()
  const ipKey = `login:ip:${input.ip}`
  const pairKey = `login:user:${username}:${input.ip}`
  const userKey = `login:user:${username}`
  const refuse = (why: string): PasswordOutcome => {
    logAuthEvent('auth.login.failed', `rate limited: ${why}`)
    return { status: 'rate-limited', retryAfter: Math.ceil(FIFTEEN_MIN / 1000) }
  }
  if (overLimit(ipKey, 10, FIFTEEN_MIN)) return refuse('ip')
  if (overLimit(pairKey, 5, FIFTEEN_MIN)) return refuse('username')
  const crowded = overLimit(userKey, 50, FIFTEEN_MIN)

  const account = passwordHashFor(input.username)
  const ok = await verifyPassword(account?.hash ?? null, input.password)
  if (!ok || account === null) {
    recordHit(ipKey, FIFTEEN_MIN)
    recordHit(pairKey, FIFTEEN_MIN)
    recordHit(userKey, FIFTEEN_MIN)
    // Past the wide cap a wrong guess reads as throttled, not as wrong: the same answer the
    // guesser would get for a right one, had it not been right.
    if (crowded) return refuse('username, across addresses')
    logAuthEvent('auth.login.failed', 'bad username or password')
    return { status: 'rejected' }
  }
  // The password was right. Whatever came before it was this person mistyping.
  clearLimit(pairKey)
  // And it is the one moment the password is in hand: an old hash moves to today's parameters
  // (ADR 0069), so a blog moved to Cloudflare never has to verify a 64 MiB hash in 128 MB.
  if (needsRehash(account.hash)) {
    await rehashPassword(account.id, input.password).catch((error: unknown) => {
      console.error(`[ERROR] auth.login: could not store the password at the new parameters: ${(error as Error).message}`)
    })
  }

  const ticket = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url')
  pending.set(ticket, { userId: account.id, createdAt: now, attempts: 0 })

  const totp = totpStateFor(account.id)
  return totp?.secret ? { status: 'need-2fa', ticket } : { status: 'need-enrolment', ticket }
}

export type SecondFactorOutcome =
  | { status: 'ok'; userId: number; token: string; expiresAt: number }
  /** Wrong code, and the ticket is still usable. */
  | { status: 'rejected'; attemptsLeft: number }
  /** The ticket is gone: expired, already used, or spent by too many wrong codes. */
  | { status: 'restart' }
  | { status: 'rate-limited'; retryAfter: number }
  /** A right code the replay guard already spent: wait for the next one. Costs no attempt. */
  | { status: 'reused' }

/**
 * Step two. `code` is either a 6-digit TOTP code or a recovery code; the shape decides
 * which, so there is no mode flag for a caller to get wrong.
 *
 * On success the ticket is destroyed BEFORE the session is created. A ticket that survives
 * its own redemption is a second sign-in for free.
 */
export async function submitSecondFactor(input: {
  ticket: string
  code: string
  ip: string
  userAgent?: string
  now?: number
}): Promise<SecondFactorOutcome> {
  const now = input.now ?? Date.now()
  sweepPending(now)

  const ticket = pending.get(input.ticket)
  if (ticket === undefined) return { status: 'restart' }

  const looksLikeTotp = /^\s*\d{6}\s*$/.test(input.code)

  // Limited by IP AND by user, same shape as the password step: a recovery attempt costs
  // up to ten argon2id verifies (~1s of the only thread), and an attacker with many IPs
  // pays the per-IP toll once each while the CPU bill lands on one machine. The per-user
  // key is the cap that survives distribution. Slightly looser than the IP one, so a real
  // owner fumbling codes from one laptop always hits the gentler limit first.
  const recoveryKey = `recovery:ip:${input.ip}`
  const recoveryUserKey = `recovery:user:${ticket.userId}`
  if (!looksLikeTotp && (overLimit(recoveryKey, 5, HOUR) || overLimit(recoveryUserKey, 10, HOUR))) {
    return { status: 'rate-limited', retryAfter: Math.ceil(HOUR / 1000) }
  }

  // ⚠️ AND THE SIX-DIGIT HALF NEEDS THE SAME PAIR, which it did not have. The block above is
  // gated on `!looksLikeTotp`, so a code shaped like a TOTP was checked with nothing counted
  // before it and nothing charged after it. The only cost was `MAX_TOTP_ATTEMPTS` against one
  // ticket, and a fresh ticket is free: the password step charges its bucket on failure only and
  // CLEARS the per-user one on success, so a caller who knows the password can mint tickets for
  // ever. Measured against the real app from one address, sequentially: 645 guesses in 8 seconds,
  // no 429, the account not locked after it. At ~290,000 guesses an hour against the three codes
  // that are live at any instant, that is an even chance of being inside within the hour, on the
  // one account there is. `docs/spec/06-auth.md` states the rule this restores.
  //
  // Looser than the recovery pair because a code costs no argon2 and a real owner fumbles: a
  // phone whose clock has drifted can burn several in a row. Fifteen an hour per account still
  // leaves an attacker needing longer than the sun has left.
  const totpKey = `totp:ip:${input.ip}`
  const totpUserKey = `totp:user:${ticket.userId}`
  if (looksLikeTotp && (overLimit(totpKey, 30, FIFTEEN_MIN) || overLimit(totpUserKey, 15, FIFTEEN_MIN))) {
    logAuthEvent('auth.totp.failed', 'rate limited')
    return { status: 'rate-limited', retryAfter: Math.ceil(FIFTEEN_MIN / 1000) }
  }

  const state = totpStateFor(ticket.userId)
  let matched = false
  let usedRecovery = false

  if (looksLikeTotp && state?.secret) {
    const result = verifyCode(state.secret, input.code, { now, minStep: state.lastStep })
    if (result.ok) {
      // The replay guard is advanced BEFORE the session exists, so a code cannot be spent
      // twice even if the session insert were to fail.
      setTotpLastStep(ticket.userId, result.step)
      matched = true
    } else if (result.reused) {
      // Not a guess: the code was right, only already used. Counted against the rate limit like
      // any code, since it is still a request, but not against this ticket's few attempts.
      recordHit(totpKey, FIFTEEN_MIN)
      recordHit(totpUserKey, FIFTEEN_MIN)
      return { status: 'reused' }
    } else {
      recordHit(totpKey, FIFTEEN_MIN)
      recordHit(totpUserKey, FIFTEEN_MIN)
      logAuthEvent('auth.totp.failed')
    }
  } else if (!looksLikeTotp) {
    matched = await redeemCode(ticket.userId, input.code)
    usedRecovery = matched
    if (!matched) {
      recordHit(recoveryKey, HOUR)
      recordHit(recoveryUserKey, HOUR)
      logAuthEvent('auth.totp.failed', 'recovery code rejected')
    }
  }

  if (!matched) {
    ticket.attempts += 1
    if (ticket.attempts >= MAX_TOTP_ATTEMPTS) {
      pending.delete(input.ticket)
      return { status: 'restart' }
    }
    return { status: 'rejected', attemptsLeft: MAX_TOTP_ATTEMPTS - ticket.attempts }
  }

  pending.delete(input.ticket)
  // The second factor was right, so whatever came before it was this person mistyping. Same
  // reasoning as `clearLimit(userKey)` after the password, and the same line.
  clearLimit(totpUserKey)
  const session = createSession(ticket.userId, { ip: input.ip, userAgent: input.userAgent })
  if (usedRecovery) logAuthEvent('auth.recovery.used')
  logAuthEvent('auth.login', usedRecovery ? 'via recovery code' : 'via totp')
  return { status: 'ok', userId: ticket.userId, token: session.token, expiresAt: session.expiresAt }
}

/** The user a pending ticket belongs to, for the enrolment flow. Null when it has expired. */
export function pendingUser(ticket: string, now = Date.now()): number | null {
  sweepPending(now)
  return pending.get(ticket)?.userId ?? null
}

/** Consume a ticket and issue the session directly. Used at the end of first-run enrolment. */
export function completeEnrolment(
  ticket: string,
  meta: { ip: string; userAgent?: string },
): { token: string; expiresAt: number; userId: number } | null {
  const entry = pending.get(ticket)
  if (entry === undefined) return null
  pending.delete(ticket)
  const session = createSession(entry.userId, meta)
  logAuthEvent('auth.login', 'after enrolment')
  return { ...session, userId: entry.userId }
}

/** Test seam: pending tickets are process-global and would leak between test files. */
export function resetPending(): void {
  pending.clear()
}
