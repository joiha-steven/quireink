// On Cloudflare the blog is a Worker on a Custom Domain, and a Worker's answers never go into the
// zone's CDN cache: there is nothing there to purge. The Server tab still offered the "Cloudflare
// cache" card, and a token pasted into it made every write purge everything else on the zone
// (2026-11-03). The card is not drawn there, and the zone is never purged.
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { saveIntegrationKeys, getIntegrationStatus } from '@/store/integration-keys'
import { purgeEdge } from '@/server/edge-cache'
import { cloudflareCard } from '@/web/admin/screens/settings-server-keys'
import { adminT } from '@/i18n/admin-i18n'

const DIR = './.tmp/test-edge-cache-cloudflare'
freshDatabase(DIR)
const before = process.env.QUIREINK_PACKAGE
const realFetch = globalThis.fetch
let calls: string[] = []
afterAll(() => {
  dropDatabase(DIR)
  if (before === undefined) delete process.env.QUIREINK_PACKAGE; else process.env.QUIREINK_PACKAGE = before
})
beforeEach(async () => {
  db().run(`delete from integration_keys`)
  await saveIntegrationKeys({ cloudflareApiToken: 'token', cloudflareZoneId: 'zone' })
  calls = []
  globalThis.fetch = (async (url: string | URL | Request) => { calls.push(String(url)); return new Response('{}') }) as typeof fetch
})
afterEach(() => { globalThis.fetch = realFetch })

describe('the Cloudflare cache on a blog that runs on Cloudflare', () => {
  it('is never purged, and its card is not drawn', async () => {
    process.env.QUIREINK_PACKAGE = 'cloudflare'
    expect(await purgeEdge()).toBe('skipped')
    expect(calls).toEqual([])
    expect(cloudflareCard(adminT('en'), await getIntegrationStatus())).toBe('')
  })

  it('is purged on a server behind Cloudflare, as before', async () => {
    process.env.QUIREINK_PACKAGE = 'docker'
    expect(await purgeEdge()).toBe('ok')
    expect(calls.some((u) => u.endsWith('/zone/purge_cache'))).toBe(true)
    expect(cloudflareCard(adminT('en'), await getIntegrationStatus())).not.toBe('')
  })
})
