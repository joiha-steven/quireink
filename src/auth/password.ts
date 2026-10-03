// Password hashing and policy.
//
// `Bun.password` is argon2id, so there is no dependency here; the cost parameters are written out
// below (ADR 0068). Verification is deliberately slow (tens of ms), which is the point,
// and is why the rate limiter in front of it matters: without one, a slow hash is a
// denial-of-service surface rather than a defence.

/**
 * The shortest password we accept. Length is the only rule.
 *
 * No composition requirements. They measurably push people toward `Passw0rd!` — a
 * predictable shape that satisfies every checkbox — and away from the long, memorable
 * phrases that actually resist an offline attack on a stolen hash.
 */
export const MIN_LENGTH = 12

/**
 * Passwords refused regardless of length, plus anything containing the site or account
 * name. This is not a breach corpus and is not pretending to be one: it catches the
 * handful a person types when they intend to "fix it later", which is the realistic
 * failure mode for a single-owner blog.
 */
const DENY = [
  'password', 'passwords', 'passphrase', 'letmein', 'welcome',
  'qwertyuiop', 'administrator', 'changeme', 'correcthorsebatterystaple',
]

export type PasswordProblem = 'too-short' | 'too-common' | 'contains-name'

/**
 * Null when acceptable. The caller maps the problem to a translated message, so no user
 * text appears here (`src/i18n` is the only home for that).
 */
export function checkPassword(
  password: string,
  names: readonly string[] = [],
): PasswordProblem | null {
  // Count by code point, not UTF-16 unit, or a passphrase of emoji or CJK is judged
  // twice as long as it reads.
  if ([...password].length < MIN_LENGTH) return 'too-short'

  const folded = password.toLowerCase()
  if (DENY.some((bad) => folded.includes(bad))) return 'too-common'

  for (const name of names) {
    const needle = name.trim().toLowerCase()
    // Below three characters this matches nearly everything: a site called "Hi" would
    // reject every password containing "hi".
    if (needle.length >= 3 && folded.includes(needle)) return 'contains-name'
  }
  return null
}

/**
 * argon2id at m = 19 MiB, t = 2, p = 1 for every NEW hash (ADR 0068) — OWASP's floor for this
 * algorithm, where Bun's default is 64 MiB. Measured 2026-10-03: one 64 MiB hash in a 128 MB
 * Cloudflare isolate allocated ~65 MB of WASM that was never handed back, beside a 40–46 MB heap,
 * so a sign-in could be the request that killed the process. Both runtimes hash with these.
 *
 * Existing hashes need nothing: the PHC string (`$argon2id$v=19$m=65536,t=2,p=1$…`) carries its
 * own parameters, and verifying reads them from there.
 */
export const HASH_PARAMS = { algorithm: 'argon2id', memoryCost: 19456, timeCost: 2 } as const

export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, HASH_PARAMS)
}

/**
 * A hash of a value nobody knows, made the first time it is needed and kept.
 *
 * Its only purpose is to be verified against when the username does not exist, so that
 * "no such account" costs the same as "wrong password". Without it, sign-in failure timing is an
 * account-existence oracle: fast means no such user.
 *
 * LAZY, not a top-level `await` (it was one until 2026-10-03): Cloudflare refuses to start a
 * Worker that does I/O in global scope ("Disallowed operation called within global scope"), and
 * a hash is the kind of work a module should not do merely by being imported.
 */
let dummy: Promise<string> | null = null
const dummyHash = (): Promise<string> => (dummy ??= Bun.password.hash(crypto.randomUUID(), HASH_PARAMS))

/**
 * Verify, spending the same time whether or not the account exists.
 *
 * Pass `null` for `hash` when the lookup found nothing. Do NOT short-circuit at the call
 * site — that reintroduces exactly the timing difference this exists to remove.
 */
export async function verifyPassword(hash: string | null, password: string): Promise<boolean> {
  if (hash === null) {
    await Bun.password.verify(password, await dummyHash()).catch(() => false)
    return false
  }
  // `verify` throws on a malformed hash rather than returning false. A row whose hash was
  // corrupted should fail the sign-in, not 500 it.
  return Bun.password.verify(password, hash).catch(() => false)
}
