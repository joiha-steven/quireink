// The log's count reads "1 entry" and "163 entries", not "163 · activity log" (2026-09-30).
import { afterAll, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { adminT } from '@/i18n/admin-i18n'
import { logActivity } from '@/server/activity'
import { logScreen } from '@/web/admin/screens/log'

const DIR = './.tmp/test-log-count'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const count = (html: string): string => /data-log-count[^>]*>([^<]*)</.exec(html)?.[1] ?? ''

describe('the log count', () => {
  it('is a number with its noun in the language’s own plural', async () => {
    const settings = { ...DEFAULT_SETTINGS, features: { ...DEFAULT_SETTINGS.features, activityLog: true } }
    await logActivity('cache.clear')
    expect(count(await logScreen(settings))).toBe('1 entry')
    await logActivity('cache.clear')
    expect(count(await logScreen(settings))).toBe('2 entries')
    const ru = await logScreen({ ...settings, language: 'ru' })
    expect(count(ru)).toBe('2 записи')
    expect(ru).toContain(`data-tpl="${adminT('ru').logEntries}"`)
  })
})
