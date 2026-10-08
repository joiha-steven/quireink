// An island prints an instant on the SITE's clock (`<html data-tz>`), not the browser's.
// Captured by NAME before the test changes it: when TZ was unset, the zone the process was
// really running on. `delete process.env.TZ` would freeze the zone for every later file in the run.
const WAS = process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone
process.env.TZ = 'America/Los_Angeles'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { formatDateTimeShort } from '@/admin-shared/when'
import { pageStamp, pageZone } from './page-lang'

beforeAll(() => { GlobalRegistrator.register() })
afterAll(async () => {
  await GlobalRegistrator.unregister()
  process.env.TZ = WAS
})
afterEach(() => { delete document.documentElement.dataset.tz })

describe('pageStamp', () => {
  it('reads the site’s zone off the page, and the browser’s zone has no say', () => {
    document.documentElement.lang = 'en'
    document.documentElement.dataset.tz = 'Asia/Ho_Chi_Minh'
    // 02:00 UTC is 19:00 the day before in the zone this process runs on.
    expect(new Date('2026-10-19T02:00:00.000Z').getHours()).toBe(19)
    expect(pageZone()).toBe('Asia/Ho_Chi_Minh')
    expect(pageStamp('2026-10-19T02:00:00.000Z')).toBe(formatDateTimeShort('2026-10-19T09:00', 'en'))
  })

  it('is UTC when the page names no zone, as the setting is everywhere else', () => {
    document.documentElement.lang = 'en'
    expect(pageStamp('2026-10-19T02:00:00.000Z')).toBe(formatDateTimeShort('2026-10-19T02:00', 'en'))
  })
})
