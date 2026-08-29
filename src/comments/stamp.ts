// The comment stamp: a gate the blog runs by itself, with no account anywhere in it.
//
// [ADR 0032]. The server signs a small puzzle into the page; the reader's browser answers it
// while somebody is typing; sending carries the answer back. Nothing is fetched from anyone,
// no verification call leaves the machine, and the only thing kept in memory is a list of
// spent salts so an answer cannot be replayed.
//
// The work is deliberately on the sender. One comment costs a person nothing they notice;
// a thousand comments cost a bot a thousand times as much. That is the whole mechanism, and
// its ceiling is honest: a headless browser can pay the cost too, just not for free. What
// catches what gets through is the classifier in `comment-guard.ts`.
//
// [ADR 0032]: ../../docs/decisions/0032-the-comment-gate-needs-no-account.md

import { createHmac, randomBytes, randomInt, timingSafeEqual, createHash } from 'node:crypto'
import { serverSecret } from '@/auth/secret'

/**
 * How many numbers the answer hides among.
 *
 * The browser tries them in order, so the average cost is half of this. Measured with
 * `crypto.subtle` on a 2020 laptop: ~15,000 hashes is a shade over half a second, and the
 * form is open for far longer than that before anybody presses send. Raising it taxes the
 * slowest phone on the site more than it taxes a bot with a datacentre, which is the reason
 * it is this size and not ten times it.
 */
export const STAMP_RANGE = 30_000

/** Under this, the form was not typed in. A person cannot read a post, write a sentence and
 *  press send in three seconds; a script fills every field in one. */
const MIN_AGE_MS = 3_000

/** Over this, the page was left open (or served from a cache) long enough that the challenge
 *  is stale. The island asks for a fresh one rather than the reader losing what they wrote. */
const MAX_AGE_MS = 2 * 60 * 60 * 1000

export type Stamp = {
  salt: string
  /** Hash of the answer the browser has to find. Hex, sha256 of `salt + answer`. */
  target: string
  /** Milliseconds since the epoch, when this was issued. Signed with the rest. */
  issued: number
  /** How far to count. Sent so a future change to the constant cannot invalidate a page
   *  that is already cached with the old one. */
  range: number
  signature: string
}

function sign(salt: string, target: string, issued: number, range: number): string {
  return createHmac('sha256', serverSecret('comment-stamp'))
    .update(`${salt}.${target}.${issued}.${range}`)
    .digest('hex')
}

const hash = (salt: string, answer: number): string =>
  createHash('sha256').update(`${salt}${answer}`).digest('hex')

/** Mint a challenge. Cheap enough to do on every render of a page that has a comment form. */
export function issueStamp(): Stamp {
  const salt = randomBytes(12).toString('hex')
  // `randomInt`, not `Math.random`: the answer IS the work. V8's PRNG state can be
  // recovered from a handful of outputs, and a bot that predicts the answer skips the
  // entire proof-of-work while looking exactly like a solver.
  const answer = randomInt(STAMP_RANGE)
  const target = hash(salt, answer)
  const issued = Date.now()
  return { salt, target, issued, range: STAMP_RANGE, signature: sign(salt, target, issued, STAMP_RANGE) }
}

// ----- spent salts ------------------------------------------------------------------------
//
// One process serves one blog (ADR 0021), so a Map is the whole store. Entries are dropped
// once they are older than a challenge can be, which bounds it at however many comments the
// site takes in two hours — a number that cannot become a memory problem on any blog this
// software is for.

const spent = new Map<string, number>()

function forget(now: number): void {
  if (spent.size < 512) return
  for (const [salt, at] of spent) if (now - at > MAX_AGE_MS) spent.delete(salt)
}

/** Test seam. */
export function resetStamps(): void {
  spent.clear()
}

export type StampVerdict = 'ok' | 'missing' | 'bad' | 'expired' | 'too-fast' | 'replayed'

/**
 * Check a returned stamp.
 *
 * The verdicts are separate because they mean different things to a person: `expired` is
 * "this page was open a while, here is a fresh one" and every other failure is "no".
 */
export function verifyStamp(input: unknown): StampVerdict {
  if (input === null || typeof input !== 'object') return 'missing'
  const { salt, target, issued, range, signature, answer } = input as Record<string, unknown>
  if (
    typeof salt !== 'string' || typeof target !== 'string' || typeof signature !== 'string'
    || typeof issued !== 'number' || typeof range !== 'number' || typeof answer !== 'number'
  ) return 'missing'

  // The signature first: everything below trusts these four values, and this is the only
  // thing that makes them the server's own rather than the sender's.
  const expected = Buffer.from(sign(salt, target, issued, range))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return 'bad'

  const now = Date.now()
  if (now - issued > MAX_AGE_MS || issued - now > 60_000) return 'expired'
  if (now - issued < MIN_AGE_MS) return 'too-fast'

  if (!Number.isInteger(answer) || answer < 0 || answer >= range) return 'bad'
  if (hash(salt, answer) !== target) return 'bad'

  // Spend it. A correct answer is worth exactly one comment.
  if (spent.has(salt)) return 'replayed'
  forget(now)
  spent.set(salt, now)
  return 'ok'
}
