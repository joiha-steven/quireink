// RFC 6238 TOTP, written out rather than pulled in.
//
// The configuration is deliberately the BORING one — SHA-1, 30-second step, 6 digits —
// because that is what every authenticator app assumes when it scans a QR code that does
// not spell out its parameters. SHA-256 here would be marginally stronger and would fail
// silently in some apps, which is a bad trade for a second factor.
//
// No dependency: this is ~90 lines against `node:crypto`, and a TOTP library is a supply
// chain entry for an algorithm that has not changed since 2011.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const STEP_SECONDS = 30
const DIGITS = 6
/** Accept the current step and one either side: ±30s of clock drift between server and phone. */
const DRIFT_STEPS = 1

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Base32 (RFC 4648, no padding) of `bytes`. The form every authenticator expects. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

/**
 * Decode base32, tolerating the shapes a human retypes: lower case, spaces every four
 * characters (how apps display it), and trailing `=` padding.
 *
 * Returns null rather than throwing on a bad character, because the only caller is
 * validating input someone typed.
 */
export function base32Decode(input: string): Uint8Array | null {
  const clean = input.replace(/[\s-]/g, '').replace(/=+$/, '').toUpperCase()
  if (clean === '') return null
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of clean) {
    const index = B32_ALPHABET.indexOf(char)
    if (index === -1) return null
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

/** A fresh 20-byte secret (160 bits, the RFC 4226 recommendation), base32 encoded. */
export function generateSecret(): string {
  return base32Encode(new Uint8Array(randomBytes(20)))
}

/** The step number a timestamp falls in. Exported because the replay guard stores it. */
export function stepAt(atMs: number): number {
  return Math.floor(atMs / 1000 / STEP_SECONDS)
}

/** The 6-digit code for one specific step. */
export function codeForStep(secret: string, step: number): string | null {
  const key = base32Decode(secret)
  if (key === null || key.length === 0) return null

  // The counter is a 64-bit big-endian integer. Written through a DataView with a BigInt
  // because a step number past 2^31 breaks a naive two-`writeUInt32BE` split, and 2^31
  // steps is only 2038 — the same cliff as time_t, and this code is meant to outlive it.
  const counter = new Uint8Array(8)
  new DataView(counter.buffer).setBigUint64(0, BigInt(step), false)

  const digest = createHmac('sha1', key).update(counter).digest()
  // Dynamic truncation, RFC 4226 §5.3: the low nibble of the last byte picks the offset.
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3]
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0')
}

/** Constant-time string compare. Length is not secret here, but the digits are. */
function sameCode(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Verify a code, returning the step it matched so the caller can persist the replay guard.
 *
 * `minStep` is `users.totp_last_step`: any step at or below it has already been spent.
 * Without this, a code seen over someone's shoulder is usable for the rest of its
 * 90-second acceptance window — which is the entire window, from the attacker's side.
 */
export function verifyCode(
  secret: string,
  input: string,
  opts: { now?: number; minStep?: number | null } = {},
): { ok: true; step: number } | { ok: false } {
  const code = input.replace(/\s/g, '')
  if (!/^\d{6}$/.test(code)) return { ok: false }

  const current = stepAt(opts.now ?? Date.now())
  const floor = opts.minStep ?? null
  for (let delta = -DRIFT_STEPS; delta <= DRIFT_STEPS; delta++) {
    const step = current + delta
    if (floor !== null && step <= floor) continue
    const expected = codeForStep(secret, step)
    if (expected !== null && sameCode(expected, code)) return { ok: true, step }
  }
  return { ok: false }
}

/**
 * The `otpauth://` URI an authenticator scans.
 *
 * The label is `Issuer:account` AND `issuer=` is repeated as a parameter: the prefix is
 * what older apps read, the parameter is what current ones read, and apps that read both
 * show a duplicate name if they disagree.
 */
export function otpauthUri(secret: string, username: string, issuer = 'QuireInk'): string {
  const label = encodeURIComponent(`${issuer}:${username}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}
