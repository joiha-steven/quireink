// One owner, and the line of code that finally says so.
//
// ADR 0002 calls a single account "the design, not a gap waiting to be filled", and until
// 2026-08-11 nothing checked it: `web/guard.ts` hands ownership to any row in `users` holding
// a session, and the CLI that creates them refused a duplicate username while being perfectly
// willing to make a second owner. These pin the rule in both directions, because the failure
// it prevents is quiet — a signup route would not look wrong, it would just make everybody an
// owner of the same blog.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createUser, getUserByUsername, noUsersYet } from '@/auth/users'

const DIR = './.tmp/test-users'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const OWNER = { username: 'owner', email: 'o@example.com', password: 'a long enough passphrase' }

beforeEach(() => {
  db().run(`delete from users`)
})

describe('createUser', () => {
  it('creates the first account', async () => {
    expect(noUsersYet()).toBe(true)
    const user = await createUser(OWNER)
    expect(user.username).toBe('owner')
    expect(noUsersYet()).toBe(false)
    // Never the hash, on the way out of the data layer.
    expect(JSON.stringify(user)).not.toContain('$argon2')
  })

  it('REFUSES a second account, and names why', async () => {
    await createUser(OWNER)
    await expect(createUser({ ...OWNER, username: 'second', email: 's@example.com' }))
      .rejects.toThrow(/one owner by design/)
    expect(getUserByUsername('second')).toBeNull()
  })

  /**
   * The escape hatch exists for the two tests that prove a session and a CSRF token do not
   * carry between accounts. It is a named argument rather than a count check so that a
   * reviewer reading `additional: true` inside a request handler stops immediately.
   */
  it('allows one when the caller says `additional` in as many words', async () => {
    await createUser(OWNER)
    const second = await createUser({ ...OWNER, username: 'second', email: 's@example.com', additional: true })
    expect(second.username).toBe('second')
  })

  /**
   * **And the hatch is nailed shut outside the test runner.** The owner stated the rule as a
   * law on 2026-08-11 — one owner, never two accounts in one blog — so `additional` is IGNORED
   * when `NODE_ENV` is not `test`, which is every real instance: a plain `bun src/index.ts`
   * leaves it undefined and the Docker image sets `production`. A signup route written against
   * this would pass its own tests and refuse in production, which is the direction to fail in.
   */
  it('IGNORES `additional` when not under the test runner', async () => {
    await createUser(OWNER)
    const was = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      await expect(createUser({ ...OWNER, username: 'second', email: 's@example.com', additional: true }))
        .rejects.toThrow(/one owner by design/)
    } finally {
      if (was === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = was
    }
    expect(getUserByUsername('second')).toBeNull()
  })

  /** Undefined, too — the common case for a self-hoster who never set it. */
  it('IGNORES `additional` when NODE_ENV is unset', async () => {
    await createUser(OWNER)
    const was = process.env.NODE_ENV
    delete process.env.NODE_ENV
    try {
      await expect(createUser({ ...OWNER, username: 'second', email: 's@example.com', additional: true }))
        .rejects.toThrow(/one owner by design/)
    } finally {
      if (was !== undefined) process.env.NODE_ENV = was
    }
  })

  it('still refuses a duplicate username through the additional path', async () => {
    await createUser(OWNER)
    await expect(createUser({ ...OWNER, additional: true })).rejects.toThrow()
  })
})
