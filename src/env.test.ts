// `readEnv`, and the two defaults that were bugs.
//
// HOST did not exist: `Bun.serve` with no `hostname` listens on 0.0.0.0 while the line under
// it printed 127.0.0.1, so all four instances were open on every interface with the log
// saying otherwise. SITE_URL's comment claimed an empty value meant "derive per request",
// which nothing did.
import { describe, it, expect } from 'bun:test'
import { readEnv } from '@/env'

const MB = 1024 * 1024
const GB = 1024 * MB

describe('readEnv', () => {
  it('defaults HOST to loopback, because a proxy on the same box is the layout', () => {
    expect(readEnv({}).host).toBe('127.0.0.1')
  })

  it('takes HOST when a deployment needs every interface', () => {
    expect(readEnv({ HOST: '0.0.0.0' }).host).toBe('0.0.0.0')
    // Empty is not a hostname. `''` as a `hostname` would bind nothing useful, and an
    // EnvironmentFile with a bare `HOST=` is a real way to arrive here.
    expect(readEnv({ HOST: '' }).host).toBe('127.0.0.1')
  })

  it('defaults the two size caps to 64 MB and 5 GB', () => {
    const env = readEnv({})
    expect(env.maxUploadBytes).toBe(64 * MB)
    expect(env.storeQuotaBytes).toBe(5 * GB)
  })

  it('reads 0 as no cap, and a fraction as itself', () => {
    expect(readEnv({ MAX_UPLOAD_MB: '0' }).maxUploadBytes).toBe(0)
    expect(readEnv({ MAX_UPLOAD_MB: '0.5' }).maxUploadBytes).toBe(MB / 2)
  })

  /** Refuses rather than falling back, like PORT: a limit nobody can trust is not a limit. */
  it('throws on a size that is not a number', () => {
    expect(() => readEnv({ STORAGE_QUOTA_GB: 'five' })).toThrow(/STORAGE_QUOTA_GB/)
    expect(() => readEnv({ MAX_UPLOAD_MB: '-1' })).toThrow(/MAX_UPLOAD_MB/)
  })

  it('still refuses a bad PORT', () => {
    expect(() => readEnv({ PORT: '70000' })).toThrow(/PORT/)
  })

  it('strips trailing slashes from SITE_URL and leaves it empty when unset', () => {
    expect(readEnv({ SITE_URL: 'https://example.com//' }).siteUrl).toBe('https://example.com')
    expect(readEnv({}).siteUrl).toBe('')
  })
})
