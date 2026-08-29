// The sign-in machine end to end, plus the recovery codes it leans on.
//
// The cases here are the ones a reader of the code cannot check by reading: that a wrong
// username and a wrong password are indistinguishable, that a TOTP code cannot be spent
// twice, and that a ticket dies when it is used.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one } from '@/store/query'
import { createUser, setTotpSecret, totpStateFor } from './users'
import { codeForStep, generateSecret, stepAt } from './totp'
import { normalizeCode, redeemCode, regenerateCodes, remainingCodes, CODE_COUNT } from './recovery'
import { resolveSession } from './sessions'
import {
  completeEnrolment, pendingUser, resetPending, submitPassword, submitSecondFactor,
} from './login'
import { resetSecretCache } from './secret'
import { resetLimits } from '@/server/rate-limit'

const DIR = './.tmp/test-login'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PASSWORD = 'a long enough passphrase'
let userId = 0
let secret = ''

// The lockout tests deliberately exhaust a window, and the buckets are process-global, so
// without `resetLimits` every test after them fails for the wrong reason. A distinct IP
// per test is not enough on its own: the per-USERNAME window is shared by design, and
// every test here signs in as the same owner.
let ipCounter = 0
const freshIp = () => `198.51.100.${++ipCounter % 250}`

beforeEach(async () => {
  for (const table of ['sessions', 'recovery_codes', 'users', 'activity_log', 'server_secrets']) {
    db().run(`delete from ${table}`)
  }
  resetPending()
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'owner', email: 'o@example.com', password: PASSWORD })
  userId = user.id
  secret = generateSecret()
  setTotpSecret(userId, secret)
})

const currentCode = (now = Date.now()) => codeForStep(secret, stepAt(now))!

describe('submitPassword', () => {
  it('accepts the right password and asks for the second factor', async () => {
    const result = await submitPassword({ username: 'owner', password: PASSWORD, ip: freshIp() })
    expect(result.status).toBe('need-2fa')
  })

  it('is case-insensitive on the username', async () => {
    const result = await submitPassword({ username: 'OWNER', password: PASSWORD, ip: freshIp() })
    expect(result.status).toBe('need-2fa')
  })

  // The account-existence oracle, at the level above `verifyPassword`: the two failures
  // must be the same outcome, not merely the same message.
  it('returns the identical outcome for an unknown user and a wrong password', async () => {
    const noSuchUser = await submitPassword({ username: 'nobody', password: PASSWORD, ip: freshIp() })
    const wrongPassword = await submitPassword({ username: 'owner', password: 'wrong wrong wrong', ip: freshIp() })
    expect(noSuchUser).toEqual({ status: 'rejected' })
    expect(wrongPassword).toEqual({ status: 'rejected' })
  })

  it('sends an un-enrolled account to enrolment rather than to the code screen', async () => {
    setTotpSecret(userId, null)
    const result = await submitPassword({ username: 'owner', password: PASSWORD, ip: freshIp() })
    expect(result.status).toBe('need-enrolment')
  })

  it('rate limits by IP after ten attempts', async () => {
    const ip = freshIp()
    for (let i = 0; i < 10; i++) {
      await submitPassword({ username: `ghost${i}`, password: 'nope nope nope', ip })
    }
    const result = await submitPassword({ username: 'owner', password: PASSWORD, ip })
    expect(result.status).toBe('rate-limited')
    if (result.status === 'rate-limited') expect(result.retryAfter).toBe(900)
  })

  // The per-IP limit alone never sees a distributed attempt on the one account that
  // matters. This is the window that does.
  it('rate limits by username across different IPs', async () => {
    for (let i = 0; i < 5; i++) {
      await submitPassword({ username: 'owner', password: 'nope nope nope', ip: freshIp() })
    }
    const result = await submitPassword({ username: 'owner', password: PASSWORD, ip: freshIp() })
    expect(result.status).toBe('rate-limited')
  })

  // The lockout counts FAILURES. Charging successes to the same window locks the owner
  // out of their own blog for signing in six times in a quarter of an hour, which is a
  // normal amount of signing in while setting up a new device.
  it('does not spend the allowance on successful sign-ins', async () => {
    const ip = freshIp()
    for (let i = 0; i < 8; i++) {
      const result = await submitPassword({ username: 'owner', password: PASSWORD, ip })
      expect(result.status).toBe('need-2fa')
    }
  })

  // ...and a success clears what came before it, because those were this person mistyping.
  it('forgives earlier mistypes once the password is right', async () => {
    const ip = freshIp()
    for (let i = 0; i < 4; i++) {
      await submitPassword({ username: 'owner', password: 'wrong wrong wrong', ip })
    }
    expect((await submitPassword({ username: 'owner', password: PASSWORD, ip })).status).toBe('need-2fa')
    for (let i = 0; i < 4; i++) {
      const result = await submitPassword({ username: 'owner', password: 'wrong wrong wrong', ip })
      expect(result.status).toBe('rejected')
    }
  })

  it('writes a failure to the audit log even with the activity toggle untouched', async () => {
    await submitPassword({ username: 'owner', password: 'wrong wrong wrong', ip: freshIp() })
    const row = one<{ action: string }>(`select action from activity_log order by id desc limit 1`)
    expect(row?.action).toBe('auth.login.failed')
  })
})

