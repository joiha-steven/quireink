// The commenter cookie is the only thing standing between a stranger and posting under
// someone else's name, so what is tested here is what it REFUSES.
import { describe, expect, it, afterAll } from 'bun:test'
import { createHmac } from 'node:crypto'
import { freshDatabase, dropDatabase } from '@/test/db'
import { serverSecret } from '@/auth/secret'
import {
  COMMENTER_COOKIE, clearedCommenterCookie, commenterCookie, issueCommenter, readCommenter,
} from '@/comments/commenter'

const DIR = './.tmp/test-commenter'
freshDatabase(DIR) // the signing secret is generated into `server_secrets` on first use
afterAll(() => dropDatabase(DIR))

const WHO = { name: 'Reader', email: 'reader@example.com', provider: 'google' as const }

describe('issueCommenter / readCommenter', () => {
  it('round-trips a commenter', () => {
    expect(readCommenter(issueCommenter(WHO))).toEqual(WHO)
  })

  it('refuses nothing, junk, and a value with no signature', () => {
    expect(readCommenter(undefined)).toBeNull()
    expect(readCommenter('')).toBeNull()
    expect(readCommenter('not-a-cookie')).toBeNull()
    expect(readCommenter(issueCommenter(WHO).split('.')[0]!)).toBeNull()
  })

  // The attack this exists for: keep the signature, rewrite the name.
  it('refuses a payload edited under a valid signature', () => {
    const [body, signature] = issueCommenter(WHO).split('.')
    const forged = Buffer.from(
      JSON.stringify({ ...WHO, name: 'Someone Else', exp: Date.now() + 60_000 }),
    ).toString('base64url')
    expect(body).not.toBe(forged)
    expect(readCommenter(`${forged}.${signature}`)).toBeNull()
  })

  it('refuses a signature from a different key', () => {
    const [body] = issueCommenter(WHO).split('.')
    expect(readCommenter(`${body}.${Buffer.from('wrong').toString('base64url')}`)).toBeNull()
  })

  // These two sign the payload the way the server does, using the real secret. A forged
  // signature would be refused for the wrong reason and prove nothing about the check
  // under test.
  it('refuses an expired payload even when the signature is genuine', () => {
    expect(readCommenter(properlySigned({ ...WHO, exp: Date.now() - 1 }))).toBeNull()
    expect(readCommenter(properlySigned({ ...WHO, exp: Date.now() + 60_000 }))).toEqual(WHO)
  })

  it('refuses a genuinely signed payload claiming a provider that does not exist', () => {
    expect(readCommenter(properlySigned({ ...WHO, provider: 'trustme', exp: Date.now() + 60_000 })))
      .toBeNull()
  })
})

function properlySigned(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', serverSecret('commenter-session'))
    .update(body).digest('base64url')
  return `${body}.${signature}`
}

describe('the cookie itself', () => {
  it('carries the attributes __Host- requires, plus HttpOnly and Lax', () => {
    const cookie = commenterCookie(issueCommenter(WHO))
    expect(cookie.startsWith(`${COMMENTER_COOKIE}=`)).toBe(true)
    for (const attr of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax']) {
      expect(cookie).toContain(attr)
    }
    expect(cookie).not.toContain('Domain=')
  })

  it('clears with the same attributes, which is what makes the browser drop it', () => {
    const cleared = clearedCommenterCookie()
    expect(cleared).toContain('Max-Age=0')
    for (const attr of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax']) {
      expect(cleared).toContain(attr)
    }
  })
})
