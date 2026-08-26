// The comment stamp (ADR 0032). This is the only gate a fresh install has, so every way
// through it that is not "solve the puzzle" is a test here.
import { describe, it, expect, beforeEach } from 'bun:test'
import { createHash, createHmac } from 'node:crypto'
import { freshDatabase } from '@/test/db'
import { serverSecret, resetSecretCache } from '@/auth/secret'
import { issueStamp, verifyStamp, resetStamps, STAMP_RANGE } from '@/comments/stamp'

freshDatabase('./.tmp/test-stamp')

/** What the browser does: count until the hash matches. */
function answer(salt: string, target: string): number {
  for (let n = 0; n < STAMP_RANGE; n++) {
    if (createHash('sha256').update(`${salt}${n}`).digest('hex') === target) return n
  }
  throw new Error('no answer in range — the challenge is not solvable')
}

/** A stamp as it would come back from a browser, with the age dialled to taste. */
function solved(ageMs = 10_000) {
  const stamp = issueStamp()
  const issued = Date.now() - ageMs
  const signature = createHmac('sha256', serverSecret('comment-stamp'))
    .update(`${stamp.salt}.${stamp.target}.${issued}.${stamp.range}`)
    .digest('hex')
  return { ...stamp, issued, signature, answer: answer(stamp.salt, stamp.target) }
}

describe('the comment stamp', () => {
  beforeEach(() => {
    resetSecretCache()
    resetStamps()
  })

  it('accepts a correctly solved challenge', () => {
    expect(verifyStamp(solved())).toBe('ok')
  })

  it('is solvable at all — the answer is inside the range it advertises', () => {
    const stamp = issueStamp()
    expect(answer(stamp.salt, stamp.target)).toBeLessThan(stamp.range)
  })

  it('refuses a missing one', () => {
    expect(verifyStamp(undefined)).toBe('missing')
    expect(verifyStamp(null)).toBe('missing')
    expect(verifyStamp({})).toBe('missing')
    expect(verifyStamp('nope')).toBe('missing')
  })

  it('refuses a wrong answer', () => {
    const s = solved()
    expect(verifyStamp({ ...s, answer: (s.answer + 1) % s.range })).toBe('bad')
  })

  it('refuses an answer outside the range, including the tricky ones', () => {
    const s = solved()
    for (const bad of [-1, s.range, s.range + 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(verifyStamp({ ...s, answer: bad })).toBe('bad')
    }
  })

  it('refuses a forged challenge — the whole point of the signature', () => {
    // A sender who mints their own puzzle knows its answer. The signature is what stops it.
    const salt = 'deadbeefdeadbeefdeadbeef'
    const target = createHash('sha256').update(`${salt}7`).digest('hex')
    expect(verifyStamp({
      salt, target, issued: Date.now() - 10_000, range: STAMP_RANGE, signature: 'x'.repeat(64), answer: 7,
    })).toBe('bad')
  })

  it('refuses a tampered field even with the original signature', () => {
    const s = solved()
    expect(verifyStamp({ ...s, issued: s.issued - 60_000 })).toBe('bad')
    expect(verifyStamp({ ...s, range: s.range * 2 })).toBe('bad')
  })

  it('refuses one sent too fast to have been typed', () => {
    expect(verifyStamp(solved(500))).toBe('too-fast')
  })

  it('calls a stale one expired, separately, so the island can re-solve', () => {
    expect(verifyStamp(solved(3 * 60 * 60 * 1000))).toBe('expired')
  })

  it('refuses one issued in the future — a clock nobody here set', () => {
    const s = solved(-5 * 60_000)
    expect(verifyStamp(s)).toBe('expired')
  })

  it('spends the salt: one answer, one comment', () => {
    const s = solved()
    expect(verifyStamp(s)).toBe('ok')
    expect(verifyStamp(s)).toBe('replayed')
  })

  it('gives every reader a different puzzle', () => {
    const salts = new Set(Array.from({ length: 20 }, () => issueStamp().salt))
    expect(salts.size).toBe(20)
  })
})
