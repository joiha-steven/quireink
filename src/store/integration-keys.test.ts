// Server-only secrets. Two behaviours matter and neither is visible from the call site:
// a partial save must not wipe the keys it did not mention, and the client-safe view must
// never carry a secret.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import {
  getIntegrationKeys, getIntegrationStatus, saveIntegrationKeys,
} from '@/store/integration-keys'
import { AI_PROVIDERS, seesImages } from '@/server/ai-capabilities'

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

describe('the purge webhook (ADR 0033)', () => {
  it('is unset until somebody sets it, and then reports configured without leaking it', async () => {
    expect((await getIntegrationStatus()).purgeWebhookConfigured).toBe(false)
    await saveIntegrationKeys({ purgeWebhookUrl: 'https://cdn.example.com/purge?key=abc123' })
    const status = await getIntegrationStatus()
    expect(status.purgeWebhookConfigured).toBe(true)
    // The URL carries a token; the client-safe view must not contain it anywhere.
    expect(JSON.stringify(status)).not.toContain('abc123')
  })

  it('holds the offsite sextet, and configured needs bucket + both keys', async () => {
    const { getIntegrationStatus } = await import('@/store/integration-keys')
    await saveIntegrationKeys({ s3Bucket: 'quire-backups', s3AccessKeyId: 'AKIA123' })
    expect((await getIntegrationStatus()).offsiteConfigured).toBe(false) // no secret yet
    await saveIntegrationKeys({ s3SecretAccessKey: 'shh', s3Endpoint: 'https://acc.r2.cloudflarestorage.com' })
    const status = await getIntegrationStatus()
    expect(status.offsiteConfigured).toBe(true)
    expect(status.s3Bucket).toBe('quire-backups')
    // The secret never travels in the status payload.
    expect(JSON.stringify(status)).not.toContain('shh')
  })

  it('survives a blank save, like every other write-to-set key', async () => {
    await saveIntegrationKeys({ purgeWebhookUrl: 'https://cdn.example.com/purge' })
    await saveIntegrationKeys({ cloudflareZoneId: 'zone' })
    expect((await getIntegrationKeys()).purgeWebhookUrl).toBe('https://cdn.example.com/purge')
  })
})

describe('getIntegrationKeys', () => {
  it('returns empty strings when nothing is stored and no env var is set', async () => {
    expect(await getIntegrationKeys()).toEqual({
      turnstileSiteKey: '', turnstileSecretKey: '', cloudflareApiToken: '', cloudflareZoneId: '',
      purgeWebhookUrl: '', s3Endpoint: '', s3Region: '', s3Bucket: '', s3Prefix: '',
      s3AccessKeyId: '', s3SecretAccessKey: '', googleClientId: '', googleClientSecret: '',
      aiProvider: '', aiApiKey: '', aiModel: '',
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
      purgeWebhookConfigured: false,
      offsiteConfigured: false, s3Bucket: '',
      googleConfigured: false,
      aiConfigured: false, aiProvider: '', aiModel: '', aiSeesImages: false,
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

describe('the provider list, all the way down', () => {
  // THE TEST THAT WAS MISSING. The list of AI providers lived in four places — the model
  // table, the admin menu, the two key routes, and a CHECK constraint in schema.sql — and
  // only the first three were widened for a fourth. Typecheck passed, nine static guards
  // passed, 2485 tests passed, and the feature was refused by SQLite at the one moment a
  // key was actually saved. Nothing static can see a CHECK; only a real write can.
  //
  // So this walks the whole set rather than naming anyone: a fifth provider is covered the
  // day it is added, and a schema nobody widened fails here instead of in someone's admin.
  it('saves and reads back every provider this build offers', async () => {
    for (const provider of AI_PROVIDERS) {
      await saveIntegrationKeys({ aiProvider: provider, aiApiKey: 'k', aiModel: '' })
      expect(`${provider} stored`).toBe(`${(await getIntegrationKeys()).aiProvider} stored`)
    }
  })

  it('still refuses a name that is not on the list', async () => {
    // The constraint is not decoration: a typo in AI_PROVIDER would otherwise sit in the
    // row and turn every AI job into a silent no-op.
    await saveIntegrationKeys({ aiProvider: 'anthropic', aiApiKey: 'k' })
    expect(saveIntegrationKeys({ aiProvider: 'not-a-provider' })).rejects.toThrow()
    expect((await getIntegrationKeys()).aiProvider).toBe('anthropic')
  })

  it('reports whether the stored model can be shown a picture', async () => {
    await saveIntegrationKeys({ aiProvider: 'deepseek', aiApiKey: 'k', aiModel: 'deepseek-v4-flash' })
    expect((await getIntegrationStatus()).aiSeesImages).toBe(false)
    await saveIntegrationKeys({ aiModel: 'deepseek-v4-flash-vision-exp' })
    expect((await getIntegrationStatus()).aiSeesImages).toBe(true)
    // Same provider, same key, opposite answer — which is the whole point of asking the
    // model rather than the provider.
    expect(seesImages('deepseek', 'deepseek-v4-flash')).toBe(false)
  })
})
