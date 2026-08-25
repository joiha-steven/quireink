// The one-time link that claims an install nobody owns yet.
//
// Until now the only way to create the owner account was `bun run user create` on the
// machine, and that shell is not an oversight: it is the PROOF. Whoever can run a command
// on the box owns the box, so the account they make is theirs by definition. A plain
// "create the owner" page on the open web throws that away — between `docker compose up`
// and the owner typing a password there is a window, and whoever finds the URL first owns
// the blog. WordPress has shipped that window for twenty years.
//
// So the proof stays and only the TYPING moves. The token is printed to the log at boot,
// which is `docker logs` or `journalctl` — one command, no TTY, no interactive password
// prompt through `docker exec -it`, and on a NAS the log is a panel in the web UI. That is
// strictly easier than what it replaces while proving exactly the same thing.
//
// In MEMORY, deliberately. Not the database, not a file:
//   * a restart mints a new one, so a token read over someone's shoulder expires the moment
//     the service bounces;
//   * nothing has to clean it up after the claim;
//   * and it cannot outlive the process that printed it, which is the only thing that ever
//     knew it.

import { randomBytes, timingSafeEqual } from 'node:crypto'

let token: string | null = null

/** The token for this process, minted on first ask. */
export function setupToken(): string {
  if (token === null) token = randomBytes(24).toString('base64url')
  return token
}

/**
 * Constant-time, and it matters here more than it looks.
 *
 * The claim route is reachable without a session by definition, so the comparison is the
 * one thing standing between a stranger and the account. A `===` on a secret leaks its
 * prefix through timing to anybody patient enough to measure, and there is no rate limit
 * that makes that safe — only a comparison that takes the same time whatever it is given.
 */
export function setupTokenMatches(given: string): boolean {
  if (token === null || given.length !== token.length) return false
  return timingSafeEqual(Buffer.from(given), Buffer.from(token))
}

/**
 * Burn it. Called once the account exists.
 *
 * The claim can only ever succeed once anyway — `createUser` refuses a second account
 * (ADR 0002) — so this is not the lock. It is hygiene: a spent token should stop being a
 * secret worth reading out of a log.
 */
export function forgetSetupToken(): void {
  token = null
}
