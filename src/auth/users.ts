// The owner account.
//
// One row, but a real table (06-auth.md): a hard-coded singleton costs a migration the
// first time anything needs a second account, and a one-row table costs nothing today.
//
// `password_hash` and `totp_secret` leave this module ONLY through the functions that
// need them for verification. `PublicUser` is the shape anything client-bound gets, and it
// has no place to put a secret.

import { one, run } from '@/store/query'
import { nowMs } from '@/store/db'
import { hashPassword } from './password'

/** Safe to serialise into any response. Deliberately has no secret-shaped field. */
export type PublicUser = {
  id: number
  username: string
  email: string
  /** Whether TOTP enrolment has happened. Not the secret, just its existence. */
  totpEnrolled: boolean
  createdAt: number
}

/** Internal shape. Never returned from a route. */
type UserRow = {
  id: number
  username: string
  email: string
  password_hash: string
  totp_secret: string | null
  totp_last_step: number | null
  created_at: number
}

const toPublic = (row: UserRow): PublicUser => ({
  id: row.id,
  username: row.username,
  email: row.email,
  totpEnrolled: row.totp_secret !== null,
  createdAt: row.created_at,
})

const SELECT = `select id, username, email, password_hash, totp_secret, totp_last_step, created_at from users`

function rowByUsername(username: string): UserRow | null {
  // Lower-cased on both sides: usernames are compared case-insensitively, and storing the
  // original case means the owner sees what they typed.
  return one<UserRow>(`${SELECT} where lower(username) = lower(?)`, username.trim())
}

function rowById(id: number): UserRow | null {
  return one<UserRow>(`${SELECT} where id = ?`, id)
}

export function getUser(id: number): PublicUser | null {
  const row = rowById(id)
  return row === null ? null : toPublic(row)
}

export function getUserByUsername(username: string): PublicUser | null {
  const row = rowByUsername(username)
  return row === null ? null : toPublic(row)
}

/** True when no account exists yet, i.e. the CLI bootstrap has not been run. */
export function noUsersYet(): boolean {
  return (one<{ n: number }>(`select count(*) as n from users`)?.n ?? 0) === 0
}

/**
 * The stored hash for a username, or null when there is no such account.
 *
 * Returning null rather than throwing is what lets the caller hand it straight to
 * `verifyPassword`, which spends the same time on null as on a real hash. A caller that
 * branches on null before verifying reintroduces the timing oracle.
 */
export function passwordHashFor(username: string): { id: number; hash: string } | null {
  const row = rowByUsername(username)
  return row === null ? null : { id: row.id, hash: row.password_hash }
}

/** The TOTP secret and replay floor for a user. Only the sign-in and enrolment paths call this. */
export function totpStateFor(id: number): { secret: string | null; lastStep: number | null } | null {
  const row = rowById(id)
  return row === null ? null : { secret: row.totp_secret, lastStep: row.totp_last_step }
}

/**
 * Create an account. Refuses a SECOND one unless the caller says so in as many words.
 *
 * ADR 0002 says one owner, permanently — "not a gap waiting to be filled" — and until
 * 2026-08-11 nothing enforced it. `web/guard.ts` treats ANY row in `users` holding a session
 * as the owner: no `id = 1`, no role column, none in the schema. What kept there being one
 * account was that only this function creates them and only the CLI calls it; the CLI itself
 * refused a duplicate USERNAME and was perfectly happy to make a second owner.
 *
 * That is an invariant held by nobody, at the exact moment the hosted tier is being designed
 * — which is when somebody adds a signup route. So the design is now a line of code, and
 * `additional` is the shape on purpose: a second account is still possible, because two tests
 * legitimately need one to prove that a session and a CSRF token do not carry across accounts,
 * but no route can be written that reaches it without saying `additional: true` and having
 * that read in review.
 *
 * It is deliberately NOT a check on `id`, and not a `role` column. Both would introduce the
 * concept ADR 0002 spent its length rejecting — that there is more than one kind of account —
 * to solve a problem that is really about who may CREATE one.
 */
export async function createUser(input: {
  username: string
  email: string
  password: string
  /** Bypass the one-account rule. Tests and nothing else; see above. */
  additional?: boolean
}): Promise<PublicUser> {
  if (input.additional !== true && !noUsersYet()) {
    throw new Error(
      'createUser: an account already exists, and Quire Ink has one owner by design (ADR 0002).'
      + ' To change its password use `bun run user set-password`.',
    )
  }
  const at = nowMs()
  const hash = await hashPassword(input.password)
  run(
    `insert into users (username, email, password_hash, created_at, updated_at)
     values ($username, $email, $hash, $at, $at)`,
    { username: input.username.trim(), email: input.email.trim(), hash, at },
  )
  const row = rowByUsername(input.username)
  if (row === null) throw new Error('createUser: the row vanished immediately after insert')
  return toPublic(row)
}

export async function setPassword(id: number, password: string): Promise<void> {
  run(`update users set password_hash = ?, updated_at = ? where id = ?`, await hashPassword(password), nowMs(), id)
}

/**
 * Store the enrolled secret and reset the replay floor.
 *
 * The floor is cleared to NULL because it refers to steps of the OLD secret; carrying it
 * across a re-enrolment would reject the first code from the new one whenever the clock
 * had not yet passed it.
 */
export function setTotpSecret(id: number, secret: string | null): void {
  run(
    `update users set totp_secret = ?, totp_last_step = null, updated_at = ? where id = ?`,
    secret, nowMs(), id,
  )
}

/** Advance the replay guard. Called with the step a successful verification matched. */
export function setTotpLastStep(id: number, step: number): void {
  run(`update users set totp_last_step = ? where id = ?`, step, id)
}
