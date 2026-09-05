import { describe, expect, test } from 'bun:test'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { changedSettingPaths, describeSettingsSave, isNavOrderOnly } from '@/content/settings-diff'
import type { SiteSettings } from '@/types'

/** A settings object with one thing moved, without mutating the defaults. */
const withChange = (patch: Partial<typeof DEFAULT_SETTINGS>) =>
  ({ ...structuredClone(DEFAULT_SETTINGS), ...patch })

describe('changedSettingPaths', () => {
  test('a save that moved nothing lists nothing', () => {
    expect(changedSettingPaths(DEFAULT_SETTINGS, structuredClone(DEFAULT_SETTINGS))).toEqual([])
  })

  test('a top-level value is named by its own key', () => {
    const after = withChange({ title: 'A new name' })
    expect(changedSettingPaths(DEFAULT_SETTINGS, after)).toEqual(['title'])
  })

  test('a value inside a group is named one level in', () => {
    const after = structuredClone(DEFAULT_SETTINGS)
    after.comments.enabled = !after.comments.enabled
    // The group alone would say about as little as saying nothing.
    expect(changedSettingPaths(DEFAULT_SETTINGS, after)).toEqual(['comments.enabled'])
  })

  test('an array is one change, not one per element', () => {
    const after = structuredClone(DEFAULT_SETTINGS)
    after.menu = [...after.menu, { label: 'About', href: '/about' }]
    expect(changedSettingPaths(DEFAULT_SETTINGS, after)).toEqual(['menu'])
  })

  test('several changes come back sorted, so two saves read alike', () => {
    const after = structuredClone(DEFAULT_SETTINGS)
    after.title = 'x'
    after.description = 'y'
    expect(changedSettingPaths(DEFAULT_SETTINGS, after)).toEqual(['description', 'title'])
  })
})

describe('describeSettingsSave', () => {
  test('a save that moved nothing says so rather than going in blank', () => {
    // The blank detail is the thing this module exists to stop.
    expect(describeSettingsSave(DEFAULT_SETTINGS, structuredClone(DEFAULT_SETTINGS)))
      .toBe('no change')
  })

  test('it names what moved', () => {
    expect(describeSettingsSave(DEFAULT_SETTINGS, withChange({ title: 'x' }))).toBe('title')
  })

  test('past five it starts counting instead of running off the row', () => {
    const after = structuredClone(DEFAULT_SETTINGS)
    after.title = 'a'
    after.description = 'b'
    after.footer = 'c'
    after.language = after.language === 'en' ? 'vi' : 'en'
    after.postsPerPage += 1
    after.excerptLength += 1
    after.relatedCount += 1
    const line = describeSettingsSave(DEFAULT_SETTINGS, after)
    expect(line).toContain('+2')
    expect(line.split(', ').length).toBe(5)
  })
})

describe('isNavOrderOnly', () => {
  const withNav = (nav: SiteSettings['navOrder']) => ({ ...structuredClone(DEFAULT_SETTINGS), navOrder: nav })

  test('a drag in the sidebar stays out of the ledger', () => {
    const after = withNav({ primary: ['write', 'home'], more: [], footer: [], hidden: [] })
    expect(isNavOrderOnly(DEFAULT_SETTINGS, after)).toBe(true)
  })

  test('hiding the logo is the same kind of change', () => {
    const after = withNav({ primary: [], more: [], footer: [], hidden: ['logo'] })
    expect(isNavOrderOnly(DEFAULT_SETTINGS, after)).toBe(true)
  })

  test('a real settings change is still logged, even alongside a rail move', () => {
    const after = { ...withNav({ primary: ['write', 'home'], more: [], footer: [], hidden: [] }), title: 'New name' }
    expect(isNavOrderOnly(DEFAULT_SETTINGS, after)).toBe(false)
  })

  test('a save that moved nothing is not a nav-order save', () => {
    expect(isNavOrderOnly(DEFAULT_SETTINGS, structuredClone(DEFAULT_SETTINGS))).toBe(false)
  })
})
