// SMTP config resolution only. `sendMail` itself needs a server and belongs in the
// Mailpit-backed flow test, not here.
//
// The `secure` fallback is why this file exists. It is derived from the port, not copied:
// `smtp_secure` had to stay NULLABLE in the SQLite schema, because a NOT NULL DEFAULT 1
// would force implicit TLS on any install that had ever saved an unrelated key on the
// shared `integration_keys` row, and a port-587 STARTTLS server would then quietly stop
// accepting mail with no setting having been touched.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { getSmtpConfig, saveSmtpConfig, isMailConfigured, getMailStatus } from '@/news/mail'
import { saveIntegrationKeys } from '@/store/integration-keys'

const DIR = './.tmp/test-mail'
freshDatabase(DIR)
afterAll(() => {
  dropDatabase(DIR)
  for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM', 'SMTP_USER']) delete process.env[k]
})

beforeEach(() => {
  db().run(`delete from integration_keys`)
  for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM', 'SMTP_USER']) delete process.env[k]
})

describe('getSmtpConfig', () => {
  it('defaults to port 587 with STARTTLS when nothing is set', async () => {
    expect(await getSmtpConfig()).toMatchObject({ host: '', port: 587, secure: false })
  })

  it('falls back to env vars, and stored values win over them', async () => {
    process.env.SMTP_HOST = 'env.example.com'
    process.env.SMTP_FROM = 'env@example.com'
    expect((await getSmtpConfig()).host).toBe('env.example.com')
    await saveSmtpConfig({ host: 'db.example.com' })
    const cfg = await getSmtpConfig()
    expect(cfg.host).toBe('db.example.com')
    expect(cfg.from).toBe('env@example.com') // untouched field still falls through
  })

  it('infers secure from the port when it was never chosen', async () => {
    await saveSmtpConfig({ host: 'smtp.example.com', port: 465 })
    expect((await getSmtpConfig()).secure).toBe(true)
    await saveSmtpConfig({ port: 587 })
    expect((await getSmtpConfig()).secure).toBe(false)
  })

  it('an explicit choice wins over the port, in both directions', async () => {
    await saveSmtpConfig({ port: 587, secure: true })
    expect((await getSmtpConfig()).secure).toBe(true)
    await saveSmtpConfig({ port: 465, secure: false })
    expect((await getSmtpConfig()).secure).toBe(false)
  })

  it('an UNRELATED key on the shared row must not force TLS on (the schema bug this caught)', async () => {
    await saveIntegrationKeys({ turnstileSiteKey: 'site' }) // creates the row, no SMTP fields
    await saveSmtpConfig({ host: 'smtp.example.com', port: 587, from: 'a@b.co' })
    expect((await getSmtpConfig()).secure).toBe(false)
  })
})

describe('saveSmtpConfig', () => {
  it('leaves an unmentioned field untouched and clears one set to an empty string', async () => {
    await saveSmtpConfig({ host: 'smtp.example.com', user: 'u', pass: 'p', from: 'a@b.co' })
    await saveSmtpConfig({ host: 'smtp2.example.com' })
    expect(await getSmtpConfig()).toMatchObject({ host: 'smtp2.example.com', user: 'u', from: 'a@b.co' })
    await saveSmtpConfig({ user: '' })
    expect((await getSmtpConfig()).user).toBe('')
  })

  it('does not disturb the Turnstile/Cloudflare keys sharing the row', async () => {
    await saveIntegrationKeys({ turnstileSecretKey: 'secret', cloudflareZoneId: 'zone' })
    await saveSmtpConfig({ host: 'smtp.example.com', from: 'a@b.co' })
    const { getIntegrationKeys } = await import('@/store/integration-keys')
    expect(await getIntegrationKeys()).toMatchObject({
      turnstileSecretKey: 'secret', cloudflareZoneId: 'zone',
    })
  })
})

describe('isMailConfigured', () => {
  it('needs both a host and a From address', async () => {
    expect(isMailConfigured(await getSmtpConfig())).toBe(false)
    await saveSmtpConfig({ host: 'smtp.example.com' })
    expect(isMailConfigured(await getSmtpConfig())).toBe(false)
    await saveSmtpConfig({ from: 'a@b.co' })
    expect(isMailConfigured(await getSmtpConfig())).toBe(true)
  })

  it('the client-safe status carries the From address but no password', async () => {
    await saveSmtpConfig({ host: 'smtp.example.com', from: 'a@b.co', pass: 'hunter2' })
    const status = await getMailStatus()
    expect(status).toEqual({ configured: true, from: 'a@b.co' })
    expect(JSON.stringify(status)).not.toContain('hunter2')
  })
})
