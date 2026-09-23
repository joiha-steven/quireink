import { describe, expect, test } from 'bun:test'
import { INK_NAME, STYLES_NAME, staleSheet } from '@/web/admin/spa'

// The admin drew with NO STYLESHEET when a tab outlived the release its shell came from: the
// shell asked for `admin.<old fingerprint>.css`, the route had only this build's name and the
// bare one, and answered 404. Both wordmark shapes then drew side by side, which is what the
// sheet's `#admin-rail .rail-mark` rule exists to prevent. Reported by eye, 2026-09-19.
//
// The name is all this decides, so the name is what the test asks about: the route's other
// half reads the build directory, which a fresh checkout does not have.
describe('a sheet name from an earlier release', () => {
  test('an old fingerprint is served the current sheet', () => {
    expect(staleSheet('admin.deadbeef99.css')).toBe(true)
    expect(staleSheet('admin.7x2k9qm4v1p0z.css')).toBe(true)
  })

  test("this build's own name is not one: it still promises immutable bytes", () => {
    expect(staleSheet(STYLES_NAME)).toBe(false)
  })

  test('the bare name is not one: it already resolves, and it revalidates', () => {
    expect(staleSheet('admin.css')).toBe(false)
  })

  test('nothing else is a sheet name', () => {
    // The entry and the chunks carry the bundler's own hash and must keep answering under it.
    expect(staleSheet('entry.a1b2c3d4.js')).toBe(false)
    expect(staleSheet('sheet.82w3m783.js')).toBe(false)
    // A name is a name, never a path: `readdirSync` filled the map with plain file names.
    expect(staleSheet('admin.../../../etc/passwd.css')).toBe(false)
    expect(staleSheet('admin.a-b.css')).toBe(false)
  })
})

// The pen has had a sheet of its own since 2026-09-23, linked only on the writing screens, and
// the same rule holds for it: an old tab on the editor asks for last release's pen by name.
describe('the pen sheet, by the same rule', () => {
  test('an old fingerprint of the pen is stale, and this build\'s is not', () => {
    expect(staleSheet('admin-ink.deadbeef99.css')).toBe(true)
    expect(staleSheet(INK_NAME)).toBe(false)
  })

  test('the two names never answer for each other', () => {
    expect(INK_NAME.startsWith('admin-ink.')).toBe(true)
    expect(STYLES_NAME.startsWith('admin.')).toBe(true)
    expect(staleSheet('admin-ink.a-b.css')).toBe(false)
  })
})
