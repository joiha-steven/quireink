// Sessions: a random token in a cookie, and only its HASH in the database.
//
// The consequence is the whole design: a database leak — a stolen backup, a dumped table —
// yields no usable session, because what is stored cannot be replayed as what is sent.
// This is the same reasoning as `mcp_tokens`, and the same as never storing a password.

import { createHash } from 'node:crypto'
import { all, one, run } from '@/store/query'
import { nowMs } from '@/store/db'
import { parseUa } from '@/analytics/ua'
import { serverSecret } from './secret'

/**
 * `__Host-` is not decoration. It is enforced by the browser: the cookie must be Secure,
 * must be Path=/, and must have NO Domain attribute — which means a subdomain, including
 * one an attacker manages to stand up, cannot set or overwrite it.
 */
export const COOKIE_NAME = '__Host-quire_session'

/** Sliding: 30 days from last use. */
const IDLE_MS = 30 * 24 * 60 * 60 * 1000
/** Absolute: 90 days, regardless of activity. A session cannot live forever by being used. */
const MAX_MS = 90 * 24 * 60 * 60 * 1000
/** `last_seen_at` is written at most this often, so reading a page is not a write. */
const TOUCH_MS = 60 * 60 * 1000
/**
 * How long an address stays the owner's after the owner last used a session from it.
 *
 * A day, not the session's life. A session lives thirty days from its last use and up to
 * ninety in all, and a phone on a carrier network shares its public address with hundreds
 * of strangers (CGNAT) and gets a new one every few days — so matching on any live session
 * dropped every reader behind the same address for as long as the owner stayed signed in
 * on the phone. `last_seen_at` is touched hourly while a session is in use, so a day still
 * covers the whole of any working day the owner spends reading their own site.
 */
const OWNER_ADDRESS_MS = 24 * 60 * 60 * 1000

export type SessionRow = {
  id: string
  userId: number
  createdAt: number
  lastSeenAt: number
  expiresAt: number
  userAgent: string | null
  ipHash: string | null
}

type DbRow = {
  id: string
  user_id: number
  created_at: number
  last_seen_at: number
  expires_at: number
  user_agent: string | null
  ip_hash: string | null
}

const toSession = (r: DbRow): SessionRow => ({
  id: r.id,
  userId: r.user_id,
  createdAt: r.created_at,
  lastSeenAt: r.last_seen_at,
  expiresAt: r.expires_at,
  userAgent: r.user_agent,
  ipHash: r.ip_hash,
})

/**
 * The stored id for a cookie token.
 *
 * Plain SHA-256, not argon2id, and deliberately: the token is 32 bytes from the CSPRNG, so
 * there is no dictionary to slow down, and this runs on every authenticated request. A
 * hundred-millisecond hash here would be a hundred milliseconds on every admin page load
 * defending against a guess nobody can make.
 */
const tokenId = (token: string) => createHash('sha256').update(token).digest('hex')

/** Salted, so the sessions table cannot be scanned for a known IP. */
const hashIp = (ip: string) =>
  createHash('sha256').update(`${serverSecret('session-ip')}|${ip}`).digest('hex').slice(0, 32)

/** Create a session and return the RAW token. This is the only moment it exists. */
export function createSession(
  userId: number,
  meta: { ip?: string; userAgent?: string } = {},
): { token: string; expiresAt: number } {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
  const at = nowMs()
  const expiresAt = at + IDLE_MS
  run(
    `insert into sessions (id, user_id, created_at, last_seen_at, expires_at, user_agent, ip_hash)
     values ($id, $userId, $at, $at, $expiresAt, $userAgent, $ipHash)`,
    {
      id: tokenId(token),
      userId,
      at,
      expiresAt,
      // The COARSE bucket only ("Firefox on macOS"), never the raw string. The raw user
      // agent is a fingerprint; the bucket is what the owner needs to recognise a device
      // in the session list.
      userAgent: meta.userAgent ? describeUa(meta.userAgent) : null,
      ipHash: meta.ip ? hashIp(meta.ip) : null,
    },
  )
  return { token, expiresAt }
}

