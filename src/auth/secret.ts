// Secrets the server generates for itself, on first use, and never shows anyone.
//
// The alternative was an environment variable, and the frozen tree demonstrated the
// failure mode: `AUTH_SECRET` was optional, so the analytics visitor hash fell back to
// salting with the literal string `quire`. A salt everybody knows is not a salt — given
// the database, any IP and user agent can be tried against the stored hash until it
// matches, which is precisely what hashing the visitor was meant to prevent.
//
// Generating it removes the way to get it wrong. There is nothing for an operator to set,
// so there is nothing for them to leave unset.

import { one, run } from '@/store/query'

/**
 * A distinct salt per purpose. Sharing one across the analytics token and the session IP
 * hash would let a match in one table confirm a guess in the other.
 */
export type SecretName =
  | 'analytics-visitor' | 'session-ip' | 'mcp-oauth' | 'preview-link' | 'commenter-session'
  // The daily token in `server/update-check.ts`. Its own salt like every other: the
  // token leaves the machine, and one that shared the analytics salt would let anybody
  // holding it test guesses against the visitor hashes in the database.
  | 'update-check'
  // The comment stamp (ADR 0032). Its signature travels in public HTML on every page with a
  // comment form, so it gets its own salt like everything else that leaves the machine.
  | 'comment-stamp'

// Memoised: these are read on the analytics path, which runs on every public request, and
// the value cannot change during a process's life.
const cache = new Map<SecretName, string>()

export function serverSecret(name: SecretName): string {
  const hit = cache.get(name)
  if (hit !== undefined) return hit

  const existing = one<{ value: string }>(`select value from server_secrets where name = ?`, name)
  if (existing !== null) {
    cache.set(name, existing.value)
    return existing.value
  }

  const value = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
  // `or ignore`, then read back: two requests can race here on the very first hit, and the
  // loser must end up using the winner's value rather than its own. Without the re-read,
  // two processes would salt differently for the rest of their lives.
  run(`insert or ignore into server_secrets (name, value) values (?, ?)`, name, value)
  const stored = one<{ value: string }>(`select value from server_secrets where name = ?`, name)?.value ?? value
  cache.set(name, stored)
  return stored
}

/** Test seam. The connections are swapped per test file; a memoised secret would outlive them. */
export function resetSecretCache(): void {
  cache.clear()
}
