// A stranger's request is refused by size before any handler reads it (2026-09-30). A 40 MB
// password used to be read whole and argon2-verified before the 401.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { resetLimits } from '@/server/rate-limit'
import { createApp } from '@/web/app'
import { MAX_IMPORT_BYTES, PUBLIC_BODY_BYTES, requestCeiling } from '@/web/body-cap'

const DIR = './.tmp/test-body-cap'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))
beforeEach(() => resetLimits())

const app = createApp()
const big = JSON.stringify({ username: 'owner', password: 'x'.repeat(PUBLIC_BODY_BYTES + 1) })
const post = (path: string, body: string) =>
  app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body })

describe('a public write route', () => {
  it('refuses a body past the cap with 413, before the handler reads it', async () => {
    for (const path of ['/api/auth/login', '/api/comments', '/api/track', '/api/subscribe', '/api/setup/claim']) {
      const res = await post(path, big)
      expect(`${path} ${res.status}`).toBe(`${path} 413`)
      expect(await res.json()).toEqual({ success: false, error: 'too large' })
    }
  })

  it('refuses a streamed body with no length the same way', async () => {
    const stream = new Blob([big]).stream()
    const res = await app.request('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half',
    } as RequestInit)
    expect(res.status).toBe(413)
  })

  it('still reads an ordinary sign-in', async () => {
    const res = await post('/api/auth/login', JSON.stringify({ username: 'nobody', password: 'wrong-but-small' }))
    expect(res.status).not.toBe(413)
  })
})

describe('the process ceiling', () => {
  it('follows MAX_UPLOAD_MB past Bun\'s 128 MB, and never drops below an import', () => {
    const MB = 1024 * 1024
    expect(requestCeiling(500 * MB)).toBe(501 * MB)
    expect(requestCeiling(8 * MB)).toBe(MAX_IMPORT_BYTES + MB)
    // `0` is "no limit" in docs/environment.md.
    expect(requestCeiling(0)).toBe(Number.MAX_SAFE_INTEGER)
  })
})
