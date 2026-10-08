// `<html data-tz>` is the zone the island prints in, so it is the EFFECTIVE zone: the setting,
// else `ANALYTICS_TZ`, else UTC. Never empty (`analytics/types.ts: siteZone`).
import { afterAll, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { adminShell } from '@/web/admin/spa'

const DIR = './.tmp/test-spa-zone'
freshDatabase(DIR)
const WAS = process.env.ANALYTICS_TZ
afterAll(() => {
  dropDatabase(DIR)
  if (WAS === undefined) delete process.env.ANALYTICS_TZ
  else process.env.ANALYTICS_TZ = WAS
})

const tzOf = async (timezone: string): Promise<string | undefined> =>
  /<html[^>]* data-tz="([^"]*)"/.exec(await adminShell({ ...DEFAULT_SETTINGS, timezone }, '/admin'))?.[1]

describe('<html data-tz>', () => {
  it('carries the setting', async () => {
    process.env.ANALYTICS_TZ = 'Europe/Paris'
    expect(await tzOf('Asia/Ho_Chi_Minh')).toBe('Asia/Ho_Chi_Minh')
  })

  it('carries ANALYTICS_TZ when the setting is empty', async () => {
    process.env.ANALYTICS_TZ = 'Europe/Paris'
    expect(await tzOf('')).toBe('Europe/Paris')
  })

  it('is UTC, not empty, when neither is set', async () => {
    delete process.env.ANALYTICS_TZ
    expect(await tzOf('')).toBe('UTC')
  })
})
