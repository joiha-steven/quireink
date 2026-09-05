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
//
// ONE SECOND WAY IN, since 2026-09-05: `SETUP_CODE`. A cloud-init paste, a hosting panel with
// no log viewer, a NAS whose owner has never opened one — for all of them "read the log" is
// the tallest step of the install, and it comes right after the step that felt like the last.
// So the operator may choose the secret instead of having it minted: set `SETUP_CODE` (twelve
// characters or more) and `/setup` asks for it. The proof is unchanged — whoever wrote the
// environment the process boots from owns the box — only where the secret is READ moves, from
// the log to the file the person already has. It is compared folded (case and dashes are not
// part of it, because a person types it) and constant-time, the claim route is rate-limited
// on top, and a code too short to be a secret is ignored in favour of the random token, with
// a line in the banner saying so. Once the blog is claimed it stops being a secret worth
// keeping: the process forgets it and never reads it again.
import { randomBytes, timingSafeEqual } from 'node:crypto'

/** Shortest `SETUP_CODE` that is honoured. Shorter is ignored and the random token stands. */
export const MIN_CODE_LENGTH = 12

let token: string | null = null
let fromCode = false
let spent = false

/** What a typed code is compared as: case and dashes are for reading it, not part of it. */
const fold = (s: string): string => s.toLowerCase().replace(/[\s-]+/g, '')

const envCode = (): string => (process.env.SETUP_CODE ?? '').trim()

function mint(): string {
  const code = spent ? '' : envCode()
  fromCode = code.length >= MIN_CODE_LENGTH
  return fromCode ? fold(code) : randomBytes(24).toString('base64url')
}

/** The token for this process, minted on first ask. */
export function setupToken(): string {
  if (token === null) token = mint()
  return token
}

/** True when the secret is the operator's `SETUP_CODE`, so `/setup` should ask for it. */
export function setupCodeConfigured(): boolean {
  setupToken()
  return fromCode
}

/** True when `SETUP_CODE` is set but too short to be honoured — worth one line in the banner. */
export function setupCodeIgnored(): boolean {
  const n = envCode().length
  return n > 0 && n < MIN_CODE_LENGTH
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
  if (token === null) return false
  const g = fromCode ? fold(given) : given
  if (g.length !== token.length) return false
  return timingSafeEqual(Buffer.from(g), Buffer.from(token))
}

/**
 * Burn it. Called once the account exists.
 *
 * The claim can only ever succeed once anyway — `createUser` refuses a second account
 * (ADR 0002) — so this is not the lock. It is hygiene: a spent token should stop being a
 * secret worth reading out of a log, and a spent `SETUP_CODE` is never read again by this
 * process, so nothing that asks for a token after this gets the operator's code back.
 */
export function forgetSetupToken(): void {
  token = null
  spent = true
}

/** Tests only: a process that has minted nothing and forgotten nothing. */
export function resetSetupToken(): void {
  token = null
  fromCode = false
  spent = false
}
