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
   * The escape hatch, and the reason it is a named argument rather than an environment
   * variable or a count check: a route cannot reach a second account without writing this
   * word, and a reviewer reading `additional: true` in a request handler knows immediately
   * that something is wrong.
   */
  it('allows one when the caller says `additional` in as many words', async () => {
    await createUser(OWNER)
    const second = await createUser({ ...OWNER, username: 'second', email: 's@example.com', additional: true })
    expect(second.username).toBe('second')
  })

  it('still refuses a duplicate username through the additional path', async () => {
    await createUser(OWNER)
    await expect(createUser({ ...OWNER, additional: true })).rejects.toThrow()
  })
})
