// Two things matter here and neither is visible from a call site: that the policy counts
// what a person sees rather than UTF-16 units, and that a missing account costs the same
// time as a wrong password.
import { describe, it, expect } from 'bun:test'
import { checkPassword, hashPassword, MIN_LENGTH, verifyPassword } from './password'

describe('checkPassword', () => {
  it('accepts a long passphrase with no special characters', () => {
    expect(checkPassword('correct battery staple horse')).toBeNull()
  })

  it('rejects anything shorter than the minimum', () => {
    expect(checkPassword('a'.repeat(MIN_LENGTH - 1))).toBe('too-short')
    expect(checkPassword('a'.repeat(MIN_LENGTH))).toBeNull()
  })

  // A CJK or emoji passphrase is twice as long in UTF-16 units as it is on screen, so
  // counting `.length` would let a six-character password through.
  it('counts code points, not UTF-16 units', () => {
    const twelveEmoji = '🙂'.repeat(12)
    expect(twelveEmoji.length).toBe(24)
    expect(checkPassword(twelveEmoji)).toBeNull()
    expect(checkPassword('🙂'.repeat(11))).toBe('too-short')
  })

  it('rejects the obvious ones wherever they appear', () => {
    expect(checkPassword('mypasswordisgood')).toBe('too-common')
    expect(checkPassword('XXXXLetMeInXXXX')).toBe('too-common')
  })

  it('rejects a password containing the site or account name', () => {
    expect(checkPassword('quireink2026!!', ['QuireInk'])).toBe('contains-name')
    expect(checkPassword('somethingHUNGxx', ['hung'])).toBe('contains-name')
  })

  // Below three characters a name matches nearly every string, and a site called "Hi"
  // would reject any password containing "hi".
  it('ignores a name too short to be meaningful', () => {
    expect(checkPassword('this contains hi', ['Hi'])).toBeNull()
  })

  it('reports the length problem first', () => {
    // Short AND common. The length message is the more useful one to show.
    expect(checkPassword('password')).toBe('too-short')
  })
})

describe('verifyPassword', () => {
  it('accepts the right password and rejects the wrong one', async () => {
    const hash = await hashPassword('a real passphrase')
    expect(await verifyPassword(hash, 'a real passphrase')).toBe(true)
    expect(await verifyPassword(hash, 'a real passphras')).toBe(false)
  })

  it('returns false rather than throwing on a corrupted hash', async () => {
    expect(await verifyPassword('not-an-argon2-hash', 'anything')).toBe(false)
  })

  /**
   * The account-existence oracle. A null hash must still cost a verification, or "no such
   * user" returns in a millisecond while "wrong password" takes a hundred, and anyone can
   * enumerate accounts with a stopwatch.
   *
   * Asserted as an order of magnitude, not a tight bound: this runs on shared CI hardware
   * and a ratio test would be flaky. The failure mode being caught is a `return false`
   * added at the top of the function, which is ~1000x, not 2x.
   */
  it('spends real time on a null hash', async () => {
    const start = performance.now()
    expect(await verifyPassword(null, 'anything at all')).toBe(false)
    expect(performance.now() - start).toBeGreaterThan(10)
  })
})
