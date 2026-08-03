// Server-only secrets. Two behaviours matter and neither is visible from the call site:
// a partial save must not wipe the keys it did not mention, and the client-safe view must
// never carry a secret.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import {
  getIntegrationKeys, getIntegrationStatus, saveIntegrationKeys,
} from '@/store/integration-keys'

const DIR = './.tmp/test-integration-keys'
freshDatabase(DIR)
afterAll(() => {
  dropDatabase(DIR)
  delete process.env.TURNSTILE_SECRET_KEY
})

beforeEach(() => {
  db().run(`delete from integration_keys`)
  delete process.env.TURNSTILE_SECRET_KEY
})

describe('getIntegrationKeys', () => {
  it('returns empty strings when nothing is stored and no env var is set', async () => {
    expect(await getIntegrationKeys()).toEqual({
      turnstileSiteKey: '', turnstileSecretKey: '', cloudflareApiToken: '', cloudflareZoneId: '',
      googleClientId: '', googleClientSecret: '',
    })
  })

  it('falls back to the same-named env var, and the stored value wins over it', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'from-env'
    expect((await getIntegrationKeys()).turnstileSecretKey).toBe('from-env')
    await saveIntegrationKeys({ turnstileSecretKey: 'from-db' })
    expect((await getIntegrationKeys()).turnstileSecretKey).toBe('from-db')
  })
})

describe('saveIntegrationKeys', () => {
  it('trims input', async () => {
    await saveIntegrationKeys({ cloudflareZoneId: '  zone-1  ' })
    expect((await getIntegrationKeys()).cloudflareZoneId).toBe('zone-1')
  })

  it('leaves an unmentioned key untouched, and an empty string clears it', async () => {
    await saveIntegrationKeys({ turnstileSiteKey: 'site', turnstileSecretKey: 'secret' })
    await saveIntegrationKeys({ turnstileSiteKey: 'site-2' }) // secret not mentioned
    expect((await getIntegrationKeys()).turnstileSecretKey).toBe('secret')
    await saveIntegrationKeys({ turnstileSecretKey: '' })
    expect((await getIntegrationKeys()).turnstileSecretKey).toBe('')
  })

  it('clearing falls back to the env var again, which is what makes it a clear and not a set', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'from-env'
    await saveIntegrationKeys({ turnstileSecretKey: 'from-db' })
    await saveIntegrationKeys({ turnstileSecretKey: '' })
    expect((await getIntegrationKeys()).turnstileSecretKey).toBe('from-env')
  })
})

describe('getIntegrationStatus', () => {
  it('reports configured flags and the PUBLIC values, never a secret', async () => {
    await saveIntegrationKeys({
      turnstileSiteKey: 'site', turnstileSecretKey: 'secret',
      cloudflareApiToken: 'token', cloudflareZoneId: 'zone',
    })
    const status = await getIntegrationStatus()
    expect(status).toEqual({
      turnstileConfigured: true, turnstileSiteKey: 'site',
      cloudflareConfigured: true, cloudflareZoneId: 'zone',
      googleConfigured: false,
    })
    expect(JSON.stringify(status)).not.toContain('secret')
    expect(JSON.stringify(status)).not.toContain('token')
  })

  it('Cloudflare needs BOTH the token and the zone before it counts as configured', async () => {
    await saveIntegrationKeys({ cloudflareApiToken: 'token' })
    expect((await getIntegrationStatus()).cloudflareConfigured).toBe(false)
    await saveIntegrationKeys({ cloudflareZoneId: 'zone' })
    expect((await getIntegrationStatus()).cloudflareConfigured).toBe(true)
  })

  // Same reason as Cloudflare, different consequence: a client id with no secret gets the
  // reader all the way to Google's consent screen before failing on the way back.
  it('Google needs BOTH halves, and the status never carries the secret', async () => {
    await saveIntegrationKeys({ googleClientId: 'client-id.apps.googleusercontent.com' })
    expect((await getIntegrationStatus()).googleConfigured).toBe(false)
    await saveIntegrationKeys({ googleClientSecret: 'GOCSPX-not-a-real-one' })
    const status = await getIntegrationStatus()
    expect(status.googleConfigured).toBe(true)
    expect(JSON.stringify(status)).not.toContain('GOCSPX')
  })
})
