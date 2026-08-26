// The clock (ADR 0031). The ticks themselves are covered through `/api/cron` in
// `web/admin-ops.test.ts`; what is only testable here is WHEN the process runs them by
// itself, and the three conditions under which it must not.
//
// The last one is why this file exists at all: the suite you are reading runs under
// `bun test`, so a clock that ignored `NODE_ENV` would start a real timer inside every
// other test file, take a backup two minutes in, and fail something unrelated.
import { describe, it, expect } from 'bun:test'
import { clockBlockedBy, startClock } from '@/server/tick'

describe('the internal clock', () => {
  it('runs by default, on a plain production boot', () => {
    expect(clockBlockedBy({ NODE_ENV: 'production' })).toBe(null)
  })

  it('runs when NODE_ENV is unset — the systemd unit sets nothing', () => {
    expect(clockBlockedBy({})).toBe(null)
  })

  it('is off when the operator says so', () => {
    expect(clockBlockedBy({ CRON_INTERNAL: '0' })).toBe('CRON_INTERNAL=0')
  })

  it('only `0` turns it off, so a typo cannot silently disable scheduled posts', () => {
    expect(clockBlockedBy({ CRON_INTERNAL: 'false' })).toBe(null)
    expect(clockBlockedBy({ CRON_INTERNAL: '1' })).toBe(null)
    expect(clockBlockedBy({ CRON_INTERNAL: '' })).toBe(null)
  })

  it('is off in every environment that means somebody is working on the software', () => {
    for (const env of ['test', 'development', 'dev', 'ci', 'TEST', ' Test ']) {
      expect(clockBlockedBy({ NODE_ENV: env })).toBe(`NODE_ENV=${env.trim().toLowerCase()}`)
    }
  })

  it('does not start inside this very suite', () => {
    // No argument: the real environment, which is `bun test`.
    expect(clockBlockedBy()).toBe('NODE_ENV=test')
    // And therefore `startClock` is a no-op whose stop function is safe to call.
    const stop = startClock()
    expect(() => stop()).not.toThrow()
  })
})
