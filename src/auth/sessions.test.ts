// The property worth a test is the one that is invisible at every call site: what the
// cookie carries is never what the database stores. Plus the expiry arithmetic, which has
// two clocks (idle and absolute) and is the kind of thing that looks right and is not.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { createHash } from 'node:crypto'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one } from '@/store/query'
import { createUser } from './users'
import { resetSecretCache, serverSecret } from './secret'
import {
  clearedCookie, COOKIE_NAME, createSession, listSessions, purgeExpiredSessions,
  resolveSession, revokeAllSessions, revokeSession, sessionCookie,
} from './sessions'

const DIR = './.tmp/test-sessions'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

let userId = 0

beforeEach(async () => {
  db().run(`delete from sessions`)
  db().run(`delete from users`)
  db().run(`delete from server_secrets`)
  resetSecretCache()
  userId = (await createUser({ username: 'owner', email: 'o@example.com', password: 'a passphrase here' })).id
})

describe('serverSecret', () => {
  it('generates once and is stable across calls', () => {
    const first = serverSecret('session-ip')
    expect(first.length).toBeGreaterThan(20)
    expect(serverSecret('session-ip')).toBe(first)
    // Survives the memo being dropped, i.e. it really was persisted.
    resetSecretCache()
    expect(serverSecret('session-ip')).toBe(first)
  })

  it('is different per purpose, so a match in one table proves nothing about the other', () => {
    expect(serverSecret('session-ip')).not.toBe(serverSecret('analytics-visitor'))
  })
})

describe('createSession', () => {
  it('stores the hash of the token, never the token', () => {
    const { token } = createSession(userId)
    const row = one<{ id: string }>(`select id from sessions`)
    expect(row).not.toBeNull()
    expect(row!.id).not.toBe(token)
    expect(row!.id).toBe(createHash('sha256').update(token).digest('hex'))
  })

  it('stores a coarse device bucket, not the raw user agent', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Firefox/128.0'
    createSession(userId, { userAgent: ua })
    const row = one<{ user_agent: string }>(`select user_agent from sessions`)
    expect(row!.user_agent).toBe('Firefox on macOS')
    expect(row!.user_agent).not.toContain('AppleWebKit')
  })

  it('salts the IP, so the table cannot be scanned for a known address', () => {
    createSession(userId, { ip: '203.0.113.9' })
    const row = one<{ ip_hash: string }>(`select ip_hash from sessions`)
    expect(row!.ip_hash).not.toContain('203.0.113')
    expect(row!.ip_hash!.length).toBe(32)
  })

  it('leaves both null when neither was supplied', () => {
    createSession(userId)
    const row = one<{ ip_hash: string | null; user_agent: string | null }>(
      `select ip_hash, user_agent from sessions`,
    )
    expect(row!.ip_hash).toBeNull()
    expect(row!.user_agent).toBeNull()
  })
})