describe('submitSecondFactor', () => {
  const startSignIn = async () => {
    const result = await submitPassword({ username: 'owner', password: PASSWORD, ip: freshIp() })
    if (result.status !== 'need-2fa') throw new Error(`expected need-2fa, got ${result.status}`)
    return result.ticket
  }

  it('issues a session for the current code', async () => {
    const ticket = await startSignIn()
    const result = await submitSecondFactor({ ticket, code: currentCode(), ip: freshIp() })
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(resolveSession(result.token)?.userId).toBe(userId)
  })

  it('rejects an unknown or expired ticket outright', async () => {
    const result = await submitSecondFactor({ ticket: 'made-up', code: currentCode(), ip: freshIp() })
    expect(result).toEqual({ status: 'restart' })
  })

  // A ticket that survives its own redemption is a second sign-in for free.
  it('destroys the ticket on success', async () => {
    const ticket = await startSignIn()
    await submitSecondFactor({ ticket, code: currentCode(), ip: freshIp() })
    const again = await submitSecondFactor({ ticket, code: currentCode(), ip: freshIp() })
    expect(again).toEqual({ status: 'restart' })
  })

  it('counts down attempts and then forces a restart', async () => {
    const ticket = await startSignIn()
    for (let attempt = 1; attempt <= 4; attempt++) {
      const result = await submitSecondFactor({ ticket, code: '000000', ip: freshIp() })
      expect(result).toEqual({ status: 'rejected', attemptsLeft: 5 - attempt })
    }
    expect(await submitSecondFactor({ ticket, code: '000000', ip: freshIp() })).toEqual({ status: 'restart' })
  })

  // The replay guard, observed from the outside: a code seen over someone's shoulder is
  // otherwise good for the rest of its acceptance window.
  it('will not accept the same code for a second sign-in', async () => {
    const code = currentCode()
    const first = await submitSecondFactor({ ticket: await startSignIn(), code, ip: freshIp() })
    expect(first.status).toBe('ok')
    const second = await submitSecondFactor({ ticket: await startSignIn(), code, ip: freshIp() })
    expect(second.status).toBe('rejected')
  })

  it('advances the stored replay floor', async () => {
    const now = Date.now()
    await submitSecondFactor({ ticket: await startSignIn(), code: currentCode(now), ip: freshIp() })
    expect(totpStateFor(userId)?.lastStep).toBe(stepAt(now))
  })

  it('accepts a recovery code in place of the six digits', async () => {
    const codes = await regenerateCodes(userId)
    const result = await submitSecondFactor({ ticket: await startSignIn(), code: codes[0], ip: freshIp() })
    expect(result.status).toBe('ok')
    expect(remainingCodes(userId)).toBe(CODE_COUNT - 1)
  })

  // The per-USER cap is the one that survives an attacker with many IPs: every wrong
  // recovery guess costs the process up to ten argon2id verifies, and the per-IP limit
  // resets with each fresh address. Ten failures against one account, from ten different
  // IPs, and the account is closed to recovery codes for the hour.
  it('rate-limits recovery attempts per user, not only per IP', async () => {
    // No codes are generated on purpose: a guess then fails without an argon2id verify,
    // which keeps ten failures affordable inside the test timeout. The limiter charges on
    // failure either way. Each ticket dies on its fifth wrong code, so a fresh one every
    // four attempts — and a fresh IP every attempt, so only the user key can be what trips.
    let spent = 0
    while (spent < 10) {
      const ticket = await startSignIn()
      for (let i = 0; i < 4 && spent < 10; i++, spent++) {
        const r = await submitSecondFactor({ ticket, code: 'wrong-code-aaaa', ip: freshIp() })
        expect(r.status).toBe('rejected')
      }
    }
    const blocked = await submitSecondFactor({ ticket: await startSignIn(), code: 'wrong-code-aaaa', ip: freshIp() })
    expect(blocked.status).toBe('rate-limited')
  })

  it('logs a recovery sign-in distinctly from a TOTP one', async () => {
    const codes = await regenerateCodes(userId)
    await submitSecondFactor({ ticket: await startSignIn(), code: codes[0], ip: freshIp() })
    const actions = db().query<{ action: string }, []>(
      `select action from activity_log order by id`,
    ).all().map((r) => r.action)
    expect(actions).toContain('auth.recovery.used')
    expect(actions).toContain('auth.login')
  })
})

