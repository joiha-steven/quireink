// The empty choice of the site's timezone said "Same as the server". It is not: an empty setting
// is ANALYTICS_TZ, then UTC, and never the machine's own zone (`i18n/format.ts` `siteZone`), so a
// server set to Vietnamese time with this left empty dated every post in UTC, and on Cloudflare
// there is no server to be the same as (2026-11-03). The option now names the zone it means.
import { afterAll, describe, expect, it } from 'bun:test'
import { blogTab } from './settings-blog'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'

const before = process.env.ANALYTICS_TZ
afterAll(() => { if (before === undefined) delete process.env.ANALYTICS_TZ; else process.env.ANALYTICS_TZ = before })
const empty = () => /<option value=""[^>]*>([^<]*)<\/option>/.exec(blogTab(adminT('en'), { ...DEFAULT_SETTINGS, timezone: '' }))?.[1]

describe('the timezone left empty', () => {
  it('names UTC when the server was given no zone', () => {
    delete process.env.ANALYTICS_TZ
    expect(empty()).toBe('Not chosen: UTC')
  })

  it('names the zone the server was given', () => {
    process.env.ANALYTICS_TZ = 'Asia/Tokyo'
    expect(empty()).toBe('Not chosen: Asia/Tokyo')
  })
})

// V8 lists only the zones of places, so on Cloudflare the list had no UTC to pick, the one zone that
// is never wrong; a saved UTC still showed only because a stored value is always offered (2026-11-03).
describe('the zone list', () => {
  it('offers UTC on an engine that leaves it out', () => {
    const real = Intl.supportedValuesOf
    Intl.supportedValuesOf = ((key: 'timeZone') => real(key).filter((z) => z !== 'UTC')) as typeof real
    try {
      const html = blogTab(adminT('en'), { ...DEFAULT_SETTINGS, timezone: 'Asia/Tokyo' })
      expect(html).toContain('<option value="UTC"')
    } finally {
      Intl.supportedValuesOf = real
    }
  })
})