describe('resolveSession', () => {
  it('resolves a live token to its user', () => {
    const { token } = createSession(userId)
    expect(resolveSession(token)?.userId).toBe(userId)
  })

  it('returns null for absent, empty and unknown tokens alike', () => {
    createSession(userId)
    expect(resolveSession(null)).toBeNull()
    expect(resolveSession(undefined)).toBeNull()
    expect(resolveSession('')).toBeNull()
    expect(resolveSession('not-a-real-token')).toBeNull()
  })

  it('deletes an expired row rather than merely refusing it', () => {
    const { token } = createSession(userId)
    db().run(`update sessions set expires_at = ?`, [Date.now() - 1])
    expect(resolveSession(token)).toBeNull()
    expect(one<{ n: number }>(`select count(*) as n from sessions`)!.n).toBe(0)
  })

  // The absolute cap. A session used every day would otherwise slide forever.
  it('refuses a session past 90 days however recently it was used', () => {
    const { token } = createSession(userId)
    const ninetyOneDays = 91 * 24 * 60 * 60 * 1000
    db().run(`update sessions set created_at = ?, last_seen_at = ?, expires_at = ?`, [
      Date.now() - ninetyOneDays, Date.now(), Date.now() + 1_000_000,
    ])
    expect(resolveSession(token)).toBeNull()
  })

  it('does not write on every request', () => {
    const { token } = createSession(userId)
    const before = one<{ t: number }>(`select last_seen_at as t from sessions`)!.t
    resolveSession(token)
    expect(one<{ t: number }>(`select last_seen_at as t from sessions`)!.t).toBe(before)
  })

  it('slides the expiry once an hour has passed', () => {
    const { token } = createSession(userId)
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    db().run(`update sessions set last_seen_at = ?`, [twoHoursAgo])
    const resolved = resolveSession(token)
    expect(resolved!.lastSeenAt).toBeGreaterThan(twoHoursAgo)
    expect(one<{ t: number }>(`select last_seen_at as t from sessions`)!.t).toBe(resolved!.lastSeenAt)
  })

  // Sliding must not defeat the absolute cap: at day 89, a touch may extend by one day,
  // not by thirty.
  it('does not slide past the absolute maximum', () => {
    const { token } = createSession(userId)
    const day89 = Date.now() - 89 * 24 * 60 * 60 * 1000
    db().run(`update sessions set created_at = ?, last_seen_at = ?`, [day89, day89])
    const resolved = resolveSession(token)
    expect(resolved!.expiresAt).toBe(day89 + 90 * 24 * 60 * 60 * 1000)
  })
})

describe('revocation', () => {
  it('revokes one session and leaves the others', () => {
    const a = createSession(userId)
    const b = createSession(userId)
    const listed = listSessions(userId)
    expect(listed.length).toBe(2)
    const idOfA = createHash('sha256').update(a.token).digest('hex')
    expect(revokeSession(userId, idOfA)).toBe(true)
    expect(resolveSession(a.token)).toBeNull()
    expect(resolveSession(b.token)?.userId).toBe(userId)
  })

  it('refuses to revoke a session belonging to someone else', async () => {
    const other = await createUser({ username: 'other', email: 'x@example.com', password: 'another passphrase' })
    const { token } = createSession(userId)
    const id = createHash('sha256').update(token).digest('hex')
    expect(revokeSession(other.id, id)).toBe(false)
    expect(resolveSession(token)).not.toBeNull()
  })

  it('signs out everywhere', () => {
    createSession(userId)
    createSession(userId)
    expect(revokeAllSessions(userId)).toBe(2)
    expect(listSessions(userId)).toEqual([])
  })

  // What a password change does: every other device out, this one stays signed in.
  it('keeps the current session when one is excepted', () => {
    const keep = createSession(userId)
    createSession(userId)
    const keepId = createHash('sha256').update(keep.token).digest('hex')
    expect(revokeAllSessions(userId, keepId)).toBe(1)
    expect(resolveSession(keep.token)).not.toBeNull()
  })
})

describe('purgeExpiredSessions', () => {
  it('drops expired rows and leaves live ones', () => {
    const live = createSession(userId)
    const dead = createSession(userId)
    const deadId = createHash('sha256').update(dead.token).digest('hex')
    db().run(`update sessions set expires_at = ? where id = ?`, [Date.now() - 1, deadId])
    expect(purgeExpiredSessions()).toBe(1)
    expect(resolveSession(live.token)).not.toBeNull()
  })
})

describe('cookies', () => {
  // `__Host-` is enforced by the browser: Secure, Path=/, and no Domain. Getting any of
  // the three wrong makes the browser reject the cookie outright, so this is not style.
  it('carries every attribute the __Host- prefix requires', () => {
    const cookie = sessionCookie('tok', Date.now() + 1000 * 60)
    expect(cookie.startsWith(`${COOKIE_NAME}=tok;`)).toBe(true)
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).not.toContain('Domain=')
  })

  it('clears with an immediate expiry and the same attributes', () => {
    const cookie = clearedCookie()
    expect(cookie).toContain('Max-Age=0')
    expect(cookie).toContain('Secure')
    expect(cookie).not.toContain('Domain=')
  })

  it('never emits a negative Max-Age for an already-expired session', () => {
    expect(sessionCookie('tok', Date.now() - 10_000)).toContain('Max-Age=0')
  })
})
