// Recovery codes: the way back in when the phone with the authenticator is gone.
//
// A code substitutes for the TOTP step ONLY. The password is still required, so a stolen
// printout is not by itself an account.
//
// Cost note: these are stored argon2id-hashed (06-auth.md), and redemption has to try the
// submitted code against every unused hash — up to ten ~100ms verifications, so about a
// second in the worst case. That is acceptable because redemption is rare and rate limited
// to 5/hour, and the alternative (a fast hash, justified by the codes being high-entropy
// and machine-generated) would make the stored form materially weaker than the password
// beside it for no user-visible gain.

import { verify as verifyHash } from '@/runtime/impl/password'
import { all, run, tx } from '@/store/query'
import { nowMs } from '@/store/db'
import { hashPassword } from './password'

export const CODE_COUNT = 10

// Ambiguity removed rather than trusted to good handwriting: no I/1, no O/0, no L, no U.
// What remains is 30 characters, so a ten-character code carries ~49 bits — far more than
// a single-use, rate-limited secret needs.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const GROUP = 5

// 256 is not a multiple of 30, so a plain `% 30` would favour the first sixteen letters.
// The bias is negligible here (49 bits, five attempts per hour), but it is cheap to remove
// and a biased draw from a CSPRNG is a claim nobody should have to re-audit: bytes at or
// above 240 are thrown away and re-drawn instead.
const CEILING = 256 - (256 % ALPHABET.length)

/** One code, formatted `xxxxx-xxxxx`. Exported only so the sampling loop can be tested. */
export function generateCode(): string {
  const chars: string[] = []
  while (chars.length < GROUP * 2) {
    for (const b of crypto.getRandomValues(new Uint8Array(GROUP * 2))) {
      if (b < CEILING && chars.length < GROUP * 2) chars.push(ALPHABET[b % ALPHABET.length])
    }
  }
  return `${chars.slice(0, GROUP).join('')}-${chars.slice(GROUP).join('')}`
}

/** Normalise what someone typed: case, spaces, and a missing or extra hyphen. */
export function normalizeCode(input: string): string {
  const bare = input.replace(/[^0-9a-zA-Z]/g, '').toUpperCase()
  return bare.length === GROUP * 2 ? `${bare.slice(0, GROUP)}-${bare.slice(GROUP)}` : bare
}

/**
 * Replace every code for a user with a fresh set, and return the PLAINTEXT codes.
 *
 * This is the only moment the plaintext exists. The caller shows it once and never gets
 * another chance, which is why the UI has an explicit "I have saved these" step.
 *
 * Regenerating invalidates all previous codes, including unused ones.
 */
export async function regenerateCodes(userId: number): Promise<string[]> {
  const codes = Array.from({ length: CODE_COUNT }, generateCode)
  // Hashed BEFORE the transaction: `tx` takes a synchronous body (an async one would
  // commit at the first await, ahead of its own later statements).
  const hashes = await Promise.all(codes.map((code) => hashPassword(code)))
  tx(() => {
    run(`delete from recovery_codes where user_id = ?`, userId)
    for (const hash of hashes) {
      run(`insert into recovery_codes (user_id, code_hash, used_at) values (?, ?, null)`, userId, hash)
    }
  })
  return codes
}

/** How many codes are still spendable. Shown in Settings so "I am running low" is visible. */
export function remainingCodes(userId: number): number {
  return all<{ n: number }>(
    `select count(*) as n from recovery_codes where user_id = ? and used_at is null`,
    userId,
  )[0]?.n ?? 0
}

/**
 * Spend a code. True when it matched an unused one, which is then marked used.
 *
 * Single use is enforced by the UPDATE's own `used_at is null` guard rather than by a
 * read-then-write: two requests arriving with the same code both verify successfully, and
 * only the one whose update reports a changed row is allowed to proceed.
 */
export async function redeemCode(userId: number, input: string): Promise<boolean> {
  const code = normalizeCode(input)
  if (code === '') return false

  const rows = all<{ code_hash: string }>(
    `select code_hash from recovery_codes where user_id = ? and used_at is null`,
    userId,
  )
  for (const row of rows) {
    const matched = await verifyHash(code, row.code_hash)
    if (!matched) continue
    const { changes } = run(
      `update recovery_codes set used_at = ? where user_id = ? and code_hash = ? and used_at is null`,
      nowMs(), userId, row.code_hash,
    )
    return changes === 1
  }
  return false
}