describe('recovery codes', () => {
  it('generates exactly ten, in the documented shape', async () => {
    const codes = await regenerateCodes(userId)
    expect(codes.length).toBe(CODE_COUNT)
    for (const code of codes) expect(code).toMatch(/^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/)
    expect(new Set(codes).size).toBe(CODE_COUNT)
  })

  it('never stores the plaintext', async () => {
    const codes = await regenerateCodes(userId)
    const stored = db().query<{ code_hash: string }, []>(`select code_hash from recovery_codes`).all()
    for (const row of stored) expect(codes).not.toContain(row.code_hash)
  })

  it('is single use', async () => {
    const codes = await regenerateCodes(userId)
    expect(await redeemCode(userId, codes[3])).toBe(true)
    expect(await redeemCode(userId, codes[3])).toBe(false)
    expect(remainingCodes(userId)).toBe(CODE_COUNT - 1)
  })

  it('accepts what a person actually types', async () => {
    const codes = await regenerateCodes(userId)
    expect(await redeemCode(userId, codes[0].toLowerCase().replace('-', ' '))).toBe(true)
  })

  it('rejects a code belonging to nobody', async () => {
    await regenerateCodes(userId)
    expect(await redeemCode(userId, 'ZZZZZ-ZZZZZ')).toBe(false)
    expect(await redeemCode(userId, '')).toBe(false)
  })

  // Regenerating is offered as "your old codes stop working", so it has to be true of the
  // unused ones as well.
  it('invalidates every previous code, used or not', async () => {
    const first = await regenerateCodes(userId)
    await regenerateCodes(userId)
    expect(await redeemCode(userId, first[0])).toBe(false)
    expect(remainingCodes(userId)).toBe(CODE_COUNT)
  })

  it('normalises hyphens, spaces and case consistently', () => {
    expect(normalizeCode('abcde fghij')).toBe('ABCDE-FGHIJ')
    expect(normalizeCode('ABCDEFGHIJ')).toBe('ABCDE-FGHIJ')
    expect(normalizeCode('  abcde-fghij  ')).toBe('ABCDE-FGHIJ')
    // Wrong length: left alone rather than mangled into a plausible-looking code.
    expect(normalizeCode('short')).toBe('SHORT')
  })
})

describe('enrolment hand-off', () => {
  it('resolves a pending ticket to its user', async () => {
    setTotpSecret(userId, null)
    const result = await submitPassword({ username: 'owner', password: PASSWORD, ip: freshIp() })
    if (result.status !== 'need-enrolment') throw new Error('expected need-enrolment')
    expect(pendingUser(result.ticket)).toBe(userId)
  })

  it('issues the session once and refuses the ticket afterwards', async () => {
    setTotpSecret(userId, null)
    const result = await submitPassword({ username: 'owner', password: PASSWORD, ip: freshIp() })
    if (result.status !== 'need-enrolment') throw new Error('expected need-enrolment')
    const session = completeEnrolment(result.ticket, { ip: freshIp() })
    expect(session).not.toBeNull()
    expect(resolveSession(session!.token)?.userId).toBe(userId)
    expect(completeEnrolment(result.ticket, { ip: freshIp() })).toBeNull()
  })
})
