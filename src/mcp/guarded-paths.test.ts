// The settings a connector may not reach, and the one shape of call that reaches them.
//
// This is a list of four strings, which is exactly why it needs a test: the whole rule is
// that the list matches what it says it matches. A prefix that matched too widely would take
// a working tool away from every connector and nothing would say why; one that matched too
// narrowly would leave the hole it was written to close.
import { describe, expect, it } from 'bun:test'
import { ADMIN_ONLY_SETTINGS, isAdminOnlyPath, refusalFor } from '@/mcp/guarded-paths'

describe('the guarded settings paths', () => {
  it('names the four that put markup on a public page or move the site', () => {
    expect([...ADMIN_ONLY_SETTINGS].sort())
      .toEqual(['customBodyEnd', 'customCss', 'customHead', 'siteUrl'])
  })

  it('matches a guarded path and anything under it', () => {
    for (const p of ADMIN_ONLY_SETTINGS) {
      expect(`${p}: ${isAdminOnlyPath(p)}`).toBe(`${p}: true`)
      expect(`${p}.x: ${isAdminOnlyPath(`${p}.x`)}`).toBe(`${p}.x: true`)
    }
    expect(isAdminOnlyPath('  customHead  ')).toBe(true)
  })

  it('does not match a path that merely ends in one of the names', () => {
    // The failure this forbids is a `startsWith` on the wrong end: `typography.customCss` is
    // not a setting today, and the day something like it exists it must not be swept up.
    expect(isAdminOnlyPath('typography.customCss')).toBe(false)
    expect(isAdminOnlyPath('customHeading')).toBe(false)
    expect(isAdminOnlyPath('features.search')).toBe(false)
    expect(isAdminOnlyPath('')).toBe(false)
  })
})

describe('the refusal', () => {
  it('stops update_settings on a guarded path and names what to do instead', () => {
    const out = refusalFor('update_settings', { path: 'customHead', value: '<script>x</script>' })
    expect(out).toContain('customHead')
    // It is talking to a model, so it has to say "do not retry" out loud; a bare failure is
    // a thing to try again with a different phrasing.
    expect(out).toContain('Do not retry')
  })

  it('leaves every other path and every other tool alone', () => {
    expect(refusalFor('update_settings', { path: 'features.search', value: false })).toBeNull()
    // The older shorthand arguments carry no path, so there is nothing to guard.
    expect(refusalFor('update_settings', { title: 'A new title' })).toBeNull()
    // Its inputs are enums of the owner's own menu options; nothing free-form gets through.
    expect(refusalFor('update_appearance', { palette: 'ocean' })).toBeNull()
    expect(refusalFor('create_post', { title: 'customHead' })).toBeNull()
  })
})
