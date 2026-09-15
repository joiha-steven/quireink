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
import { getSmtpConfig, saveSmtpConfig, isMailConfigured, getMailStatus, mailBlocked, sendMail } from '@/news/mail'
import { saveIntegrationKeys } from '@/store/integration-keys'

const DIR = './.tmp/test-mail'
freshDatabase(DIR)
afterAll(() => {
  dropDatabase(DIR)
  for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM', 'SMTP_USER', 'SMTP_OFF']) delete process.env[k]
})

beforeEach(() => {
  db().run(`delete from integration_keys`)
  for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM', 'SMTP_USER', 'SMTP_OFF']) delete process.env[k]
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

/**
 * ⚠️ THE ONE THING THAT HAS EVER STOPPED THIS PRODUCT SENDING REAL MAIL FROM A COPY OF A REAL
 * INSTANCE is that nobody happened to configure SMTP on it. That is not a safety measure, it is
 * a coincidence — and it ends the moment somebody copies a production `.env` onto a staging box
 * to reproduce something, which is the ordinary way to reproduce something.
 *
 * `SMTP_OFF=1` is the switch. It is checked at the ONE gate every sending path asks, so this
 * file can hold it with a working configuration in place: if the gate says no with everything
 * else right, nothing downstream has a way to send.
 */
describe('the environment can refuse to send at all', () => {
  const working = { host: 'smtp.example.com', from: 'a@b.co', pass: 'x' }

  it('refuses with a complete configuration in place, and says WHICH refusal it is', async () => {
    await saveSmtpConfig(working)
    expect(mailBlocked(await getSmtpConfig())).toBe(null)
    process.env.SMTP_OFF = '1'
    // Not `smtp_not_configured`: every field is right. An owner reading the send log to find
    // out why nothing arrived must not be sent looking for a setting that is already correct.
    expect(mailBlocked(await getSmtpConfig())).toBe('smtp_off')
    expect(isMailConfigured(await getSmtpConfig())).toBe(false)
  })

  it('takes the subscribe form off the reader page with it, which is the point', async () => {
    // `getMailStatus().configured` is what decides whether that form is drawn. A form that
    // collects an address and can never send the confirmation leaves the reader waiting for an
    // email that was never going to arrive.
    await saveSmtpConfig(working)
    expect((await getMailStatus()).configured).toBe(true)
    process.env.SMTP_OFF = '1'
    expect((await getMailStatus()).configured).toBe(false)
  })

  it('makes `sendMail` refuse and RECORD the reason rather than throwing', async () => {
    await saveSmtpConfig(working)
    process.env.SMTP_OFF = '1'
    const out = await sendMail({ to: 'someone@example.com', subject: 's', html: '<p>h</p>', kind: 'test' })
    expect(out).toEqual({ sent: false, error: 'smtp_off' })
    // And it is in the log, because every send is written from that one choke point — a refusal
    // that left no trace would be indistinguishable from a send nobody made.
    const row = db().query(`select kind, ok, error from newsletter_sends order by id desc limit 1`)
      .get() as { kind: string; ok: number; error: string } | null
    expect(row).toMatchObject({ kind: 'test', ok: 0, error: 'smtp_off' })
  })

  /**
   * ⚠️ A SAFETY SWITCH THAT FAILS OPEN IS NOT A SAFETY SWITCH. The first cut read `=== '1'`,
   * which means `SMTP_OFF=true` — written by somebody who believed they had turned mail off —
   * sends the newsletter. Anything present and not an explicit denial means OFF.
   */
  it('stops mail for ANY value that is not an explicit denial', async () => {
    await saveSmtpConfig(working)
    for (const value of ['1', 'true', 'yes', 'on', 'TRUE', ' 1 ']) {
      process.env.SMTP_OFF = value
      expect(`SMTP_OFF=${JSON.stringify(value)}: ${mailBlocked(await getSmtpConfig())}`)
        .toBe(`SMTP_OFF=${JSON.stringify(value)}: smtp_off`)
    }
    // And the ways to say "no, send" — including an empty value, so a `.env` line left blank
    // does not silence a working blog.
    for (const value of ['', '0', 'false', 'no', 'FALSE']) {
      process.env.SMTP_OFF = value
      expect(`SMTP_OFF=${JSON.stringify(value)}: ${mailBlocked(await getSmtpConfig())}`)
        .toBe(`SMTP_OFF=${JSON.stringify(value)}: null`)
    }
  })
})
