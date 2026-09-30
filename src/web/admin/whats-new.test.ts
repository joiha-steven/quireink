// The release note shows on an UPGRADED blog, never on a new one (FIXLIST 9.3).
import { describe, expect, it } from 'bun:test'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { adminT } from '@/i18n/admin-i18n'
import { APP_VERSION } from '@/version'
import { overlaysHtml } from '@/web/admin/overlays'

const t = adminT('en')
const note = (over: Partial<typeof DEFAULT_SETTINGS>): boolean =>
  overlaysHtml(t, { ...DEFAULT_SETTINGS, ...over }).includes('data-whats-new')

describe('what’s new', () => {
  it('stays away from a brand-new install, whose owner has seen no earlier version', () => {
    expect(note({ setupDone: false, seenRelease: '' })).toBe(false)
  })
  it('shows on a blog with history that has not seen this version, and not twice', () => {
    expect(note({ setupDone: true, seenRelease: '0.0.1' })).toBe(true)
    expect(note({ setupDone: true, seenRelease: APP_VERSION })).toBe(false)
  })
})