function describeUa(ua: string): string {
  const { browser, os } = parseUa(ua)
  return `${browser} on ${os}`
}

/**
 * Resolve a cookie token to a live session, sliding its expiry.
 *
 * Returns null for absent, unknown, and expired alike — the caller has nothing useful to
 * do with the distinction, and neither does an attacker.
 */
export function resolveSession(token: string | null | undefined): SessionRow | null {
  if (!token) return null
  const row = one<DbRow>(
    `select id, user_id, created_at, last_seen_at, expires_at, user_agent, ip_hash
     from sessions where id = ?`,
    tokenId(token),
  )
  if (row === null) return null

  const at = nowMs()
  if (row.expires_at <= at) {
    // Delete on sight rather than leaving it for the sweep: it is already in hand, and a
    // row that cannot authenticate anyone has no reason to remain.
    run(`delete from sessions where id = ?`, row.id)
    return null
  }
  if (at - row.created_at >= MAX_MS) {
    run(`delete from sessions where id = ?`, row.id)
    return null
  }

  if (at - row.last_seen_at >= TOUCH_MS) {
    const expiresAt = Math.min(at + IDLE_MS, row.created_at + MAX_MS)
    run(`update sessions set last_seen_at = ?, expires_at = ? where id = ?`, at, expiresAt, row.id)
    return toSession({ ...row, last_seen_at: at, expires_at: expiresAt })
  }
  return toSession(row)
}

/**
 * Was a live session created from this address used within the last day?
 *
 * Analytics asks, so the owner's own reading is not counted as a reader's even when there is
 * no cookie to find (a second browser, a private window, the phone on the desk). It compares
 * the SALTED hash the table already stores, so answering costs no new stored data and the
 * raw address still never lands anywhere. The day is `OWNER_ADDRESS_MS`, above.
 */
export function isSessionIp(ip: string): boolean {
  if (!ip) return false
  const at = nowMs()
  const row = one<{ n: number }>(
    `select count(*) as n from sessions where ip_hash = ? and expires_at > ? and last_seen_at > ?`,
    hashIp(ip), at, at - OWNER_ADDRESS_MS,
  )
  return (row?.n ?? 0) > 0
}

/** The owner's device list. Most recently used first. */

export function listSessions(userId: number): SessionRow[] {
  return all<DbRow>(
    `select id, user_id, created_at, last_seen_at, expires_at, user_agent, ip_hash
     from sessions where user_id = ? order by last_seen_at desc`,
    userId,
  ).map(toSession)
}

/** Revoke one session by its stored id (which is what the session list shows). */
export function revokeSession(userId: number, id: string): boolean {
  return run(`delete from sessions where user_id = ? and id = ?`, userId, id).changes === 1
}

/**
 * Sign out everywhere. `exceptId` keeps the caller's own session alive, which is what a
 * password change does: revoke every OTHER device, without logging the person out of the
 * page they are standing on.
 */
export function revokeAllSessions(userId: number, exceptId?: string): number {
  return exceptId === undefined
    ? run(`delete from sessions where user_id = ?`, userId).changes
    : run(`delete from sessions where user_id = ? and id <> ?`, userId, exceptId).changes
}

/** Drop expired rows. Called from the cron sweep, not from the request path. */
export function purgeExpiredSessions(): number {
  const at = nowMs()
  return run(`delete from sessions where expires_at <= ? or created_at <= ?`, at, at - MAX_MS).changes
}

/** The `Set-Cookie` value for a fresh session. */
export function sessionCookie(token: string, expiresAt: number): string {
  const maxAge = Math.max(0, Math.floor((expiresAt - nowMs()) / 1000))
  // SameSite=Lax, not Strict: Strict withholds the cookie on a normal top-level navigation
  // arriving from elsewhere, so following a link to the admin from an email would land on
  // the sign-in page every time. Lax blocks the cross-site POST, which is the attack.
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

/** The `Set-Cookie` value that clears it. */
export function clearedCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}
